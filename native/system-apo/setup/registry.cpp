/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "registry.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "fs.h"

namespace fluideq_engine::setup {

const wchar_t kEngineClsid[] = L"{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}";
const wchar_t kEngineFriendlyName[] = L"FluidEQ Engine";

namespace {

const wchar_t kRenderPath[] =
    L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render";
const wchar_t kAudioPath[] =
    L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Audio";
const wchar_t kApoPath[] =
    L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Audio"
    L"\\AudioProcessingObjects";
// HKEY_CLASSES_ROOT is a merged view of this key and the per-user one. A
// machine-wide registration has to be written to the machine-wide half by
// name: writing through the merged view lands wherever it happens to resolve.
const wchar_t kClassesPath[] = L"SOFTWARE\\Classes\\CLSID";

/** The FX property set, whose members are the effect values themselves. */
const wchar_t kFxProperty[] = L"{d04e05a6-594b-4fb6-a80d-01af5eed7d1d}";
/** The signal-processing-mode property set that sits beside them. */
const wchar_t kModeProperty[] = L"{d3993a3f-99c2-4402-b5ec-a92a0367664b}";

/** `IID_IAudioProcessingObject` — the one interface the effect advertises. */
const wchar_t kApoInterface[] = L"{FD7F2B29-24D0-4B5C-B177-592C39F9CA10}";

const int kSinglePid[kSlotCount] = {5, 6, 7};
const int kCompositePid[kSlotCount] = {13, 14, 15};
const int kLegacyPid[kLegacyCount] = {1, 2};
const int kModePid[kSlotCount] = {5, 6, 7};

std::wstring value_name(const wchar_t* property_set, int pid) {
  return std::wstring(property_set) + L"," + std::to_wstring(pid);
}

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
  bool valid() const noexcept { return key_ != nullptr; }
  void reset() noexcept {
    if (key_ != nullptr) {
      RegCloseKey(key_);
      key_ = nullptr;
    }
  }

