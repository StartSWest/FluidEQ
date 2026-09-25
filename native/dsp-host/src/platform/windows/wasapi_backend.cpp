/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Shared-mode WASAPI render, which is to say: an ordinary application.
 *
 * Nothing here is privileged and nothing is installed. WASAPI is a user-mode
 * COM API that ships with Windows, `ole32` and `avrt` are already on every
 * machine, and this process opens the default endpoint exactly the way any
 * media player does. Equalizer APO lives further down, inside the endpoint's
 * own processing chain, so audio written here passes through it afterwards —
 * the same relationship the Web Audio path already has, unchanged.
 *
 * Exclusive mode is deliberately not used. It would take the endpoint away
 * from every other application on the machine, which for a system equaliser
 * is precisely backwards.
 */

#include "../../audio_backend.h"

#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <thread>
#include <vector>

#ifndef NOMINMAX
#define NOMINMAX
#endif
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <audioclient.h>
#include <audiopolicy.h>
#include <avrt.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>

using Microsoft::WRL::ComPtr;

namespace {

/**
 * The failure, and the code the system gave for it.
 *
 * "the output device refused to activate" says which call failed; `0x8889000A`
 * says the device is already in exclusive use by another application, and
 * `0x88890004` says it was unplugged. Those are different problems with
 * different answers, and without the code a support report cannot tell them
 * apart — the message alone sends everybody down the same wrong path.
 *
 * Hex because every Microsoft page documenting an `AUDCLNT_E_` value writes it
 * that way, so the number can be pasted into a search and found.
 */
std::string with_code(const char* what, HRESULT result) {
  char buffer[160];
  std::snprintf(buffer, sizeof(buffer), "%s (0x%08lX)", what,
                static_cast<unsigned long>(result));
  return std::string(buffer);
}

/**
 * How much buffer to ask the engine for, in 100-nanosecond units.
 *
 * Shared mode treats this as a hint and the endpoint's own period usually
 * wins, so it is not a latency setting so much as a floor. Thirty milliseconds
 * is generous on purpose: this backend has no decoder feeding it yet, and a
 * bring-up that also fights for the smallest possible buffer is a bring-up
 * where an underrun could be either problem.
 */
constexpr REFERENCE_TIME kRequestedBufferDuration = 300000;

/** Does this mix format carry 32-bit floats, which is all this path writes? */
bool is_float32(const WAVEFORMATEX* format) {
  if (format == nullptr) {
    return false;
  }
  if (format->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) {
    return format->wBitsPerSample == 32;
  }
  if (format->wFormatTag == WAVE_FORMAT_EXTENSIBLE) {
    const auto* extensible =
        reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(format);
    return format->wBitsPerSample == 32 &&
           extensible->SubFormat == KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;
  }
  return false;
}

/**
 * What the backend is told about, from the three places that tell it.
 *
 * Every one of them arrives on a thread that is not the host's — a COM
 * notification thread, the service manager's APC, the device's session — and
 * every answer is the same: raise a flag and wake the host, which does the
 * work on its own thread. Nothing is torn down from inside a notification
 * about the thing being torn down.
 */
class IOutputsListener {
 public:
  virtual ~IOutputsListener() = default;
  /** Windows moved the default render endpoint. */
  virtual void heard_default_changed() = 0;
  /** An endpoint was added, removed, enabled, disabled or changed. */
  virtual void heard_outputs_changed() = 0;
  /** The stream playing now was cut off, or Windows audio went away. */
  virtual void heard_stream_lost() = 0;
};

/**
 * Told when Windows changes anything about the render endpoints.
 *
 * Without this the host opens the default endpoint once and writes to it
 * forever. Switching output — speakers to headphones, a monitor unplugged —
 * leaves the stream pointed at the device nobody is listening to any more, and
 * WASAPI does not object: the old endpoint is still perfectly valid, so nothing
 * fails and nothing is reported. The `<audio>` element path follows the default
 * on its own, which is why only the native engine went quiet.
 *
 * The other notices matter while no stream is open. An output that failed to
 * open — unplugged, re-enumerating, held by another program — is tried again
 * when anything about the outputs changes, which is when it may have come
 * back; it used to be tried forty times a second until it did.
 */
class EndpointWatcher final : public IMMNotificationClient {
 public:
  explicit EndpointWatcher(IOutputsListener& listener) : listener_(listener) {}

