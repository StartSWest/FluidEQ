/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The tray once main has left it (`appLeave.ts`): FluidEQ goes on — the
// engine's line held, nothing undone — and the tray starts FluidEQ again
// when it is opened, once however often it is pressed, and takes FluidEQ's
// sound off only when it is told to quit. Each beside its control: main
// ending without saying it leaves is FluidEQ ending, as it always was.

#include <cstdio>
#include <functional>
#include <optional>
#include <span>
#include <string>
#include <vector>

#include "app_launch.h"
#include "fluideq/io/pipes.h"
#include "links.h"
#include "tray_host.h"
#include "tray_model.h"

// After the headers above, which bring in windows.h.
#include <shellapi.h>

namespace {

namespace io = feq::io;
namespace json = feq::share::json;
namespace tray = feq::tray;

int failures = 0;

void check(bool ok, const std::string& what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what.c_str());
    ++failures;
  }
}

io::Bytes bytes(std::string_view text) { return {text.begin(), text.end()}; }

void print(const std::vector<std::string>& log) {
  for (const auto& entry : log) {
    std::printf("  %s\n", entry.c_str());
  }
}

// --- the command main hands over ---------------------------------------------

void quotes_as_windows_reads_it() {
  check(io::quoted_argument(L"plain") == L"plain", "a plain word stays bare");
  check(io::quoted_argument(L"") == L"\"\"", "an empty argument is a pair of quotes");
  check(io::quoted_argument(L"C:\\Program Files\\FluidEQ\\FluidEQ.exe") ==
            L"\"C:\\Program Files\\FluidEQ\\FluidEQ.exe\"",
        "a path with a space is quoted, its backslashes left alone");
  check(io::quoted_argument(L"say \"hi\"") == L"\"say \\\"hi\\\"\"",
        "a quote inside is escaped");
  check(io::quoted_argument(L"C:\\dir\\ x\\") == L"\"C:\\dir\\ x\\\\\"",
        "backslashes before the closing quote are doubled");

  tray::Relaunch relaunch{L"C:\\Program Files\\FluidEQ\\FluidEQ.exe",
                          {L"--flag", L"a b", L"c\\\"d"},
                          L""};
  int count = 0;
  LPWSTR* read = CommandLineToArgvW(tray::command_line(relaunch).c_str(), &count);
  const bool same = read != nullptr && count == 4 &&
                    std::wstring(read[0]) == relaunch.file &&
                    std::wstring(read[1]) == L"--flag" &&
                    std::wstring(read[2]) == L"a b" &&
                    std::wstring(read[3]) == L"c\\\"d";
  LocalFree(read);
  check(same, "Windows reads the command back as main gave it");
}

void reads_leaving() {
  const auto message = json::parse(
      R"({"type":"leaving","relaunch":{"file":"C:\\app\\FluidEQ.exe",)"
      R"("args":["--x",7,"y z"],"cwd":"C:\\app"}})");
  const auto read = message ? tray::parse_leaving(*message) : std::nullopt;
  check(read && read->file == L"C:\\app\\FluidEQ.exe" && read->args.size() == 2 &&
            read->args[1] == L"y z" && read->cwd == L"C:\\app",
        "the command is read, and an argument that is not text dropped");
  const auto no_file = json::parse(R"({"type":"leaving","relaunch":{"args":[]}})");
  check(!tray::parse_leaving(*no_file), "a leaving with nothing to start is none");
  const auto other = json::parse(R"({"type":"state","menu":[]})");
  check(!tray::parse_leaving(*other), "another message is not a leaving");
}

// --- the host after main --------------------------------------------------------

std::shared_ptr<io::PipeStream> connect_to(const std::wstring& name) {
  const HANDLE handle =
      CreateFileW(name.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr,
                  OPEN_EXISTING, FILE_FLAG_OVERLAPPED, nullptr);
  if (handle == INVALID_HANDLE_VALUE || !io::loop().attach(handle)) {
    return nullptr;
  }
  return std::make_shared<io::PipeStream>(handle);
}

void on_line(const std::shared_ptr<io::PipeStream>& client,
             std::function<void(const std::string&)> line) {
  auto pending = std::make_shared<std::string>();
  client->start(io::PipeStream::Events{
      [pending, line](std::span<const std::uint8_t> data) {
        pending->append(data.begin(), data.end());
        for (auto end = pending->find('\n'); end != std::string::npos;
             end = pending->find('\n')) {
          const std::string one = pending->substr(0, end);
          pending->erase(0, end + 1);
          line(one);
        }
      },
      {},
      {}});
}

