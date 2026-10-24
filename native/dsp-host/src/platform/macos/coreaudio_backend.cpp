/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "../../audio_backend.h"

#include <AudioUnit/AudioUnit.h>
#include <CoreAudio/CoreAudio.h>

#include <atomic>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

namespace {

/** The engine is stereo; a wider device is fed its first two channels. */
constexpr uint32_t kEngineChannels = 2;

AudioObjectPropertyAddress global_address(AudioObjectPropertySelector what) {
  AudioObjectPropertyAddress address{};
  address.mSelector = what;
  address.mScope = kAudioObjectPropertyScopeGlobal;
  address.mElement = kAudioObjectPropertyElementMain;
  return address;
}

/** The system's current default output, or `kAudioObjectUnknown`. */
AudioDeviceID default_output_device() {
  AudioObjectPropertyAddress address =
      global_address(kAudioHardwarePropertyDefaultOutputDevice);
  AudioDeviceID device = kAudioObjectUnknown;
  UInt32 size = sizeof(device);
  const OSStatus status = AudioObjectGetPropertyData(
      kAudioObjectSystemObject, &address, 0, nullptr, &size, &device);
  return status == noErr ? device : kAudioObjectUnknown;
}

/**
 * What the device is actually clocked at.
 *
 * Asked rather than assumed for the same reason the Windows backend asks: a
 * machine set to 44.1 will not open at 48 because the engine would prefer it,
 * and the engine is rebuilt around the answer.
 */
double device_sample_rate(AudioDeviceID device) {
  AudioObjectPropertyAddress address =
      global_address(kAudioDevicePropertyNominalSampleRate);
  Float64 rate = 0.0;
  UInt32 size = sizeof(rate);
  if (AudioObjectGetPropertyData(device, &address, 0, nullptr, &size, &rate) !=
      noErr) {
    return 0.0;
  }
  return static_cast<double>(rate);
}

/**
 * The device period, in frames, which is how long a callback has to return.
 *
 * This is the denominator `FeqBackendStats::buffer_frames` exists to carry: a
 * figure in microseconds says nothing about whether the work fit.
 */
uint32_t device_buffer_frames(AudioDeviceID device) {
  AudioObjectPropertyAddress address =
      global_address(kAudioDevicePropertyBufferFrameSize);
  UInt32 frames = 0;
  UInt32 size = sizeof(frames);
  if (AudioObjectGetPropertyData(device, &address, 0, nullptr, &size,
                                 &frames) != noErr) {
    return 0;
  }
  return static_cast<uint32_t>(frames);
}

/** The default moving, and the set of devices changing. */
constexpr AudioObjectPropertySelector kSystemSelectors[] = {
    kAudioHardwarePropertyDefaultOutputDevice,
    kAudioHardwarePropertyDevices,
};

/**
 * AUHAL, which is a pull model with a render callback — the shape
 * `FeqRenderFn` already has.
 *
 * `kAudioFormatFlagIsNonInterleaved` is the reason this file is shorter than
 * its Windows counterpart. CoreAudio then hands the callback an
 * `AudioBufferList` holding one buffer per channel, which IS `float* const*
 * planar`: no scratch buffer, and no per-frame interleave loop.
 */
class CoreAudioBackend final : public IAudioOutputBackend {
 public:
  /**
   * The system's outputs are listened to for the backend's whole life, not
   * per open. A failed open used to take its listeners down with it, which
   * was harmless while the host retried on a 25 ms tick and is silence for
   * good now that a retry waits for a reason (`await_endpoint`).
   */
  explicit CoreAudioBackend(const FeqBackendHooks& hooks,
                            AudioDeviceID requested = kAudioObjectUnknown)
      : hooks_(hooks), requested_(requested) {
    for (const AudioObjectPropertySelector what : kSystemSelectors) {
      AudioObjectPropertyAddress address = global_address(what);
      AudioObjectAddPropertyListener(kAudioObjectSystemObject, &address,
                                     &CoreAudioBackend::system_changed, this);
    }
  }

  ~CoreAudioBackend() override {
    close();
    for (const AudioObjectPropertySelector what : kSystemSelectors) {
      AudioObjectPropertyAddress address = global_address(what);
      AudioObjectRemovePropertyListener(kAudioObjectSystemObject, &address,
                                        &CoreAudioBackend::system_changed,
                                        this);
    }
  }