  // IUnknown. Not reference counted in any meaningful way: this object is owned
  // by the backend and outlives every callback by construction, because the
  // backend unregisters before it destroys itself.
  ULONG STDMETHODCALLTYPE AddRef() override { return 1; }
  ULONG STDMETHODCALLTYPE Release() override { return 1; }
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid,
                                           void** object) override {
    if (object == nullptr) {
      return E_POINTER;
    }
    if (riid == __uuidof(IUnknown) || riid == __uuidof(IMMNotificationClient)) {
      *object = static_cast<IMMNotificationClient*>(this);
      return S_OK;
    }
    *object = nullptr;
    return E_NOINTERFACE;
  }

  HRESULT STDMETHODCALLTYPE OnDefaultDeviceChanged(EDataFlow flow, ERole role,
                                                   LPCWSTR) override {
    // Render only, and only the role this backend opened with. A capture
    // device changing, or the communications default moving, is not this
    // stream's business and reopening for it would interrupt playback for
    // something the listener did not do.
    if (flow == eRender && role == eConsole) {
      listener_.heard_default_changed();
    }
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE OnDeviceStateChanged(LPCWSTR, DWORD) override {
    listener_.heard_outputs_changed();
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnDeviceAdded(LPCWSTR) override {
    listener_.heard_outputs_changed();
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnDeviceRemoved(LPCWSTR) override {
    listener_.heard_outputs_changed();
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnPropertyValueChanged(LPCWSTR,
                                                   const PROPERTYKEY) override {
    listener_.heard_outputs_changed();
    return S_OK;
  }

 private:
  IOutputsListener& listener_;
};

/**
 * Told when the stream playing now has been cut off.
 *
 * The render loop used to find that out by waiting two seconds for a period
 * that did not come — two full buffers of silence, guessed as long enough to
 * mean dead rather than slow. Windows says it outright: the device was
 * removed, its format was changed in Sound settings, Windows audio stopped,
 * the session was logged off, or another program took the device in
 * exclusive mode. Each of those is a reason to reopen, and none of them sends
 * another period.
 */
class SessionWatcher final : public IAudioSessionEvents {
 public:
  explicit SessionWatcher(IOutputsListener& listener) : listener_(listener) {}

  ULONG STDMETHODCALLTYPE AddRef() override { return 1; }
  ULONG STDMETHODCALLTYPE Release() override { return 1; }
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid,
                                           void** object) override {
    if (object == nullptr) {
      return E_POINTER;
    }
    if (riid == __uuidof(IUnknown) || riid == __uuidof(IAudioSessionEvents)) {
      *object = static_cast<IAudioSessionEvents*>(this);
      return S_OK;
    }
    *object = nullptr;
    return E_NOINTERFACE;
  }

  HRESULT STDMETHODCALLTYPE
  OnSessionDisconnected(AudioSessionDisconnectReason) override {
    listener_.heard_stream_lost();
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE OnDisplayNameChanged(LPCWSTR, LPCGUID) override {
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnIconPathChanged(LPCWSTR, LPCGUID) override {
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnSimpleVolumeChanged(float, BOOL,
                                                  LPCGUID) override {
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnChannelVolumeChanged(DWORD, float*, DWORD,
                                                   LPCGUID) override {
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnGroupingParamChanged(LPCGUID,
                                                   LPCGUID) override {
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnStateChanged(AudioSessionState) override {
    return S_OK;
  }

 private:
  IOutputsListener& listener_;
};

/**
 * One of Windows' audio services, and whether it left or came back.
 *
 * Touched only on the watch thread: the service manager's callback is an APC,
 * run inside that thread's own alertable wait. The same watch the output
 * helper keeps (`native/output-watch`), for the same reason: when
 * AudioEndpointBuilder restarts, a registered endpoint callback goes with it
 * and no notice ever arrives again, and when Audiosrv stops, every stream on
 * the machine stops with it.
 */
struct ServiceWatch {
  SC_HANDLE service = nullptr;
  SERVICE_NOTIFYW notify{};
  bool is_running = false;
  bool is_armed = false;
  bool came_back = false;
  bool went_down = false;
  /** The service manager said it can no longer tell this watch anything. */
  bool has_failed = false;
};

constexpr const wchar_t* kAudioServices[2] = {L"AudioEndpointBuilder",
                                             L"Audiosrv"};

VOID CALLBACK on_service_changed(PVOID parameter) {
  auto* notify = static_cast<SERVICE_NOTIFYW*>(parameter);
  auto* watch = static_cast<ServiceWatch*>(notify->pContext);
  watch->is_armed = false;
  if (notify->dwNotificationStatus != ERROR_SUCCESS) {
    watch->has_failed = true;
    return;
  }
  const bool is_running =
      notify->ServiceStatus.dwCurrentState == SERVICE_RUNNING;
  if (is_running && !watch->is_running) {
    watch->came_back = true;
  }
  if (!is_running && watch->is_running) {
    watch->went_down = true;
  }
  watch->is_running = is_running;
}

/**
 * Ask to be told when the service leaves the state it is in — only the other
 * states, because the service manager answers at once for the state a service
 * is already in, and asking a running service to say when it runs would
 * answer on every wait, for ever. A watch the manager gave up on, or refuses
 * to arm, is opened again from `manager`; false only when that fails too.
 */
bool arm(ServiceWatch& watch, SC_HANDLE manager, const wchar_t* name) {
  if (watch.is_armed) {
    return true;
  }
  if (watch.service != nullptr && watch.has_failed) {
    CloseServiceHandle(watch.service);
    watch.service = nullptr;
  }
  for (int attempt = 0; attempt < 2; ++attempt) {
    if (watch.service == nullptr) {
      watch.has_failed = false;
      watch.service = OpenServiceW(manager, name, SERVICE_QUERY_STATUS);
      if (watch.service == nullptr) {
        return false;
      }
      SERVICE_STATUS status{};
      if (!QueryServiceStatus(watch.service, &status)) {
        CloseServiceHandle(watch.service);
        watch.service = nullptr;
        return false;
      }
      watch.is_running = status.dwCurrentState == SERVICE_RUNNING;
    }
    watch.notify = SERVICE_NOTIFYW{};
    watch.notify.dwVersion = SERVICE_NOTIFY_STATUS_CHANGE;
    watch.notify.pfnNotifyCallback = on_service_changed;
    watch.notify.pContext = &watch;
    const DWORD states =
        watch.is_running
            ? SERVICE_NOTIFY_STOPPED | SERVICE_NOTIFY_STOP_PENDING |
                  SERVICE_NOTIFY_START_PENDING | SERVICE_NOTIFY_PAUSED |
                  SERVICE_NOTIFY_PAUSE_PENDING |
                  SERVICE_NOTIFY_CONTINUE_PENDING
            : SERVICE_NOTIFY_RUNNING;
    if (NotifyServiceStatusChangeW(watch.service, states, &watch.notify) ==
        ERROR_SUCCESS) {
      watch.is_armed = true;
      return true;
    }
    // Refused — a client too slow to be told, or a service being deleted.
    // Once more on a fresh handle, then given up.
    CloseServiceHandle(watch.service);
    watch.service = nullptr;
  }
  return false;
}

class WasapiBackend final : public IAudioOutputBackend,
                            private IOutputsListener {
 public:
  WasapiBackend(FeqRenderFn render, void* context, FeqWake* changes)
      : render_(render), context_(context), changes_(changes) {
    // For the backend's whole life, not a stream's: an output that is not
    // there to open is exactly when somebody has to be listening for it.
    watch_stop_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (watch_stop_ != nullptr) {
      watch_thread_ = std::thread([this] { watch(); });
    }
  }

  ~WasapiBackend() override {
    close();
    if (watch_thread_.joinable()) {
      SetEvent(watch_stop_);
      watch_thread_.join();
    }
    if (watch_stop_ != nullptr) {
      CloseHandle(watch_stop_);
    }
  }

  bool open(FeqBackendFormat& negotiated, std::string& error) override {
    if (is_open()) {
      negotiated = format_;
      return true;
    }
    // Cleared per attempt, not per process: a machine can gain an endpoint
    // between two opens — plugging in a USB DAC is exactly that — and a latched
    // answer would keep reporting the silence it found the first time.
    endpoint_absent_ = false;
    changed_while_opening_.store(false, std::memory_order_release);
    opening_.store(true, std::memory_order_release);
    if (!prepare(error)) {
      teardown();
      // Waiting for the outputs to change BEFORE this attempt stops counting
      // as one, so a notice arriving in between is heard by one or the other.
      awaiting_.store(true, std::memory_order_release);
      opening_.store(false, std::memory_order_release);
      if (changed_while_opening_.exchange(false, std::memory_order_acq_rel)) {
        // Something changed while this attempt failed: it may be what failed
        // it, so the next attempt is due now rather than at the next notice.
        raise_reopen();
      }
      return false;
    }
    negotiated = format_;
    open_.store(true, std::memory_order_release);
    awaiting_.store(false, std::memory_order_release);
    opening_.store(false, std::memory_order_release);
    return true;
  }

  bool endpoint_absent() const override { return endpoint_absent_; }

  bool start(std::string& error) override {
    if (!is_open()) {
      error = "the device was not opened";
      return false;
    }
    if (is_running()) {
      return true;
    }
    stop_.store(false, std::memory_order_release);
    running_.store(true, std::memory_order_release);
    thread_ = std::thread([this] { run(); });
    return true;
  }

  void close() override {
    // Closed on purpose, so nothing is waited for: a STOP is not an outage.
    awaiting_.store(false, std::memory_order_release);
    const bool was_running = running_.exchange(false, std::memory_order_acq_rel);
    if (!open_.exchange(false, std::memory_order_acq_rel) && !was_running) {
      teardown();
      return;
    }
    stop_.store(true, std::memory_order_release);
    if (event_ != nullptr) {
      // Wake the thread, which otherwise waits for the device's next period —
      // for good, if the stream has been cut off. A stop that takes a full
      // period to be noticed is a stop somebody can hear as a tail.
      SetEvent(event_);
    }
    if (thread_.joinable()) {
      thread_.join();
    }
    teardown();
  }

  bool is_open() const override { return open_.load(std::memory_order_acquire); }

  bool is_running() const override {
    return running_.load(std::memory_order_acquire);
  }

  FeqBackendStats stats() const override {
    FeqBackendStats copy;
    copy.underruns = underruns_.load(std::memory_order_relaxed);
    copy.periods = periods_.load(std::memory_order_relaxed);
    copy.buffer_frames = buffer_frames_;
    return copy;
  }

  /**
   * Has the endpoint this stream is writing to stopped being the right one?
   *
   * Set by the default-device notification, by the stream's own session when
   * it is cut off, by Windows audio stopping, by the render loop when a call
   * fails under it — a device that was removed fails its next call and the
   * loop exits, which was previously silent — and, while an open is waited
   * for, by any change to the outputs. Every one of them wakes the host.
   */
  bool needs_reopen() const override {
    return reopen_.load(std::memory_order_acquire);
  }

  void clear_reopen() override {
    reopen_.store(false, std::memory_order_release);
  }

  const char* name() const override { return "wasapi-shared"; }
  std::string endpoint_guid() const override { return endpoint_guid_; }

 private:
  /**
   * Pretend this machine has no endpoint, so the silent-machine path can be
   * tested on a machine that has one.
   *
   * `smoke-native-dsp.ts` uses it as the positive control for its own skip: a
   * branch that only ever runs on a build agent is a branch nobody has run,
   * and the whole point of the skip is that it must not be reachable by
   * accident. Deliberately not a build flag — the binary under test has to be
   * the binary that ships, or the control proves something about a different
   * program.
   */
  static bool forced_absent() {
    size_t length = 0;
    char value[8] = {};
    if (getenv_s(&length, value, sizeof(value),
                 "FLUIDEQ_DSP_NO_ENDPOINT") != 0) {
      return false;
    }
    return length > 0 && value[0] == '1';
  }

  bool prepare(std::string& error) {
    // Apartment-agnostic on this thread; the render thread initialises its
    // own, because COM is per-thread and the interfaces are used from both.
    const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (com == RPC_E_CHANGED_MODE) {
      // Somebody already chose an apartment for this thread. That is fine —
      // it just means this call must not be the one that uninitialises it.
      owns_com_ = false;
    } else if (SUCCEEDED(com)) {
      owns_com_ = true;
    } else {
      error = "CoInitializeEx failed";
      return false;
    }

    ComPtr<IMMDeviceEnumerator> enumerator;
    const HRESULT created = CoCreateInstance(
        __uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
        IID_PPV_ARGS(&enumerator));
    if (FAILED(created)) {
      error = with_code("no audio endpoint enumerator", created);
      return false;
    }
    // A reopen asked for before this attempt is answered by it. Changes to
    // the outputs are heard by the watch thread (`watch`), for the backend's
    // whole life rather than a stream's.
    reopen_.store(false, std::memory_order_release);

    const HRESULT endpoint =
        forced_absent()
            ? HRESULT_FROM_WIN32(ERROR_NOT_FOUND)
            : enumerator->GetDefaultAudioEndpoint(eRender, eConsole, &device_);
    if (FAILED(endpoint)) {
      /**
       * `E_NOTFOUND` here means the machine has no render endpoint at all —
       * a build agent, a server, a session with the audio service stopped.
       * Every other failure is a device that exists and would not open, which
       * is a defect. `endpoint_absent` carries that distinction out.
       */
      endpoint_absent_ = endpoint == HRESULT_FROM_WIN32(ERROR_NOT_FOUND);
      error = with_code("no default output device", endpoint);
      return false;
    }
    endpoint_guid_.clear();
    LPWSTR device_id = nullptr;
    if (SUCCEEDED(device_->GetId(&device_id)) && device_id != nullptr) {
      const std::wstring id(device_id);
      CoTaskMemFree(device_id);
      const auto start = id.rfind(L'{');
      if (start != std::wstring::npos && id.size() - start == 38) {
        for (size_t at = start; at < id.size(); ++at) {
          if (id[at] > 127) { endpoint_guid_.clear(); break; }
          endpoint_guid_.push_back(static_cast<char>(id[at]));
        }
      }
    }
    const HRESULT activated = device_->Activate(
        __uuidof(IAudioClient), CLSCTX_ALL, nullptr, &client_);
    if (FAILED(activated)) {
      error = with_code("the output device refused to activate", activated);
      return false;
    }

    WAVEFORMATEX* mix = nullptr;
    if (FAILED(client_->GetMixFormat(&mix)) || mix == nullptr) {
      error = "the output device reported no mix format";
      return false;
    }
    const bool floats = is_float32(mix);
    const uint32_t rate = mix->nSamplesPerSec;
    const uint32_t channels = mix->nChannels;

    HRESULT initialised = E_FAIL;
    if (floats) {
      initialised = client_->Initialize(
          AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
          kRequestedBufferDuration, 0, mix, nullptr);
    }
    CoTaskMemFree(mix);
    if (!floats) {
      // Refused with a reason rather than converted silently. Every shared-mode
      // endpoint on a supported Windows mixes in float; one that does not is a
      // machine worth hearing about instead of quietly serving worse audio.
      error = "the output device does not mix in 32-bit float";
      return false;
    }
    if (FAILED(initialised)) {
      error =
          with_code("the output device refused the shared-mode format",
                    initialised);
      return false;
    }

    if (FAILED(client_->GetBufferSize(&buffer_frames_))) {
      error = "the output device reported no buffer size";
      return false;
    }
    event_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    if (event_ == nullptr) {
      error = "no render event could be created";
      return false;
    }
    if (FAILED(client_->SetEventHandle(event_))) {
      error = "the output device refused the render event";
      return false;
    }
    if (FAILED(client_->GetService(IID_PPV_ARGS(&render_client_)))) {
      error = "the output device exposed no render client";
      return false;
    }
    /**
     * Told when this stream is cut off. A failure here is survivable: the
     * stream still plays, and a device removed under it still fails the
     * render loop's next call; what goes unheard is a disconnect that sends
     * no error, until the outputs next change.
     */
    if (SUCCEEDED(client_->GetService(IID_PPV_ARGS(&session_))) &&
        FAILED(session_->RegisterAudioSessionNotification(&session_watcher_))) {
      session_.Reset();
    }

    format_.sample_rate = rate;
    format_.channels = channels;
    format_.max_block_frames = buffer_frames_;

    // Every buffer the render thread touches, allocated once, here. The engine
    // is planar and the device is interleaved, so the deinterleave scratch is
    // part of the contract rather than an optimisation.
    const uint32_t engine_channels = channels < 2 ? channels : 2;
    planar_.assign(engine_channels,
                   std::vector<float>(buffer_frames_, 0.0f));
    planar_pointers_.clear();
    for (auto& channel : planar_) {
      planar_pointers_.push_back(channel.data());
    }
    return true;
  }

  void teardown() {
    // Unregistered before anything else goes, so no callback can arrive against
    // a half-destroyed stream.
    if (session_) {
      session_->UnregisterAudioSessionNotification(&session_watcher_);
      session_.Reset();
    }
    render_client_.Reset();
    client_.Reset();
    device_.Reset();
    if (event_ != nullptr) {
      CloseHandle(event_);
      event_ = nullptr;
    }
    if (owns_com_) {
      CoUninitialize();
      owns_com_ = false;
    }
  }

  /** Ask the host to reopen, and wake it to do so. Any thread. */
  void raise_reopen() {
    reopen_.store(true, std::memory_order_release);
    if (changes_ != nullptr) {
      changes_->signal();
    }
  }

  void heard_default_changed() override { raise_reopen(); }

  /**
   * An output changed. Only a reason to act while an open is waited for:
   * with a stream playing, a property changing on some other endpoint is
   * nothing to interrupt it for, and a default moving has its own notice.
   */
  void heard_outputs_changed() override {
    if (opening_.load(std::memory_order_acquire)) {
      changed_while_opening_.store(true, std::memory_order_release);
      return;
    }
    if (awaiting_.load(std::memory_order_acquire)) {
      raise_reopen();
    }
  }

  void heard_stream_lost() override { raise_reopen(); }

  /** A fresh enumerator with the endpoint callback on it, or nothing. */
  ComPtr<IMMDeviceEnumerator> listen() {
    ComPtr<IMMDeviceEnumerator> enumerator;
    if (FAILED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                                CLSCTX_ALL, IID_PPV_ARGS(&enumerator))) ||
        FAILED(enumerator->RegisterEndpointNotificationCallback(
            &endpoint_watcher_))) {
      return nullptr;
    }
    return enumerator;
  }

  void stop_listening(ComPtr<IMMDeviceEnumerator>& enumerator) {
    if (enumerator) {
      enumerator->UnregisterEndpointNotificationCallback(&endpoint_watcher_);
      enumerator.Reset();
    }
  }

  /**
   * The watch thread: Windows' notices about outputs and its audio services,
   * for the backend's whole life.
   *
   * It waits alertably on its stop event, which is where the service
   * manager's callbacks run, and on nothing else. When the audio services
   * come back the endpoint callback is registered again on a fresh
   * enumerator — the old registration went with the service — and an open
   * that was waiting is tried; when either service goes, the stream went
   * with it.
   */
  void watch() {
    const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    ComPtr<IMMDeviceEnumerator> enumerator = listen();
    const SC_HANDLE manager =
        OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT);
    ServiceWatch services[2];
    bool is_lost = false;
    for (int at = 0; at < 2 && manager != nullptr; ++at) {
      is_lost = !arm(services[at], manager, kAudioServices[at]) || is_lost;
    }
    for (;;) {
      const DWORD result = WaitForSingleObjectEx(watch_stop_, INFINITE, TRUE);
      if (result != WAIT_IO_COMPLETION) {
        break;
      }
      bool came_back = false;
      bool went_down = false;
      for (int at = 0; at < 2; ++at) {
        came_back = came_back || services[at].came_back;
        went_down = went_down || services[at].went_down;
        services[at].came_back = false;
        services[at].went_down = false;
        if (!services[at].is_armed && manager != nullptr &&
            !arm(services[at], manager, kAudioServices[at]) && !is_lost) {
          // Said once. Outputs are still followed; only a restart of
          // Windows audio would go unseen from here.
          is_lost = true;
          std::fprintf(stderr,
                       "FluidEQ-DSP: stopped hearing about Windows audio "
                       "restarts\n");
        }
      }
      if (went_down) {
        heard_stream_lost();
      }
      if (came_back) {
        stop_listening(enumerator);
        enumerator = listen();
        heard_outputs_changed();
      }
    }
    stop_listening(enumerator);
    for (ServiceWatch& service : services) {
      if (service.service != nullptr) {
        CloseServiceHandle(service.service);
      }
    }
    if (manager != nullptr) {
      CloseServiceHandle(manager);
    }
    if (SUCCEEDED(com)) {
      CoUninitialize();
    }
  }

  /** The real-time thread. Everything it needs already exists. */
  void run() {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);

    /**
     * Pro Audio, through MMCSS, and not `SetThreadPriority`.
     *
     * A raw priority bump makes the thread compete harder; MMCSS tells the
     * scheduler what kind of work this is, so it is given a guaranteed slice
     * and is exempted from the throttling that applies to ordinary busy
     * threads. Failing to register is survivable and is not treated as fatal —
     * it costs headroom, not correctness.
     */
    DWORD task_index = 0;
    HANDLE task = AvSetMmThreadCharacteristicsW(L"Pro Audio", &task_index);

    if (FAILED(client_->Start())) {
      // A stream that would not start is a dead one, the same as a stream
      // that stopped being asked for: Windows audio restarting underneath it
      // is how this happens, and nothing else would ever reopen it. Returning
      // quietly used to leave playback silent while the host went on
      // reporting a stream that was running.
      raise_reopen();
      if (task != nullptr) {
        AvRevertMmThreadCharacteristics(task);
      }
      CoUninitialize();
      return;
    }

    const uint32_t engine_channels =
        static_cast<uint32_t>(planar_pointers_.size());
    const uint32_t device_channels = format_.channels;

    while (!stop_.load(std::memory_order_acquire)) {
      // Until the device asks for its next period, however long that is. It
      // was two seconds, after which the stream was called dead: a guess, and
      // a stream that is cut off says so (`SessionWatcher`), which wakes the
      // host, whose reopen wakes this wait through `close`.
      const DWORD waited = WaitForSingleObject(event_, INFINITE);
      if (stop_.load(std::memory_order_acquire)) {
        break;
      }
      if (waited != WAIT_OBJECT_0) {
        // The wait itself failed: the event is gone, and so is the stream.
        raise_reopen();
        break;
      }

      UINT32 padding = 0;
      if (FAILED(client_->GetCurrentPadding(&padding))) {
        // The device went away underneath the stream. Silent before this: the
        // loop simply left and nothing above was told.
        raise_reopen();
        break;
      }
      const UINT32 available = buffer_frames_ - padding;
      if (available == 0) {
        continue;
      }

      /**
       * An underrun, as closely as shared mode will admit to one.
       *
       * WASAPI does not report a glitch on the render path, so this is the
       * proxy: the endpoint had drained completely by the time we were woken,
       * which means anything it played in that gap was silence we did not
       * write. Counted from the second period onward — the first is empty by
       * definition, and counting it would report one underrun on every start.
       */
      if (padding == 0 && periods_.load(std::memory_order_relaxed) > 0) {
        underruns_.fetch_add(1, std::memory_order_relaxed);
      }

      BYTE* raw = nullptr;
      if (FAILED(render_client_->GetBuffer(available, &raw))) {
        raise_reopen();
        break;
      }
      auto* interleaved = reinterpret_cast<float*>(raw);

      for (uint32_t channel = 0; channel < engine_channels; ++channel) {
        std::memset(planar_[channel].data(), 0,
                    static_cast<size_t>(available) * sizeof(float));
      }
      render_(context_, planar_pointers_.data(), available);

      // Interleave into whatever width the endpoint has. A stereo programme on
      // a 5.1 endpoint fills the front pair and leaves the rest silent, which
      // is what every other stereo application on the machine does.
      for (uint32_t frame = 0; frame < available; ++frame) {
        float* out = interleaved + static_cast<size_t>(frame) * device_channels;
        for (uint32_t channel = 0; channel < device_channels; ++channel) {
          out[channel] = channel < engine_channels
                             ? planar_[channel][frame]
                             : 0.0f;
        }
      }

      if (FAILED(render_client_->ReleaseBuffer(available, 0))) {
        // Same as a failed GetBuffer above: the device has gone.
        raise_reopen();
        break;
      }
      periods_.fetch_add(1, std::memory_order_relaxed);
    }

    client_->Stop();
    client_->Reset();
    if (task != nullptr) {
      AvRevertMmThreadCharacteristics(task);
    }
    CoUninitialize();
  }

  FeqRenderFn render_ = nullptr;
  void* context_ = nullptr;

  ComPtr<IMMDevice> device_;
  ComPtr<IAudioClient> client_;
  ComPtr<IAudioRenderClient> render_client_;
  HANDLE event_ = nullptr;
  UINT32 buffer_frames_ = 0;
  bool owns_com_ = false;
  /** Read only on the control thread, between `open` and its ack. */
  bool endpoint_absent_ = false;
  std::string endpoint_guid_;

  FeqBackendFormat format_;
  std::vector<std::vector<float>> planar_;
  std::vector<float*> planar_pointers_;

  std::thread thread_;
  std::atomic<bool> open_{false};
  std::atomic<bool> running_{false};
  std::atomic<bool> stop_{false};
  std::atomic<uint64_t> underruns_{0};
  /** Raised when the endpoint should be reopened; read by the control side. */
  std::atomic<bool> reopen_{false};
  /** An open failed and nothing has closed it on purpose since. */
  std::atomic<bool> awaiting_{false};
  /** An open is being attempted, and whether the outputs changed during it. */
  std::atomic<bool> opening_{false};
  std::atomic<bool> changed_while_opening_{false};
  /** The host's wake, raised with every reopen asked for. */
  FeqWake* changes_ = nullptr;
  EndpointWatcher endpoint_watcher_{*this};
  SessionWatcher session_watcher_{*this};
  ComPtr<IAudioSessionControl> session_;
  std::thread watch_thread_;
  HANDLE watch_stop_ = nullptr;
  std::atomic<uint64_t> periods_{0};
};

}  // namespace

std::unique_ptr<IAudioOutputBackend> create_audio_backend(FeqRenderFn render,
                                                          void* context,
                                                          FeqWake* changes) {
  return std::make_unique<WasapiBackend>(render, context, changes);
}
