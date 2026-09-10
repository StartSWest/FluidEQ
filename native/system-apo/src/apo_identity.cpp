/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "apo.h"

namespace fluideq_engine {

// Windows can aggregate the effect into its audio graph. Rejecting an outer
// IUnknown at the factory allowed standalone discovery but prevented that
// graph from ever initializing the effect. The inner identity owns our
// lifetime; all exposed interfaces use the host's controlling identity.
// https://learn.microsoft.com/en-us/windows/win32/com/aggregation
Apo::Apo(IUnknown* outer)
    : controlling_unknown_(outer == nullptr ? &inner_ : outer) {
  g_object_count.fetch_add(1, std::memory_order_relaxed);
}

Apo::~Apo() {
  release_locked_state();
  g_object_count.fetch_sub(1, std::memory_order_relaxed);
}

IUnknown* Apo::inner_unknown() noexcept { return &inner_; }

STDMETHODIMP Apo::QueryInterface(REFIID riid, void** object) {
  return controlling_unknown_->QueryInterface(riid, object);
}

STDMETHODIMP_(ULONG) Apo::AddRef() { return controlling_unknown_->AddRef(); }

STDMETHODIMP_(ULONG) Apo::Release() { return controlling_unknown_->Release(); }

STDMETHODIMP Apo::InnerUnknown::QueryInterface(REFIID riid, void** object) {
  return owner_.query_inner(riid, object);
}

STDMETHODIMP_(ULONG) Apo::InnerUnknown::AddRef() {
  return owner_.references_.fetch_add(1, std::memory_order_relaxed) + 1;
}

STDMETHODIMP_(ULONG) Apo::InnerUnknown::Release() {
  const ULONG left =
      owner_.references_.fetch_sub(1, std::memory_order_acq_rel) - 1;
  if (left == 0) {
    delete &owner_;
  }
  return left;
}

HRESULT Apo::query_inner(REFIID riid, void** object) {
  if (object == nullptr) {
    return E_POINTER;
  }
  *object = nullptr;
  if (IsEqualIID(riid, __uuidof(IUnknown))) {
    *object = static_cast<IUnknown*>(&inner_);
    inner_.AddRef();
    return S_OK;
  }
  if (IsEqualIID(riid, __uuidof(IAudioProcessingObject))) {
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
  } else if (IsEqualIID(riid, __uuidof(IAudioSystemEffects3))) {
    *object = static_cast<IAudioSystemEffects3*>(this);
  } else {
    return E_NOINTERFACE;
  }
  AddRef();
  return S_OK;
}

}  // namespace fluideq_engine
