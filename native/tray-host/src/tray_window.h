/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * The notification-area icon and its menu, on the tray's UI thread.
 *
 * A hidden top-level window rather than a message-only one: the shell
 * broadcasts `TaskbarCreated` when Explorer restarts, and Windows sends the
 * session's end, to top-level windows alone — a message-only window would
 * lose the icon to the first Explorer restart and never hear a shutdown.
 *
 * The loop thread hands it what to show through `show` (a mailbox and a
 * wake-up, so a burst of states is drawn once and nothing is left allocated
 * in a queue a closing window drops) and closes it through `close`.
 */

#include "tray_model.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <string>

namespace feq::tray {

class TrayWindow {
 public:
  struct Events {
    /** A menu item's id, or "open" for the icon itself. */
    std::function<void(const std::string& id)> pressed;
    /** Windows is ending the session; runs before the handler returns. */
    std::function<void()> session_ending;
  };

  /** The window, or null when Windows would not make one. UI thread. */
  static std::unique_ptr<TrayWindow> create(HINSTANCE instance, Events events);

  ~TrayWindow();
  TrayWindow(const TrayWindow&) = delete;
  TrayWindow& operator=(const TrayWindow&) = delete;

  /** From any thread: the newest state wins. */
  void show(TrayState state);
  /** From any thread: the icon comes down and the message loop ends. */
  void close();

 private:
  explicit TrayWindow(Events events);

  static LRESULT CALLBACK procedure(HWND window, UINT message, WPARAM w,
                                    LPARAM l);
  bool handle(UINT message, WPARAM w, LPARAM l, LRESULT* result);
  void take_state();
  void load_icon_for(const std::wstring& path);
  void put_icon();
  void take_icon_down();
  void open_menu(int x, int y);

  /** The window while it lives; UI thread only. */
  HWND window_ = nullptr;
  /** The same handle, set before any other thread exists and never cleared,
   * for posting: a post to a window already gone simply fails. */
  HWND target_ = nullptr;
  Events events_;
  UINT taskbar_created_ = 0;

  std::mutex mailbox_lock_;
  std::optional<TrayState> mailbox_;

  TrayState state_;
  /** Null until a state names an icon that can be read: nothing to show. */
  HICON icon_ = nullptr;
  std::wstring icon_path_;
  /** On screen: the shell took it, and has not restarted since. */
  bool added_ = false;
};

}  // namespace feq::tray
