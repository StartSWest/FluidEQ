/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The setup helper: the only part of FluidEQ that writes the registry.
 *
 * It is one executable rather than an installer plug-in because the app has
 * to be able to run it at any time — attaching a headset the user just
 * plugged in, taking the effect off again when they switch back to the other
 * engine — and because everything it does has to be reversible by the same
 * program that did it.
 *
 * The elevation boundary is why the result goes through a file. A child
 * process started by `ShellExecuteExW` with the `runas` verb gets its own
 * console and there is no way to read its output, so the elevated half writes
 * `last-setup.json` and the unelevated half prints it. Both halves are this
 * same binary, told apart only by whether the token they are running under is
 * elevated.
 *
 * Exit codes: 0 done, 1 the command line was not understood, 2 the consent
 * prompt was declined, 3 the command ran and failed — with the reason in the
 * JSON rather than in the exit code, because there is only one of those and
 * there are many ways for an audio driver's registry key to surprise us.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

// WIN32_LEAN_AND_MEAN leaves COM out of `windows.h`, and the device
// enumerator this program reaches through needs an initialised apartment.
#include <objbase.h>
#include <winver.h>

#include <cstdio>
#include <optional>
#include <string>
#include <vector>

#include "backup.h"
#include "commands.h"
#include "elevate.h"
#include "endpoints.h"
#include "fs.h"
#include "fx_list.h"
#include "json.h"
#include "registry.h"

