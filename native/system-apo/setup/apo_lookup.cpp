/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "apo_lookup.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winver.h>

#include <cwchar>
#include <iterator>
#include <utility>
#include <vector>

#include "fx_list.h"

namespace fluideq_engine::setup {

namespace {

/**
 * The AudioProcessingObject device class: the drivers of Windows 11's audio
 * effects components ("Elevoc Audio Effects Component", "THX Audio
 * Processing Object Component", "Voice Clarity") live under it, one numbered
 * key each, readable by any user.
 */
constexpr wchar_t kComponentClass[] =
    L"SYSTEM\\CurrentControlSet\\Control\\Class\\"
    L"{5989fce8-9cd0-467d-8a6a-5419e31529d4}";

/** Far past any machine; a bound on a loop over somebody else's keys. */
constexpr DWORD kMaxComponents = 4096;

/** A string value, `REG_EXPAND_SZ` expanded, or empty. */
std::wstring read_string(HKEY root, const std::wstring& path,
                         const wchar_t* value) {
  DWORD size = 0;
  // RRF_RT_REG_SZ alone takes a REG_EXPAND_SZ too, expanded. This program
  // is 64-bit, so the view it reads is the 64-bit one audiodg reads.
  constexpr DWORD kFlags = RRF_RT_REG_SZ;
  if (RegGetValueW(root, path.c_str(), value, kFlags, nullptr, nullptr,
                   &size) != ERROR_SUCCESS ||
      size < sizeof(wchar_t)) {
    return std::wstring();
  }
  std::vector<wchar_t> buffer(size / sizeof(wchar_t) + 1, L'\0');
  if (RegGetValueW(root, path.c_str(), value, kFlags, nullptr, buffer.data(),
                   &size) != ERROR_SUCCESS) {
    return std::wstring();
  }
  return std::wstring(buffer.data());
}

bool key_exists(HKEY root, const std::wstring& path) {
  HKEY key = nullptr;
  if (RegOpenKeyExW(root, path.c_str(), 0, KEY_READ | KEY_WOW64_64KEY, &key) !=
      ERROR_SUCCESS) {
    return false;
  }
  RegCloseKey(key);
  return true;
}

/** A path as InprocServer32 holds it: quotes off, nothing else changed. */
std::wstring unquoted(std::wstring path) {
  if (path.size() >= 2 && path.front() == L'"' && path.back() == L'"') {
    path = path.substr(1, path.size() - 2);
  }
  return path;
}

/**
 * A full path only. A bare file name would be found by the loader's search
 * order, which is a question about somebody else's folders this report has
 * no business asking.
 */
bool is_absolute(const std::wstring& path) {
  return (path.size() > 2 && path[1] == L':' &&
          (path[2] == L'\\' || path[2] == L'/')) ||
         path.rfind(L"\\\\", 0) == 0;
}

/** Fills each empty field of `into` from `from`. */
void fill(std::wstring& into, const std::wstring& from) {
  if (into.empty()) {
    into = from;
  }
}

/**
 * The two keys a class id is registered by: `AudioEngine` under `engine`,
 * `CLSID` under `classes` — both `SOFTWARE\Classes` machine-wide, and a
 * component's driver key and its `Classes` subkey for a component.
 */
void read_registration(HKEY root, const std::wstring& engine,
                       const std::wstring& classes, const std::wstring& clsid,
                       ApoSources& sources) {
  const std::wstring apo =
      engine + L"\\AudioEngine\\AudioProcessingObjects\\" + clsid;
  fill(sources.friendly_name, read_string(root, apo, L"FriendlyName"));
  fill(sources.copyright, read_string(root, apo, L"Copyright"));
  const std::wstring com = classes + L"\\CLSID\\" + clsid;
  fill(sources.class_name, read_string(root, com, nullptr));
  fill(sources.dll_path,
       unquoted(read_string(root, com + L"\\InprocServer32", nullptr)));
}

/**
 * The effects component whose driver registers `clsid`: the first one, as
 * every copy of a component (one per headset) carries the same files.
 */
void read_component(const std::wstring& clsid, ApoSources& sources) {
  HKEY components = nullptr;
  if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, kComponentClass, 0,
                    KEY_READ | KEY_WOW64_64KEY,
                    &components) != ERROR_SUCCESS) {
    return;
  }
  for (DWORD index = 0; index < kMaxComponents; ++index) {
    wchar_t name[256] = {};
    DWORD length = static_cast<DWORD>(std::size(name));
    const LONG status = RegEnumKeyExW(components, index, name, &length,
                                      nullptr, nullptr, nullptr, nullptr);
    if (status == ERROR_NO_MORE_ITEMS) {
      break;
    }
    if (status != ERROR_SUCCESS) {
      continue;
    }
    const std::wstring driver = std::wstring(kComponentClass) + L"\\" + name;
    if (!key_exists(HKEY_LOCAL_MACHINE,
                    driver + L"\\AudioEngine\\AudioProcessingObjects\\" +
                        clsid)) {
      continue;
    }
    read_registration(HKEY_LOCAL_MACHINE, driver, driver + L"\\Classes", clsid,
                      sources);
    fill(sources.component,
         read_string(HKEY_LOCAL_MACHINE, driver, L"DriverDesc"));
    fill(sources.provider,
         read_string(HKEY_LOCAL_MACHINE, driver, L"ProviderName"));
    break;
  }
  RegCloseKey(components);
}

