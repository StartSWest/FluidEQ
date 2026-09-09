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
#include <new>
#include <string>

namespace fluideq_engine {

// The three initialisation structures are told apart by their size, so a
// future SDK that made two of them the same would silently make this code
// read the wrong fields out of the right bytes.
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

// 1 to 8: mono through 7.1. Above that the deinterleave scratch and the
// per-channel filter states stop being a fixed cost and this effect has no
// business in the signal path of a mixing desk.
constexpr WORD kMaxChannels = 8;

/**
 * The float32 answer to a format this effect cannot take.
 *
 * Same channel count and same rate as the request — the only thing changed
 * is the sample type, because that is the only thing being refused. A
 * suggestion that also moved the rate would have the audio engine resample
 * for no reason this effect asked for.
 */
HRESULT suggest_float(const WAVEFORMATEX* requested,
                      IAudioMediaType** supported) {
  WORD channels = requested == nullptr ? 2 : requested->nChannels;
  if (channels == 0) {
    channels = 2;
  }
  if (channels > kMaxChannels) {
    channels = kMaxChannels;
  }
  DWORD rate = requested == nullptr ? 48000 : requested->nSamplesPerSec;
  if (rate == 0) {
    rate = 48000;
  }

  WAVEFORMATEXTENSIBLE format = {};
  format.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
  format.Format.nChannels = channels;
  format.Format.nSamplesPerSec = rate;
  format.Format.wBitsPerSample = 32;
  format.Format.nBlockAlign = static_cast<WORD>(channels * 4);
  format.Format.nAvgBytesPerSec = rate * format.Format.nBlockAlign;
  format.Format.cbSize = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
  format.Samples.wValidBitsPerSample = 32;
  format.SubFormat = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;
  // Carried over when the request had one; zero otherwise, which is the
  // documented "the channels are in their natural order" and is what a
  // plain WAVEFORMATEX request means anyway.
  if (requested != nullptr &&
      requested->wFormatTag == WAVE_FORMAT_EXTENSIBLE &&
      requested->cbSize >= sizeof(WAVEFORMATEXTENSIBLE) -
                               sizeof(WAVEFORMATEX)) {
    format.dwChannelMask =
        reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(requested)
            ->dwChannelMask;
  }
  return CreateAudioMediaType(&format.Format, sizeof(WAVEFORMATEXTENSIBLE),
                              supported);
}

/**
 * The endpoint guid out of an `IMMDevice` id.
 *
 * The id is `{0.0.0.00000000}.{guid}`; the config files name the second
 * brace group alone, upper-cased, which is the form Equalizer APO's own
 * Device Selector writes into a `Device:` line.
 */
std::wstring guid_from_device_id(const wchar_t* id) {
  if (id == nullptr) {
    return std::wstring();
  }
  const std::wstring text(id);
  const size_t open = text.find_last_of(L'{');
  if (open == std::wstring::npos || text.back() != L'}') {
    return std::wstring();
  }
  std::wstring guid = text.substr(open);
  for (wchar_t& letter : guid) {
    if (letter >= L'a' && letter <= L'z') {
      letter = static_cast<wchar_t>(letter - L'a' + L'A');
    }
  }
  return guid;
}

}  // namespace

ConnectionFormat describe_format(const WAVEFORMATEX* format) {
  ConnectionFormat described;
  if (format == nullptr) {
    return described;
  }
  described.channels = format->nChannels;
  described.rate = format->nSamplesPerSec;
  if (format->wBitsPerSample != 32 || format->nChannels == 0 ||
      format->nChannels > kMaxChannels || format->nSamplesPerSec == 0) {
    return described;
  }
  if (format->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) {
    described.acceptable = true;
    return described;
  }
  if (format->wFormatTag != WAVE_FORMAT_EXTENSIBLE ||
      format->cbSize < sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX)) {
    return described;
  }
  const auto* extensible =
      reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(format);
  // A 32-bit container carrying fewer valid bits is a padded integer format
  // wearing a float's clothes; those samples would not be floats.
  if (extensible->Samples.wValidBitsPerSample != 32 &&
      extensible->Samples.wValidBitsPerSample != 0) {
    return described;
  }
  described.acceptable =
      IsEqualGUID(extensible->SubFormat, KSDATAFORMAT_SUBTYPE_IEEE_FLOAT) != 0;
  return described;
}