constexpr char kLeaving[] =
    R"({"type":"recipe","recipe":{"configDir":"C:\\cfg","rootName":"fluideq.txt","rootText":"x"}})"
    "\n"
    R"({"type":"leaving","relaunch":{"file":"C:\\app\\FluidEQ.exe","args":[]}})"
    "\n";

constexpr char kLeavingWithSongs[] =
    R"({"type":"leaving","relaunch":{"file":"C:\\app\\FluidEQ.exe","args":[]},)"
    R"("songs":{"mediaExe":"C:\\app\\FluidEQ-Media.exe","selfId":"FluidEQ",)"
    R"("configDir":"C:\\engine\\config","statusDir":"C:\\engine",)"
    R"("levelsFile":"C:\\data\\song-levels.json","rootName":"fluideq-programme.txt",)"
    R"("perOutputPrefix":"fluideq-programme-","mainEndpoint":"{AB}"}})"
    "\n";

/** A tray whose launches and endings are written down, not done. */
struct LeaveRun {
  std::vector<std::string> log;
  std::shared_ptr<tray::QuitDuty> duty = std::make_shared<tray::QuitDuty>();
  std::shared_ptr<tray::TrayHost> host;
  /** What a launch hands back, so a test can end the process it stands for. */
  std::function<void()> launched_ended;
  std::wstring link = io::unique_pipe_name(L"FluidEQ-Tray-Test-");
  std::wstring owner = io::unique_pipe_name(L"FluidEQ-Owner-Test-");

  tray::HostParts parts() {
    return tray::HostParts{
        [this](tray::TrayState state) {
          log.push_back("show " + tray::narrow(state.tooltip));
        },
        [this] {
          log.push_back("close");
          io::loop().stop(0);
        },
        [this] { log.push_back("stop answering"); },
        [this](const tray::QuitRecipe& recipe) {
          log.push_back("apply " + tray::narrow(recipe.config_dir));
        },
        [this](const tray::Relaunch& relaunch, std::function<void()> ended) {
          log.push_back("launch " + tray::narrow(relaunch.file));
          launched_ended = std::move(ended);
          return true;
        },
        [this](const tray::SongsHandover& handover) -> std::function<void()> {
          log.push_back("songs start " + tray::narrow(handover.config_dir));
          return [this] { log.push_back("songs stop"); };
        }};
  }

  bool start() {
    auto started = tray::TrayHost::start(link, owner, duty, parts());
    if (started.index() != 0) {
      return false;
    }
    host = std::get<0>(started);
    return true;
  }
};

/**
 * `then`, once `ready` says the host has heard what it waits for. The host
 * hears the pipe's end and its lines on the loop, in an order the pipe and
 * not the test decides, so the test asks the host rather than guessing; each
 * ask is one turn of the loop, behind whatever completion is already queued.
 */
void once(const std::function<bool()>& ready, std::function<void()> then) {
  io::loop().post([ready, then] {
    if (ready()) {
      then();
    } else {
      once(ready, then);
    }
  });
}

/** Main connects, says it leaves (`said`), and goes; then `after` runs. */
void main_leaves(LeaveRun& run, std::function<void()> after,
                 const char* said = kLeaving) {
  auto main_end = connect_to(run.link);
  on_line(main_end, [&run, main_end, after, said](const std::string& line) {
    if (line.find("\"hello\"") == std::string::npos) {
      return;
    }
    main_end->write(bytes(said), [&run, main_end, after](const auto&) {
      once([&run] { return run.host->main_is_leaving(); },
           [&run, main_end, after] {
             main_end->destroy();
             once([&run] { return !run.host->main_is_here(); }, after);
           });
    });
  });
}

void left_it_running_and_opens_it_once() {
  io::Loop loop;
  io::set_loop(&loop);
  LeaveRun run;
  if (!run.start()) {
    check(false, "the host starts");
    return;
  }
  main_leaves(run, [&run] {
    run.log.push_back(tray::OwnerPipe::serve(run.owner).index() == 1
                          ? "line still held"
                          : "line let go");
    run.host->pressed("open");
    run.host->pressed("open");
    run.log.push_back("pressed twice");
    // The FluidEQ it started ended before it connected: the next press
    // starts another.
    if (run.launched_ended) {
      run.launched_ended();
    }
    run.host->pressed("open");
    // That one connects: the tray is its again.
    const auto again = connect_to(run.link);
    on_line(again, [&run, again](const std::string& line) {
      if (line.find("\"hello\"") != std::string::npos) {
        run.log.push_back("hello again");
        run.host->pressed("quit");
      } else {
        run.log.push_back("main told " + line);
        again->destroy();
      }
    });
  });
  loop.run();
  const std::vector<std::string> expected{
      "line still held", "launch C:\\app\\FluidEQ.exe", "pressed twice",
      "launch C:\\app\\FluidEQ.exe", "hello again",
      "main told {\"type\":\"pressed\",\"id\":\"quit\"}", "stop answering",
      "apply C:\\cfg", "close"};
  check(run.log == expected,
        "left: the line held and nothing undone; opened: started once per "
        "attempt; back: its presses are main's, and its end is FluidEQ's");
  if (run.log != expected) {
    print(run.log);
  }
}

