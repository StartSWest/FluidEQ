/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The one translation unit that defines the GUIDs it names. `initguid.h` has
// to come before every header that declares one, which is why it sits above
// even the project's own includes here and appears nowhere else.
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <initguid.h>

#include <mmdeviceapi.h>
#include <mmreg.h>
#include <propvarutil.h>

// In this order and no other. `functiondiscoverykeys_devpkey.h` does not
// include `propkeydef.h` itself and expects the caller to have done it — and
// `propkeydef.h` deliberately has no include guard, because it redefines
// DEFINE_PROPERTYKEY according to whether INITGUID is set at the moment it is
// read. Swap these two lines and every PKEY in the file parses as a function
// declaration returning int.
#include <propkeydef.h>

#include <functiondiscoverykeys_devpkey.h>

#include "apo.h"

#include <cstring>
#include "log.h"
#include <new>
#include <string>
#include <utility>

namespace fluideq_engine {

// The three initialisation structures are told apart by their size, so a
// future SDK that made two of them the same would silently make this code
// read the wrong fields out of the right bytes.
//
// Their sizes are NOT ordered by version. On x64 version 1 is 56 bytes,
// version 3 is 80 and version 2 is 88 — version 3 dropped version 2's
// `pAPOSystemEffectsProperties` and `pReserved` and added one pointer back.
// So the match below is exact per version rather than "at least as big as",
// which would read a version 2 payload through version 3's layout and call
// `Item` on what is really `pReserved`.
static_assert(sizeof(APOInitSystemEffects) != sizeof(APOInitSystemEffects2),
              "APO init structures must stay distinguishable by size");
static_assert(sizeof(APOInitSystemEffects) != sizeof(APOInitSystemEffects3),
              "APO init structures must stay distinguishable by size");
static_assert(sizeof(APOInitSystemEffects2) != sizeof(APOInitSystemEffects3),
              "APO init structures must stay distinguishable by size");

const CLSID kEngineClsid = {
    0xB7E2C4D1,
    0x5A8F,
    0x4C3E,
    {0x9D, 0x2B, 0x6F, 0x1A, 0x0C, 0x8E, 0x7D, 0x34}};

const GUID kEffectId = {
    0x6E2B7F3C,
    0x1A9D,
    0x4C5E,
    {0x8B, 0x7A, 0x2F, 0x4D, 0x6C, 0x8E, 0x1B, 0x39}};

std::atomic<long> g_object_count{0};

namespace {

// `AUDIO_SIGNALPROCESSINGMODE_DEFAULT` from ksmedia.h, written out rather
// than included: that header is thirteen thousand lines of kernel-streaming
// declarations for one constant, and with INITGUID active in this file it
// would define every GUID in all of them.
constexpr GUID kDefaultProcessingMode = {
    0xC18E2F7E,
    0x933D,
    0x4965,
    {0xB7, 0xD1, 0x1E, 0xEF, 0x22, 0x8D, 0x2A, 0xF3}};

constexpr GUID kNoProcessingMode = {};

}  // namespace

// ---------------------------------------------------------------------------

STDMETHODIMP Apo::Reset() {
  // Plenty survives a reset. The graph is built once per lock and kept across
  // every stream start and stop inside it, so its biquad histories, its
  // convolvers' overlap buffers — up to 65536 taps, over a second at 48 kHz —
  // and the rack's own state all carry the previous stream's tail into the
  // next one. The comment that used to sit here said the opposite and was
  // wrong: `LockForProcess` is not called again for a flush.
  //
  // None of it may be zeroed from here. `Reset`'s documented contract is that
  // it "is not real-time compliant and must not be called from a real-time
  // processing thread" — that names the caller, and does not promise the
  // audio thread is idle while it runs. So the reset is a whole new graph,
  // asked of the watcher and handed over by the same two-pointer exchange as
  // any other rebuild; it lands a block or two after this returns, which is
  // the price of not writing state another thread may be inside.
  //
  // This relies on Windows calling `Reset`, `LockForProcess` and
  // `UnlockForProcess` on its own control thread, one at a time, never
  // concurrently with each other — the same assumption `Watcher::request_reset`
  // in `watcher.cpp` already states, about the same three calls.
  if (watcher_) {
    watcher_->request_reset();
  }
  return S_OK;
}

STDMETHODIMP Apo::GetLatency(HNSTIME* time) {
  if (time == nullptr) {
    return E_POINTER;
  }
  *time = 0;
  const uint32_t frames = slot_.latency();
  // Read once into a local: read twice, an unlock landing between the two
  // divides by the zero the second read returned.
  const uint32_t rate = sample_rate_.load(std::memory_order_relaxed);
  if (frames == 0 || rate == 0) {
    return S_OK;
  }
  // HNSTIME counts 100 ns units; done in 64-bit integers because the frame
  // counts here reach 65536 and the rates reach 384000.
  *time = static_cast<HNSTIME>(static_cast<uint64_t>(frames) * 10000000ULL /
                               static_cast<uint64_t>(rate));
  return S_OK;
}

STDMETHODIMP Apo::GetRegistrationProperties(APO_REG_PROPERTIES** properties) {
  trace(endpoint_.guid, "registration properties asked for");
  if (properties == nullptr) {
    return E_POINTER;
  }
  *properties = nullptr;

  // `APO_REG_PROPERTIES` carries room for one interface id and is sized for
  // the rest by hand; one is all this effect advertises, which is what the
  // helper writes as `APOInterface0`.
  constexpr UINT32 kInterfaceCount = 1;
  const size_t bytes =
      sizeof(APO_REG_PROPERTIES) + sizeof(IID) * (kInterfaceCount - 1);
  auto* registration =
      static_cast<APO_REG_PROPERTIES*>(CoTaskMemAlloc(bytes));
  if (registration == nullptr) {
    return E_OUTOFMEMORY;
  }
  std::memset(registration, 0, bytes);

  registration->clsid = kEngineClsid;
  // In place because the graph processes a buffer where it finds it, and all
  // three format dimensions must match: this effect does not resample,
  // remix channels or convert sample types. Keep the registry in agreement.
  registration->Flags = static_cast<APO_FLAG>(
      APO_FLAG_INPLACE | APO_FLAG_SAMPLESPERFRAME_MUST_MATCH |
      APO_FLAG_FRAMESPERSECOND_MUST_MATCH | APO_FLAG_BITSPERSAMPLE_MUST_MATCH);
  wcscpy_s(registration->szFriendlyName, L"FluidEQ Engine");
  wcscpy_s(registration->szCopyrightInfo,
           L"Copyright (C) 2026 Ivan Carmenates Garcia. GPL-3.0-or-later.");
  registration->u32MajorVersion = 1;
  registration->u32MinorVersion = 0;
  registration->u32MinInputConnections = 1;
  registration->u32MaxInputConnections = 1;
  registration->u32MinOutputConnections = 1;
  registration->u32MaxOutputConnections = 1;
  registration->u32MaxInstances = INFINITE;
  registration->u32NumAPOInterfaces = kInterfaceCount;
  registration->iidAPOInterfaceList[0] = __uuidof(IAudioProcessingObject);

  *properties = registration;
  return S_OK;
}

bool Apo::is_default_processing_mode() const {
  return IsEqualGUID(processing_mode_, kDefaultProcessingMode) != 0 ||
         IsEqualGUID(processing_mode_, kNoProcessingMode) != 0;
}

STDMETHODIMP Apo::Initialize(UINT32 size, BYTE* data) {
  if (locked_) {
    return APOERR_APO_LOCKED;
  }
  if (initialized_) {
    return APOERR_ALREADY_INITIALIZED;
  }
  if (size == 0 && data == nullptr) {
    initialized_ = true;
    return S_OK;
  }
  if (data == nullptr || size < sizeof(APOInitBaseStruct)) {
    return E_INVALIDARG;
  }

  // cbSize identifies the layout; size bounds every access. The v3 layout
  // is smaller than v2 and reordered fields, so a larger unknown structure
  // cannot safely be interpreted as the newest one we know.
  const auto* base = reinterpret_cast<const APOInitBaseStruct*>(data);
  const UINT32 declared = base->cbSize;
  if (declared > size) {
    return E_INVALIDARG;
  }
  try {
    trace(L"", "initialize: " + std::to_string(size) +
                   " bytes, declared layout " + std::to_string(declared));
    if (declared == sizeof(APOInitSystemEffects3)) {
      const auto* init = reinterpret_cast<const APOInitSystemEffects3*>(data);
      processing_mode_ = init->AudioProcessingMode;
      read_endpoint_properties(init->pAPOEndpointProperties);
      read_endpoint(init->pDeviceCollection, init->nSoftwareIoDeviceInCollection);
    } else if (declared == sizeof(APOInitSystemEffects2)) {
      const auto* init = reinterpret_cast<const APOInitSystemEffects2*>(data);
      processing_mode_ = init->AudioProcessingMode;
      read_endpoint_properties(init->pAPOEndpointProperties);
      read_endpoint(init->pDeviceCollection, init->nSoftwareIoDeviceInCollection);
    } else if (declared == sizeof(APOInitSystemEffects)) {
      const auto* init = reinterpret_cast<const APOInitSystemEffects*>(data);
      read_endpoint_properties(init->pAPOEndpointProperties);
      read_endpoint(init->pDeviceCollection, 0);
    } else {
      trace(L"", "initialize refused: unsupported structure layout");
      return E_INVALIDARG;
    }
    trace(endpoint_.guid,
          "initialized for \"" + to_utf8(endpoint_.friendly_name) + "\"" +
              (is_default_processing_mode() ? "" : ", not the default mode"));
  } catch (const std::bad_alloc&) {
    endpoint_ = Endpoint();
    return E_OUTOFMEMORY;
  } catch (...) {
    endpoint_ = Endpoint();
    return E_FAIL;
  }
  initialized_ = true;
  return S_OK;
}

STDMETHODIMP Apo::GetInputChannelCount(UINT32* channels) {
  if (!locked_) {
    trace(endpoint_.guid, "channel count asked for");
  }
  if (channels == nullptr) {
    return E_POINTER;
  }
  *channels = channels_;
  return S_OK;
}

STDMETHODIMP Apo::GetEffectsList(LPGUID* effects, UINT* count, HANDLE event) {
  // The event is how a host asks to be told when the list changes. This
  // effect's list is one fixed id for the life of the object, so there is
  // nothing to signal and nothing to keep the handle for.
  UNREFERENCED_PARAMETER(event);
  if (!locked_) {
    trace(endpoint_.guid, "effects list asked for");
  }
  if (effects == nullptr || count == nullptr) {
    return E_POINTER;
  }
  *effects = nullptr;
  *count = 0;

  auto* ids = static_cast<GUID*>(CoTaskMemAlloc(sizeof(GUID)));
  if (ids == nullptr) {
    return E_OUTOFMEMORY;
  }
  ids[0] = kEffectId;
  *effects = ids;
  *count = 1;
  return S_OK;
}

STDMETHODIMP Apo::GetControllableSystemEffectsList(
    AUDIO_SYSTEMEFFECT** effects, UINT* count, HANDLE event) {
  UNREFERENCED_PARAMETER(event);
  if (!locked_) {
    trace(endpoint_.guid, "controllable effects list asked for");
  }
  if (effects == nullptr || count == nullptr) {
    return E_POINTER;
  }
  *effects = nullptr;
  *count = 0;

  auto* list =
      static_cast<AUDIO_SYSTEMEFFECT*>(CoTaskMemAlloc(sizeof(AUDIO_SYSTEMEFFECT)));
  if (list == nullptr) {
    return E_OUTOFMEMORY;
  }
  list[0].id = kEffectId;
  // Not switchable from Windows' own sound settings: the app is the switch,
  // and a toggle there that this effect then ignored would be a lie.
  list[0].canSetState = FALSE;
  list[0].state = AUDIO_SYSTEMEFFECT_STATE_ON;
  *effects = list;
  *count = 1;
  return S_OK;
}

STDMETHODIMP Apo::SetAudioSystemEffectState(GUID effect_id,
                                            AUDIO_SYSTEMEFFECT_STATE state) {
  UNREFERENCED_PARAMETER(state);
  // Reported as not controllable, so a host that asks anyway is asking for
  // something the list said it could not have.
  return IsEqualGUID(effect_id, kEffectId) != 0 ? E_NOTIMPL : E_INVALIDARG;
}

STDMETHODIMP_(UINT32) Apo::CalcInputFrames(UINT32 output_frames) {
  return output_frames;
}

STDMETHODIMP_(UINT32) Apo::CalcOutputFrames(UINT32 input_frames) {
  return input_frames;
}

}  // namespace fluideq_engine
