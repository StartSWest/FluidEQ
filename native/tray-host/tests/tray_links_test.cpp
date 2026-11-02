/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The tray's two pipes, live on this machine — main's and the engine's —
// and what the tray does when main's connection ends, told apart, step by
// step, from what it does while main is there.

#include <cstdio>
#include <functional>
#include <optional>
#include <span>
#include <string>
#include <vector>

#include "links.h"
#include "tray_host.h"
#include "tray_model.h"

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

// --- the two pipes ----------------------------------------------------------

std::shared_ptr<io::PipeStream> connect_to(const std::wstring& name) {
  const HANDLE handle =
      CreateFileW(name.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr,
                  OPEN_EXISTING, FILE_FLAG_OVERLAPPED, nullptr);
  if (handle == INVALID_HANDLE_VALUE || !io::loop().attach(handle)) {
    return nullptr;
  }
  return std::make_shared<io::PipeStream>(handle);
}

/** A client's lines, as main reads them. */
void read_lines(const std::shared_ptr<io::PipeStream>& client,
                std::function<void(const std::string&)> line,
                std::function<void()> closed = {}) {
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
      [closed](const std::optional<io::Failure>&) {
        if (closed) {
          closed();
        }
      }});
}

void app_link() {
  io::Loop loop;
  io::set_loop(&loop);
  const std::wstring name = io::unique_pipe_name(L"FluidEQ-Tray-Test-");
  std::vector<std::string> log;
  std::shared_ptr<tray::AppLink> link;
  std::shared_ptr<io::PipeStream> first;
  std::shared_ptr<io::PipeStream> second;
  auto served = tray::AppLink::serve(
      name, tray::AppLink::Events{
                [&] {
                  log.push_back("arrived");
                  link->send(json::Value::object({{"type", json::Value::string("hi")}}));
                },
                [&](const json::Value& message) {
                  const std::string type = *json::string_at(message, "type");
                  log.push_back("heard " + type);
                  if (type == "c") {
                    second = connect_to(name);
                    read_lines(second, [&](const std::string& line) {
                      log.push_back("second told " + line);
                      second->write(bytes("{\"type\":\"d\"}\n"));
                    });
                  } else if (type == "d") {
                    second->destroy();
                  }
                },
                [&] {
                  log.push_back("gone");
                  link->close();
                  loop.stop(0);
                }});
  if (served.index() != 0) {
    check(false, "main's pipe is served");
    return;
  }
  link = std::get<0>(served);
  // When the replaced connection hears its end, against the newer one's
  // first line, is the pipe's business; that it hears it is the tray's.
  bool first_closed = false;
  first = connect_to(name);
  read_lines(
      first,
      [&](const std::string& line) {
        log.push_back("first told " + line);
        first->write(bytes("{\"type\":\"a\"}\n[1]\nnope\n{\"type\":\"b\"}\n{\"ty"));
        first->write(bytes("pe\":\"c\"}\n"));
      },
      [&] { first_closed = true; });
  loop.run();
  const std::vector<std::string> expected{
      "arrived", "first told {\"type\":\"hi\"}",
      "heard a", "heard b",
      "heard c", "arrived",
      "second told {\"type\":\"hi\"}", "heard d",
      "gone"};
  check(log == expected,
        "lines across writes, the rest dropped, the newest connection is main, "
        "and only main's own end is heard as gone");
  if (log != expected) {
    for (const auto& entry : log) {
      std::printf("  %s\n", entry.c_str());
    }
  }
  check(first_closed, "the connection a newer one replaced is ended");
}

void app_link_refuses_a_flood() {
  io::Loop loop;
  io::set_loop(&loop);
  const std::wstring name = io::unique_pipe_name(L"FluidEQ-Tray-Test-");
  bool flooded = false;
  // A line no main would send ends the connection rather than the memory.
  auto served = tray::AppLink::serve(
      name, tray::AppLink::Events{{}, {}, [&] {
                                    flooded = true;
                                    loop.stop(0);
                                  }});
  if (served.index() != 0) {
    check(false, "main's pipe is served");
    return;
  }
  const auto link = std::get<0>(served);
  const auto flood = connect_to(name);
  flood->write(io::Bytes(tray::kMaxLineBytes + 1, 'x'));
  loop.run();
  check(flooded, "a line past the limit drops the connection");
  link->close();
  flood->destroy();
}

