/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The one translation unit in the helper that defines the GUIDs it names.
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <initguid.h>

#include <mmdeviceapi.h>

// In this order and no other. `functiondiscoverykeys_devpkey.h` does not
// include `propkeydef.h` itself and expects the caller to have done it, and
// `propkeydef.h` deliberately has no include guard because it redefines
// DEFINE_PROPERTYKEY according to whether INITGUID is set when it is read.
#include <propkeydef.h>

#include <functiondiscoverykeys_devpkey.h>

#include "endpoints.h"

#include <string>
#include <vector>

namespace fluideq_engine::setup {

namespace {

/**
 * An HRESULT as `0x88890008`, which is the only form worth printing.
 *
 * Not the Win32 error describer: an HRESULT is not a Win32 code, and
 * `FormatMessage` given one either finds nothing or finds the unrelated
 * message belonging to whatever Win32 error shares its bits. The hexadecimal
 * is what a person can look up; a wrong sentence is what sends them looking in
 * the wrong place.
 */
std::wstring describe_hresult(HRESULT code) {
  const wchar_t digits[] = L"0123456789ABCDEF";
  const unsigned long value = static_cast<unsigned long>(code);
  std::wstring text = L"0x";
  for (int shift = 28; shift >= 0; shift -= 4) {
    text += digits[(value >> shift) & 0xFu];
  }
  return text;
}

/** A COM pointer that releases itself, so no early return leaks one. */
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

  Interface* get() const noexcept { return pointer_; }
  Interface** receive() noexcept { return &pointer_; }

 private:
  Interface* pointer_ = nullptr;
};

/** The last brace group of a device id, upper cased. */
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

std::wstring friendly_name(IMMDevice* device) {
  ComPtr<IPropertyStore> store;
  if (FAILED(device->OpenPropertyStore(STGM_READ, store.receive())) ||
      store.get() == nullptr) {
    return std::wstring();
  }
  PROPVARIANT value;
  PropVariantInit(&value);
  std::wstring name;
  if (SUCCEEDED(store.get()->GetValue(PKEY_Device_FriendlyName, &value)) &&
      value.vt == VT_LPWSTR && value.pwszVal != nullptr) {
    name = value.pwszVal;
  }
  PropVariantClear(&value);
  return name;
}

}  // namespace

bool list_render_endpoints(std::vector<Endpoint>& out, std::wstring& error) {
  out.clear();
  ComPtr<IMMDeviceEnumerator> enumerator;
  HRESULT made = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                                  CLSCTX_INPROC_SERVER,
                                  __uuidof(IMMDeviceEnumerator),
                                  reinterpret_cast<void**>(
                                      enumerator.receive()));
  if (FAILED(made) || enumerator.get() == nullptr) {
    error = L"could not reach the audio device list: " +
            describe_hresult(made);
    return false;
  }

  ComPtr<IMMDeviceCollection> devices;
  made = enumerator.get()->EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE,
                                              devices.receive());
  if (FAILED(made) || devices.get() == nullptr) {
    error = L"could not list the outputs: " + describe_hresult(made);
    return false;
  }

  UINT count = 0;
  const HRESULT counted = devices.get()->GetCount(&count);
  if (FAILED(counted)) {
    error = L"could not count the outputs: " + describe_hresult(counted);
    return false;
  }
  for (UINT at = 0; at < count; ++at) {
    ComPtr<IMMDevice> device;
    if (FAILED(devices.get()->Item(at, device.receive())) ||
        device.get() == nullptr) {
      continue;
    }
    LPWSTR id = nullptr;
    if (FAILED(device.get()->GetId(&id)) || id == nullptr) {
      continue;
    }
    Endpoint endpoint;
    endpoint.guid = guid_from_device_id(id);
    CoTaskMemFree(id);
    if (endpoint.guid.empty()) {
      continue;
    }
    endpoint.name = friendly_name(device.get());
    out.push_back(std::move(endpoint));
  }
  return true;
}

}  // namespace fluideq_engine::setup