 private:
  HKEY key_ = nullptr;
};

LSTATUS open_read(const std::wstring& path, RegKey& key) {
  return RegOpenKeyExW(HKEY_LOCAL_MACHINE, path.c_str(), 0,
                       KEY_READ | KEY_WOW64_64KEY, key.receive());
}

LSTATUS create_write(const std::wstring& path, RegKey& key) {
  return RegCreateKeyExW(HKEY_LOCAL_MACHINE, path.c_str(), 0, nullptr,
                         REG_OPTION_NON_VOLATILE,
                         KEY_SET_VALUE | KEY_WOW64_64KEY, nullptr,
                         key.receive(), nullptr);
}

LSTATUS set_string(HKEY key, const wchar_t* name, const std::wstring& value) {
  return RegSetValueExW(
      key, name, 0, REG_SZ,
      reinterpret_cast<const BYTE*>(value.c_str()),
      static_cast<DWORD>((value.size() + 1) * sizeof(wchar_t)));
}

LSTATUS set_dword(HKEY key, const wchar_t* name, DWORD value) {
  return RegSetValueExW(key, name, 0, REG_DWORD,
                        reinterpret_cast<const BYTE*>(&value), sizeof(value));
}

/** Raw bytes of one value, with its type, or nothing when it is absent. */
bool query_value(HKEY key, const std::wstring& name, DWORD& type,
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

/** Registry string data as a `wstring`, without its terminator. */
std::wstring string_from_bytes(const std::vector<BYTE>& bytes) {
  const size_t characters = bytes.size() / sizeof(wchar_t);
  std::wstring text(reinterpret_cast<const wchar_t*>(bytes.data()),
                    characters);
  const size_t end = text.find(L'\0');
  if (end != std::wstring::npos) {
    text.resize(end);
  }
  return text;
}

std::vector<std::wstring> list_from_bytes(const std::vector<BYTE>& bytes) {
  std::vector<std::wstring> entries;
  const size_t characters = bytes.size() / sizeof(wchar_t);
  const wchar_t* data = reinterpret_cast<const wchar_t*>(bytes.data());
  size_t at = 0;
  while (at < characters) {
    const std::wstring entry(data + at);
    if (entry.empty()) {
      break;
    }
    at += entry.size() + 1;
    entries.push_back(entry);
  }
  return entries;
}

/** REG_MULTI_SZ data: every entry, then the extra terminator. */
std::vector<wchar_t> bytes_from_list(const std::vector<std::wstring>& entries) {
  std::vector<wchar_t> block;
  for (const std::wstring& entry : entries) {
    block.insert(block.end(), entry.begin(), entry.end());
    block.push_back(L'\0');
  }
  block.push_back(L'\0');
  return block;
}

bool read_single(HKEY key, const std::wstring& name,
                 std::optional<std::wstring>& out, std::wstring& error) {
  DWORD type = 0;
  std::vector<BYTE> bytes;
  bool present = false;
  if (!query_value(key, name, type, bytes, present)) {
    error = L"could not read " + name;
    return false;
  }
  if (!present) {
    out.reset();
    return true;
  }
  if (type != REG_SZ && type != REG_EXPAND_SZ) {
    error = name + L" is not a string";
    return false;
  }
  out = string_from_bytes(bytes);
  return true;
}

bool read_list(HKEY key, const std::wstring& name,
               std::optional<std::vector<std::wstring>>& out,
               std::wstring& error) {
  DWORD type = 0;
  std::vector<BYTE> bytes;
  bool present = false;
  if (!query_value(key, name, type, bytes, present)) {
    error = L"could not read " + name;
    return false;
  }
  if (!present) {
    out.reset();
    return true;
  }
  if (type == REG_MULTI_SZ) {
    out = list_from_bytes(bytes);
    return true;
  }
  // A vendor that wrote a single string into a list value still registered an
  // effect there, and it has to survive the edit. Reading it as a one-entry
  // list keeps it; refusing the whole endpoint would be safe but would also
  // make FluidEQ unusable on that machine for no reason the user could act
  // on.
  if (type == REG_SZ || type == REG_EXPAND_SZ) {
    const std::wstring only = string_from_bytes(bytes);
    out = only.empty() ? std::vector<std::wstring>()
                       : std::vector<std::wstring>{only};
    return true;
  }
  error = name + L" is neither a string nor a list";
  return false;
}

/** Sets `name` from `value`, or deletes it when `value` is absent. */
LSTATUS apply_list(HKEY key, const std::wstring& name,
                   const std::optional<std::vector<std::wstring>>& value) {
  if (!value.has_value()) {
    const LSTATUS deleted = RegDeleteValueW(key, name.c_str());
    return deleted == ERROR_FILE_NOT_FOUND ? ERROR_SUCCESS : deleted;
  }
  const std::vector<wchar_t> block = bytes_from_list(*value);
  return RegSetValueExW(
      key, name.c_str(), 0, REG_MULTI_SZ,
      reinterpret_cast<const BYTE*>(block.data()),
      static_cast<DWORD>(block.size() * sizeof(wchar_t)));
}

std::wstring endpoint_path(const std::wstring& guid) {
  return std::wstring(kRenderPath) + L"\\" + guid;
}

std::wstring fx_path(const std::wstring& guid) {
  return endpoint_path(guid) + L"\\FxProperties";
}

std::wstring clsid_path() {
  return std::wstring(kClassesPath) + L"\\" + kEngineClsid;
}

std::wstring apo_path() {
  return std::wstring(kApoPath) + L"\\" + kEngineClsid;
}

}  // namespace

bool is_valid_endpoint_guid(std::wstring_view guid) {
  // {8-4-4-4-12}, and nothing else. Length first so the index below is safe.
  if (guid.size() != 38 || guid.front() != L'{' || guid.back() != L'}') {
    return false;
  }
  const size_t dashes[] = {9, 14, 19, 24};
  for (size_t at = 1; at + 1 < guid.size(); ++at) {
    const bool is_dash = at == dashes[0] || at == dashes[1] ||
                         at == dashes[2] || at == dashes[3];
    const wchar_t symbol = guid[at];
    if (is_dash) {
      if (symbol != L'-') {
        return false;
      }
      continue;
    }
    const bool hex = (symbol >= L'0' && symbol <= L'9') ||
                     (symbol >= L'a' && symbol <= L'f') ||
                     (symbol >= L'A' && symbol <= L'F');
    if (!hex) {
      return false;
    }
  }
  return true;
}

bool endpoint_key_exists(const std::wstring& guid) {
  if (!is_valid_endpoint_guid(guid)) {
    return false;
  }
  RegKey key;
  return open_read(endpoint_path(guid), key) == ERROR_SUCCESS;
}

bool read_fx_values(const std::wstring& guid, FxValues& out,
                    std::wstring& error) {
  if (!is_valid_endpoint_guid(guid)) {
    error = L"not an endpoint id: " + guid;
    return false;
  }
  out = FxValues();
  RegKey key;
  const LSTATUS opened = open_read(fx_path(guid), key);
  if (opened == ERROR_FILE_NOT_FOUND) {
    // An endpoint with no effects registered at all. Every value is absent,
    // which is exactly what the caller was told.
    return true;
  }
  if (opened != ERROR_SUCCESS) {
    error = L"could not open the effect properties of " + guid + L": " +
            describe_error(static_cast<unsigned long>(opened));
    return false;
  }
  for (int slot = 0; slot < kSlotCount; ++slot) {
    if (!read_single(key.get(), value_name(kFxProperty, kSinglePid[slot]),
                     out.single[slot], error) ||
        !read_list(key.get(), value_name(kFxProperty, kCompositePid[slot]),
                   out.composite[slot], error) ||
        !read_list(key.get(), value_name(kModeProperty, kModePid[slot]),
                   out.modes[slot], error)) {
      return false;
    }
  }
  for (int slot = 0; slot < kLegacyCount; ++slot) {
    if (!read_single(key.get(), value_name(kFxProperty, kLegacyPid[slot]),
                     out.legacy[slot], error)) {
      return false;
    }
  }
  return true;
}

bool write_fx_values(const std::wstring& guid, const FxValues& before,
                     const FxValues& after, std::wstring& error) {
  if (!is_valid_endpoint_guid(guid)) {
    error = L"not an endpoint id: " + guid;
    return false;
  }
  // The guarantee, checked rather than assumed. If a plan ever proposes an
  // edit to the vendor's own single or legacy values, nothing is written at
  // all — a partial write to an endpoint's effect chain is worse than none.
  for (int slot = 0; slot < kSlotCount; ++slot) {
    if (before.single[slot] != after.single[slot]) {
      error = L"refusing to change the single effect values of " + guid;
      return false;
    }
  }
  for (int slot = 0; slot < kLegacyCount; ++slot) {
    if (before.legacy[slot] != after.legacy[slot]) {
      error = L"refusing to change the legacy effect values of " + guid;
      return false;
    }
  }

  RegKey key;
  const LSTATUS opened = create_write(fx_path(guid), key);
  if (opened != ERROR_SUCCESS) {
    error = L"could not open the effect properties of " + guid + L": " +
            describe_error(static_cast<unsigned long>(opened));
    return false;
  }
  for (int slot = 0; slot < kSlotCount; ++slot) {
    if (before.composite[slot] != after.composite[slot]) {
      const std::wstring name = value_name(kFxProperty, kCompositePid[slot]);
      const LSTATUS written = apply_list(key.get(), name,
                                         after.composite[slot]);
      if (written != ERROR_SUCCESS) {
        error = L"could not write " + name + L": " +
                describe_error(static_cast<unsigned long>(written));
        return false;
      }
    }
    if (before.modes[slot] != after.modes[slot]) {
      const std::wstring name = value_name(kModeProperty, kModePid[slot]);
      const LSTATUS written = apply_list(key.get(), name, after.modes[slot]);
      if (written != ERROR_SUCCESS) {
        error = L"could not write " + name + L": " +
                describe_error(static_cast<unsigned long>(written));
        return false;
      }
    }
  }
  return true;
}

bool register_engine(const std::wstring& dll_path, std::wstring& error) {
  {
    RegKey clsid;
    LSTATUS status = create_write(clsid_path(), clsid);
    if (status == ERROR_SUCCESS) {
      status = set_string(clsid.get(), nullptr, kEngineFriendlyName);
    }
    if (status != ERROR_SUCCESS) {
      error = L"could not write the class registration: " +
              describe_error(static_cast<unsigned long>(status));
      return false;
    }
  }
  {
    RegKey server;
    LSTATUS status = create_write(clsid_path() + L"\\InProcServer32", server);
    if (status == ERROR_SUCCESS) {
      status = set_string(server.get(), nullptr, dll_path);
    }
    if (status == ERROR_SUCCESS) {
      // "Both": the audio engine creates this object on its own threads and
      // the effect's own locking is what keeps it correct, so there is no
      // apartment for a proxy to marshal into.
      status = set_string(server.get(), L"ThreadingModel", L"Both");
    }
    if (status != ERROR_SUCCESS) {
      error = L"could not write the in-process server path: " +
              describe_error(static_cast<unsigned long>(status));
      return false;
    }
  }
  {
    RegKey apo;
    LSTATUS status = create_write(apo_path(), apo);
    if (status == ERROR_SUCCESS) {
      status = set_string(apo.get(), L"FriendlyName", kEngineFriendlyName);
    }
    if (status == ERROR_SUCCESS) {
      status = set_string(
          apo.get(), L"Copyright",
          L"Copyright (C) 2026 Ivan Carmenates Garcia. GPL-3.0-or-later.");
    }
    if (status == ERROR_SUCCESS) {
      status = set_string(apo.get(), L"APOInterface0", kApoInterface);
    }
    // 0xF is INPLACE | SAMPLESPERFRAME_MUST_MATCH | FRAMESPERSECOND_MUST_MATCH
    // | BITSPERSAMPLE_MUST_MATCH: the effect writes into the buffer it was
    // given and does not resample, change the frame size or change the
    // sample format, so the engine is told not to insert a converter for it.
    const std::pair<const wchar_t*, DWORD> numbers[] = {
        {L"MajorVersion", 1},         {L"MinorVersion", 0},
        {L"Flags", 0xF},              {L"MinInputConnections", 1},
        {L"MaxInputConnections", 1},  {L"MinOutputConnections", 1},
        {L"MaxOutputConnections", 1}, {L"MaxInstances", 0xFFFFFFFF},
        {L"NumAPOInterfaces", 1},
    };
    for (const auto& number : numbers) {
      if (status != ERROR_SUCCESS) {
        break;
      }
      status = set_dword(apo.get(), number.first, number.second);
    }
    if (status != ERROR_SUCCESS) {
      error = L"could not write the audio processing object registration: " +
              describe_error(static_cast<unsigned long>(status));
      return false;
    }
  }
  return true;
}

bool unregister_engine(std::wstring& error) {
  const std::wstring paths[] = {clsid_path(), apo_path()};
  for (const std::wstring& path : paths) {
    RegKey parent;
    const std::wstring above = path.substr(0, path.find_last_of(L'\\'));
    const LSTATUS opened =
        RegOpenKeyExW(HKEY_LOCAL_MACHINE, above.c_str(), 0,
                      KEY_READ | KEY_WRITE | KEY_WOW64_64KEY,
                      parent.receive());
    if (opened == ERROR_FILE_NOT_FOUND) {
      continue;
    }
    if (opened != ERROR_SUCCESS) {
      error = L"could not open " + above + L": " +
              describe_error(static_cast<unsigned long>(opened));
      return false;
    }
    const LSTATUS deleted = RegDeleteTreeW(parent.get(), kEngineClsid);
    if (deleted != ERROR_SUCCESS && deleted != ERROR_FILE_NOT_FOUND) {
      error = L"could not remove " + path + L": " +
              describe_error(static_cast<unsigned long>(deleted));
      return false;
    }
  }
  return true;
}

bool enable_unsigned_effects(std::wstring& error) {
  RegKey audio;
  LSTATUS status = create_write(kAudioPath, audio);
  if (status == ERROR_SUCCESS) {
    status = set_dword(audio.get(), L"DisableProtectedAudioDG", 1);
  }
  if (status != ERROR_SUCCESS) {
    error = L"could not allow unsigned audio effects: " +
            describe_error(static_cast<unsigned long>(status));
    return false;
  }
  return true;
}

std::wstring registered_dll_path() {
  RegKey server;
  if (open_read(clsid_path() + L"\\InProcServer32", server) !=
      ERROR_SUCCESS) {
    return std::wstring();
  }
  DWORD type = 0;
  std::vector<BYTE> bytes;
  bool present = false;
  if (!query_value(server.get(), std::wstring(), type, bytes, present) ||
      !present || (type != REG_SZ && type != REG_EXPAND_SZ)) {
    return std::wstring();
  }
  return string_from_bytes(bytes);
}

}  // namespace fluideq_engine::setup
