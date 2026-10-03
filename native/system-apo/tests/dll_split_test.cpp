/* FluidEQ — GPL-3.0-or-later */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <initguid.h>
#include <propvarutil.h>
#include <propsys.h>

#include <array>
#include <cmath>
#include <string>

#include "dll_test_support.h"
#include "../src/split_transport.h"

using namespace fluideq_engine_test;

namespace {

constexpr wchar_t kMain[] = L"{11111111-2222-3333-4444-555555555555}";
constexpr wchar_t kSecond[] = L"{66666666-7777-8888-9999-aaaaaaaaaaaa}";

// These are in-memory COM connections, not Windows endpoints. Every APO
// loads its actual watcher/graph/split path from the private test root.
class Output {
 public:
  ~Output() {
    if (locked_) CHECK(configuration_->UnlockForProcess() == S_OK);
    if (configuration_) configuration_->Release();
    if (rt_) rt_->Release();
    if (apo_) apo_->Release();
    if (media_) media_->Release();
  }

  bool open(IClassFactory* factory, const wchar_t* endpoint) {
    apo_ = create_apo(factory);
    if (!apo_) return false;
    IPropertyStore* properties = nullptr;
    CHECK(PSCreateMemoryPropertyStore(__uuidof(IPropertyStore),
        reinterpret_cast<void**>(&properties)) == S_OK);
    if (!properties) return false;
    const ScopeGuard release([&] { properties->Release(); });
    PROPVARIANT guid = {};
    CHECK(InitPropVariantFromString(endpoint, &guid) == S_OK);
    CHECK(properties->SetValue(PKEY_AudioEndpoint_GUID, guid) == S_OK);
    PropVariantClear(&guid);
    APOInitSystemEffects3 init = {};
    init.APOInit.cbSize = sizeof(init);
    init.APOInit.clsid = kEngineClsid;
    init.pAPOEndpointProperties = properties;
    CHECK(apo_->Initialize(sizeof(init), reinterpret_cast<BYTE*>(&init)) == S_OK);
    CHECK(apo_->QueryInterface(__uuidof(IAudioProcessingObjectRT),
        reinterpret_cast<void**>(&rt_)) == S_OK);
    CHECK(apo_->QueryInterface(__uuidof(IAudioProcessingObjectConfiguration),
        reinterpret_cast<void**>(&configuration_)) == S_OK);
    if (!rt_ || !configuration_) return false;
    const WAVEFORMATEXTENSIBLE format = float_format(kChannels, kRate);
    CHECK(CreateAudioMediaType(&format.Format, sizeof(format), &media_) == S_OK);
    if (!media_) return false;
    APO_CONNECTION_DESCRIPTOR connection = {};
    connection.Type = APO_CONNECTION_BUFFER_TYPE_EXTERNAL;
    connection.pBuffer = reinterpret_cast<UINT_PTR>(samples.data());
    connection.u32MaxFrameCount = kFrames;
    connection.pFormat = media_;
    connection.u32Signature = APO_CONNECTION_DESCRIPTOR_SIGNATURE;
    APO_CONNECTION_DESCRIPTOR* connections[] = {&connection};
    const HRESULT result = configuration_->LockForProcess(1, connections, 1, connections);
    CHECK(result == S_OK);
    locked_ = SUCCEEDED(result);
    return locked_;
  }

  void render(float input, bool silent = false, bool starting = false) {
    samples.fill(input);
    APO_CONNECTION_PROPERTY in = {};
    in.pBuffer = reinterpret_cast<UINT_PTR>(samples.data());
    in.u32ValidFrameCount = kFrames;
    in.u32BufferFlags = silent ? BUFFER_SILENT : BUFFER_VALID;
    in.u32Signature = APO_CONNECTION_PROPERTY_SIGNATURE;
    APO_CONNECTION_PROPERTY out = in;
    out.u32BufferFlags = BUFFER_INVALID;
    APO_CONNECTION_PROPERTY* inputs[] = {&in};
    APO_CONNECTION_PROPERTY* outputs[] = {&out};
    rt_->APOProcess(1, inputs, 1, outputs);
    CHECK(out.u32BufferFlags == BUFFER_VALID ||
          (starting && silent && out.u32BufferFlags == BUFFER_SILENT));
    CHECK(out.u32ValidFrameCount == kFrames);
  }

  bool matches(float value) const {
    bool correct = true;
    for (float sample : samples) correct = correct && std::abs(sample - value) < 0.0002f;
    return correct;
  }

  void expect(float value) const {
    const bool correct = matches(value);
    CHECK(correct);
    if (!correct) std::printf("  expected %.6f, first %.6f, last %.6f\n",
                             value, samples.front(), samples.back());
  }

  alignas(16) std::array<float, kChannels * kFrames> samples{};