  /**
   * `FLUIDEQ_DSP_NO_ENDPOINT=1` makes this build take the silent-machine
   * path on a machine that has a device. It is the positive control for the
   * smoke's skip: without it, "no endpoint" and "never looked" are the same
   * green line. The same variable the Windows backend honours, so one smoke
   * runs the control on both. Deliberately not a build flag — the binary
   * under test has to be the binary that ships.
   */
  static bool forced_absent() {
    const char* value = std::getenv("FLUIDEQ_DSP_NO_ENDPOINT");
    return value != nullptr && value[0] == '1';
  }

  bool open(FeqBackendFormat& negotiated, std::string& error) override {
    // `teardown` and not `close` on every path here: a failed open must leave
    // a reopen that is waiting for a device still waiting for one.
    teardown();
    const AudioDeviceID device =
        forced_absent() ? kAudioObjectUnknown
                        : (requested_ == kAudioObjectUnknown
                               ? default_output_device() : requested_);
    if (device == kAudioObjectUnknown) {
      // A fact about the machine, not a defect. A build agent with no output
      // fails here forever and correctly, and reporting that as a refused
      // format would make a green tree indistinguishable from a broken one.
      endpoint_absent_ = true;
      error = "this machine has no default audio output device";
      return false;
    }
    endpoint_absent_ = false;

    const double rate = device_sample_rate(device);
    if (rate <= 0.0) {
      error = "the default output device did not report a sample rate";
      return false;
    }

    AudioComponentDescription wanted{};
    wanted.componentType = kAudioUnitType_Output;
    wanted.componentSubType = kAudioUnitSubType_HALOutput;
    wanted.componentManufacturer = kAudioUnitManufacturer_Apple;
    AudioComponent component = AudioComponentFindNext(nullptr, &wanted);
    if (component == nullptr) {
      error = "the HAL output audio unit is not available";
      return false;
    }
    if (AudioComponentInstanceNew(component, &unit_) != noErr ||
        unit_ == nullptr) {
      error = "the HAL output audio unit could not be created";
      return false;
    }

    if (AudioUnitSetProperty(unit_, kAudioOutputUnitProperty_CurrentDevice,
                             kAudioUnitScope_Global, 0, &device,
                             sizeof(device)) != noErr) {
      error = "the audio unit refused the default output device";
      teardown();
      return false;
    }

    const uint32_t period = device_buffer_frames(device);
    UInt32 slice = period > 0 ? period : 512;
    if (AudioUnitSetProperty(unit_, kAudioUnitProperty_MaximumFramesPerSlice,
                             kAudioUnitScope_Global, 0, &slice,
                             sizeof(slice)) != noErr) {
      error = "the audio unit refused the maximum block size";
      teardown();
      return false;
    }

    // Non-interleaved float32: one buffer per channel, which is the planar
    // contract exactly. `mBytesPerFrame` and `mBytesPerPacket` are ONE
    // sample's width in this layout, not the frame's — an interleaved-shaped
    // value here is accepted and then renders one channel of noise.
    AudioStreamBasicDescription format{};
    format.mSampleRate = rate;
    format.mFormatID = kAudioFormatLinearPCM;
    format.mFormatFlags =
        kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked |
        kAudioFormatFlagIsNonInterleaved;
    format.mFramesPerPacket = 1;
    format.mChannelsPerFrame = kEngineChannels;
    format.mBitsPerChannel = 32;
    format.mBytesPerFrame = sizeof(float);
    format.mBytesPerPacket = sizeof(float);
    if (AudioUnitSetProperty(unit_, kAudioUnitProperty_StreamFormat,
                             kAudioUnitScope_Input, 0, &format,
                             sizeof(format)) != noErr) {
      error = "the device refused non-interleaved 32-bit float stereo";
      teardown();
      return false;
    }

    AURenderCallbackStruct callback{};
    callback.inputProc = &CoreAudioBackend::render_trampoline;
    callback.inputProcRefCon = this;
    if (AudioUnitSetProperty(unit_, kAudioUnitProperty_SetRenderCallback,
                             kAudioUnitScope_Input, 0, &callback,
                             sizeof(callback)) != noErr) {
      error = "the audio unit refused the render callback";
      teardown();
      return false;
    }

    if (AudioUnitInitialize(unit_) != noErr) {
      error = "the audio unit failed to initialise";
      teardown();
      return false;
    }

    // Everything the callback touches is sized here, because it may not
    // allocate. `silence_` backs any channel the device does not give us.
    planar_pointers_.assign(kEngineChannels, nullptr);
    silence_.assign(slice, 0.0f);

    device_ = device;
    buffer_frames_ = slice;
    underruns_.store(0, std::memory_order_relaxed);
    periods_.store(0, std::memory_order_relaxed);
    add_device_listener();

    negotiated.sample_rate = static_cast<uint32_t>(rate);
    negotiated.channels = kEngineChannels;
    negotiated.max_block_frames = slice;
    open_ = true;
    mode_.store(kOpen, std::memory_order_release);
    return true;
  }