// ---------------------------------------------------------------------------

Apo::Apo() { g_object_count.fetch_add(1, std::memory_order_relaxed); }

Apo::~Apo() {
  release_locked_state();
  g_object_count.fetch_sub(1, std::memory_order_relaxed);
}

STDMETHODIMP Apo::QueryInterface(REFIID riid, void** object) {
  if (object == nullptr) {
    return E_POINTER;
  }
  *object = nullptr;
  if (IsEqualIID(riid, __uuidof(IUnknown)) ||
      IsEqualIID(riid, __uuidof(IAudioProcessingObject))) {
    *object = static_cast<IAudioProcessingObject*>(this);
  } else if (IsEqualIID(riid, __uuidof(IAudioProcessingObjectRT))) {
    *object = static_cast<IAudioProcessingObjectRT*>(this);
  } else if (IsEqualIID(riid,
                        __uuidof(IAudioProcessingObjectConfiguration))) {
    *object = static_cast<IAudioProcessingObjectConfiguration*>(this);
  } else if (IsEqualIID(riid, __uuidof(IAudioSystemEffects))) {
    *object = static_cast<IAudioSystemEffects*>(this);
  } else if (IsEqualIID(riid, __uuidof(IAudioSystemEffects2))) {
    *object = static_cast<IAudioSystemEffects2*>(this);
  } else {
    return E_NOINTERFACE;
  }
  AddRef();
  return S_OK;
}

STDMETHODIMP_(ULONG) Apo::AddRef() {
  return references_.fetch_add(1, std::memory_order_relaxed) + 1;
}

STDMETHODIMP_(ULONG) Apo::Release() {
  const ULONG left = references_.fetch_sub(1, std::memory_order_acq_rel) - 1;
  if (left == 0) {
    delete this;
  }
  return left;
}

STDMETHODIMP Apo::Reset() {
  // Nothing survives a reset that a reset would have to clear. The filter
  // histories live in the graph, which is rebuilt from the configuration at
  // the next `LockForProcess`; zeroing them here would mean touching memory
  // the audio thread owns from a thread that does not, to remove at most one
  // block's worth of decaying tail.
  return S_OK;
}

STDMETHODIMP Apo::GetLatency(HNSTIME* time) {
  if (time == nullptr) {
    return E_POINTER;
  }
  *time = 0;
  const uint32_t frames = slot_.latency();
  if (frames == 0 || sample_rate_ == 0) {
    return S_OK;
  }
  // HNSTIME counts 100 ns units; done in 64-bit integers because the frame
  // counts here reach 65536 and the rates reach 384000.
  *time = static_cast<HNSTIME>(static_cast<uint64_t>(frames) * 10000000ULL /
                               static_cast<uint64_t>(sample_rate_));
  return S_OK;
}

