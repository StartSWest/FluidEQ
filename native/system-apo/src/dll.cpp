/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The module: what Windows calls before it has an object to talk to.
 *
 * There is no `DllRegisterServer` here, and that is deliberate rather than
 * unfinished. Registering a system effect means writing under HKLM and
 * naming a class the audio engine will load into audiodg.exe for every
 * output it is attached to; that is an installer's decision, made once, with
 * the user's consent and an uninstaller that can undo it. A DLL that can
 * register itself is a DLL any stray `regsvr32` — or any other installer that
 * happens to find it — can attach to somebody's speakers.
 */

#include "apo.h"
#include "log.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <new>

namespace fluideq_engine {

namespace {

/**
 * The class object, one static instance for the life of the module.
 *
 * It carries no state, so its own reference count is bookkeeping rather than
 * ownership and is deliberately kept out of the module's object count:
 * holding a class object is not a reason to keep a DLL loaded, holding an
 * effect that is filtering somebody's audio is.
 */
class Factory final : public IClassFactory {
 public:
  STDMETHODIMP QueryInterface(REFIID riid, void** object) override {
    if (object == nullptr) {
      return E_POINTER;
    }
    *object = nullptr;
    if (IsEqualIID(riid, __uuidof(IUnknown)) ||
        IsEqualIID(riid, __uuidof(IClassFactory))) {
      *object = static_cast<IClassFactory*>(this);
      AddRef();
      return S_OK;
    }
    return E_NOINTERFACE;
  }

  STDMETHODIMP_(ULONG) AddRef() override { return 2; }
  STDMETHODIMP_(ULONG) Release() override { return 1; }

  STDMETHODIMP CreateInstance(IUnknown* outer, REFIID riid,
                              void** object) override {
    if (object == nullptr) {
      return E_POINTER;
    }
    *object = nullptr;
    // An aggregating host must receive the inner IUnknown, so it can own
    // that identity while exposing the APO interfaces as its own.
    if (outer != nullptr && !IsEqualIID(riid, __uuidof(IUnknown))) {
      return E_NOINTERFACE;
    }
    auto* apo = new (std::nothrow) Apo(outer);
    if (apo == nullptr) {
      return E_OUTOFMEMORY;
    }
    IUnknown* const inner = apo->inner_unknown();
    const HRESULT asked = inner->QueryInterface(riid, object);
    // The constructor's reference; whatever `QueryInterface` handed out has
    // its own, and on failure this is the one that destroys the object.
    inner->Release();
    // The first line the log ever gets from a host: without it, an effect
    // the audio engine never creates and one it creates and then drops are
    // the same empty file.
    trace(L"", (SUCCEEDED(asked) ? (outer == nullptr
                                      ? "created standalone, as "
                                      : "created aggregated, as ")
                                 : "created, but the host asked for an "
                                   "interface this effect does not offer: ") +
                   guid_text(riid));
    return asked;
  }

  STDMETHODIMP LockServer(BOOL lock) override {
    if (lock) {
      g_object_count.fetch_add(1, std::memory_order_relaxed);
    } else {
      g_object_count.fetch_sub(1, std::memory_order_relaxed);
    }
    return S_OK;
  }
};

Factory g_factory;

}  // namespace

}  // namespace fluideq_engine

extern "C" STDAPI DllGetClassObject(REFCLSID clsid, REFIID riid,
                                    LPVOID* object) {
  if (object == nullptr) {
    return E_POINTER;
  }
  *object = nullptr;
  if (!IsEqualCLSID(clsid, fluideq_engine::kEngineClsid)) {
    return CLASS_E_CLASSNOTAVAILABLE;
  }
  return fluideq_engine::g_factory.QueryInterface(riid, object);
}

extern "C" STDAPI DllCanUnloadNow() {
  return fluideq_engine::g_object_count.load(std::memory_order_acquire) == 0
             ? S_OK
             : S_FALSE;
}

BOOL WINAPI DllMain(HINSTANCE module, DWORD reason, LPVOID reserved) {
  UNREFERENCED_PARAMETER(reserved);
  if (reason == DLL_PROCESS_ATTACH) {
    // Nothing here needs to know about threads, and audiodg.exe creates and
    // destroys plenty: every one of them would otherwise take the loader
    // lock to tell this module something it would ignore.
    //
    // THIS LINE MUST GO if this DLL is ever linked against the static CRT
    // (/MT). A statically linked CRT does its own per-thread setup and
    // teardown from DLL_THREAD_ATTACH and DLL_THREAD_DETACH, so silencing
    // those leaks a block of per-thread state for every thread audiodg.exe
    // ever runs. It is correct only because this DLL is /MD and the CRT DLL
    // gets its own notifications.
    DisableThreadLibraryCalls(module);
  }
  return TRUE;
}