  bool endpoint_absent() const override { return endpoint_absent_; }

  bool start(std::string& error) override {
    if (!open_) {
      error = "the device is not open";
      return false;
    }
    if (AudioOutputUnitStart(unit_) != noErr) {
      error = "the audio unit would not start";
      return false;
    }
    running_ = true;
    return true;
  }

  void close() override {
    // Nobody wants a device, or a reopen is about to say so itself.
    mode_.store(kClosed, std::memory_order_release);
    teardown();
  }

  bool is_open() const override { return open_; }

  bool is_running() const override { return running_; }

  FeqBackendStats stats() const override {
    FeqBackendStats out{};
    out.underruns = underruns_.load(std::memory_order_relaxed);
    out.periods = periods_.load(std::memory_order_relaxed);
    out.buffer_frames = buffer_frames_;
    return out;
  }

  bool needs_reopen() const override {
    return reopen_.load(std::memory_order_acquire);
  }

  void clear_reopen() override {
    reopen_.store(false, std::memory_order_release);
  }

  void await_endpoint() override {
    mode_.store(kAwaiting, std::memory_order_release);
  }

  const char* name() const override { return "coreaudio"; }

 private:
  // What counts as a reason to reopen, as on Windows (`device_watch.h`):
  // nothing while nothing is open or wanted, the default moving while a
  // stream is open, and any change to the devices while a reopen waits.
  static constexpr int kClosed = 0;
  static constexpr int kOpen = 1;
  static constexpr int kAwaiting = 2;

  /** The unit and the device's own listener, released; the mode untouched. */
  void teardown() {
    remove_device_listener();
    if (unit_ != nullptr) {
      if (running_) {
        AudioOutputUnitStop(unit_);
      }
      AudioUnitUninitialize(unit_);
      AudioComponentInstanceDispose(unit_);
      unit_ = nullptr;
    }
    running_ = false;
    open_ = false;
    device_ = kAudioObjectUnknown;
    buffer_frames_ = 0;
  }

  /** Raise `needs_reopen` and wake whoever acts on it. Any thread. */
  void want_reopen() {
    reopen_.store(true, std::memory_order_release);
    if (hooks_.reopen_wanted != nullptr) {
      hooks_.reopen_wanted(hooks_.context);
    }
  }

  static OSStatus render_trampoline(void* refcon,
                                    AudioUnitRenderActionFlags* flags,
                                    const AudioTimeStamp* timestamp,
                                    UInt32 bus, UInt32 frames,
                                    AudioBufferList* data) {
    (void)flags;
    (void)timestamp;
    (void)bus;
    return static_cast<CoreAudioBackend*>(refcon)->render_period(frames, data);
  }

