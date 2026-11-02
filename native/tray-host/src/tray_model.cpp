/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "tray_model.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <bcrypt.h>

#include <algorithm>
#include <array>
#include <cwctype>

namespace feq::tray {
namespace {

namespace json = feq::share::json;

std::wstring wide_at(const json::Value& record, std::string_view key) {
  const std::string* found = json::string_at(record, key);
  return found != nullptr ? wide(*found) : std::wstring();
}

std::vector<std::wstring> wide_list(const json::Value& record,
                                    std::string_view key) {
  std::vector<std::wstring> out;
  const json::Value* list = record.get(key);
  if (list != nullptr && list->is_array()) {
    for (const auto& item : list->items()) {
      if (item.is_string()) {
        out.push_back(wide(item.as_string()));
      }
    }
  }
  return out;
}

std::wstring lower(std::wstring_view text) {
  std::wstring out(text);
  for (wchar_t& c : out) {
    c = static_cast<wchar_t>(std::towlower(c));
  }
  return out;
}

/** /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/ */
bool is_canonical_guid(std::wstring_view text) {
  if (text.size() != 36) {
    return false;
  }
  for (std::size_t at = 0; at < text.size(); at += 1) {
    const bool dash = at == 8 || at == 13 || at == 18 || at == 23;
    const wchar_t c = text[at];
    if (dash ? c != L'-'
             : !((c >= L'0' && c <= L'9') || (c >= L'a' && c <= L'f'))) {
      return false;
    }
  }
  return true;
}

std::wstring joined(const std::wstring& dir, const std::wstring& name) {
  if (dir.empty() || dir.back() == L'\\' || dir.back() == L'/') {
    return dir + name;
  }
  return dir + L"\\" + name;
}

/**
 * `${path}.${pid}-${uuid}.tmp`: the shape main's own writer gives its
 * temporaries, so a run killed mid-write leaves one main sweeps away.
 */
std::wstring temporary_beside(const std::wstring& path) {
  std::array<std::uint8_t, 16> bytes{};
  BCryptGenRandom(nullptr, bytes.data(), static_cast<ULONG>(bytes.size()),
                  BCRYPT_USE_SYSTEM_PREFERRED_RNG);
  bytes[6] = static_cast<std::uint8_t>((bytes[6] & 0x0F) | 0x40);
  bytes[8] = static_cast<std::uint8_t>((bytes[8] & 0x3F) | 0x80);
  constexpr std::wstring_view kHex = L"0123456789abcdef";
  std::wstring uuid;
  for (std::size_t at = 0; at < bytes.size(); at += 1) {
    if (at == 4 || at == 6 || at == 8 || at == 10) {
      uuid.push_back(L'-');
    }
    uuid.push_back(kHex[bytes[at] >> 4]);
    uuid.push_back(kHex[bytes[at] & 0x0F]);
  }
  return path + L"." + std::to_wstring(GetCurrentProcessId()) + L"-" + uuid +
         L".tmp";
}

/** The Windows error that stopped the write, or 0. */
DWORD write_whole(const std::wstring& path, const std::string& text) {
  const std::wstring temporary = temporary_beside(path);
  const HANDLE file = CreateFileW(temporary.c_str(), GENERIC_WRITE, 0, nullptr,
                                  CREATE_NEW, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) {
    return GetLastError();
  }
  DWORD written = 0;
  DWORD error = 0;
  if (WriteFile(file, text.data(), static_cast<DWORD>(text.size()), &written,
                nullptr) == FALSE ||
      FlushFileBuffers(file) == FALSE) {
    error = GetLastError();
  } else if (written != text.size()) {
    error = ERROR_WRITE_FAULT;
  }
  CloseHandle(file);
  if (error == 0 &&
      MoveFileExW(temporary.c_str(), path.c_str(),
                  MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) == FALSE) {
    error = GetLastError();
  }
  if (error != 0) {
    DeleteFileW(temporary.c_str());
  }
  return error;
}

}  // namespace

DWORD write_atomically(const std::wstring& path, const std::string& text) {
  return write_whole(path, text);
}

std::wstring wide(std::string_view text) {
  if (text.empty()) {
    return {};
  }
  const int size = MultiByteToWideChar(CP_UTF8, 0, text.data(),
                                       static_cast<int>(text.size()), nullptr, 0);
  std::wstring out(static_cast<std::size_t>(size), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, text.data(), static_cast<int>(text.size()),
                      out.data(), size);
  return out;
}

std::string narrow(std::wstring_view text) {
  if (text.empty()) {
    return {};
  }
  const int size =
      WideCharToMultiByte(CP_UTF8, 0, text.data(), static_cast<int>(text.size()),
                          nullptr, 0, nullptr, nullptr);
  std::string out(static_cast<std::size_t>(size), '\0');
  WideCharToMultiByte(CP_UTF8, 0, text.data(), static_cast<int>(text.size()),
                      out.data(), size, nullptr, nullptr);
  return out;
}

std::optional<TrayState> parse_state(const json::Value& message) {
  const std::string* type = json::string_at(message, "type");
  if (type == nullptr || *type != "state") {
    return std::nullopt;
  }
  TrayState state;
  state.tooltip = wide_at(message, "tooltip");
  state.icon = wide_at(message, "icon");
  if (const json::Value* menu = message.get("menu");
      menu != nullptr && menu->is_array()) {
    for (const auto& entry : menu->items()) {
      const std::string* id = json::string_at(entry, "id");
      const std::string* label = json::string_at(entry, "label");
      if (id == nullptr || label == nullptr || id->empty()) {
        continue;
      }
      const json::Value* separator = entry.get("separatorAfter");
      state.menu.push_back(MenuItem{
          *id, wide(*label), wide_at(entry, "icon"),
          separator != nullptr && separator->is_bool() && separator->as_bool()});
    }
  }
  return state;
}

std::optional<RecipeMessage> parse_recipe(const json::Value& message) {
  const std::string* type = json::string_at(message, "type");
  if (type == nullptr || *type != "recipe") {
    return std::nullopt;
  }
  RecipeMessage out;
  const json::Value* recipe = message.get("recipe");
  if (recipe == nullptr || !recipe->is_object()) {
    return out;
  }
  QuitRecipe read;
  read.config_dir = wide_at(*recipe, "configDir");
  read.root_name = wide_at(*recipe, "rootName");
  const std::string* text = json::string_at(*recipe, "rootText");
  read.root_text = text != nullptr ? *text : std::string();
  read.remove_names = wide_list(*recipe, "removeNames");
  read.remove_prefixes = wide_list(*recipe, "removePrefixes");
  // A recipe that names no folder or no root would write into the working
  // folder, or nowhere: it is none.
  if (!read.config_dir.empty() && !read.root_name.empty()) {
    out.recipe = std::move(read);
  }
  return out;
}

std::optional<Relaunch> parse_leaving(const json::Value& message) {
  const std::string* type = json::string_at(message, "type");
  const json::Value* relaunch = message.get("relaunch");
  if (type == nullptr || *type != "leaving" || relaunch == nullptr ||
      !relaunch->is_object()) {
    return std::nullopt;
  }
  Relaunch out;
  out.file = wide_at(*relaunch, "file");
  out.args = wide_list(*relaunch, "args");
  out.cwd = wide_at(*relaunch, "cwd");
  if (out.file.empty()) {
    return std::nullopt;
  }
  return out;
}

bool is_output_file(std::wstring_view name,
                    const std::vector<std::wstring>& prefixes) {
  const std::wstring low = lower(name);
  if (low.size() < 4 || low.substr(low.size() - 4) != L".txt") {
    return false;
  }
  return std::any_of(prefixes.begin(), prefixes.end(),
                     [&low](const std::wstring& prefix) {
                       const std::wstring head = lower(prefix);
                       return low.size() == head.size() + 36 + 4 &&
                              low.starts_with(head) &&
                              is_canonical_guid(std::wstring_view(low).substr(
                                  head.size(), 36));
                     });
}

std::vector<std::wstring> files_to_remove(const QuitRecipe& recipe) {
  std::vector<std::wstring> out;
  for (const auto& name : recipe.remove_names) {
    out.push_back(joined(recipe.config_dir, name));
  }
  WIN32_FIND_DATAW found{};
  const HANDLE search =
      FindFirstFileW(joined(recipe.config_dir, L"*.txt").c_str(), &found);
  if (search == INVALID_HANDLE_VALUE) {
    return out;
  }
  do {
    if ((found.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) == 0 &&
        is_output_file(found.cFileName, recipe.remove_prefixes)) {
      out.push_back(joined(recipe.config_dir, found.cFileName));
    }
  } while (FindNextFileW(search, &found) != FALSE);
  FindClose(search);
  return out;
}

bool apply_recipe(const QuitRecipe& recipe, std::vector<std::string>* failures) {
  bool ok = true;
  const auto failed = [&ok, failures](std::string what) {
    ok = false;
    if (failures != nullptr) {
      failures->push_back(std::move(what));
    }
  };
  if (const DWORD error = write_whole(
          joined(recipe.config_dir, recipe.root_name), recipe.root_text);
      error != 0) {
    failed("the engine's root could not be written (error " +
           std::to_string(error) + ")");
  }
  for (const auto& path : files_to_remove(recipe)) {
    if (DeleteFileW(path.c_str()) != FALSE) {
      continue;
    }
    // Read before anything else can set it.
    const DWORD error = GetLastError();
    if (error != ERROR_FILE_NOT_FOUND) {
      failed("a file could not be removed: " + narrow(path) + " (error " +
             std::to_string(error) + ")");
    }
  }
  return ok;
}

}  // namespace feq::tray
