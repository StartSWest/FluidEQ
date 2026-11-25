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
 *
 * It is a windows subsystem program with a `wWinMain`, and prints through
 * whatever console the caller already had (see `console.h`). The installer
 * runs it through StdUtils' `ExecShellWaitEx`, which is the only way to read
 * its exit code and hard-codes `SW_SHOWNORMAL`: as a console program it
 * flashed a black window on screen during every install and uninstall.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

// The command line, taken apart here rather than by the CRT: a windows
// subsystem entry point is handed one string, not an argument vector.
#include <shellapi.h>

// WIN32_LEAN_AND_MEAN leaves COM out of `windows.h`, and the device
// enumerator this program reaches through needs an initialised apartment.
#include <objbase.h>

#include <algorithm>
#include <cstdio>
#include <optional>
#include <string>
#include <vector>

#include "acl.h"
#include "apo_lookup.h"
#include "apo_names.h"
#include "backup.h"
#include "com_registration.h"
#include "commands.h"
#include "console.h"
#include "elevate.h"
#include "endpoints.h"
#include "fs.h"
#include "fx_list.h"
#include "fx_modes.h"
#include "json.h"
#include "own_effects.h"
#include "registry.h"
#include "retry.h"
#include "services.h"
#include "slot_memory.h"
#include "slot_report.h"