STDMETHODIMP Apo::GetRegistrationProperties(APO_REG_PROPERTIES** properties) {
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
  // three MUST_MATCH flags because this effect neither resamples, remixes nor
  // converts sample types: a format the two sides disagree about is one the
  // audio engine has to reconcile before it reaches here.
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

void Apo::read_endpoint(IMMDeviceCollection* collection, UINT index) {
  if (collection == nullptr) {
    return;
  }
  IMMDevice* device = nullptr;
  if (FAILED(collection->Item(index, &device)) || device == nullptr) {
    return;
  }
  LPWSTR id = nullptr;
  if (SUCCEEDED(device->GetId(&id))) {
    endpoint_.guid = guid_from_device_id(id);
    CoTaskMemFree(id);
  }
  IPropertyStore* store = nullptr;
  if (SUCCEEDED(device->OpenPropertyStore(STGM_READ, &store)) &&
      store != nullptr) {
    PROPVARIANT value;
    PropVariantInit(&value);
    if (SUCCEEDED(store->GetValue(PKEY_Device_FriendlyName, &value)) &&
        value.vt == VT_LPWSTR && value.pwszVal != nullptr) {
      endpoint_.friendly_name = value.pwszVal;
    }
    PropVariantClear(&value);
    store->Release();
  }
  device->Release();
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
  // A host with nothing to say about the endpoint is not an error: the
  // resolver then applies only the configuration blocks that name no device,
  // and the log says so.
  if (size == 0 || data == nullptr) {
    initialized_ = true;
    return S_OK;
  }

  try {
    if (size == sizeof(APOInitSystemEffects3)) {
      const auto* init = reinterpret_cast<const APOInitSystemEffects3*>(data);
      processing_mode_ = init->AudioProcessingMode;
      read_endpoint(init->pDeviceCollection,
                    init->nSoftwareIoDeviceInCollection);
    } else if (size == sizeof(APOInitSystemEffects2)) {
      const auto* init = reinterpret_cast<const APOInitSystemEffects2*>(data);
      processing_mode_ = init->AudioProcessingMode;
      read_endpoint(init->pDeviceCollection,
                    init->nSoftwareIoDeviceInCollection);
    } else if (size == sizeof(APOInitSystemEffects)) {
      const auto* init = reinterpret_cast<const APOInitSystemEffects*>(data);
      // Version 1 has no index; the collection it carries holds the one
      // endpoint this instance was created for.
      read_endpoint(init->pDeviceCollection, 0);
    } else {
      return E_INVALIDARG;
    }
  } catch (...) {
    // Only the two strings in `endpoint_` can throw here, and an endpoint we
    // could not name is a pass-through, not a reason to refuse to load.
    endpoint_ = Endpoint();
  }
  initialized_ = true;
  return S_OK;
}

STDMETHODIMP Apo::IsInputFormatSupported(IAudioMediaType* opposite,
                                         IAudioMediaType* requested,
                                         IAudioMediaType** supported) {
  UNREFERENCED_PARAMETER(opposite);
  if (supported == nullptr) {
    return E_POINTER;
  }
  *supported = nullptr;
  if (requested == nullptr) {
    return E_POINTER;
  }
  const WAVEFORMATEX* format = requested->GetAudioFormat();
  if (describe_format(format).acceptable) {
    // The requested type handed straight back, with a reference of its own.
    // The alternative reading of the contract — S_OK with a null out
    // parameter — is the one that crashes a caller which dereferences it,
    // and this one costs a caller that ignores it only a release it was
    // going to make anyway.
    *supported = requested;
    requested->AddRef();
    return S_OK;
  }
  const HRESULT made = suggest_float(format, supported);
  if (FAILED(made)) {
    *supported = nullptr;
    return APOERR_FORMAT_NOT_SUPPORTED;
  }
  return S_FALSE;
}

STDMETHODIMP Apo::IsOutputFormatSupported(IAudioMediaType* opposite,
                                          IAudioMediaType* requested,
                                          IAudioMediaType** supported) {
  // Symmetric by construction: this effect never changes the format, so a
  // format it can read is exactly a format it can write.
  return IsInputFormatSupported(opposite, requested, supported);
}

STDMETHODIMP Apo::GetInputChannelCount(UINT32* channels) {
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

STDMETHODIMP_(UINT32) Apo::CalcInputFrames(UINT32 output_frames) {
  return output_frames;
}

STDMETHODIMP_(UINT32) Apo::CalcOutputFrames(UINT32 input_frames) {
  return input_frames;
}

}  // namespace fluideq_engine
