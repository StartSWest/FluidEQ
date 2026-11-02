/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "desktop_monitor.h"

#include <objbase.h>

#include <algorithm>
#include <chrono>
#include <iterator>
#include <utility>

#include "shown_scene.h"

namespace feq::scene {
namespace {

constexpr wchar_t kWindowClass[] = L"FluidEQ-Desktop-Background";

/** A frame's own time is never more than this: a pause is not a jump. */
constexpr double kLongestFrameMs = 100.0;

LRESULT CALLBACK background_procedure(HWND window, UINT message, WPARAM w,
                                      LPARAM l) {
  // Nothing to erase: every frame covers the window, and an erase between a
  // move and the next frame is the flash of a background colour.
  if (message == WM_ERASEBKGND) {
    return 1;
  }
  return DefWindowProcW(window, message, w, l);
}

ATOM window_class() {
  static const ATOM registered = [] {
    WNDCLASSEXW type{};
    type.cbSize = sizeof(type);
    type.lpfnWndProc = background_procedure;
    type.hInstance = GetModuleHandleW(nullptr);
    type.lpszClassName = kWindowClass;
    return RegisterClassExW(&type);
  }();
  return registered;
}

}  // namespace

HeardNow::HeardNow() : first_heard_(CreateEventW(nullptr, TRUE, FALSE, nullptr)) {}

HeardNow::~HeardNow() {
  if (first_heard_ != nullptr) {
    CloseHandle(first_heard_);
  }
}

void HeardNow::set(const HeardLampFrame& frame) {
  {
    const std::lock_guard lock(mutex_);
    frame_ = frame;
  }
  SetEvent(first_heard_);
}

std::optional<HeardLampFrame> HeardNow::latest() const {
  const std::lock_guard lock(mutex_);
  return frame_;
}

DesktopMonitor::DesktopMonitor(wire::MonitorOpen open, std::wstring angle_dir,
                               Mouth& mouth, const HeardNow& heard)
    : open_(open),
      angle_dir_(std::move(angle_dir)),
      mouth_(mouth),
      heard_(heard),
      commands_ready_(CreateEventW(nullptr, FALSE, FALSE, nullptr)),
      stop_(CreateEventW(nullptr, TRUE, FALSE, nullptr)),
      thread_([this] { run(); }) {}

DesktopMonitor::~DesktopMonitor() {
  SetEvent(stop_);
  thread_.join();
  CloseHandle(commands_ready_);
  CloseHandle(stop_);
}

void DesktopMonitor::command(Command next) {
  {
    const std::lock_guard lock(mutex_);
    commands_.push_back(std::move(next));
  }
  SetEvent(commands_ready_);
}

void DesktopMonitor::show(DesktopScene scene) { command(std::move(scene)); }
void DesktopMonitor::daylight(const wire::Daylight& daylight) { command(daylight); }
void DesktopMonitor::scale(double scale) { command(Scale{scale}); }
void DesktopMonitor::pause(bool paused) { command(Pause{paused}); }

void DesktopMonitor::run() {
  const std::uint32_t monitor = open_.monitor;
  // Its own apartment: the artwork the scenes carry is already decoded, but
  // ANGLE may ask for COM on the thread that draws.
  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  const HWND window =
      window_class() == 0
          ? nullptr
          : CreateWindowExW(WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE, kWindowClass,
                            L"FluidEQ", WS_POPUP, open_.x, open_.y,
                            static_cast<int>(open_.width),
                            static_cast<int>(open_.height), nullptr, nullptr,
                            GetModuleHandleW(nullptr), nullptr);
  DesktopPainter painter(
      angle_dir_,
      DesktopPainter::Output{
          [this, monitor](std::uint32_t id) {
            mouth_.say(wire::monitor_loaded_message(monitor, id), false);
          },
          [this, monitor](std::uint32_t id) {
            mouth_.say(wire::monitor_drawn_message(monitor, id), false);
          },
          [this, monitor](std::uint32_t id, wire::FailReason reason,
                          const std::string& words) {
            mouth_.say(wire::monitor_failed_message(monitor, id, reason, words),
                       false);
          }});
  bool open = false;
  if (window == nullptr) {
    mouth_.say(wire::monitor_failed_message(monitor, 0,
                                            wire::FailReason::kNoContext,
                                            "the monitor's window could not be made"),
               false);
  } else {
    mouth_.say(wire::monitor_window_message(
                   monitor, static_cast<std::uint64_t>(
                                reinterpret_cast<std::uintptr_t>(window))),
               false);
    std::string why;
    open = painter.open(window, static_cast<int>(open_.width),
                        static_cast<int>(open_.height), why);
    if (!open) {
      mouth_.say(wire::monitor_failed_message(monitor, 0,
                                              wire::FailReason::kNoContext, why),
                 false);
    }
    painter.set_scale(open_.scale);
  }

  wire::Daylight daylight;
  bool paused = false;
  std::optional<std::chrono::steady_clock::time_point> last_paint;
  for (;;) {
    // The desktop helper moves this window from its own process, and those
    // calls wait until this thread has taken their messages.
    MSG message{};
    while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE) != FALSE) {
      TranslateMessage(&message);
      DispatchMessageW(&message);
    }
    if (WaitForSingleObject(stop_, 0) == WAIT_OBJECT_0) {
      break;
    }
    std::deque<Command> commands;
    {
      const std::lock_guard lock(mutex_);
      commands.swap(commands_);
    }
    for (auto& next : commands) {
      if (auto* scene = std::get_if<DesktopScene>(&next)) {
        painter.load(std::move(*scene));
      } else if (auto* set = std::get_if<wire::Daylight>(&next)) {
        daylight = *set;
      } else if (const auto* scale = std::get_if<Scale>(&next)) {
        painter.set_scale(scale->value);
      } else if (const auto* pause = std::get_if<Pause>(&next)) {
        paused = pause->paused;
        last_paint.reset();
      }
    }
    painter.settle();
    if (open && painter.linking() && !painter.drawing()) {
      // Nothing on the monitor to keep moving meanwhile.
      painter.finish_link();
    }
    const auto heard = heard_.latest();
    if (open && !paused && painter.drawing() && heard) {
      HeardLampFrame frame = *heard;
      const auto now = std::chrono::steady_clock::now();
      frame.delta_ms =
          last_paint ? std::clamp(std::chrono::duration<double, std::milli>(
                                      now - *last_paint)
                                      .count(),
                                  0.0, kLongestFrameMs)
                     : 0.0;
      last_paint = now;
      // Presenting waits for the monitor's refresh: that is the pace.
      if (!painter.paint(std::move(frame), daylight_now(daylight))) {
        // The GPU went from under it, as said; main opens it afresh.
        open = false;
      }
      continue;
    }
    // Nothing to draw: wait for a word from main, the first sound, or the
    // window's own messages.
    const bool waits_for_sound = open && !paused && painter.drawing() && !heard;
    const HANDLE waits[]{stop_, commands_ready_, heard_.first_heard()};
    MsgWaitForMultipleObjects(waits_for_sound ? 3 : 2, waits, FALSE, INFINITE,
                              QS_ALLINPUT);
  }
  painter.close();
  if (window != nullptr) {
    DestroyWindow(window);
  }
  if (SUCCEEDED(com)) {
    CoUninitialize();
  }
}

}  // namespace feq::scene