/** One string of a version block, in its first language, then in English. */
std::wstring version_string(std::vector<BYTE>& block, const wchar_t* field) {
  std::vector<std::wstring> languages;
  struct Translation {
    WORD language;
    WORD code_page;
  };
  Translation* table = nullptr;
  UINT bytes = 0;
  if (VerQueryValueW(block.data(), L"\\VarFileInfo\\Translation",
                     reinterpret_cast<LPVOID*>(&table), &bytes) != 0 &&
      table != nullptr && bytes >= sizeof(Translation)) {
    wchar_t code[16] = {};
    std::swprintf(code, std::size(code), L"%04x%04x", table[0].language,
                  table[0].code_page);
    languages.emplace_back(code);
  }
  languages.emplace_back(L"040904b0");
  languages.emplace_back(L"040904e4");
  for (const std::wstring& language : languages) {
    const std::wstring path =
        L"\\StringFileInfo\\" + language + L"\\" + field;
    wchar_t* text = nullptr;
    UINT characters = 0;
    if (VerQueryValueW(block.data(), path.c_str(),
                       reinterpret_cast<LPVOID*>(&text), &characters) != 0 &&
        text != nullptr && characters > 1) {
      return std::wstring(text);
    }
  }
  return std::wstring();
}

void read_version_resource(ApoSources& sources) {
  if (!is_absolute(sources.dll_path)) {
    return;
  }
  DWORD ignored = 0;
  const DWORD size = GetFileVersionInfoSizeW(sources.dll_path.c_str(),
                                             &ignored);
  if (size == 0) {
    return;
  }
  std::vector<BYTE> block(size, 0);
  if (GetFileVersionInfoW(sources.dll_path.c_str(), 0, size, block.data()) ==
      0) {
    return;
  }
  sources.file_description = version_string(block, L"FileDescription");
  sources.company = version_string(block, L"CompanyName");
  sources.file_version = dll_version(sources.dll_path);
}

}  // namespace

std::wstring dll_version(const std::wstring& path) {
  DWORD ignored = 0;
  const DWORD size = GetFileVersionInfoSizeW(path.c_str(), &ignored);
  if (size == 0) {
    return std::wstring();
  }
  std::vector<BYTE> block(size, 0);
  if (GetFileVersionInfoW(path.c_str(), 0, size, block.data()) == 0) {
    return std::wstring();
  }
  VS_FIXEDFILEINFO* fixed = nullptr;
  UINT length = 0;
  if (VerQueryValueW(block.data(), L"\\", reinterpret_cast<LPVOID*>(&fixed),
                     &length) == 0 ||
      fixed == nullptr || length < sizeof(VS_FIXEDFILEINFO)) {
    return std::wstring();
  }
  return std::to_wstring(HIWORD(fixed->dwFileVersionMS)) + L"." +
         std::to_wstring(LOWORD(fixed->dwFileVersionMS)) + L"." +
         std::to_wstring(HIWORD(fixed->dwFileVersionLS)) + L"." +
         std::to_wstring(LOWORD(fixed->dwFileVersionLS));
}

ApoSources read_apo_sources(const std::wstring& clsid) {
  ApoSources sources;
  read_registration(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Classes",
                    L"SOFTWARE\\Classes", clsid, sources);
  if (sources.friendly_name.empty() || sources.dll_path.empty()) {
    read_component(clsid, sources);
  }
  read_version_resource(sources);
  return sources;
}

ApoInfo apo_info(const std::wstring& clsid) {
  // Copied out, never referenced: a later class id grows the vector.
  static std::vector<std::pair<std::wstring, ApoInfo>> known;
  for (const auto& [id, info] : known) {
    if (equal_ci(id, clsid)) {
      return info;
    }
  }
  known.emplace_back(clsid, resolve_apo(read_apo_sources(clsid)));
  return known.back().second;
}

}  // namespace fluideq_engine::setup
