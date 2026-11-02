/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// FluidEQ-Tray: the notification-area icon and the engine's line to
// FluidEQ, out of Electron (`tray_host.h`). Main starts it with
// `--key <key>`, which names this install's tray, and `--owner-pipe <name>`
// when it is to serve the engine's line; it prints `ready` on its standard
// output once main can connect, and main speaks to it on
// `\\.\pipe\FluidEQ-Tray-<key>`.
//
// One tray an install. A second one started while the first runs waits for
// the first to be ready, says `ready` for it and ends; one started while the
// first is on its way out waits for it to go, then serves in its place. A
// tray main has left (`appLeave.ts`) is still ready: the FluidEQ it starts
// again, or any other launch, connects to it.
//
// Two threads: the window's, which owns the icon and the menu and hears the
// session end, and the loop's, which owns both pipes and the FluidEQ it
// starts again.

#include <combaseapi.h>
#include <shellapi.h>

#include <cstdio>
#include <future>
#include <string>
#include <thread>

#include "app_launch.h"
#include "song_watch.h"
#include "tray_host.h"
#include "tray_window.h"

namespace {

namespace io = feq::io;
namespace tray = feq::tray;

constexpr int kExitUsage = 1;
constexpr int kExitCannotServe = 3;

struct Arguments {
  std::wstring key;
  std::wstring owner_pipe;
};

/** A key names kernel objects and a pipe: letters, digits and dashes only. */
bool is_key(const std::wstring& key) {
  if (key.empty() || key.size() > 64) {
    return false;
  }
  for (const wchar_t c : key) {
    const bool allowed = (c >= L'a' && c <= L'z') || (c >= L'A' && c <= L'Z') ||
                         (c >= L'0' && c <= L'9') || c == L'-';
    if (!allowed) {
      return false;
    }
  }
  return true;
}

bool read_arguments(Arguments* out) {
  int count = 0;
  LPWSTR* values = CommandLineToArgvW(GetCommandLineW(), &count);
  if (values == nullptr) {
    return false;
  }
  for (int at = 1; at + 1 < count; at += 2) {
    const std::wstring name = values[at];
    if (name == L"--key") {
      out->key = values[at + 1];
    } else if (name == L"--owner-pipe") {
      out->owner_pipe = values[at + 1];
    }
  }
  LocalFree(values);
  return is_key(out->key);
}

/** The one line main waits for. Nothing to say it to when run by hand. */
void say_ready() {
  const HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
  if (output == nullptr || output == INVALID_HANDLE_VALUE) {
    return;
  }
  constexpr char kReady[] = "ready\n";
  DWORD written = 0;
  WriteFile(output, kReady, sizeof(kReady) - 1, &written, nullptr);
  FlushFileBuffers(output);
}

class Handle {
 public:
  explicit Handle(HANDLE handle) : handle_(handle) {}
  ~Handle() {
    if (handle_ != nullptr) {
      CloseHandle(handle_);
    }
  }
  Handle(const Handle&) = delete;
  Handle& operator=(const Handle&) = delete;
  HANDLE get() const { return handle_; }

 private:
  HANDLE handle_;
};

}  // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int) {
  Arguments arguments;
  if (!read_arguments(&arguments)) {
    return kExitUsage;
  }
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

  // Local\: the tray belongs to the signed-in session it shows an icon in.
  const Handle only(
      CreateMutexW(nullptr, FALSE, (L"Local\\FluidEQ-Tray-" + arguments.key).c_str()));
  const Handle ready(CreateEventW(
      nullptr, TRUE, FALSE, (L"Local\\FluidEQ-Tray-Ready-" + arguments.key).c_str()));
  if (only.get() == nullptr || ready.get() == nullptr) {
    return kExitCannotServe;
  }
  const HANDLE either[] = {ready.get(), only.get()};
  const DWORD waited = WaitForMultipleObjects(2, either, FALSE, INFINITE);
  if (waited == WAIT_OBJECT_0) {
    // Another tray serves this install; main connects to that one.
    say_ready();
    return 0;
  }
  if (waited != WAIT_OBJECT_0 + 1 && waited != WAIT_ABANDONED_0 + 1) {
    return kExitCannotServe;
  }

  // WIC, for the menu's marks; the window's thread is an apartment of its own.
  const HRESULT com = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

  io::Loop loop;
  io::set_loop(&loop);
  const auto duty = std::make_shared<tray::QuitDuty>();
  std::shared_ptr<tray::TrayHost> host;
  /** The FluidEQ last started from here, watched until it ends. Loop thread. */
  std::shared_ptr<tray::AppLaunch> launched;

  auto window = tray::TrayWindow::create(
      instance,
      tray::TrayWindow::Events{
          [&loop, &host](const std::string& id) {
            loop.post([&host, id] {
              if (host) {
                host->pressed(id);
              }
            });
          },
          [&duty] {
            duty->carry_out(
                [](const tray::QuitRecipe& recipe) { tray::apply_recipe(recipe); });
          }});
  if (!window) {
    ReleaseMutex(only.get());
    return kExitCannotServe;
  }

  std::promise<bool> serving;
  std::future<bool> served = serving.get_future();
  std::thread pipes([&] {
    auto started = tray::TrayHost::start(
        L"\\\\.\\pipe\\FluidEQ-Tray-" + arguments.key, arguments.owner_pipe, duty,
        tray::HostParts{
            [&window](tray::TrayState state) { window->show(std::move(state)); },
            [&window, &loop] {
              window->close();
              loop.stop(0);
            },
            [&ready] { ResetEvent(ready.get()); },
            [](const tray::QuitRecipe& recipe) { tray::apply_recipe(recipe); },
            [&launched](const tray::Relaunch& relaunch, std::function<void()> ended) {
              launched = tray::AppLaunch::start(relaunch, std::move(ended));
              return launched != nullptr;
            },
            [&loop](const tray::SongsHandover& handover) -> std::function<void()> {
              auto watch = tray::SongWatch::start(loop, handover);
              if (!watch) {
                return {};
              }
              return [watch] { watch->stop(); };
            }});
    if (started.index() == 1) {
      serving.set_value(false);
      return;
    }
    host = std::get<0>(started);
    serving.set_value(true);
    loop.run();
    host.reset();
    launched.reset();
  });

  if (!served.get()) {
    pipes.join();
    window.reset();
    ReleaseMutex(only.get());
    return kExitCannotServe;
  }
  SetEvent(ready.get());
  say_ready();

  MSG message{};
  while (GetMessageW(&message, nullptr, 0, 0) > 0) {
    TranslateMessage(&message);
    DispatchMessageW(&message);
  }
  // The window ends only after the loop was told to, but a loop left
  // running would hold the join for ever.
  loop.post([&loop] { loop.stop(0); });
  pipes.join();
  window.reset();
  if (SUCCEEDED(com)) {
    CoUninitialize();
  }
  // Last: a tray started meanwhile serves the pipes this one has let go of.
  ReleaseMutex(only.get());
  return 0;
}