void quit_with_nobody_there_takes_the_sound_off() {
  io::Loop loop;
  io::set_loop(&loop);
  LeaveRun run;
  if (!run.start()) {
    check(false, "the host starts");
    return;
  }
  main_leaves(run, [&run] { run.host->pressed("quit"); });
  loop.run();
  const std::vector<std::string> expected{"stop answering", "apply C:\\cfg",
                                          "close"};
  check(run.log == expected, "Quit from the tray alone ends FluidEQ, sound and all");
  if (run.log != expected) {
    print(run.log);
  }
}

void a_quit_while_main_is_leaving_waits_for_it() {
  io::Loop loop;
  io::set_loop(&loop);
  LeaveRun run;
  if (!run.start()) {
    check(false, "the host starts");
    return;
  }
  auto main_end = connect_to(run.link);
  on_line(main_end, [&run, main_end](const std::string& line) {
    if (line.find("\"hello\"") == std::string::npos) {
      return;
    }
    main_end->write(bytes(kLeaving), [&run, main_end](const auto&) {
      // Said it leaves and is not gone yet: a press now is the tray's, and
      // it is done once main has gone.
      once([&run] { return run.host->main_is_leaving(); }, [&run, main_end] {
        run.host->pressed("quit");
        run.log.push_back("quit pressed");
        main_end->destroy();
      });
    });
  });
  loop.run();
  const std::vector<std::string> expected{"quit pressed", "stop answering",
                                          "apply C:\\cfg", "close"};
  check(run.log == expected, "a quit pressed as main leaves is done once it has");
  if (run.log != expected) {
    print(run.log);
  }
}

void an_open_while_main_is_leaving_opens_once_it_has() {
  io::Loop loop;
  io::set_loop(&loop);
  LeaveRun run;
  if (!run.start()) {
    check(false, "the host starts");
    return;
  }
  auto main_end = connect_to(run.link);
  on_line(main_end, [&run, main_end](const std::string& line) {
    if (line.find("\"hello\"") == std::string::npos) {
      return;
    }
    main_end->write(bytes(kLeaving), [&run, main_end](const auto&) {
      once([&run] { return run.host->main_is_leaving(); }, [&run, main_end] {
        run.host->pressed("open");
        run.log.push_back("open pressed");
        main_end->destroy();
        once([&run] { return !run.host->main_is_here(); }, [&run] {
          // Started once main had gone; then Quit, with nobody there.
          run.host->pressed("quit");
        });
      });
    });
  });
  loop.run();
  const std::vector<std::string> expected{"open pressed",
                                          "launch C:\\app\\FluidEQ.exe",
                                          "stop answering", "apply C:\\cfg",
                                          "close"};
  check(run.log == expected,
        "an Open pressed as main leaves starts FluidEQ once it has gone");
  if (run.log != expected) {
    print(run.log);
  }
}

}  // namespace

/**
 * This program started as FluidEQ would be (`AppLaunch`): it writes the
 * folder it started in and the arguments it was given to the file named
 * first, one a line, and ends.
 */
int as_relaunched(int count, wchar_t** values) {
  const HANDLE file = CreateFileW(values[2], GENERIC_WRITE, 0, nullptr,
                                  CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) {
    return 2;
  }
  wchar_t folder[MAX_PATH + 1]{};
  GetCurrentDirectoryW(MAX_PATH, folder);
  std::string text = tray::narrow(folder) + "\n";
  for (int at = 3; at < count; at += 1) {
    text += tray::narrow(values[at]) + "\n";
  }
  DWORD written = 0;
  WriteFile(file, text.data(), static_cast<DWORD>(text.size()), &written, nullptr);
  CloseHandle(file);
  return 0;
}

