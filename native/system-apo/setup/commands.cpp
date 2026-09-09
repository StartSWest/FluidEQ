/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "commands.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <algorithm>
#include <optional>
#include <string>
#include <vector>

#include "acl.h"
#include "backup.h"
#include "endpoints.h"
#include "fs.h"
#include "fx_list.h"
#include "json.h"
#include "registry.h"
#include "services.h"

namespace fluideq_engine::setup {

namespace {

void fail(CommandResult& result, std::wstring message) {
  result.ok = false;
  result.error = std::move(message);
}

/**
 * Adds our class id to one endpoint, recording what was there first.
 *
 * The backup is written before anything is planned, not after: an attach that
 * crashed between the write and the backup would leave an endpoint carrying
 * our effect with no record of how to take it off again.
 */
bool attach_one(const std::wstring& guid, Slot slot, bool& attached,
                std::wstring& error) {
  FxValues before;
  if (!read_fx_values(guid, before, error)) {
    return false;
  }
  if (!save_backup_once(guid, before, error)) {
    return false;
  }
  const FxPlan plan = plan_attach(before, kEngineClsid, slot);
  if (plan.changed && !write_fx_values(guid, before, plan.after, error)) {
    return false;
  }
  attached = is_attached(plan.after, kEngineClsid);
  return true;
}

bool detach_one(const std::wstring& guid, bool& attached,
                std::wstring& error) {
  FxValues current;
  if (!read_fx_values(guid, current, error)) {
    return false;
  }
  const std::optional<FxValues> saved = load_backup(guid);
  // With no backup there is no way to know which values this program created,
  // so it takes none of them away: passing the current values as the
  // reference means every key that exists is treated as one that was already
  // there, and only our own entry comes out of the lists.
  const FxValues& reference = saved.has_value() ? *saved : current;
  const FxPlan plan = plan_detach(current, reference, kEngineClsid);
  if (plan.changed && !write_fx_values(guid, current, plan.after, error)) {
    return false;
  }
  attached = is_attached(plan.after, kEngineClsid);
  if (!attached) {
    remove_backup(guid);
  }
  return true;
}

/**
 * Deletes the installed files, and settles for the next reboot when it
 * cannot.
 *
 * The effect stays mapped into audiodg.exe until the audio stack is
 * restarted, so the DLL of a just-uninstalled engine is routinely still in
 * use. It has already been unregistered and detached by this point, so a file
 * left on disk until the next boot is inert — failing the whole uninstall
 * over it would be worse.
 */
void remove_install_tree(const std::wstring& directory) {
  for (const std::wstring& name : files_matching(directory, L"*")) {
    const std::wstring file = directory + L"\\" + name;
    if (DeleteFileW(file.c_str()) != 0) {
      continue;
    }
    const std::wstring aside = file + L".removed";
    DeleteFileW(aside.c_str());
    if (MoveFileExW(file.c_str(), aside.c_str(), MOVEFILE_REPLACE_EXISTING) !=
        0) {
      MoveFileExW(aside.c_str(), nullptr, MOVEFILE_DELAY_UNTIL_REBOOT);
    }
  }
  RemoveDirectoryW(directory.c_str());
}

/** Endpoint ids with a backup file, which are the ones ever attached. */
std::vector<std::wstring> endpoints_with_backups() {
  std::vector<std::wstring> guids;
  const std::wstring directory = backup_dir();
  if (directory.empty()) {
    return guids;
  }
  for (const std::wstring& name : files_matching(directory, L"*.json")) {
    const size_t dot = name.find_last_of(L'.');
    if (dot == std::wstring::npos) {
      continue;
    }
    const std::wstring guid = name.substr(0, dot);
    if (is_valid_endpoint_guid(guid)) {
      guids.push_back(guid);
    }
  }
  return guids;
}

void attach_each(const std::vector<std::wstring>& guids, Slot slot,
                 CommandResult& result) {
  for (const std::wstring& guid : guids) {
    if (!endpoint_key_exists(guid)) {
      fail(result, L"there is no output with the id " + guid);
      return;
    }
    EndpointResult one;
    one.guid = guid;
    if (!attach_one(guid, slot, one.attached, result.error)) {
      result.ok = false;
      result.endpoints.push_back(one);
      return;
    }
    result.endpoints.push_back(one);
  }
}

void detach_each(const std::vector<std::wstring>& guids,
                 CommandResult& result) {
  for (const std::wstring& guid : guids) {
    EndpointResult one;
    one.guid = guid;
    one.attached = true;
    if (!detach_one(guid, one.attached, result.error)) {
      result.ok = false;
      result.endpoints.push_back(one);
      return;
    }
    result.endpoints.push_back(one);
  }
}

void run_install(const Options& options, CommandResult& result) {
  const std::wstring source = module_dir();
  const std::wstring target = install_dir();
  if (source.empty() || target.empty()) {
    fail(result, L"could not work out where to install from or to");
    return;
  }
  if (!path_exists(source + L"\\FluidEQ-Engine.dll")) {
    fail(result, L"FluidEQ-Engine.dll is not next to the setup program");
    return;
  }
  if (!ensure_directory(target)) {
    fail(result, L"could not create " + target + L": " +
                     describe_error(GetLastError()));
    return;
  }
  // Every DLL beside the helper, not only the effect: the effect is built
  // against the shared runtime, and audiodg.exe searches its own directory
  // and the system directory — never ours. A missing runtime DLL makes the
  // effect fail to load with no message anywhere.
  for (const std::wstring& name : files_matching(source, L"*.dll")) {
    if (!replace_file(source + L"\\" + name, target + L"\\" + name,
                      result.error)) {
      result.ok = false;
      return;
    }
  }
  if (!register_engine(target + L"\\FluidEQ-Engine.dll", result.error) ||
      !enable_unsigned_effects(result.error) ||
      !ensure_engine_tree(result.error)) {
    result.ok = false;
    return;
  }
  if (options.attach_all) {
    std::vector<Endpoint> found;
    if (!list_render_endpoints(found, result.error)) {
      result.ok = false;
      return;
    }
    std::vector<std::wstring> guids;
    for (const Endpoint& endpoint : found) {
      guids.push_back(endpoint.guid);
    }
    attach_each(guids, options.slot, result);
    if (!result.ok) {
      return;
    }
  }
  if (options.restart_audio && !restart_audio(result.error)) {
    result.ok = false;
  }
}

void run_uninstall(const Options& options, CommandResult& result) {
  std::vector<std::wstring> guids = endpoints_with_backups();
  // Also whatever is attached without a backup — a backup file deleted by
  // hand must not leave an effect nobody can take off again.
  std::vector<Endpoint> active;
  std::wstring listed;
  if (list_render_endpoints(active, listed)) {
    for (const Endpoint& endpoint : active) {
      FxValues values;
      std::wstring ignored;
      if (read_fx_values(endpoint.guid, values, ignored) &&
          is_attached(values, kEngineClsid) &&
          std::find(guids.begin(), guids.end(), endpoint.guid) ==
              guids.end()) {
        guids.push_back(endpoint.guid);
      }
    }
  }
  detach_each(guids, result);
  if (!result.ok) {
    return;
  }
  if (!unregister_engine(result.error)) {
    result.ok = false;
    return;
  }
  const std::wstring target = install_dir();
  if (!target.empty()) {
    remove_install_tree(target);
  }
  if (options.purge) {
    const std::wstring root = engine_root();
    if (!root.empty()) {
      delete_directory_tree(root);
    }
  }
}

}  // namespace

bool ensure_engine_tree(std::wstring& error) {
  const std::wstring root = engine_root();
  if (root.empty()) {
    error = L"could not find the machine's program data directory";
    return false;
  }
  if (!ensure_directory(root) || !ensure_directory(config_dir()) ||
      !ensure_directory(backup_dir())) {
    error = L"could not create " + root + L": " +
            describe_error(GetLastError());
    return false;
  }
  if (!apply_engine_acl(root, error)) {
    return false;
  }
  // An empty `config.txt` rather than none: the effect's watcher waits on the
  // directory, and the app appends to this file. A missing one reads as "no
  // configuration" everywhere it is looked at, which is the same answer an
  // empty one gives — but only the empty one can be edited without first
  // creating it.
  const std::wstring config = config_dir() + L"\\config.txt";
  if (!path_exists(config) && !write_utf8(config, std::wstring())) {
    error = L"could not create " + config + L": " +
            describe_error(GetLastError());
    return false;
  }
  return true;
}

void run_command(const Options& options, CommandResult& result) {
  if (options.command == L"install") {
    run_install(options, result);
    return;
  }
  if (options.command == L"uninstall") {
    run_uninstall(options, result);
    return;
  }
  if (options.command == L"restart-audio") {
    if (!restart_audio(result.error)) {
      result.ok = false;
    }
    return;
  }
  if (options.command == L"attach") {
    if (!ensure_engine_tree(result.error)) {
      result.ok = false;
      return;
    }
    attach_each(options.guids, options.slot, result);
  } else {
    detach_each(options.guids, result);
  }
  if (result.ok && options.restart_audio && !restart_audio(result.error)) {
    result.ok = false;
  }
}

std::wstring result_json(const std::wstring& command,
                         const CommandResult& result) {
  std::wstring out = L"{\"command\":\"";
  out += json_escape(command);
  out += L"\",\"ok\":";
  out += result.ok ? L"true" : L"false";
  out += L",\"error\":\"";
  out += json_escape(result.error);
  out += L"\",\"endpoints\":[";
  for (size_t at = 0; at < result.endpoints.size(); ++at) {
    if (at != 0) {
      out += L',';
    }
    out += L"{\"guid\":\"";
    out += json_escape(result.endpoints[at].guid);
    out += L"\",\"attached\":";
    out += result.endpoints[at].attached ? L"true" : L"false";
    out += L'}';
  }
  out += L"]}";
  return out;
}

}  // namespace fluideq_engine::setup
