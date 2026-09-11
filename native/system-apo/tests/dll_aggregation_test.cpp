/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <initguid.h>
#include <propvarutil.h>
#include <propsys.h>

#include <array>
#include <cmath>
#include <string>

#include "dll_test_support.h"

using fluideq_engine_test::EngineModule;
using fluideq_engine_test::ScopeGuard;
using fluideq_engine_test::create_factory;
using fluideq_engine_test::float_format;
using fluideq_engine_test::kEngineClsid;
using fluideq_engine_test::kFrames;
using fluideq_engine_test::load_engine;
using fluideq_engine_test::read_text_file;
using fluideq_engine_test::run_dll_test;
using fluideq_engine_test::unload_engine;
using fluideq_engine_test::write_text_file;

namespace {

// A controlling identity like the one supplied by an aggregating audio
// graph. The old standalone-only tests never passed a non-null outer and
// therefore could not detect CLASS_E_NOAGGREGATION stopping graph creation.
class Host final : public IUnknown {
 public:
  IUnknown* inner = nullptr;
  ULONG references = 1;

  ~Host() {
    CHECK(references == 1);
    if (inner != nullptr) {
      CHECK(inner->Release() == 0);
    }
  }

  STDMETHODIMP QueryInterface(REFIID riid, void** object) override {
    if (object == nullptr) {
      return E_POINTER;
    }
    *object = nullptr;
    if (IsEqualIID(riid, __uuidof(IUnknown))) {
      *object = static_cast<IUnknown*>(this);
      AddRef();
      return S_OK;
    }
    return inner == nullptr ? E_NOINTERFACE
                            : inner->QueryInterface(riid, object);
  }