void owner_pipe() {
  io::Loop loop;
  io::set_loop(&loop);
  const std::wstring name = io::unique_pipe_name(L"FluidEQ-Owner-Test-");
  auto served = tray::OwnerPipe::serve(name);
  check(served.index() == 0, "the engine's pipe is served");
  if (served.index() != 0) {
    return;
  }
  const auto owner = std::get<0>(served);
  check(tray::OwnerPipe::serve(name).index() == 1,
        "nothing else serves it while the tray does");
  const auto engine = connect_to(name);
  bool broken = false;
  engine->start(io::PipeStream::Events{
      {}, {}, [&](const std::optional<io::Failure>&) {
        broken = true;
        loop.stop(0);
      }});
  engine->write(bytes("ignored"));
  // After the connection's own completion, which the port holds first.
  loop.post([&] {
    check(owner->connections() == 1, "the engine's connection is held");
    owner->close();
  });
  loop.run();
  check(broken, "closing the pipe breaks the engine's line");
}

// --- the host ---------------------------------------------------------------

struct HostRun {
  std::vector<std::string> log;
  std::shared_ptr<tray::QuitDuty> duty = std::make_shared<tray::QuitDuty>();
};

tray::HostParts parts_logging(HostRun& run, std::function<void()> on_show) {
  return tray::HostParts{
      [&run, on_show](tray::TrayState state) {
        run.log.push_back("show " + tray::narrow(state.tooltip));
        on_show();
      },
      [&run] {
        run.log.push_back("close");
        io::loop().stop(0);
      },
      [&run] { run.log.push_back("stop answering"); },
      [&run](const tray::QuitRecipe& recipe) {
        run.log.push_back("apply " + tray::narrow(recipe.config_dir));
      }};
}

/** What main says once connected: the recipe, then what to show. */
constexpr char kState[] =
    R"({"type":"recipe","recipe":{"configDir":"C:\\cfg","rootName":"fluideq.txt",)"
    R"("rootText":"x"}})"
    "\n"
    R"({"type":"state","tooltip":"FluidEQ","icon":"","menu":[{"id":"quit","label":"Quit"}]})"
    "\n";

void host_while_main_is_there_and_after() {
  io::Loop loop;
  io::set_loop(&loop);
  const std::wstring link_name = io::unique_pipe_name(L"FluidEQ-Tray-Test-");
  const std::wstring owner_name = io::unique_pipe_name(L"FluidEQ-Owner-Test-");
  HostRun run;
  std::shared_ptr<tray::TrayHost> host;
  std::shared_ptr<io::PipeStream> main_end;
  auto started = tray::TrayHost::start(
      link_name, owner_name, run.duty,
      parts_logging(run, [&] {
        // While main is there: nothing on disk is touched, and a press
        // goes to main.
        run.log.push_back(tray::OwnerPipe::serve(owner_name).index() == 1
                              ? "owner served"
                              : "owner free");
        host->pressed("quit");
      }));
  if (started.index() != 0) {
    check(false, "the host starts");
    return;
  }
  host = std::get<0>(started);
  check(host->serving_owner_pipe(), "the host serves the engine's pipe");
  main_end = connect_to(link_name);
  read_lines(main_end, [&](const std::string& line) {
    const auto message = json::parse(line);
    const std::string type = message ? *json::string_at(*message, "type") : "";
    if (type == "hello") {
      const auto pid = json::integer_at(*message, "pid");
      const json::Value* owner = message->get("ownerPipe");
      run.log.push_back(
          std::string("hello") +
          (pid && static_cast<DWORD>(*pid) == GetCurrentProcessId() ? " pid"
                                                                     : " no pid") +
          (owner != nullptr && owner->is_bool() && owner->as_bool() ? " owner" : ""));
      main_end->write(bytes(kState));
    } else {
      run.log.push_back("main told " + line);
      // Main quitting: its end of the pipe goes with it.
      main_end->destroy();
    }
  });
  loop.run();
  const std::vector<std::string> expected{
      "hello pid owner", "show FluidEQ", "owner served",
      "main told {\"type\":\"pressed\",\"id\":\"quit\"}",
      "stop answering",  "apply C:\\cfg", "close"};
  check(run.log == expected,
        "hello, the state shown, a press sent, and only main's end runs the "
        "recipe — after the tray stops answering, before it closes");
  if (run.log != expected) {
    for (const auto& entry : run.log) {
      std::printf("  %s\n", entry.c_str());
    }
  }
  check(tray::OwnerPipe::serve(owner_name).index() == 0,
        "the engine's pipe is let go once main has gone");
  check(tray::AppLink::serve(link_name, {}).index() == 0,
        "and main's pipe too");
}

