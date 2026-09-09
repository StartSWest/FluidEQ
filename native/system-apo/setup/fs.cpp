/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fs.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <knownfolders.h>
#include <shlobj_core.h>

#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace fluideq_engine::setup {

namespace {

/** A known folder's path with any trailing separator removed, or empty. */
std::wstring known_folder(REFKNOWNFOLDERID folder) {
  PWSTR found = nullptr;
  const HRESULT asked = SHGetKnownFolderPath(folder, 0, nullptr, &found);
  if (FAILED(asked) || found == nullptr) {
    CoTaskMemFree(found);
    return std::wstring();
  }
  std::wstring path(found);
  CoTaskMemFree(found);
  while (path.size() > 3 && (path.back() == L'\\' || path.back() == L'/')) {
    path.pop_back();
  }
  return path;
}

bool is_directory(const std::wstring& path) {
  const DWORD attributes = GetFileAttributesW(path.c_str());
  return attributes != INVALID_FILE_ATTRIBUTES &&
         (attributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
}

/** True for a junction or symbolic link, which a recursive delete must not
 *  descend into: doing so deletes the target rather than the link. */
bool is_reparse_point(DWORD attributes) {
  return (attributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0;
}

}  // namespace

std::wstring engine_root() {
  const std::wstring program_data = known_folder(FOLDERID_ProgramData);
  if (program_data.empty()) {
    return std::wstring();
  }
  return program_data + L"\\FluidEQ\\engine";
}

std::wstring config_dir() {
  const std::wstring root = engine_root();
  return root.empty() ? root : root + L"\\config";
}

std::wstring backup_dir() {
  const std::wstring root = engine_root();
  return root.empty() ? root : root + L"\\backup";
}

std::wstring result_path() {
  const std::wstring root = engine_root();
  return root.empty() ? root : root + L"\\last-setup.json";
}

std::wstring install_dir() {
  const std::wstring program_files = known_folder(FOLDERID_ProgramFiles);
  if (program_files.empty()) {
    return std::wstring();
  }
  return program_files + L"\\FluidEQ Engine";
}

std::wstring installed_dll_path() {
  const std::wstring directory = install_dir();
  return directory.empty() ? directory
                           : directory + L"\\FluidEQ-Engine.dll";
}

std::wstring module_dir() {
  // Grown rather than assumed: `MAX_PATH` is not the limit on a machine with
  // long paths enabled, and the truncated answer is a valid-looking path to
  // the wrong place.
  std::wstring path(MAX_PATH, L'\0');
  while (true) {
    const DWORD written =
        GetModuleFileNameW(nullptr, path.data(),
                           static_cast<DWORD>(path.size()));
    if (written == 0) {
      return std::wstring();
    }
    if (written < path.size()) {
      path.resize(written);
      break;
    }
    path.resize(path.size() * 2);
  }
  const size_t cut = path.find_last_of(L'\\');
  if (cut == std::wstring::npos) {
    return std::wstring();
  }
  return path.substr(0, cut);
}

bool path_exists(const std::wstring& path) {
  return !path.empty() &&
         GetFileAttributesW(path.c_str()) != INVALID_FILE_ATTRIBUTES;
}

bool ensure_directory(const std::wstring& path) {
  if (path.empty()) {
    return false;
  }
  if (is_directory(path)) {
    return true;
  }
  const size_t cut = path.find_last_of(L'\\');
  if (cut != std::wstring::npos && cut > 2) {
    if (!ensure_directory(path.substr(0, cut))) {
      return false;
    }
  }
  if (CreateDirectoryW(path.c_str(), nullptr) != 0) {
    return true;
  }
  return GetLastError() == ERROR_ALREADY_EXISTS && is_directory(path);
}

std::string utf8_from_wide(std::wstring_view text) {
  if (text.empty()) {
    return std::string();
  }
  const int needed =
      WideCharToMultiByte(CP_UTF8, 0, text.data(),
                          static_cast<int>(text.size()), nullptr, 0, nullptr,
                          nullptr);
  if (needed <= 0) {
    return std::string();
  }
  std::string bytes(static_cast<size_t>(needed), '\0');
  const int written =
      WideCharToMultiByte(CP_UTF8, 0, text.data(),
                          static_cast<int>(text.size()), bytes.data(), needed,
                          nullptr, nullptr);
  if (written != needed) {
    return std::string();
  }
  return bytes;
}

bool write_utf8(const std::wstring& path, std::wstring_view text) {
  const std::string bytes = utf8_from_wide(text);
  const HANDLE file =
      CreateFileW(path.c_str(), GENERIC_WRITE, FILE_SHARE_READ, nullptr,
                  CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) {
    return false;
  }
  DWORD written = 0;
  const BOOL ok = WriteFile(file, bytes.data(),
                            static_cast<DWORD>(bytes.size()), &written,
                            nullptr);
  CloseHandle(file);
  return ok != 0 && written == bytes.size();
}

std::optional<std::wstring> read_utf8(const std::wstring& path) {
  const HANDLE file =
      CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr,
                  OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) {
    return std::nullopt;
  }
  LARGE_INTEGER size = {};
  if (GetFileSizeEx(file, &size) == 0 || size.QuadPart < 0 ||
      // A backup is a few hundred bytes. The cap is here because this reads a
      // file under a directory Users can write to, and an unbounded read of
      // whatever they put there is a denial of service with extra steps.
      size.QuadPart > 4 * 1024 * 1024) {
    CloseHandle(file);
    return std::nullopt;
  }
  std::string bytes(static_cast<size_t>(size.QuadPart), '\0');
  DWORD read = 0;
  const BOOL ok = bytes.empty() ||
                  ReadFile(file, bytes.data(),
                           static_cast<DWORD>(bytes.size()), &read, nullptr);
  CloseHandle(file);
  if (ok == 0 || read != bytes.size()) {
    return std::nullopt;
  }
  if (bytes.empty()) {
    return std::wstring();
  }
  const int needed =
      MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, bytes.data(),
                          static_cast<int>(bytes.size()), nullptr, 0);
  if (needed <= 0) {
    return std::nullopt;
  }
  std::wstring text(static_cast<size_t>(needed), L'\0');
  if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, bytes.data(),
                          static_cast<int>(bytes.size()), text.data(),
                          needed) != needed) {
    return std::nullopt;
  }
  return text;
}

