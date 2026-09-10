/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the effect DLL and its object say about themselves: the module's
 * exports, the class factory, every interface Windows queries for, the
 * registration properties it reads before it will load the effect at all, the
 * formats the object accepts and refuses, and which initialisation structure
 * it believes it was handed.
 *
 * What it does to audio is `dll_process_test.cpp`.
 *
 * The DLL's path arrives as argv[1]: CMake knows where it put it and this
 * test does not have to guess at a generator's directory layout.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

// Before every header that names a GUID: this is the one translation unit in
// this binary that defines them, so `KSDATAFORMAT_SUBTYPE_IEEE_FLOAT` and the
// interface ids resolve without an import library that may not carry them.
#include <initguid.h>

#include <cstdio>
#include <string>

#include "dll_test_support.h"

using fluideq_engine_test::create_apo;
using fluideq_engine_test::create_factory;
using fluideq_engine_test::EngineModule;
using fluideq_engine_test::float_format;
using fluideq_engine_test::is_float32;
using fluideq_engine_test::kChannels;
using fluideq_engine_test::kEffectId;
using fluideq_engine_test::kEngineClsid;
using fluideq_engine_test::kRate;
using fluideq_engine_test::load_engine;
using fluideq_engine_test::pcm16_format;
using fluideq_engine_test::run_dll_test;
using fluideq_engine_test::ScopeGuard;
using fluideq_engine_test::unload_engine;

