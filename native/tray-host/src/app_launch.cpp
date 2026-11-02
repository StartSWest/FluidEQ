/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "app_launch.h"

#include "fluideq/io/pipes.h"

namespace feq::tray {
namespace {

void CALLBACK ended_now(void* context, BOOLEAN) {
  const auto* weak = static_cast<std::weak_ptr<std::function<void()>>*>(context);
  std::weak_ptr<std::function<void()>> later = *weak;
  // Heard on a pool thread; told on the loop, like everything else.
  io::loop().post([later] {
    if (const auto ended = later.lock()) {
      if (*ended) {
        (*ended)();
      }
    }
  });
}

}  // namespace

std::wstring command_line(const Relaunch& relaunch) {
  std::wstring command = io::quoted_argument(relaunch.file);
  for (const auto& argument : relaunch.args) {
    command += L" " + io::quoted_argument(argument);
  }
  return command;
}

std::shared_ptr<AppLaunch> AppLaunch::start(const Relaunch& relaunch,
                                            std::function<void()> ended) {
  if (relaunch.file.empty()) {
    return nullptr;
  }
  // An ordinary launch: no show flags, so the window Electron shows comes up
  // as it does from the Start menu.
  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  PROCESS_INFORMATION process{};
  std::wstring command = command_line(relaunch);
  if (CreateProcessW(relaunch.file.c_str(), command.data(), nullptr, nullptr,
                     FALSE, CREATE_UNICODE_ENVIRONMENT, nullptr,
                     relaunch.cwd.empty() ? nullptr : relaunch.cwd.c_str(),
                     &startup, &process) == FALSE) {
    return nullptr;
  }
  CloseHandle(process.hThread);
  // The press that started it came through the tray, which the shell let
  // come to the front; this lets the window it opens come there too.
  AllowSetForegroundWindow(process.dwProcessId);
  auto launch = std::make_shared<AppLaunch>(process.hProcess, process.dwProcessId,
                                            std::move(ended));
  launch->context_ = new std::weak_ptr<std::function<void()>>(launch->ended_);
  if (RegisterWaitForSingleObject(&launch->wait_, process.hProcess, ended_now,
                                  launch->context_, INFINITE,
                                  WT_EXECUTEONLYONCE) == FALSE) {
    // Unwatched, it is as good as ended for the tray: the next press starts
    // another, which the single-copy lock turns into this one's window.
    launch->wait_ = nullptr;
    ended_now(launch->context_, FALSE);
  }
  return launch;
}

AppLaunch::AppLaunch(HANDLE process, DWORD pid, std::function<void()> ended)
    : process_(process),
      pid_(pid),
      ended_(std::make_shared<std::function<void()>>(std::move(ended))) {}

AppLaunch::~AppLaunch() {
  if (wait_ != nullptr) {
    // Waits for a callback already running, so its context can go.
    UnregisterWaitEx(wait_, INVALID_HANDLE_VALUE);
  }
  delete context_;
  CloseHandle(process_);
}

}  // namespace feq::tray