std::vector<std::wstring> files_matching(const std::wstring& directory,
                                         const std::wstring& pattern) {
  std::vector<std::wstring> names;
  WIN32_FIND_DATAW found = {};
  const HANDLE search =
      FindFirstFileW((directory + L"\\" + pattern).c_str(), &found);
  if (search == INVALID_HANDLE_VALUE) {
    return names;
  }
  do {
    if ((found.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) == 0) {
      names.emplace_back(found.cFileName);
    }
  } while (FindNextFileW(search, &found) != 0);
  FindClose(search);
  return names;
}

bool replace_file(const std::wstring& from, const std::wstring& to,
                  std::wstring& error) {
  if (CopyFileW(from.c_str(), to.c_str(), FALSE) != 0) {
    return true;
  }
  const DWORD first = GetLastError();
  if (first != ERROR_SHARING_VIOLATION && first != ERROR_ACCESS_DENIED &&
      first != ERROR_USER_MAPPED_FILE) {
    error = L"could not copy " + from + L" to " + to + L": " +
            describe_error(first);
    return false;
  }
  // The name is derived from the target rather than random: a machine that
  // has been reinstalled onto several times should accumulate at most one
  // such file, not one per attempt.
  const std::wstring aside = to + L".replaced";
  DeleteFileW(aside.c_str());
  if (MoveFileExW(to.c_str(), aside.c_str(), MOVEFILE_REPLACE_EXISTING) == 0) {
    error = L"could not move the file in use aside: " +
            describe_error(GetLastError());
    return false;
  }
  MoveFileExW(aside.c_str(), nullptr, MOVEFILE_DELAY_UNTIL_REBOOT);
  if (CopyFileW(from.c_str(), to.c_str(), FALSE) == 0) {
    error = L"could not copy " + from + L" to " + to + L": " +
            describe_error(GetLastError());
    return false;
  }
  return true;
}

bool delete_directory_tree(const std::wstring& directory) {
  if (!is_directory(directory)) {
    return !path_exists(directory);
  }
  bool ok = true;
  WIN32_FIND_DATAW found = {};
  const HANDLE search =
      FindFirstFileW((directory + L"\\*").c_str(), &found);
  if (search != INVALID_HANDLE_VALUE) {
    do {
      const std::wstring name(found.cFileName);
      if (name == L"." || name == L"..") {
        continue;
      }
      const std::wstring child = directory + L"\\" + name;
      if ((found.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0 &&
          !is_reparse_point(found.dwFileAttributes)) {
        ok = delete_directory_tree(child) && ok;
        continue;
      }
      if ((found.dwFileAttributes & FILE_ATTRIBUTE_READONLY) != 0) {
        SetFileAttributesW(child.c_str(), FILE_ATTRIBUTE_NORMAL);
      }
      if ((found.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0) {
        ok = RemoveDirectoryW(child.c_str()) != 0 && ok;
      } else {
        ok = DeleteFileW(child.c_str()) != 0 && ok;
      }
    } while (FindNextFileW(search, &found) != 0);
    FindClose(search);
  }
  return RemoveDirectoryW(directory.c_str()) != 0 && ok;
}

std::wstring describe_error(unsigned long code) {
  LPWSTR text = nullptr;
  const DWORD length = FormatMessageW(
      FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM |
          FORMAT_MESSAGE_IGNORE_INSERTS,
      nullptr, code, MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT),
      reinterpret_cast<LPWSTR>(&text), 0, nullptr);
  std::wstring message;
  if (length != 0 && text != nullptr) {
    message.assign(text, length);
  }
  LocalFree(text);
  while (!message.empty() && (message.back() == L'\r' ||
                              message.back() == L'\n' ||
                              message.back() == L' ')) {
    message.pop_back();
  }
  if (message.empty()) {
    message = L"error " + std::to_wstring(code);
  } else {
    message += L" (" + std::to_wstring(code) + L")";
  }
  return message;
}

}  // namespace fluideq_engine::setup
