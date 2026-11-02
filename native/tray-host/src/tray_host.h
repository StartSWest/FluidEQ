/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * What the tray does, on its loop thread, with the window and the files
 * handed in as parts so a test can stand in for both.
 *
 * Main connects and is told the tray's pid; main sends what to show, and the
 * quit recipe whenever its engine folder changes; a press on the icon or the
 * menu goes back to main.
 * Main's connection ending is FluidEQ ending — a quit, a crash, End task —
 * and the tray then does what main's own quit does (`engineQuitReset.ts`),
 * which a crash and End task never ran, and ends: the engine hears its line
 * break, and passes every output through.
 */

#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <variant>

#include "links.h"
#include "tray_model.h"

namespace feq::tray {

/**
 * The quit recipe, done once whichever thread asks first: the loop thread
 * when main has gone, or the window's thread when Windows ends the session —
 * where it has to be done before the handler returns.
 */
class QuitDuty {
 public:
  void set(std::optional<QuitRecipe> recipe);
  /** The recipe once, to `apply`; nothing if it was done or never set. */
  void carry_out(const std::function<void(const QuitRecipe&)>& apply);

 private:
  std::mutex lock_;
  std::optional<QuitRecipe> recipe_;
  bool done_ = false;
};

struct HostParts {
  /** The newest state, for the window. */
  std::function<void(TrayState)> show;
  /** The tray is ending: the icon comes down and the window's loop ends. */
  std::function<void()> close;
  /** No longer the tray a new FluidEQ may connect to (`main.cpp`). */
  std::function<void()> stop_answering;
  std::function<void(const QuitRecipe&)> apply;
};

class TrayHost : public std::enable_shared_from_this<TrayHost> {
 public:
  /**
   * Serving main's pipe and, when `owner_pipe` is not empty, the engine's.
   * A failure to serve main's is the tray's end; the engine's only costs
   * what main used to lose without it, and is told to main.
   */
  static std::variant<std::shared_ptr<TrayHost>, io::Failure> start(
      const std::wstring& link_pipe, const std::wstring& owner_pipe,
      std::shared_ptr<QuitDuty> duty, HostParts parts);

  TrayHost(std::shared_ptr<QuitDuty> duty, HostParts parts);

  /** A press, to main. Loop thread. */
  void pressed(const std::string& id);
  bool serving_owner_pipe() const { return owner_ != nullptr; }

 private:
  void arrived();
  void heard(const share::json::Value& message);
  void main_gone();

  std::shared_ptr<QuitDuty> duty_;
  HostParts parts_;
  std::shared_ptr<OwnerPipe> owner_;
  std::shared_ptr<AppLink> link_;
  bool ending_ = false;
};

}  // namespace feq::tray
