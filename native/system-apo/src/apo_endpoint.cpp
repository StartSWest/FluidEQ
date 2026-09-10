/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "apo.h"
#include <propvarutil.h>
#include <functiondiscoverykeys_devpkey.h>
#include <wrl/client.h>

namespace fluideq_engine {
namespace {

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

}  // namespace

void Apo::read_endpoint_properties(IPropertyStore* properties) {
  if (properties == nullptr) {
    return;
  }
  // Windows supplies the endpoint's own property store in all three layouts.
  // The collection's software I/O device can instead be a KS topology node;
  // its opaque GetId string does not identify the endpoint's EQ profile.
  PropVariant guid;
  if (SUCCEEDED(properties->GetValue(PKEY_AudioEndpoint_GUID, guid.receive())) &&
      guid.get().vt == VT_LPWSTR && guid.get().pwszVal != nullptr) {
    GUID parsed = {};
    if (SUCCEEDED(CLSIDFromString(guid.get().pwszVal, &parsed))) {
      wchar_t text[39] = {};
      if (StringFromGUID2(parsed, text, 39) != 0) {
        endpoint_.guid = text;
      }
    }
  }
  PropVariant name;
  if (SUCCEEDED(properties->GetValue(PKEY_Device_FriendlyName, name.receive())) &&
      name.get().vt == VT_LPWSTR && name.get().pwszVal != nullptr) {
    endpoint_.friendly_name = name.get().pwszVal;
  }
}

void Apo::read_endpoint(IMMDeviceCollection* collection, UINT index) {
  if (!endpoint_.guid.empty() || collection == nullptr) {
    return;
  }
  Microsoft::WRL::ComPtr<IMMDevice> device;
  if (FAILED(collection->Item(index, device.GetAddressOf())) || !device) {
    return;
  }
  Microsoft::WRL::ComPtr<IPropertyStore> store;
  if (SUCCEEDED(device->OpenPropertyStore(STGM_READ, store.GetAddressOf()))) {
    read_endpoint_properties(store.Get());
  }
}

}  // namespace fluideq_engine