  STDMETHODIMP_(ULONG) AddRef() override { return ++references; }
  STDMETHODIMP_(ULONG) Release() override { return --references; }
};

void check_identity(IUnknown* exposed, Host& host) {
  const ULONG before = host.references;
  IUnknown* identity = nullptr;
  CHECK(exposed->QueryInterface(__uuidof(IUnknown),
                                reinterpret_cast<void**>(&identity)) == S_OK);
  CHECK(identity == static_cast<IUnknown*>(&host));
  CHECK(host.references == before + 1);
  if (identity != nullptr) {
    identity->Release();
  }
  CHECK(exposed->AddRef() == before + 1);
  CHECK(exposed->Release() == before);
}

// The root the run is pointed at, for the status file the effect writes.
std::wstring g_root;

std::wstring status_path() {
  return g_root + L"\\status-{947B0242-A1CF-4483-A44E-B72DA462C901}.json";
}

void check_audio(IAudioProcessingObject* apo,
                 IAudioProcessingObjectConfiguration* configuration,
                 IAudioProcessingObjectRT* rt, WORD channels, DWORD rate) {
  const WAVEFORMATEXTENSIBLE format = float_format(channels, rate);
  IAudioMediaType* media = nullptr;
  CHECK(CreateAudioMediaType(&format.Format, sizeof(format), &media) == S_OK);
  if (media == nullptr) {
    return;
  }
  const ScopeGuard release([&] { media->Release(); });
  alignas(16) std::array<float, 8 * kFrames> samples = {};
  samples.fill(0.25f);

  APO_CONNECTION_DESCRIPTOR input = {};
  input.Type = APO_CONNECTION_BUFFER_TYPE_EXTERNAL;
  input.pBuffer = reinterpret_cast<UINT_PTR>(samples.data());
  input.u32MaxFrameCount = kFrames;
  input.pFormat = media;
  input.u32Signature = APO_CONNECTION_DESCRIPTOR_SIGNATURE;
  APO_CONNECTION_DESCRIPTOR output = input;
  APO_CONNECTION_DESCRIPTOR* inputs[] = {&input};
  APO_CONNECTION_DESCRIPTOR* outputs[] = {&output};
  const HRESULT locked = configuration->LockForProcess(1, inputs, 1, outputs);
  CHECK(locked == S_OK);
  if (FAILED(locked)) {
    return;
  }
  const ScopeGuard unlock([&] { CHECK(configuration->UnlockForProcess() == S_OK); });
  UINT32 actual_channels = 0;
  CHECK(apo->GetInputChannelCount(&actual_channels) == S_OK);
  CHECK(actual_channels == channels);

  APO_CONNECTION_PROPERTY in = {};
  in.pBuffer = input.pBuffer;
  in.u32ValidFrameCount = kFrames;
  in.u32BufferFlags = BUFFER_VALID;
  in.u32Signature = APO_CONNECTION_PROPERTY_SIGNATURE;
  APO_CONNECTION_PROPERTY out = in;
  out.u32BufferFlags = BUFFER_INVALID;
  APO_CONNECTION_PROPERTY* in_properties[] = {&in};
  APO_CONNECTION_PROPERTY* out_properties[] = {&out};
  rt->APOProcess(1, in_properties, 1, out_properties);
  CHECK(out.u32BufferFlags == BUFFER_VALID);
  CHECK(out.u32ValidFrameCount == kFrames);
  // Positive control: -6 dB must change every channel's nonzero samples.
  // A disconnected or pass-through APO fails, as does one producing silence.
  bool correct_gain = true;
  for (size_t at = 0; at < static_cast<size_t>(channels) * kFrames; ++at) {
    correct_gain = correct_gain &&
                   std::abs(samples[at] - 0.25f * 0.501187f) < 1.0e-5f;
  }
  CHECK(correct_gain);

  // What the app will read about this output while it plays: locked, and
  // processing, since the -6 dB block names it.
  const std::string status = read_text_file(status_path());
  CHECK(status.find("\"locked\":true") != std::string::npos);
  CHECK(status.find("\"processing\":true") != std::string::npos);
  CHECK(status.find("\"problems\":[]") != std::string::npos);
}

void check_aggregated(IClassFactory* factory, const EngineModule& module,
                      UINT32 init_size, BYTE* init) {
  Host host;
  void* rejected = &host;
  CHECK(factory->CreateInstance(&host, __uuidof(IAudioProcessingObject),
                                &rejected) == E_NOINTERFACE);
  CHECK(rejected == nullptr);
  CHECK(host.references == 1);
  CHECK(module.can_unload_now() == S_OK);

  const HRESULT created = factory->CreateInstance(
      &host, __uuidof(IUnknown), reinterpret_cast<void**>(&host.inner));
  CHECK(created == S_OK);
  CHECK(host.inner != nullptr);
  if (FAILED(created) || host.inner == nullptr) {
    return;
  }
  CHECK(module.can_unload_now() == S_FALSE);
  CHECK(host.references == 1);
  IUnknown* inner_identity = nullptr;
  CHECK(host.inner->QueryInterface(__uuidof(IUnknown),
                                   reinterpret_cast<void**>(&inner_identity)) == S_OK);
  CHECK(inner_identity == host.inner);
  CHECK(host.references == 1);
  if (inner_identity != nullptr) {
    inner_identity->Release();
  }

  IAudioProcessingObject* apo = nullptr;
  IAudioProcessingObjectRT* rt = nullptr;
  IAudioProcessingObjectConfiguration* configuration = nullptr;
  IAudioSystemEffects3* effects = nullptr;
  const ScopeGuard release_interfaces([&] {
    if (effects != nullptr) {
      effects->Release();
    }
    if (configuration != nullptr) {
      configuration->Release();
    }
    if (rt != nullptr) {
      rt->Release();
    }
    if (apo != nullptr) {
      apo->Release();
    }
  });
  CHECK(host.QueryInterface(__uuidof(IAudioProcessingObject),
                             reinterpret_cast<void**>(&apo)) == S_OK);
  CHECK(host.QueryInterface(__uuidof(IAudioProcessingObjectRT),
                             reinterpret_cast<void**>(&rt)) == S_OK);
  CHECK(host.QueryInterface(__uuidof(IAudioProcessingObjectConfiguration),
                             reinterpret_cast<void**>(&configuration)) == S_OK);
  CHECK(host.QueryInterface(__uuidof(IAudioSystemEffects3),
                             reinterpret_cast<void**>(&effects)) == S_OK);
  if (apo == nullptr || rt == nullptr || configuration == nullptr || effects == nullptr) {
    return;
  }
  CHECK(host.references == 5);
  check_identity(apo, host);
  check_identity(rt, host);
  check_identity(configuration, host);
  check_identity(effects, host);

  CHECK(apo->Initialize(init_size, init) == S_OK);
  for (WORD channels : {WORD(1), WORD(2), WORD(6), WORD(8)}) {
    for (DWORD rate : {DWORD(44100), DWORD(48000), DWORD(96000)}) {
      check_audio(apo, configuration, rt, channels, rate);
    }
  }
}

template <typename Init>
void check_layout(IClassFactory* factory, const EngineModule& module,
                   IPropertyStore* properties) {
  Init init = {};
  init.APOInit.cbSize = sizeof(init);
  init.APOInit.clsid = kEngineClsid;
  init.pAPOEndpointProperties = properties;
  // No topology collection: the endpoint store must be sufficient to pick
  // a profile. The old implementation ignored it in every Windows layout.
  check_aggregated(factory, module, sizeof(init), reinterpret_cast<BYTE*>(&init));
}

void run(const wchar_t* dll_path, const std::wstring& root) {
  g_root = root;
  CHECK(CreateDirectoryW((root + L"\\config").c_str(), nullptr) != 0);
  CHECK(write_text_file(root + L"\\config\\config.txt",
                        "Device: all\nPreamp: -3 dB\n"
                        "Device: {947b0242-a1cf-4483-a44e-b72da462c901}\n"
                        "Preamp: -6 dB\n"
                        "Device: {7df52202-61b9-4bbb-9202-68191a33a085}\n"
                        "Preamp: -12 dB\n"));
  EngineModule module = load_engine(dll_path);
  const ScopeGuard unload([&] { unload_engine(module); });
  if (!module.usable()) {
    return;
  }
  IClassFactory* factory = create_factory(module);
  if (factory == nullptr) {
    return;
  }
  const ScopeGuard release_factory([&] {
    factory->Release();
    CHECK(module.can_unload_now() == S_OK);
  });
  IPropertyStore* properties = nullptr;
  CHECK(PSCreateMemoryPropertyStore(__uuidof(IPropertyStore),
                                    reinterpret_cast<void**>(&properties)) == S_OK);
  if (properties == nullptr) {
    return;
  }
  const ScopeGuard release_properties([&] { properties->Release(); });
  PROPVARIANT guid = {};
  CHECK(InitPropVariantFromString(L"{947B0242-A1CF-4483-A44E-B72DA462C901}",
                                  &guid) == S_OK);
  CHECK(properties->SetValue(PKEY_AudioEndpoint_GUID, guid) == S_OK);
  PropVariantClear(&guid);
  check_layout<APOInitSystemEffects>(factory, module, properties);
  check_layout<APOInitSystemEffects2>(factory, module, properties);
  check_layout<APOInitSystemEffects3>(factory, module, properties);

  // Every lock above has been let go, and the file says so: an app reading
  // a "locked" left behind would think the engine was still running this
  // output after Windows had stopped using it.
  const std::string status = read_text_file(status_path());
  CHECK(status.find("\"locked\":false") != std::string::npos);
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  return run_dll_test(argc, argv, "aggregated engine identity and processing",
                      L"fluideq-engine-aggregation-", run);
}
