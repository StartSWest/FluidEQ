/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * FluidEQ started again from the tray, after its window's process left with
 * nothing to do (`TrayHost`, `appLeave.ts`): the command main handed over as
 * it left, run as an ordinary launch — shown, not hidden, its window allowed
 * to come to the front — and its end heard on the loop, so a launch that
 * fails before it ever connects does not leave the tray waiting on it.
 */

#include <functional>
#include <memory>
#include <string>

#include "fluideq/io/loop.h"
#include "tray_model.h"

namespace feq::tray {

/** The whole command line: the program first, then each argument. */
std::wstring command_line(const Relaunch& relaunch);

class AppLaunch {
 public:
  /**
   * Starts it; `ended` runs on the loop once the process has ended. Nothing
   * when it could not be started.
   */
  static std::shared_ptr<AppLaunch> start(const Relaunch& relaunch,
                                          std::function<void()> ended);

  AppLaunch(HANDLE process, DWORD pid, std::function<void()> ended);
  ~AppLaunch();
  AppLaunch(const AppLaunch&) = delete;
  AppLaunch& operator=(const AppLaunch&) = delete;

  DWORD pid() const { return pid_; }

 private:
  HANDLE process_;
  DWORD pid_;
  HANDLE wait_ = nullptr;
  /** Shared with the wait, which may fire after this is gone. */
  std::shared_ptr<std::function<void()>> ended_;
  std::weak_ptr<std::function<void()>>* context_ = nullptr;
};

}  // namespace feq::tray
