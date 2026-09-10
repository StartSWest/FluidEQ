/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The handle and the four typed accessors both registry files are built on.
 *
 * Internal to the helper — nothing outside `registry.cpp` and
 * `com_registration.cpp` includes it. It exists because those two were one
 * file that had grown past the limit, and the half that registers a COM class
 * and the half that edits somebody else's audio driver are different jobs with
 * different failure modes.
 *
 * Everything opens with `KEY_WOW64_64KEY`. The helper is a 64-bit binary and
 * would reach the 64-bit view anyway; naming it is the point, because a future
 * 32-bit build that silently landed in `Wow6432Node` would register an effect
 * the audio engine cannot see and report success.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_REG_KEY_H
#define FLUIDEQ_ENGINE_SETUP_REG_KEY_H

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <string>
#include <vector>

namespace fluideq_engine::setup {

/** An owning `HKEY`, so that no early return can leave one open. */
class RegKey {
 public:
  RegKey() = default;
  ~RegKey() { reset(); }
  RegKey(const RegKey&) = delete;
  RegKey& operator=(const RegKey&) = delete;

  HKEY get() const noexcept { return key_; }
  HKEY* receive() noexcept {
    reset();
    return &key_;
  }
  void reset() noexcept {
    if (key_ != nullptr) {
      RegCloseKey(key_);
      key_ = nullptr;
    }
  }

 private:
  HKEY key_ = nullptr;
};

inline LSTATUS open_read(const std::wstring& path, RegKey& key) {
  return RegOpenKeyExW(HKEY_LOCAL_MACHINE, path.c_str(), 0,
                       KEY_READ | KEY_WOW64_64KEY, key.receive());
}

inline LSTATUS create_write(const std::wstring& path, RegKey& key) {
  return RegCreateKeyExW(HKEY_LOCAL_MACHINE, path.c_str(), 0, nullptr,
                         REG_OPTION_NON_VOLATILE,
                         KEY_SET_VALUE | KEY_WOW64_64KEY, nullptr,
                         key.receive(), nullptr);
}

inline LSTATUS set_string(HKEY key, const wchar_t* name,
                          const std::wstring& value) {
  return RegSetValueExW(
      key, name, 0, REG_SZ, reinterpret_cast<const BYTE*>(value.c_str()),
      static_cast<DWORD>((value.size() + 1) * sizeof(wchar_t)));
}

inline LSTATUS set_dword(HKEY key, const wchar_t* name, DWORD value) {
  return RegSetValueExW(key, name, 0, REG_DWORD,
                        reinterpret_cast<const BYTE*>(&value), sizeof(value));
}

/** Raw bytes of one value, with its type, or nothing when it is absent. */
inline bool query_value(HKEY key, const std::wstring& name, DWORD& type,
                        std::vector<BYTE>& bytes, bool& present) {
  present = false;
  DWORD size = 0;
  LSTATUS asked =
      RegQueryValueExW(key, name.c_str(), nullptr, &type, nullptr, &size);
  if (asked == ERROR_FILE_NOT_FOUND) {
    return true;
  }
  if (asked != ERROR_SUCCESS) {
    return false;
  }
  bytes.assign(size, 0);
  asked = RegQueryValueExW(key, name.c_str(), nullptr, &type,
                           size == 0 ? nullptr : bytes.data(), &size);
  if (asked != ERROR_SUCCESS) {
    return false;
  }
  bytes.resize(size);
  present = true;
  return true;
}

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_REG_KEY_H