 private:
  IAudioProcessingObject* apo_ = nullptr;
  IAudioProcessingObjectRT* rt_ = nullptr;
  IAudioProcessingObjectConfiguration* configuration_ = nullptr;
  IAudioMediaType* media_ = nullptr;
  bool locked_ = false;
};

bool wait_for_transport_status(const std::wstring& root, bool failed) {
  HANDLE changed = FindFirstChangeNotificationW(root.c_str(), FALSE,
      FILE_NOTIFY_CHANGE_FILE_NAME | FILE_NOTIFY_CHANGE_LAST_WRITE);
  if (changed == INVALID_HANDLE_VALUE) return false;
  const ScopeGuard close([&] { FindCloseChangeNotification(changed); });
  const ULONGLONG until = GetTickCount64() + 3000;
  for (;;) {
    const auto status = read_text_file(root + L"\\status-" + kMain + L".json");
    if (status.find("\"locked\":true") != std::string::npos &&
        (status.find("split-transport") != std::string::npos) == failed) return true;
    const ULONGLONG now = GetTickCount64();
    if (now >= until || WaitForSingleObject(changed,
        static_cast<DWORD>(until - now)) != WAIT_OBJECT_0) return false;
    if (!FindNextChangeNotification(changed)) return false;
  }
}

void run(const wchar_t* dll_path, const std::wstring& root) {
  CHECK(CreateDirectoryW((root + L"\\config").c_str(), nullptr) != 0);
  CHECK(write_text_file(root + L"\\config\\config.txt",
      "Device: {11111111-2222-3333-4444-555555555555}\nPreamp: -20 dB\n"
      "Device: {66666666-7777-8888-9999-aaaaaaaaaaaa}\nPreamp: -6 dB\n"));
  const std::wstring route = root + L"\\config\\fluideq-split.txt";
  const std::string route_text =
      "# main {11111111-2222-3333-4444-555555555555}\n"
      "{11111111-2222-3333-4444-555555555555} "
      "{66666666-7777-8888-9999-aaaaaaaaaaaa} 0.5\n";
  CHECK(write_text_file(route, "# main {11111111-2222-3333-4444-555555555555}\n"));
  const ScopeGuard cleanup([&] { DeleteFileW(route.c_str()); });
  EngineModule module = load_engine(dll_path);
  const ScopeGuard unload([&] { unload_engine(module); });
  if (!module.usable()) return;
  IClassFactory* factory = create_factory(module);
  if (!factory) return;
  const ScopeGuard release([&] {
    factory->Release();
    CHECK(module.can_unload_now() == S_OK);
  });
  Output main;
  if (!main.open(factory, kMain)) return;
  // The main graph is available immediately, before optional sharing setup.
  for (int block = 0; block < 4; ++block) main.render(0.2f);
  main.expect(0.02f);
  CHECK(wait_for_transport_status(root, false));
  const auto mapping_name = fluideq_engine::split_transport_name(root + L"\\config", kMain);
  HANDLE conflict = CreateEventW(nullptr, TRUE, FALSE, mapping_name.c_str());
  CHECK(conflict != nullptr);
  // Main's from remains empty and its graph stays identical. Only transport
  // health changes; that transition must still publish a fresh status.
  CHECK(write_text_file(route, route_text.c_str()));
  CHECK(wait_for_transport_status(root, true));
  main.render(0.2f);
  main.expect(0.02f);
  if (conflict) CloseHandle(conflict);
  CHECK(write_text_file(route, (route_text + "# same route, retry setup\n").c_str()));
  CHECK(wait_for_transport_status(root, false));
  std::printf("unchanged main graph reports transport refusal and recovery\n");
  Output receiver;
  if (!receiver.open(factory, kSecond)) return;
  // Drive the real clock used by the resampler. This timer models the audio
  // host's 10 ms callbacks; setup runs asynchronously on the private watcher.
  // Readiness is observed from samples, with a bounded deadline, not assumed
  // after a fixed sleep. The test never opens a physical audio device.
  const HANDLE period = CreateWaitableTimerW(nullptr, FALSE, nullptr);
  CHECK(period != nullptr);
  if (!period) return;
  const ScopeGuard close_period([&] { CloseHandle(period); });
  LARGE_INTEGER due{};
  due.QuadPart = -100000;
  CHECK(SetWaitableTimer(period, &due, 10, nullptr, nullptr, FALSE) != 0);
  const ULONGLONG deadline = GetTickCount64() + 3000;
  const float receiver_gain = 0.2f * 0.501187f * 0.5f;
  do {
    CHECK(WaitForSingleObject(period, 1000) == WAIT_OBJECT_0);
    main.render(0.2f);
    // BUFFER_SILENT means these poisoned input bytes are not local audio.
    receiver.render(0.9f, true, true);
    main.expect(0.02f);
  } while (!receiver.matches(receiver_gain) && GetTickCount64() < deadline);
  main.expect(0.02f);
  receiver.expect(receiver_gain);
  std::printf("raw source passes through receiver EQ then listening trim\n");
  // The receiver's own audio joins the raw source before its own graph.
  // Muting or bypassing that local input would fail this positive control.
  for (int block = 0; block < 4; ++block) {
    CHECK(WaitForSingleObject(period, 1000) == WAIT_OBJECT_0);
    main.render(0.2f);
    receiver.render(0.1f);
  }
  main.expect(0.02f);
  receiver.expect(0.3f * 0.501187f * 0.5f);
  // Silent source callbacks must publish zeros too. Reusing the prior wet
  // buffer or the poisoned source bytes would keep sound in this receiver.
  for (int block = 0; block < 20; ++block) {
    CHECK(WaitForSingleObject(period, 1000) == WAIT_OBJECT_0);
    main.render(0.9f, true, true);
    receiver.render(0.9f, true);
  }
  receiver.expect(0.0f);
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  return run_dll_test(argc, argv, "fluideq engine DLL raw fan-out",
                      L"fluideq-engine-dll-split-", run);
}