void session_end_does_it_once() {
  io::Loop loop;
  io::set_loop(&loop);
  const std::wstring link_name = io::unique_pipe_name(L"FluidEQ-Tray-Test-");
  const std::wstring owner_name = io::unique_pipe_name(L"FluidEQ-Owner-Test-");
  const auto taken = tray::OwnerPipe::serve(owner_name);
  HostRun run;
  std::shared_ptr<io::PipeStream> main_end;
  auto started = tray::TrayHost::start(
      link_name, owner_name, run.duty, parts_logging(run, [&] {
        // Windows ends the session while main is still there.
        run.duty->carry_out([&run](const tray::QuitRecipe& recipe) {
          run.log.push_back("session end " + tray::narrow(recipe.config_dir));
        });
        main_end->destroy();
      }));
  if (started.index() != 0) {
    check(false, "the host starts beside a taken engine pipe");
    return;
  }
  check(!std::get<0>(started)->serving_owner_pipe(),
        "an engine pipe somebody else serves is not the host's");
  main_end = connect_to(link_name);
  read_lines(main_end, [&](const std::string& line) {
    run.log.push_back(line.find("\"ownerPipe\":false") != std::string::npos
                          ? "told no owner"
                          : "told owner");
    main_end->write(bytes(kState));
  });
  loop.run();
  const std::vector<std::string> expected{"told no owner", "show FluidEQ",
                                          "session end C:\\cfg", "stop answering",
                                          "close"};
  check(run.log == expected, "the session's end does the recipe, and main's end "
                             "after it does not do it again");
  if (run.log != expected) {
    for (const auto& entry : run.log) {
      std::printf("  %s\n", entry.c_str());
    }
  }
  if (taken.index() == 0) {
    std::get<0>(taken)->close();
  }
}

void a_recipe_taken_back_is_not_done() {
  io::Loop loop;
  io::set_loop(&loop);
  const std::wstring link_name = io::unique_pipe_name(L"FluidEQ-Tray-Test-");
  HostRun run;
  std::shared_ptr<io::PipeStream> main_end;
  auto started = tray::TrayHost::start(link_name, L"", run.duty, parts_logging(run, [&] {
                                         if (run.log.back() == "show again") {
                                           main_end->destroy();
                                         }
                                       }));
  if (started.index() != 0) {
    check(false, "the host starts with no engine pipe to serve");
    return;
  }
  check(!std::get<0>(started)->serving_owner_pipe(),
        "no engine pipe is served when none is named");
  main_end = connect_to(link_name);
  read_lines(main_end, [&](const std::string&) {
    // An engine switch left no folder written: the recipe is taken back.
    main_end->write(bytes(std::string(kState) + "{\"type\":\"recipe\"}\n" +
                          "{\"type\":\"state\",\"tooltip\":\"again\",\"menu\":[]}\n"));
  });
  loop.run();
  const std::vector<std::string> expected{"show FluidEQ", "show again",
                                          "stop answering", "close"};
  check(run.log == expected, "a recipe taken back is not done when main goes");
  if (run.log != expected) {
    for (const auto& entry : run.log) {
      std::printf("  %s\n", entry.c_str());
    }
  }
}

}  // namespace

int main() {
  app_link();
  app_link_refuses_a_flood();
  owner_pipe();
  host_while_main_is_there_and_after();
  session_end_does_it_once();
  a_recipe_taken_back_is_not_done();
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("tray links: both pipes live, the host while main is there and after\n");
  return 0;
}
