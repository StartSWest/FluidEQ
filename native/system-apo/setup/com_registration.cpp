/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "com_registration.h"

#include <string>
#include <utility>
#include <vector>

#include "com_paths.h"
#include "fs.h"
#include "multi_sz.h"
#include "reg_key.h"

namespace fluideq_engine::setup {

const wchar_t kEngineFriendlyName[] = L"FluidEQ Engine";

namespace {

const wchar_t kAudioPath[] =
    L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Audio";

/** `IID_IAudioProcessingObject` — the one interface the effect advertises. */
const wchar_t kApoInterface[] = L"{FD7F2B29-24D0-4B5C-B177-592C39F9CA10}";

std::wstring clsid_path() { return clsid_registration_path(); }

std::wstring apo_path() { return apo_registration_path(); }

/** The whole tree at `path` gone, or never there; anything else is an error. */
bool delete_tree(const std::wstring& path, std::wstring& error) {
  RegKey parent;
  const std::wstring above = path.substr(0, path.find_last_of(L'\\'));
  const LSTATUS opened =
      RegOpenKeyExW(HKEY_LOCAL_MACHINE, above.c_str(), 0,
                    KEY_READ | KEY_WRITE | KEY_WOW64_64KEY, parent.receive());
  if (opened == ERROR_FILE_NOT_FOUND) {
    return true;
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
  return true;
}

}  // namespace

bool register_engine(const std::wstring& dll_path, std::wstring& error) {
  // A machine that ran a build from before the record moved has it under the
  // Audio policy key, where it does nothing but mislead the next person who
  // looks. Taken out first so an install always ends with exactly two keys.
  if (!delete_tree(misplaced_apo_record_path(), error)) {
    return false;
  }
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
    // INPLACE and all three MUST_MATCH flags: the effect does not resample,
    // remix channels or convert sample types. Match GetRegistrationProperties.
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
  const std::wstring paths[] = {clsid_path(), apo_path(),
                                misplaced_apo_record_path()};
  for (const std::wstring& path : paths) {
    if (!delete_tree(path, error)) {
      return false;
    }
  }
  return true;
}

bool apo_record_present() {
  RegKey record;
  return open_read(apo_path(), record) == ERROR_SUCCESS;
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
  if (open_read(clsid_path() + L"\\InProcServer32", server) != ERROR_SUCCESS) {
    return std::wstring();
  }
  DWORD type = 0;
  std::vector<BYTE> bytes;
  bool present = false;
  if (!query_value(server.get(), std::wstring(), type, bytes, present) ||
      !present || (type != REG_SZ && type != REG_EXPAND_SZ)) {
    return std::wstring();
  }
  return decode_sz(bytes.data(), bytes.size());
}

}  // namespace fluideq_engine::setup