namespace {

/**
 * Unknown layouts must be refused; a known layout in a larger allocation
 * remains valid when cbSize still identifies the known structure.
 */
struct FutureInit {
  APOInitSystemEffects3 known;
  BYTE appended[64];
};

void check_format_pairs(IAudioProcessingObject* apo, IAudioMediaType* requested,
                        IAudioMediaType* pcm) {
  // Optional output pointers are useful for probing without allocating a
  // suggestion. Unsupported opposite formats cannot be repaired on this side.
  CHECK(apo->IsInputFormatSupported(nullptr, requested, nullptr) == S_OK);
  CHECK(apo->IsOutputFormatSupported(nullptr, pcm, nullptr) == S_FALSE);
  IAudioMediaType* supported = requested;
  CHECK(apo->IsInputFormatSupported(pcm, requested, &supported) ==
        APOERR_FORMAT_NOT_SUPPORTED);
  CHECK(supported == requested);
  CHECK(apo->IsInputFormatSupported(nullptr, nullptr, &supported) == E_POINTER);
  CHECK(supported == requested);

  for (WORD channels : {WORD(1), WORD(6), WORD(8)}) {
    for (DWORD rate : {DWORD(44100), DWORD(48000), DWORD(96000)}) {
      const auto format = float_format(channels, rate);
      IAudioMediaType* opposite = nullptr;
      CHECK(CreateAudioMediaType(&format.Format, sizeof(format), &opposite) == S_OK);
      if (opposite == nullptr) {
        continue;
      }
      const ScopeGuard release([&] { opposite->Release(); });
      for (bool input : {true, false}) {
        supported = nullptr;
        const HRESULT result = input
            ? apo->IsInputFormatSupported(opposite, requested, &supported)
            : apo->IsOutputFormatSupported(opposite, requested, &supported);
        CHECK(result == S_FALSE);
        CHECK(supported != nullptr);
        if (supported != nullptr) {
          const auto* actual = supported->GetAudioFormat();
          CHECK(actual != nullptr && actual->nChannels == channels);
          CHECK(actual != nullptr && actual->nSamplesPerSec == rate);
          CHECK(is_float32(actual));
          supported->Release();
        }
      }
    }
  }
}

void run(const wchar_t* dll_path, const std::wstring& root) {
  // Nothing here locks, so nothing here writes a log or reads a config; the
  // private root exists only so a stray one could not reach the real one.
  UNREFERENCED_PARAMETER(root);

  EngineModule engine = load_engine(dll_path);
  const ScopeGuard unload([&engine] { unload_engine(engine); });
  if (!engine.usable()) {
    return;
  }

  // Nothing is created yet, so the module must be unloadable.
  CHECK(engine.can_unload_now() == S_OK);

  // Declared before the guard that releases them, so every early return below
  // goes out through it — and out through `unload` afterwards, in that order,
  // because a COM object released after its DLL is unmapped is a call into
  // memory that is no longer there.
  IClassFactory* factory = nullptr;
  IAudioProcessingObject* apo = nullptr;
  IAudioProcessingObjectRT* rt = nullptr;
  IAudioProcessingObjectConfiguration* config = nullptr;
  IAudioSystemEffects* effects = nullptr;
  IAudioSystemEffects2* effects2 = nullptr;
  IUnknown* unknown = nullptr;
  IAudioMediaType* float_type = nullptr;
  IAudioMediaType* pcm_type = nullptr;
  const ScopeGuard release([&] {
    if (pcm_type != nullptr) {
      pcm_type->Release();
    }
    if (float_type != nullptr) {
      float_type->Release();
    }
    if (unknown != nullptr) {
      unknown->Release();
    }
    if (effects != nullptr) {
      effects->Release();
    }
    if (effects2 != nullptr) {
      effects2->Release();
    }
    if (config != nullptr) {
      config->Release();
    }
    if (rt != nullptr) {
      rt->Release();
    }
    if (apo != nullptr) {
      apo->Release();
    }
    if (factory != nullptr) {
      factory->Release();
    }
    // Every object is gone, so the module must be unloadable again. Inside
    // the guard because it is only true once the releases above have run.
    CHECK(engine.can_unload_now() == S_OK);
  });

  factory = create_factory(engine);
  if (factory == nullptr) {
    return;
  }
  // A CLSID this DLL does not serve must be refused rather than answered
  // with the one it does.
  IClassFactory* wrong = nullptr;
  CHECK(engine.get_class_object(__uuidof(IUnknown), __uuidof(IClassFactory),
                                reinterpret_cast<LPVOID*>(&wrong)) ==
        CLASS_E_CLASSNOTAVAILABLE);
  CHECK(wrong == nullptr);

  apo = create_apo(factory);
  if (apo == nullptr) {
    return;
  }
  // One live object: the module must now refuse to unload.
  CHECK(engine.can_unload_now() == S_FALSE);

  // --- Registration properties -------------------------------------------
  APO_REG_PROPERTIES* props = nullptr;
  CHECK(apo->GetRegistrationProperties(&props) == S_OK);
  CHECK(props != nullptr);
  if (props != nullptr) {
    CHECK(IsEqualGUID(props->clsid, kEngineClsid));
    CHECK((props->Flags & APO_FLAG_INPLACE) != 0);
    CHECK((props->Flags & APO_FLAG_SAMPLESPERFRAME_MUST_MATCH) != 0);
    CHECK((props->Flags & APO_FLAG_FRAMESPERSECOND_MUST_MATCH) != 0);
    CHECK((props->Flags & APO_FLAG_BITSPERSAMPLE_MUST_MATCH) != 0);
    CHECK(props->u32MinInputConnections == 1);
    CHECK(props->u32MaxInputConnections == 1);
    CHECK(props->u32MinOutputConnections == 1);
    CHECK(props->u32MaxOutputConnections == 1);
    CHECK(props->u32NumAPOInterfaces >= 1);
    CHECK(wcscmp(props->szFriendlyName, L"FluidEQ Engine") == 0);
    CoTaskMemFree(props);
  }

  // --- Every interface Windows asks for ----------------------------------
  CHECK(apo->QueryInterface(__uuidof(IAudioProcessingObjectRT),
                            reinterpret_cast<void**>(&rt)) == S_OK);
  CHECK(apo->QueryInterface(__uuidof(IAudioProcessingObjectConfiguration),
                            reinterpret_cast<void**>(&config)) == S_OK);
  CHECK(apo->QueryInterface(__uuidof(IAudioSystemEffects),
                            reinterpret_cast<void**>(&effects)) == S_OK);
  CHECK(apo->QueryInterface(__uuidof(IAudioSystemEffects2),
                            reinterpret_cast<void**>(&effects2)) == S_OK);
  // Windows 11's effects API reports the same effect through version 3.
  IAudioSystemEffects3* effects3 = nullptr;
  CHECK(apo->QueryInterface(__uuidof(IAudioSystemEffects3),
                            reinterpret_cast<void**>(&effects3)) == S_OK);
  if (effects3 != nullptr) {
    AUDIO_SYSTEMEFFECT* controllable = nullptr;
    UINT controllable_count = 0;
    CHECK(effects3->GetControllableSystemEffectsList(
              &controllable, &controllable_count, nullptr) == S_OK);
    CHECK(controllable_count == 1);
    if (controllable != nullptr && controllable_count == 1) {
      CHECK(IsEqualGUID(controllable[0].id, kEffectId));
      CHECK(controllable[0].canSetState == FALSE);
      CHECK(controllable[0].state == AUDIO_SYSTEMEFFECT_STATE_ON);
    }
    CoTaskMemFree(controllable);
    CHECK(effects3->SetAudioSystemEffectState(
              kEffectId, AUDIO_SYSTEMEFFECT_STATE_OFF) == E_NOTIMPL);
    effects3->Release();
  }
  CHECK(apo->QueryInterface(__uuidof(IUnknown),
                            reinterpret_cast<void**>(&unknown)) == S_OK);
  IUnknown* absent = nullptr;
  CHECK(apo->QueryInterface(kEffectId, reinterpret_cast<void**>(&absent)) ==
        E_NOINTERFACE);
  CHECK(absent == nullptr);
  if (rt == nullptr || config == nullptr || effects2 == nullptr) {
    std::printf("  a required interface is missing; stopping\n");
    return;
  }

  // --- The effect this object reports to the audio stack ------------------
  GUID* ids = nullptr;
  UINT count = 0;
  CHECK(effects2->GetEffectsList(&ids, &count, nullptr) == S_OK);
  CHECK(count == 1);
  CHECK(ids != nullptr);
  if (ids != nullptr && count == 1) {
    CHECK(IsEqualGUID(ids[0], kEffectId));
  }
  CoTaskMemFree(ids);

  // --- Formats ------------------------------------------------------------
  const WAVEFORMATEXTENSIBLE wanted =
      float_format(static_cast<WORD>(kChannels), kRate);
  CHECK(CreateAudioMediaType(&wanted.Format, sizeof(WAVEFORMATEXTENSIBLE),
                             &float_type) == S_OK);
  const WAVEFORMATEX pcm = pcm16_format(static_cast<WORD>(kChannels), kRate);
  CHECK(CreateAudioMediaType(&pcm, sizeof(WAVEFORMATEX), &pcm_type) == S_OK);
  if (float_type == nullptr || pcm_type == nullptr) {
    std::printf("  CreateAudioMediaType failed; stopping\n");
    return;
  }

  IAudioMediaType* supported = nullptr;
  CHECK(apo->IsInputFormatSupported(nullptr, float_type, &supported) == S_OK);
  if (supported != nullptr) {
    supported->Release();
    supported = nullptr;
  }
  CHECK(apo->IsOutputFormatSupported(nullptr, float_type, &supported) == S_OK);
  if (supported != nullptr) {
    supported->Release();
    supported = nullptr;
  }

  CHECK(apo->IsInputFormatSupported(nullptr, pcm_type, &supported) == S_FALSE);
  CHECK(supported != nullptr);
  if (supported != nullptr) {
    const WAVEFORMATEX* suggestion = supported->GetAudioFormat();
    CHECK(is_float32(suggestion));
    CHECK(suggestion != nullptr && suggestion->nChannels == kChannels);
    CHECK(suggestion != nullptr && suggestion->nSamplesPerSec == kRate);
    supported->Release();
    supported = nullptr;
  }

  check_format_pairs(apo, float_type, pcm_type);

  // --- Initialize ---------------------------------------------------------
  APOInitSystemEffects init = {};
  init.APOInit.cbSize = sizeof(APOInitSystemEffects);
  init.APOInit.clsid = kEngineClsid;
  CHECK(apo->Initialize(sizeof(APOInitSystemEffects),
                        reinterpret_cast<BYTE*>(&init)) == S_OK);
  CHECK(apo->Initialize(sizeof(APOInitSystemEffects),
                        reinterpret_cast<BYTE*>(&init)) ==
        APOERR_ALREADY_INITIALIZED);

  // Each of the rest needs its own object: `Initialize` is once per instance.
  const auto initialize_fresh = [&factory](UINT32 size, void* data) -> HRESULT {
    IAudioProcessingObject* fresh = create_apo(factory);
    if (fresh == nullptr) {
      return E_FAIL;
    }
    const HRESULT result = fresh->Initialize(size, static_cast<BYTE*>(data));
    fresh->Release();
    return result;
  };

  // Version 2 and version 3 are told apart by `APOInit.cbSize`, NOT by which
  // is bigger: on x64 version 3 is 80 bytes and version 2 is 88, so a
  // "at least this big" cascade would read a version 2 payload through
  // version 3's layout. Every device collection here is null, which is the
  // "Windows named no endpoint" case the effect already handles.
  APOInitSystemEffects2 init2 = {};
  init2.APOInit.cbSize = sizeof(APOInitSystemEffects2);
  init2.APOInit.clsid = kEngineClsid;
  CHECK(initialize_fresh(sizeof(APOInitSystemEffects2), &init2) == S_OK);

  APOInitSystemEffects3 init3 = {};
  init3.APOInit.cbSize = sizeof(APOInitSystemEffects3);
  init3.APOInit.clsid = kEngineClsid;
  CHECK(initialize_fresh(sizeof(APOInitSystemEffects3), &init3) == S_OK);

  // An unknown size does not tell us where pointers live. In particular,
  // v3 did not extend v2: it removed fields and rearranged the layout.
  FutureInit future = {};
  future.known.APOInit.cbSize = sizeof(FutureInit);
  future.known.APOInit.clsid = kEngineClsid;
  CHECK(initialize_fresh(sizeof(FutureInit), &future) == E_INVALIDARG);
  future.known.APOInit.cbSize = sizeof(APOInitSystemEffects3);
  CHECK(initialize_fresh(sizeof(FutureInit), &future) == S_OK);

  // A host with nothing to say about the endpoint is not an error.
  CHECK(initialize_fresh(0, nullptr) == S_OK);
  CHECK(initialize_fresh(sizeof(init3), nullptr) == E_INVALIDARG);
  CHECK(initialize_fresh(0, &init3) == E_INVALIDARG);
  CHECK(initialize_fresh(sizeof(init3) - 1, &init3) == E_INVALIDARG);

  // Neither a short buffer nor an unknown declared layout can be parsed.
  alignas(APOInitSystemEffects) BYTE stub[sizeof(APOInitSystemEffects)] = {};
  CHECK(initialize_fresh(4, stub) == E_INVALIDARG);
  auto* stub_base = reinterpret_cast<APOInitBaseStruct*>(stub);
  stub_base->cbSize = sizeof(APOInitBaseStruct);
  CHECK(initialize_fresh(sizeof(APOInitBaseStruct), stub) == E_INVALIDARG);

  // The buffer's allocation size alone does not identify its contents.
  APOInitSystemEffects2 bad_cbsize = {};
  bad_cbsize.APOInit.cbSize = 60;
  bad_cbsize.APOInit.clsid = kEngineClsid;
  CHECK(initialize_fresh(sizeof(APOInitSystemEffects2), &bad_cbsize) == E_INVALIDARG);
  bad_cbsize.APOInit.cbSize = 0;
  CHECK(initialize_fresh(sizeof(APOInitSystemEffects2), &bad_cbsize) == E_INVALIDARG);
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  return run_dll_test(argc, argv, "fluideq engine dll smoke",
                      L"fluideq-engine-smoke-", &run);
}
