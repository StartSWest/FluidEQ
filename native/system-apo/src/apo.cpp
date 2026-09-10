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

/**
 * Three holders so nothing leaks when a `std::wstring` throws.
 *
 * Everything `read_endpoint` touches is either a COM reference, a
 * CoTaskMem allocation or a PROPVARIANT, and the only throwing expression
 * anywhere near them is building the strings out of what they hold. A
 * `bad_alloc` on the way past a hand-written release leaks an `IMMDevice`,
 * an `IPropertyStore` and a device-name string inside audiodg.exe, once per
 * endpoint that ever initialises while the machine is short of memory.
 */
template <typename Interface>
class ComPtr {
 public:
  ComPtr() = default;
  ~ComPtr() {
    if (pointer_ != nullptr) {
      pointer_->Release();
    }
  }
  ComPtr(const ComPtr&) = delete;
  ComPtr& operator=(const ComPtr&) = delete;

  Interface** receive() noexcept { return &pointer_; }
  Interface* get() const noexcept { return pointer_; }

 private:
  Interface* pointer_ = nullptr;
};

class CoTaskString {
 public:
  CoTaskString() = default;
  ~CoTaskString() { CoTaskMemFree(text_); }
  CoTaskString(const CoTaskString&) = delete;
  CoTaskString& operator=(const CoTaskString&) = delete;

  LPWSTR* receive() noexcept { return &text_; }
  const wchar_t* get() const noexcept { return text_; }

 private:
  LPWSTR text_ = nullptr;
};

class PropVariant {
 public:
  PropVariant() { PropVariantInit(&value_); }
  ~PropVariant() { PropVariantClear(&value_); }
  PropVariant(const PropVariant&) = delete;
  PropVariant& operator=(const PropVariant&) = delete;

  PROPVARIANT* receive() noexcept { return &value_; }
  const PROPVARIANT& get() const noexcept { return value_; }

 private:
  PROPVARIANT value_;
};

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
  ComPtr<IMMDevice> device;
  if (FAILED(collection->Item(index, device.receive())) ||
      device.get() == nullptr) {
    return;
  }

  // Built into locals first, and moved into the members only once every
  // handle above has been released: a throw here leaves the endpoint
  // unnamed, which is a pass-through, rather than half-named.
  std::wstring guid;
  {
    CoTaskString id;
    if (SUCCEEDED(device.get()->GetId(id.receive()))) {
      guid = guid_from_device_id(id.get());
    }
  }

  std::wstring name;
  {
    ComPtr<IPropertyStore> store;
    if (SUCCEEDED(device.get()->OpenPropertyStore(STGM_READ,
                                                  store.receive())) &&
        store.get() != nullptr) {
      PropVariant value;
      if (SUCCEEDED(store.get()->GetValue(PKEY_Device_FriendlyName,
                                          value.receive())) &&
          value.get().vt == VT_LPWSTR && value.get().pwszVal != nullptr) {
        name = value.get().pwszVal;
      }
    }
  }

  endpoint_.guid = std::move(guid);
  endpoint_.friendly_name = std::move(name);
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
  if (size < sizeof(APOInitBaseStruct)) {
    return E_INVALIDARG;
  }

  // Which structure the host says it filled in, rather than how many bytes it
  // happened to pass. `size` still caps it: reading past what was handed over
  // is reading somebody else's stack, and a host that left `cbSize` at zero
  // leaves `size` as the only number there is.
  const auto* base = reinterpret_cast<const APOInitBaseStruct*>(data);
  UINT32 declared = base->cbSize;
  trace(L"", "initialize: " + std::to_string(size) + " bytes handed over, " +
                 "cbSize " + std::to_string(declared) + " (known layouts: " +
                 std::to_string(sizeof(APOInitSystemEffects)) + ", " +
                 std::to_string(sizeof(APOInitSystemEffects2)) + ", " +
                 std::to_string(sizeof(APOInitSystemEffects3)) + ")");
  if (declared == 0 || declared > size) {
    declared = size;
  }

  // The biggest layout this code knows, whichever version that happens to be:
  // the versions are not ordered by size and a later SDK could reorder them
  // again.
  constexpr UINT32 kLargestKnown = static_cast<UINT32>(
      sizeof(APOInitSystemEffects2) > sizeof(APOInitSystemEffects3)
          ? sizeof(APOInitSystemEffects2)
          : sizeof(APOInitSystemEffects3));

  // Tries one candidate size against the cascade; returns whether it named a
  // known layout. Anything larger than every known version is a later SDK
  // extending the newest layout, and is read as that rather than refused:
  // refusing means the effect never loads and every output on the machine
  // plays unprocessed, with nothing on screen to say why. Anything else has
  // to match a known size exactly — a size between two of them names a layout
  // this code cannot know, and guessing would mean dereferencing whatever
  // sits where a pointer used to be.
  const auto read_as = [&](UINT32 candidate) -> bool {
    if (candidate > kLargestKnown ||
        candidate == sizeof(APOInitSystemEffects3)) {
      const auto* init = reinterpret_cast<const APOInitSystemEffects3*>(data);
      processing_mode_ = init->AudioProcessingMode;
      read_endpoint(init->pDeviceCollection,
                    init->nSoftwareIoDeviceInCollection);
      return true;
    }
    if (candidate == sizeof(APOInitSystemEffects2)) {
      const auto* init = reinterpret_cast<const APOInitSystemEffects2*>(data);
      processing_mode_ = init->AudioProcessingMode;
      read_endpoint(init->pDeviceCollection,
                    init->nSoftwareIoDeviceInCollection);
      return true;
    }
    if (candidate == sizeof(APOInitSystemEffects)) {
      const auto* init = reinterpret_cast<const APOInitSystemEffects*>(data);
      // Version 1 has no index; the collection it carries holds the one
      // endpoint this instance was created for.
      read_endpoint(init->pDeviceCollection, 0);
      return true;
    }
    return false;
  };

  try {
    // `declared` first, and — only when it names nothing this code knows —
    // retried against `size`, the byte count Windows actually handed over. A
    // host can miscompute `cbSize` while still passing a buffer that is
    // exactly one known layout's size, and refusing that payload is the same
    // silent failure as refusing an oversized one: the effect never loads.
    // Reading `size` bytes is always in bounds, because the check above
    // already guarantees `size` bytes exist. `read_as` has no effect when it
    // returns false, so calling it twice with the same value when `declared`
    // already equals `size` costs nothing.
    if (!read_as(declared) && !read_as(size)) {
      trace(L"", "initialize refused: neither size names a layout this "
                 "effect knows");
      return E_INVALIDARG;
    }
  } catch (...) {
    // Only the two strings in `endpoint_` can throw here, and an endpoint we
    // could not name is a pass-through, not a reason to refuse to load.
    endpoint_ = Endpoint();
  }
  initialized_ = true;
  trace(endpoint_.guid,
        "initialized for \"" + to_utf8(endpoint_.friendly_name) + "\"" +
            (is_default_processing_mode() ? "" : ", not the default mode"));
  return S_OK;
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