  /** The real-time thread. No allocation, no lock, no logging, no blocking. */
  OSStatus render_period(UInt32 frames, AudioBufferList* data) {
    const uint32_t supplied = data->mNumberBuffers;
    for (uint32_t buffer = 0; buffer < supplied; buffer += 1) {
      std::memset(data->mBuffers[buffer].mData, 0,
                  data->mBuffers[buffer].mDataByteSize);
    }
    const uint32_t channels = static_cast<uint32_t>(planar_pointers_.size());
    for (uint32_t channel = 0; channel < channels; channel += 1) {
      planar_pointers_[channel] =
          channel < supplied
              ? static_cast<float*>(data->mBuffers[channel].mData)
              : silence_.data();
    }
    hooks_.render(hooks_.context, planar_pointers_.data(), frames);
    periods_.fetch_add(1, std::memory_order_relaxed);
    /**
     * What the block armed is rung here, at the end of the IO proc.
     *
     * Windows rings after `ReleaseBuffer`, on its own device thread and
     * outside any callback. AUHAL has no such point: the buffers are the
     * device's the moment this returns, and nothing of ours runs on this
     * thread until the next period. The ring is `std::atomic::notify_one`, a
     * `__ulock_wake` that never blocks or takes a lock — the same kind of
     * wake Core Audio code makes with `semaphore_signal` from this thread.
     * Without it the decoder, the voice worker and telemetry sleep forever:
     * they no longer poll.
     */
    if (hooks_.period_done != nullptr) {
      hooks_.period_done(hooks_.context);
    }
    return noErr;
  }

  /**
   * The default output moved, or the set of devices changed.
   *
   * Answered rather than defaulted, because macOS has the notification
   * `audio_backend.h` says a platform should not pretend to lack: a stream
   * whose device is no longer the default stays technically healthy and
   * completely inaudible. And while a reopen waits, a device arriving is the
   * only thing that ends the wait.
   */
  static OSStatus system_changed(AudioObjectID object, UInt32 count,
                                 const AudioObjectPropertyAddress* addresses,
                                 void* context) {
    (void)object;
    auto* self = static_cast<CoreAudioBackend*>(context);
    const int mode = self->mode_.load(std::memory_order_acquire);
    for (UInt32 index = 0; index < count; index += 1) {
      const AudioObjectPropertySelector what = addresses[index].mSelector;
      const bool is_reason =
          (what == kAudioHardwarePropertyDefaultOutputDevice &&
           mode != kClosed) ||
          (what == kAudioHardwarePropertyDevices && mode == kAwaiting);
      if (is_reason) {
        self->want_reopen();
        return noErr;
      }
    }
    return noErr;
  }

  /** The open device overloaded: a period it could not finish in time. */
  static OSStatus device_overloaded(AudioObjectID object, UInt32 count,
                                    const AudioObjectPropertyAddress* addresses,
                                    void* context) {
    (void)object;
    auto* self = static_cast<CoreAudioBackend*>(context);
    for (UInt32 index = 0; index < count; index += 1) {
      if (addresses[index].mSelector == kAudioDeviceProcessorOverload) {
        self->underruns_.fetch_add(1, std::memory_order_relaxed);
      }
    }
    return noErr;
  }

  void add_device_listener() {
    AudioObjectPropertyAddress overload =
        global_address(kAudioDeviceProcessorOverload);
    AudioObjectAddPropertyListener(device_, &overload,
                                   &CoreAudioBackend::device_overloaded, this);
    listening_ = true;
  }

  void remove_device_listener() {
    if (!listening_) {
      return;
    }
    AudioObjectPropertyAddress overload =
        global_address(kAudioDeviceProcessorOverload);
    AudioObjectRemovePropertyListener(device_, &overload,
                                      &CoreAudioBackend::device_overloaded,
                                      this);
    listening_ = false;
  }

  FeqBackendHooks hooks_;
  AudioDeviceID requested_ = kAudioObjectUnknown;
  AudioUnit unit_ = nullptr;
  AudioDeviceID device_ = kAudioObjectUnknown;
  bool open_ = false;
  bool running_ = false;
  bool listening_ = false;
  bool endpoint_absent_ = false;
  uint32_t buffer_frames_ = 0;
  std::atomic<uint64_t> underruns_{0};
  std::atomic<uint64_t> periods_{0};
  std::atomic<bool> reopen_{false};
  std::atomic<int> mode_{kClosed};
  std::vector<float*> planar_pointers_;
  std::vector<float> silence_;
};

}  // namespace

std::unique_ptr<IAudioOutputBackend> create_audio_backend(
    const FeqBackendHooks& hooks) {
  return std::make_unique<CoreAudioBackend>(hooks);
}

// Share Audio may follow a selected output without changing the system's
// default. The Library keeps the default-only factory above.
std::unique_ptr<IAudioOutputBackend> create_coreaudio_backend_for_device(
    const FeqBackendHooks& hooks, uint32_t device) {
  return std::make_unique<CoreAudioBackend>(hooks, device);
}