namespace {

using fluideq_engine::setup::CommandResult;
using fluideq_engine::setup::Endpoint;
using fluideq_engine::setup::FxValues;
using fluideq_engine::setup::Options;
using fluideq_engine::setup::Slot;
using fluideq_engine::setup::backup_exists;
using fluideq_engine::setup::borrow_caller_console;
using fluideq_engine::setup::config_dir;
using fluideq_engine::setup::engine_root;
using fluideq_engine::setup::ensure_engine_tree;
using fluideq_engine::setup::files_matching;
using fluideq_engine::setup::installed_dll_path;
using fluideq_engine::setup::apo_record_present;
using fluideq_engine::setup::service_can_write;
using fluideq_engine::setup::unsigned_effects_enabled;
using fluideq_engine::setup::is_attached;
using fluideq_engine::setup::is_elevated;
using fluideq_engine::setup::is_valid_endpoint_guid;
using fluideq_engine::setup::json_escape;
using fluideq_engine::setup::kCommandTries;
using fluideq_engine::setup::kEngineClsid;
using fluideq_engine::setup::list_capture_endpoints;
using fluideq_engine::setup::list_render_endpoints;
using fluideq_engine::setup::path_exists;
using fluideq_engine::setup::read_fx_values;
using fluideq_engine::setup::read_utf8;
using fluideq_engine::setup::registered_dll_path;
using fluideq_engine::setup::relaunch_elevated;
using fluideq_engine::setup::result_json;
using fluideq_engine::setup::result_path;
using fluideq_engine::setup::run_command;
using fluideq_engine::setup::run_with_retries;
using fluideq_engine::setup::setup_log_path;
using fluideq_engine::setup::utf8_from_wide;
using fluideq_engine::setup::wait_audio_settled;
using fluideq_engine::setup::write_utf8;
using fluideq_engine::setup::append_utf8;
using fluideq_engine::setup::EndpointResult;
using fluideq_engine::setup::describe_slots;
using fluideq_engine::setup::held_slots;
using fluideq_engine::setup::load_backup;
using fluideq_engine::setup::RunningEffect;
using fluideq_engine::setup::apo_info;
using fluideq_engine::setup::dll_version;
using fluideq_engine::setup::effect_json;
using fluideq_engine::setup::effects_running;
using fluideq_engine::setup::equal_ci;
using fluideq_engine::setup::load_mic_own_off;
using fluideq_engine::setup::mode_missing;
using fluideq_engine::setup::slot_from_name;
using fluideq_engine::setup::remembered_slots;
using fluideq_engine::setup::slot_name;
using fluideq_engine::setup::slot_of;

const char kUsage[] =
    "FluidEQ-Engine-Setup <command> [options]\n"
    "\n"
    "  install [--attach-all] [--restart-audio]\n"
    "  attach <endpoint-id>... [--slot "
    "efx|mfx|sfx|efx-single|mfx-single|sfx-single|gfx|lfx] "
    "[--restart-audio]\n"
    "  detach <endpoint-id>... [--restart-audio]\n"
    "  uninstall [--purge]\n"
    "  suspend-apo [--restart-audio]\n"
    "  restore-apo [--restart-audio]\n"
    "  suspend-mic-effects <microphone-id>... [--restart-audio]\n"
    "  restore-mic-effects <microphone-id>... [--restart-audio]\n"
    "  restart-audio\n"
    "  status\n"
    "  settle\n"
    "\n"
    "An endpoint id names an output or a microphone, looks like\n"
    "{00000000-0000-0000-0000-000000000000} and is listed by the status\n"
    "command, microphones apart under \"microphones\" (gfx is never created\n"
    "on a microphone). status and settle (which waits until\n"
    "Windows audio has finished starting or stopping) never ask for\n"
    "administrator rights. Every other command is tried up to three times,\n"
    "waiting for Windows audio to settle between tries.\n"
    "\n"
    "From an interactive shell, pipe or capture the output (the helper is a\n"
    "windowed program and the shell will not wait for it otherwise).\n"
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
      options.command == L"attach" || options.command == L"detach" ||
      options.command == L"suspend-mic-effects" ||
      options.command == L"restore-mic-effects";
  if (options.command != L"install" && !takes_guids &&
      options.command != L"uninstall" &&
      options.command != L"suspend-apo" && options.command != L"restore-apo" &&
      options.command != L"restart-audio" && options.command != L"status" &&
      options.command != L"settle") {
    return false;
  }
  for (int at = 2; at < argc; ++at) {
    const std::wstring argument = argv[at];
    if (argument == L"--attach-all" && options.command == L"install") {
      options.attach_all = true;
    } else if (argument == L"--restart-audio" &&
               options.command != L"uninstall" &&
               options.command != L"restart-audio" &&
               options.command != L"status" &&
               options.command != L"settle") {
      options.restart_audio = true;
    } else if (argument == L"--purge" && options.command == L"uninstall") {
      options.purge = true;
    } else if (argument == L"--slot" && options.command == L"attach") {
      if (at + 1 >= argc) {
        return false;
      }
      options.slot = slot_from_name(argv[++at]);
      if (!options.slot.has_value()) {
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

/**
 * The answer to "is any of this installed, and where".
 *
 * It never elevates and never writes: the app calls it on every launch, and a
 * consent prompt for a question is the fastest way to make somebody stop
 * using a feature. Returns the process exit code: 0, or 3 when the audio
 * stack could not be asked at all.
 */
/**
 * Whether the C++ runtime the effect is linked against sits beside it.
 *
 * `audiodg.exe` searches its own directory and the system directory, never
 * ours, so these three have to be in the engine's own folder. `install`
 * copies every DLL next to the helper, which is where they ship — but a
 * folder left behind by an older version, or a cleaner, can leave the effect
 * on disk with nothing to load it against, and the failure is silent: the
 * class is registered, the endpoint names it, and Windows creates nothing.
 */
bool runtime_beside(const std::wstring& dll_path) {
  const size_t slash = dll_path.find_last_of(L'\\');
  if (slash == std::wstring::npos) {
    return false;
  }
  const std::wstring directory = dll_path.substr(0, slash);
  const wchar_t* const names[] = {L"msvcp140.dll", L"vcruntime140.dll",
                                  L"vcruntime140_1.dll"};
  for (const wchar_t* name : names) {
    if (!path_exists(directory + L"\\" + name)) {
      return false;
    }
  }
  return true;
}

/**
 * Whether the effect has ever been created by Windows on this machine.
 *
 * Two kinds of evidence, because either alone is wrong. The log is what it
 * writes the first time it is created — but a machine whose `%ProgramData%`
 * has been swept, or one that ran an engine from before the log existed, has
 * none and has certainly run. The status files are what it writes per output
 * inside the lock, and one of those is proof too. Only with neither is "never"
 * the honest answer, and it has to be honest: it decides whether the window
 * tells somebody Windows has never started their engine.
 */
bool engine_has_run() {
  const std::wstring root = engine_root();
  if (root.empty()) {
    return false;
  }
  return path_exists(root + L"\\engine.log") ||
         !files_matching(root, L"status-*.json").empty();
}

/**
 * The name Windows has for a class id, or empty (`apo_names.h`): read for
 * the report only; nothing here is written.
 */
std::wstring registered_class_name(const std::wstring& clsid) {
  return apo_info(clsid).name;
}

/**
 * One endpoint as the status document lists it: an output, or a
 * microphone under `microphones`, in the same shape.
 */
std::wstring endpoint_json(const Endpoint& endpoint) {
  std::wstring out;
  FxValues values;
  std::wstring unreadable;
  const bool attached =
      read_fx_values(endpoint.guid, values, unreadable) &&
      is_attached(values, kEngineClsid);
  out += L"{\"guid\":\"";
  out += json_escape(endpoint.guid);
  out += L"\",\"name\":\"";
  out += json_escape(endpoint.name);
  out += L"\",\"attached\":";
  out += attached ? L"true" : L"false";
  out += L",\"backupExists\":";
  out += backup_exists(endpoint.guid) ? L"true" : L"false";
  // Which slot it sits in, because that is the one thing the app can
  // change about an output where the engine is attached and never loaded:
  // a driver that creates no endpoint effect still creates a mode effect.
  const std::optional<Slot> slot = slot_of(values, kEngineClsid);
  out += L",\"slot\":";
  out += slot.has_value() ? L"\"" + std::wstring(slot_name(*slot)) + L"\""
                          : L"null";
  // Whether that slot lacks the processing modes value Windows needs to
  // reach it, which an attach into the same slot writes (`mode_missing`).
  out += L",\"modeMissing\":";
  out += mode_missing(values, kEngineClsid) ? L"true" : L"false";
  // And every slot this output has already been put in, oldest first. The
  // ladder walks newest to oldest, so where the engine is now says only
  // how far down it got — not which rungs were tried, which is a different
  // question the moment a rung is added to the middle of the ladder. An
  // endpoint that had already reached the bottom would otherwise never be
  // offered the new one.
  out += L",\"slotsTried\":[";
  const std::vector<Slot> tried = remembered_slots(endpoint.guid);
  for (size_t step = 0; step < tried.size(); ++step) {
    if (step != 0) {
      out += L',';
    }
    out += L'"';
    out += slot_name(tried[step]);
    out += L'"';
  }
  out += L']';
  // And which rungs somebody else's effect holds (`held_slots`), so the
  // app steps past them instead of spending a Windows prompt on a refusal.
  out += L",\"slotsHeld\":[";
  const std::vector<Slot> held = held_slots(
      values, load_backup(endpoint.guid).value_or(values), kEngineClsid);
  for (size_t step = 0; step < held.size(); ++step) {
    if (step != 0) {
      out += L',';
    }
    out += L'"';
    out += slot_name(held[step]);
    out += L'"';
  }
  out += L']';
  // Everything in the output's effect slots, named, and how many are
  // free: "attached" is one bit about a structure a sound card's own
  // effects can fill, and which slot this engine sits in — and beside
  // whom — is the question on a machine where it is attached and never
  // heard. Read again here rather than reused: a read that failed above
  // reported "not attached", and this says what it could see.
  out += L',';
  out += describe_slots(values, registered_class_name);
  // What Windows actually runs here (`effects_run`): the list above also
  // names a vendor's single value that a list now shadows, which no longer
  // runs. And whether a microphone's own effects were taken off, with what
  // the switch took, read from its record — the card lists those, each
  // with its name, maker, file and where it runs (`effect_json`).
  const auto named = [](const std::vector<RunningEffect>& effects) {
    std::wstring list = L"[";
    for (size_t at = 0; at < effects.size(); ++at) {
      if (at != 0) {
        list += L',';
      }
      list += effect_json(effects[at].clsid, effects[at].kind,
                          apo_info(effects[at].clsid));
    }
    return list + L"]";
  };
  const std::vector<RunningEffect> runs = effects_running(values);
  out += L",\"runs\":" + named(runs);
  const std::optional<FxValues> own_off = load_mic_own_off(endpoint.guid);
  out += L",\"ownEffectsOff\":";
  out += own_off.has_value() ? L"true" : L"false";
  std::vector<RunningEffect> taken;
  if (own_off.has_value()) {
    for (const RunningEffect& effect : effects_running(*own_off)) {
      const bool still = std::any_of(
          runs.begin(), runs.end(), [&effect](const RunningEffect& each) {
            return equal_ci(each.clsid, effect.clsid);
          });
      if (!still) {
        taken.push_back(effect);
      }
    }
  }
  out += L",\"ownEffectsTaken\":" + named(taken);
  out += L'}';
  return out;
}

int print_status() {
  std::vector<Endpoint> endpoints;
  // Enumerated before anything is printed. An empty output list and an audio
  // stack that could not be asked look identical once they are both `[]`, and
  // the app reads that as "this machine has no outputs" rather than "ask
  // again" — so the failure gets its own document and its own exit code.
  //
  // Asked up to three times, with Windows audio settled between: the stack is
  // unreachable exactly while it restarts, and "could not ask" taken in the
  // middle of a switch read as the engine that had just been installed being
  // missing.
  const CommandResult listed = run_with_retries(
      kCommandTries,
      [&endpoints](CommandResult& attempt) {
        endpoints.clear();
        attempt.ok = list_render_endpoints(endpoints, attempt.error);
      },
      wait_audio_settled);
  if (!listed.ok) {
    print_json(L"{\"error\":\"" + json_escape(listed.error) + L"\"}");
    return 3;
  }

  const std::wstring registered = registered_dll_path();
  const bool installed =
      !registered.empty() && path_exists(registered) && apo_record_present();
  std::wstring out = L"{\"installed\":";
  out += installed ? L"true" : L"false";
  out += L",\"dllPath\":\"";
  out += json_escape(installed ? registered : installed_dll_path());
  out += L"\",\"dllVersion\":\"";
  out += json_escape(installed ? dll_version(registered) : std::wstring());
  out += L"\",\"configDir\":\"";
  out += json_escape(config_dir());
  // The three machine-wide facts that decide whether audiodg.exe can load
  // this effect at all. Every one of them can be true at install time and
  // false later, and while any is false the engine reports as installed and
  // attached on every output and is never once loaded — the state a user's
  // machine was in with nothing anywhere to say why.
  out += L"\",\"unsignedAllowed\":";
  out += unsigned_effects_enabled() ? L"true" : L"false";
  out += L",\"runtimeBeside\":";
  out += runtime_beside(installed ? registered : installed_dll_path())
             ? L"true"
             : L"false";
  // And whether it has ever run here: the effect writes a line to its own log
  // the first time Windows creates it, so an absent log on a machine that has
  // been playing sound is itself the answer.
  out += L",\"everRan\":";
  out += engine_has_run() ? L"true" : L"false";
  // And whether the account the effect runs as may write there at all: the
  // tree can exist, be named correctly and still be closed to LOCAL SERVICE,
  // which loads the effect into a folder it can neither read a configuration
  // from nor write a status to. From outside, identical to never loading.
  out += L",\"serviceCanWrite\":";
  out += service_can_write(engine_root()) ? L"true" : L"false";
  out += L",\"endpoints\":[";
  for (size_t at = 0; at < endpoints.size(); ++at) {
    if (at != 0) {
      out += L',';
    }
    out += endpoint_json(endpoints[at]);
  }
  out += L']';
  // The microphones, in a list of their own so nothing that reads
  // `endpoints` as the outputs ever mistakes one for an output. Asked once,
  // after the outputs answered: a list that fails here is reported beside an
  // empty one and costs the outputs nothing.
  std::vector<Endpoint> microphones;
  std::wstring microphones_error;
  list_capture_endpoints(microphones, microphones_error);
  out += L",\"microphones\":[";
  for (size_t at = 0; at < microphones.size(); ++at) {
    if (at != 0) {
      out += L',';
    }
    out += endpoint_json(microphones[at]);
  }
  out += L']';
  if (!microphones_error.empty()) {
    out += L",\"microphonesError\":\"" + json_escape(microphones_error) + L"\"";
  }
  out += L'}';
  print_json(out);
  return 0;
}

/**
 * Waits until Windows audio has finished starting or stopping, and says so.
 *
 * For the app's own retries, which cannot see the service control manager:
 * never elevates, never writes. Returns 0, or 3 when the services could not
 * be watched.
 */
int print_settled() {
  CommandResult result;
  result.ok = wait_audio_settled(result.error);
  print_json(result_json(L"settle", result));
  return result.ok ? 0 : 3;
}

/**
 * Runs the command here, having already established it may — up to three
 * times, in this one elevated process (`retry.h`).
 */
/**
 * One line per elevated run, appended to `<engine root>\setup.log`.
 *
 * `last-setup.json` holds only the most recent run and the app log only what
 * this program printed back to it. Neither says what the run before that
 * did, and a machine that has been installed, attached, repaired and had
 * Equalizer APO switched off over a week is a sequence, not a state. The
 * line carries the command as it was given, how it ended, and each output it
 * touched with the error it met there — and it is dated the way the effect's
 * own log is (UTC, ISO), so a report can cut both at the same moment.
 */
void note_run(const std::vector<std::wstring>& arguments,
              const CommandResult& result, int code) {
  const std::wstring root = engine_root();
  if (root.empty() || !path_exists(root)) {
    return;  // A purge, or a machine the engine was never put on.
  }
  SYSTEMTIME now = {};
  GetSystemTime(&now);
  wchar_t stamp[32] = {};
  swprintf_s(stamp, L"%04u-%02u-%02uT%02u:%02u:%02u.%03uZ", now.wYear,
             now.wMonth, now.wDay, now.wHour, now.wMinute, now.wSecond,
             now.wMilliseconds);
  std::wstring line = stamp;
  line += L" setup";
  for (const std::wstring& argument : arguments) {
    line += L' ';
    line += argument;
  }
  line += result.ok ? L" -> ok" : L" -> FAILED";
  line += L" (exit " + std::to_wstring(code) + L")";
  if (!result.error.empty()) {
    line += L": " + result.error;
  }
  for (const EndpointResult& one : result.endpoints) {
    line += L"\n    " + one.guid +
            (one.attached ? L" attached" : L" not attached");
    if (!one.error.empty()) {
      line += L": " + one.error;
    }
  }
  line += L"\n";
  append_utf8(setup_log_path(), line);
}

int run_elevated(const Options& options, const std::vector<std::wstring>& arguments) {
  const CommandResult result = run_with_retries(
      kCommandTries,
      [&options](CommandResult& attempt) { run_command(options, attempt); },
      wait_audio_settled);
  const std::wstring json = result_json(options.command, result);
  note_run(arguments, result, result.ok ? 0 : 3);
  // `uninstall --purge` has just deleted this tree on purpose. Recreating it
  // to drop a result file in would leave behind exactly the directory the
  // user asked to be rid of, so that run reports through its exit code alone
  // and the unelevated half fills in the rest.
  const bool purged = options.command == L"uninstall" && options.purge;
  // `restart-audio` is also what "Restart Windows audio" runs on a machine
  // that only uses Equalizer APO. Creating the tree there leaves a folder
  // with a Users-modify permission and an empty config.txt for an engine that
  // was never installed, so this one writes its result only into a tree that
  // already exists and otherwise reports through its exit code, like a purge.
  const bool leaves_tree_alone = options.command == L"restart-audio";
  if (!purged) {
    // The tree may not exist yet — `attach` can be the first command ever run
    // on a machine — and the result has to have somewhere to go regardless.
    if (!leaves_tree_alone) {
      std::wstring ignored;
      ensure_engine_tree(ignored);
    }
    if (!leaves_tree_alone || path_exists(engine_root())) {
      write_utf8(result_path(), json);
    }
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
  if (code == 2) {
    // The elevated half never ran, so nothing wrote the line above; the
    // refusal itself is the fact worth keeping — a machine whose engine was
    // never repaired because every prompt was declined looks, from the app
    // log alone, like one where the repair was never tried.
    CommandResult declined;
    declined.ok = false;
    declined.error = L"the Windows permission prompt was declined";
    note_run(arguments, declined, code);
  }
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

/** Everything the program does, once it has an argument vector to do it on. */
int run_main(int argc, wchar_t** argv) {
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
    code = print_status();
  } else if (options.command == L"settle") {
    code = print_settled();
  } else if (is_elevated()) {
    code = run_elevated(options,
                        std::vector<std::wstring>(argv + 1, argv + argc));
  } else {
    code = run_through_elevation(argc, argv, options);
  }

  CoUninitialize();
  return code;
}

}  // namespace

// Unnamed parameters: `/W4 /WX` makes an unused one an error, and a windows
// subsystem entry point is handed four things this program has no use for —
// it has no window and no instance of its own.
int APIENTRY wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
  // Before anything is printed, and before the parse that prints the usage.
  borrow_caller_console();

  int argc = 0;
  wchar_t** argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  if (argv == nullptr) {
    std::fputs("FluidEQ-Engine-Setup: the command line could not be read.\n",
               stderr);
    return 1;
  }
  const int code = run_main(argc, argv);
  LocalFree(argv);
  return code;
}