namespace {

using fluideq_engine::setup::CommandResult;
using fluideq_engine::setup::Endpoint;
using fluideq_engine::setup::FxValues;
using fluideq_engine::setup::Options;
using fluideq_engine::setup::Slot;
using fluideq_engine::setup::backup_exists;
using fluideq_engine::setup::config_dir;
using fluideq_engine::setup::ensure_engine_tree;
using fluideq_engine::setup::installed_dll_path;
using fluideq_engine::setup::is_attached;
using fluideq_engine::setup::is_elevated;
using fluideq_engine::setup::is_valid_endpoint_guid;
using fluideq_engine::setup::json_escape;
using fluideq_engine::setup::kEngineClsid;
using fluideq_engine::setup::list_render_endpoints;
using fluideq_engine::setup::path_exists;
using fluideq_engine::setup::read_fx_values;
using fluideq_engine::setup::read_utf8;
using fluideq_engine::setup::registered_dll_path;
using fluideq_engine::setup::relaunch_elevated;
using fluideq_engine::setup::result_json;
using fluideq_engine::setup::result_path;
using fluideq_engine::setup::run_command;
using fluideq_engine::setup::utf8_from_wide;
using fluideq_engine::setup::write_utf8;

const char kUsage[] =
    "FluidEQ-Engine-Setup <command> [options]\n"
    "\n"
    "  install [--attach-all] [--restart-audio]\n"
    "  attach <output-id>... [--slot efx|mfx] [--restart-audio]\n"
    "  detach <output-id>... [--restart-audio]\n"
    "  uninstall [--purge]\n"
    "  restart-audio\n"
    "  status\n"
    "\n"
    "An output id looks like {00000000-0000-0000-0000-000000000000} and is\n"
    "listed by the status command, which is the only one that never asks for\n"
    "administrator rights.\n"
    "\n"
    "Exit codes: 0 done, 1 command line, 2 elevation declined, 3 failed.\n";

/** One UTF-8 line on stdout, which is the only thing the caller parses. */
void print_json(const std::wstring& text) {
  const std::string bytes = utf8_from_wide(text);
  std::fwrite(bytes.data(), 1, bytes.size(), stdout);
  std::fputc('\n', stdout);
  std::fflush(stdout);
}

bool parse(int argc, wchar_t** argv, Options& options) {
  if (argc < 2) {
    return false;
  }
  options.command = argv[1];
  const bool takes_guids =
      options.command == L"attach" || options.command == L"detach";
  if (options.command != L"install" && !takes_guids &&
      options.command != L"uninstall" &&
      options.command != L"restart-audio" && options.command != L"status") {
    return false;
  }
  for (int at = 2; at < argc; ++at) {
    const std::wstring argument = argv[at];
    if (argument == L"--attach-all" && options.command == L"install") {
      options.attach_all = true;
    } else if (argument == L"--restart-audio" &&
               options.command != L"uninstall" &&
               options.command != L"restart-audio" &&
               options.command != L"status") {
      options.restart_audio = true;
    } else if (argument == L"--purge" && options.command == L"uninstall") {
      options.purge = true;
    } else if (argument == L"--slot" && options.command == L"attach") {
      if (at + 1 >= argc) {
        return false;
      }
      const std::wstring value = argv[++at];
      if (value == L"efx") {
        options.slot = Slot::Efx;
      } else if (value == L"mfx") {
        options.slot = Slot::Mfx;
      } else {
        return false;
      }
    } else if (takes_guids && is_valid_endpoint_guid(argument)) {
      options.guids.push_back(argument);
    } else {
      return false;
    }
  }
  return !takes_guids || !options.guids.empty();
}

/** `1.0.0.0` from a DLL's version resource, or empty. */
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

/**
 * The answer to "is any of this installed, and where".
 *
 * It never elevates and never writes: the app calls it on every launch, and a
 * consent prompt for a question is the fastest way to make somebody stop
 * using a feature.
 */
void print_status() {
  const std::wstring registered = registered_dll_path();
  const bool installed = !registered.empty() && path_exists(registered);
  std::wstring out = L"{\"installed\":";
  out += installed ? L"true" : L"false";
  out += L",\"dllPath\":\"";
  out += json_escape(installed ? registered : installed_dll_path());
  out += L"\",\"dllVersion\":\"";
  out += json_escape(installed ? dll_version(registered) : std::wstring());
  out += L"\",\"configDir\":\"";
  out += json_escape(config_dir());
  out += L"\",\"endpoints\":[";

  std::vector<Endpoint> endpoints;
  std::wstring unreachable;
  list_render_endpoints(endpoints, unreachable);
  for (size_t at = 0; at < endpoints.size(); ++at) {
    if (at != 0) {
      out += L',';
    }
    FxValues values;
    std::wstring unreadable;
    const bool attached =
        read_fx_values(endpoints[at].guid, values, unreadable) &&
        is_attached(values, kEngineClsid);
    out += L"{\"guid\":\"";
    out += json_escape(endpoints[at].guid);
    out += L"\",\"name\":\"";
    out += json_escape(endpoints[at].name);
    out += L"\",\"attached\":";
    out += attached ? L"true" : L"false";
    out += L",\"backupExists\":";
    out += backup_exists(endpoints[at].guid) ? L"true" : L"false";
    out += L'}';
  }
  out += L"]}";
  print_json(out);
}

/** Runs the command here, having already established it may. */
int run_elevated(const Options& options) {
  CommandResult result;
  run_command(options, result);
  const std::wstring json = result_json(options.command, result);
  // `uninstall --purge` has just deleted this tree on purpose. Recreating it
  // to drop a result file in would leave behind exactly the directory the
  // user asked to be rid of, so that run reports through its exit code alone
  // and the unelevated half fills in the rest.
  const bool purged = options.command == L"uninstall" && options.purge;
  if (!purged) {
    // The tree may not exist yet — `attach` can be the first command ever run
    // on a machine — and the result has to have somewhere to go regardless.
    std::wstring ignored;
    ensure_engine_tree(ignored);
    write_utf8(result_path(), json);
  }
  print_json(json);
  return result.ok ? 0 : 3;
}

/**
 * Asks for administrator, waits, and reports what the elevated run wrote.
 *
 * The stale result of a previous run is deleted first. Printing one would be
 * worse than printing nothing: it says a command succeeded that never ran.
 */
int run_through_elevation(int argc, wchar_t** argv, const Options& options) {
  const std::wstring path = result_path();
  if (!path.empty()) {
    DeleteFileW(path.c_str());
  }
  const std::vector<std::wstring> arguments(argv + 1, argv + argc);
  std::wstring error;
  const int code = relaunch_elevated(arguments, error);
  const std::optional<std::wstring> reported =
      (code == 2 || path.empty()) ? std::nullopt : read_utf8(path);
  if (reported.has_value() && !reported->empty()) {
    print_json(*reported);
    return code;
  }
  // Always one line of JSON on stdout, whatever happened. The caller parses
  // this and reads the exit code; a run that printed nothing at all would
  // make the two disagree about whether there was an answer.
  CommandResult result;
  result.ok = code == 0;
  if (code == 2) {
    result.error = L"administrator rights were declined";
  } else if (!result.ok) {
    result.error = error.empty()
                       ? std::wstring(L"the elevated helper reported nothing")
                       : error;
  }
  print_json(result_json(options.command, result));
  return code;
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  Options options;
  if (!parse(argc, argv, options)) {
    std::fputs(kUsage, stderr);
    return 1;
  }

  // Apartment threaded because `ShellExecuteExW` is documented against it,
  // and the device enumerator is happy either way.
  const HRESULT com = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
  if (FAILED(com)) {
    std::fputs("FluidEQ-Engine-Setup: COM could not be started.\n", stderr);
    return 3;
  }

  int code = 0;
  if (options.command == L"status") {
    print_status();
  } else if (is_elevated()) {
    code = run_elevated(options);
  } else {
    code = run_through_elevation(argc, argv, options);
  }

  CoUninitialize();
  return code;
}
