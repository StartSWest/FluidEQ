/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "com_registration.h"

#include <string>
#include <utility>
#include <vector>

#include "fs.h"
#include "multi_sz.h"
#include "reg_key.h"

namespace fluideq_engine::setup {

const wchar_t kEngineClsid[] = L"{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}";
const wchar_t kEngineFriendlyName[] = L"FluidEQ Engine";

namespace {

const wchar_t kAudioPath[] =
    L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Audio";
const wchar_t kApoPath[] =
    L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Audio"
    L"\\AudioProcessingObjects";
// HKEY_CLASSES_ROOT is a merged view of this key and the per-user one. A
// machine-wide registration has to be written to the machine-wide half by
// name: writing through the merged view lands wherever it happens to resolve.
const wchar_t kClassesPath[] = L"SOFTWARE\\Classes\\CLSID";

/** `IID_IAudioProcessingObject` — the one interface the effect advertises. */
const wchar_t kApoInterface[] = L"{FD7F2B29-24D0-4B5C-B177-592C39F9CA10}";

std::wstring clsid_path() {
  return std::wstring(kClassesPath) + L"\\" + kEngineClsid;
}

std::wstring apo_path() { return std::wstring(kApoPath) + L"\\" + kEngineClsid; }

}  // namespace

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