void starts_fluideq_as_it_was_started() {
  io::Loop loop;
  io::set_loop(&loop);
  wchar_t self[MAX_PATH]{};
  GetModuleFileNameW(nullptr, self, MAX_PATH);
  wchar_t temp[MAX_PATH + 1]{};
  GetTempPathW(MAX_PATH, temp);
  const std::wstring said = std::wstring(temp) + L"fluideq-tray-relaunch-" +
                            std::to_wstring(GetCurrentProcessId()) + L".txt";
  // Its own folder, which is not this one's: the temporary folder, as
  // Windows names a working folder (no closing backslash).
  std::wstring folder(temp);
  folder.pop_back();
  bool ended = false;
  const auto launch = tray::AppLaunch::start(
      tray::Relaunch{self, {L"--relaunched", said, L"--lang=es", L"two words",
                            L"C:\\path with space\\", L"say \"hi\""},
                     folder},
      [&] {
        ended = true;
        loop.stop(0);
      });
  check(launch != nullptr, "the program starts");
  if (!launch) {
    return;
  }
  loop.run();
  check(ended, "its end is heard on the loop");
  std::string text;
  const HANDLE file = CreateFileW(said.c_str(), GENERIC_READ, FILE_SHARE_READ,
                                  nullptr, OPEN_EXISTING, 0, nullptr);
  if (file != INVALID_HANDLE_VALUE) {
    text.resize(4096);
    DWORD read = 0;
    ReadFile(file, text.data(), static_cast<DWORD>(text.size()), &read, nullptr);
    text.resize(read);
    CloseHandle(file);
  }
  DeleteFileW(said.c_str());
  check(text == tray::narrow(folder) +
                    "\n--lang=es\ntwo words\nC:\\path with space\\\nsay \"hi\"\n",
        "it starts in the folder main named, with every argument exactly as "
        "main handed them over");
  check(!tray::AppLaunch::start(tray::Relaunch{L"C:\\no such\\program.exe", {}, L""},
                                [] {}),
        "a program that is not there is not started");
}

void carries_the_song_job_while_main_is_gone() {
  io::Loop loop;
  io::set_loop(&loop);
  LeaveRun run;
  if (!run.start()) {
    check(false, "the host starts");
    return;
  }
  main_leaves(
      run,
      [&run] {
        run.log.push_back("main gone");
        // A FluidEQ connects again: the job is its own once more.
        const auto again = connect_to(run.link);
        on_line(again, [&run, again](const std::string& line) {
          if (line.find("\"hello\"") != std::string::npos) {
            run.log.push_back("hello again");
            again->destroy();
            once([&run] { return !run.host->main_is_here(); },
                 [&run] { run.host->pressed("quit"); });
          }
        });
      },
      kLeavingWithSongs);
  loop.run();
  const std::vector<std::string> expected{
      "songs start C:\\engine\\config", "main gone", "songs stop",
      "hello again", "stop answering", "close"};
  check(run.log == expected,
        "the song job runs from main's leaving to the next FluidEQ, and once");
  if (run.log != expected) {
    print(run.log);
  }
}

void reads_the_song_handover() {
  const auto with = json::parse(std::string_view(kLeavingWithSongs));
  const auto songs = with ? tray::parse_leaving_songs(*with) : std::nullopt;
  check(songs && songs->media_exe == L"C:\\app\\FluidEQ-Media.exe" &&
            songs->self_id == L"FluidEQ" &&
            songs->config_dir == L"C:\\engine\\config" &&
            songs->status_dir == L"C:\\engine" &&
            songs->levels_file == L"C:\\data\\song-levels.json" &&
            songs->root_name == "fluideq-programme.txt" &&
            songs->per_output_prefix == "fluideq-programme-" &&
            songs->main_endpoint == "{AB}",
        "a leaving hands the song job over whole");
  const auto without = json::parse(std::string_view(kLeaving).substr(
      std::string_view(kLeaving).find('\n') + 1));
  check(without && !tray::parse_leaving_songs(*without),
        "a leaving with no song job hands none over");
  const auto partial = json::parse(
      R"({"type":"leaving","relaunch":{"file":"x"},"songs":{"mediaExe":"m",)"
      R"("selfId":"s","statusDir":"d","levelsFile":"l","rootName":"r",)"
      R"("perOutputPrefix":"p"}})");
  check(partial && !tray::parse_leaving_songs(*partial),
        "a handover missing the engine's folder is no job at all");
}

int wmain(int count, wchar_t** values) {
  if (count >= 3 && std::wstring(values[1]) == L"--relaunched") {
    return as_relaunched(count, values);
  }
  quotes_as_windows_reads_it();
  reads_leaving();
  left_it_running_and_opens_it_once();
  quit_with_nobody_there_takes_the_sound_off();
  a_quit_while_main_is_leaving_waits_for_it();
  an_open_while_main_is_leaving_opens_once_it_has();
  starts_fluideq_as_it_was_started();
  reads_the_song_handover();
  carries_the_song_job_while_main_is_gone();
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("tray leave: FluidEQ goes on without main, opens again, quits whole\n");
  return 0;
}
