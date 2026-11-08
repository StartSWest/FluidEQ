/* FluidEQ — GPL-3.0-or-later */

/**
 * Auto normalize's level when Windows opens the same output again: the real
 * DLL locked, played, unlocked and locked again on one endpoint, which is
 * what audiodg does whenever FluidEQ restarts, the Library's player starts
 * its stream again, or anything starts playing on an idle output.
 *
 * Each lock used to start over at the curve's own level and climb back for
 * half a minute (Ivan, 2026-11-07: "the preamp kind of resets and needs to
 * rise again ... we need to ensure stable volume"). The control is the first
 * lock's own start, at the curve's level: the second lock must start where the
 * first one's music had climbed to instead.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <initguid.h>
#include <propvarutil.h>
#include <propsys.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <string>

#include "dll_test_support.h"

using namespace fluideq_engine_test;

namespace {

constexpr wchar_t kOutput[] = L"{12121212-3434-5656-7878-909090909090}";

/** One lock of the effect on `kOutput`, unlocked when it goes. */
class Lock {
 public:
  ~Lock() {
    if (locked_) CHECK(configuration_->UnlockForProcess() == S_OK);
    if (configuration_) configuration_->Release();
    if (rt_) rt_->Release();
    if (apo_) apo_->Release();
    if (media_) media_->Release();
  }

  bool open(IClassFactory* factory) {
    apo_ = create_apo(factory);
    if (!apo_) return false;
    IPropertyStore* properties = nullptr;
    CHECK(PSCreateMemoryPropertyStore(__uuidof(IPropertyStore),
        reinterpret_cast<void**>(&properties)) == S_OK);
    if (!properties) return false;
    const ScopeGuard release([&] { properties->Release(); });
    PROPVARIANT guid = {};
    CHECK(InitPropVariantFromString(kOutput, &guid) == S_OK);
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
    const WAVEFORMATEXTENSIBLE format = float_format(static_cast<WORD>(kChannels), kRate);
    CHECK(CreateAudioMediaType(&format.Format, sizeof(format), &media_) == S_OK);
    if (!media_) return false;
    APO_CONNECTION_DESCRIPTOR connection = {};
    connection.Type = APO_CONNECTION_BUFFER_TYPE_EXTERNAL;
    connection.pBuffer = reinterpret_cast<UINT_PTR>(samples_.data());
    connection.u32MaxFrameCount = kFrames;
    connection.pFormat = media_;
    connection.u32Signature = APO_CONNECTION_DESCRIPTOR_SIGNATURE;
    APO_CONNECTION_DESCRIPTOR* connections[] = {&connection};
    const HRESULT result = configuration_->LockForProcess(1, connections, 1, connections);
    CHECK(result == S_OK);
    locked_ = SUCCEEDED(result);
    return locked_;
  }

  /** One block of a steady `input` through the effect; what came out last. */
  float render(float input) {
    samples_.fill(input);
    APO_CONNECTION_PROPERTY in = {};
    in.pBuffer = reinterpret_cast<UINT_PTR>(samples_.data());
    in.u32ValidFrameCount = kFrames;
    in.u32BufferFlags = BUFFER_VALID;
    in.u32Signature = APO_CONNECTION_PROPERTY_SIGNATURE;
    APO_CONNECTION_PROPERTY out = in;
    out.u32BufferFlags = BUFFER_INVALID;
    APO_CONNECTION_PROPERTY* inputs[] = {&in};
    APO_CONNECTION_PROPERTY* outputs[] = {&out};
    rt_->APOProcess(1, inputs, 1, outputs);
    CHECK(out.u32BufferFlags == BUFFER_VALID);
    return samples_.back();
  }

 private:
  alignas(16) std::array<float, kChannels * kFrames> samples_{};
  IAudioProcessingObject* apo_ = nullptr;
  IAudioProcessingObjectRT* rt_ = nullptr;
  IAudioProcessingObjectConfiguration* configuration_ = nullptr;
  IAudioMediaType* media_ = nullptr;
  bool locked_ = false;
};

// Parenthesised: <windows.h> is included here without NOMINMAX.
double db(float value) { return 20.0 * std::log10((std::max)(1e-9f, value)); }

void run(const wchar_t* dll_path, const std::wstring& root) {
  CHECK(CreateDirectoryW((root + L"\\config").c_str(), nullptr) != 0);
  // A curve whose own level is -12 dB, Auto normalize on.
  CHECK(write_text_file(root + L"\\config\\config.txt",
                        "Preamp: -12 dB\n# FluidEQAutoPreamp: ON\n"));
  EngineModule module = load_engine(dll_path);
  const ScopeGuard unload([&] { unload_engine(module); });
  if (!module.usable()) return;
  IClassFactory* factory = create_factory(module);
  if (!factory) return;
  const ScopeGuard release([&] {
    factory->Release();
    CHECK(module.can_unload_now() == S_OK);
  });

  // -6 dBFS in: room for the level to climb towards -1 dB under the ceiling.
  constexpr float kInput = 0.5f;
  float started = 0;
  float settled = 0;
  {
    Lock first;
    if (!first.open(factory)) return;
    // The second block, past the guard's two milliseconds of delay.
    first.render(kInput);
    started = first.render(kInput);
    // Twenty-five seconds: five waited, twenty climbing at 0.15 dB/s.
    for (uint32_t block = 0; block < 25 * kRate / kFrames; ++block) {
      settled = first.render(kInput);
    }
  }
  std::printf("first lock: started at %.2f dB, climbed to %.2f dB\n",
              db(started) - db(kInput), db(settled) - db(kInput));
  CHECK(std::abs(db(started) - db(kInput) + 12.0) < 0.05);
  CHECK(db(settled) - db(started) > 2.5);

  Lock again;
  if (!again.open(factory)) return;
  again.render(kInput);
  const float resumed = again.render(kInput);
  std::printf("second lock: started at %.2f dB\n", db(resumed) - db(kInput));
  CHECK(std::abs(db(resumed) - db(settled)) < 0.05);
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  return run_dll_test(argc, argv, "fluideq engine dll level across locks",
                      L"fluideq-engine-level-", &run);
}
