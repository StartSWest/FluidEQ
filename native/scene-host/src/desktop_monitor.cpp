/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "desktop_monitor.h"

#include <objbase.h>

#include <algorithm>
#include <chrono>
#include <cstring>
#include <iterator>
#include <utility>

#include "display_beat.h"
#include "fluideq/scene/frame_pacing.h"
#include "shown_scene.h"

namespace feq::scene {
namespace {

constexpr wchar_t kWindowClass[] = L"FluidEQ-Desktop-Background";

/** A frame's own time is never more than this: a pause is not a jump. */
constexpr double kLongestFrameMs = 100.0;

/** `GUID_CONSOLE_DISPLAY_STATE`: the displays off, on, or dimmed. */
constexpr GUID kConsoleDisplayState{
    0x6fe69556, 0x704a, 0x47a0, {0x8f, 0x24, 0xc2, 0x8d, 0x93, 0x6f, 0xda, 0x47}};

// What Windows said to this thread's window: each monitor's window is made,
// pumped and destroyed on its own thread, so each has its own.
thread_local bool display_on = true;
thread_local bool display_changed = false;

LRESULT CALLBACK background_procedure(HWND window, UINT message, WPARAM w,
                                      LPARAM l) {
  // Nothing to erase: every frame covers the window, and an erase between a
  // move and the next frame is the flash of a background colour.
  if (message == WM_ERASEBKGND) {
    return 1;
  }
  if (message == WM_DISPLAYCHANGE) {
    display_changed = true;
  }
  // Said once when the registration is made, then at every change: a
  // display that is off has no beat, and nobody to draw for.
  if (message == WM_POWERBROADCAST && w == PBT_POWERSETTINGCHANGE) {
    const auto* setting = reinterpret_cast<const POWERBROADCAST_SETTING*>(l);
    if (setting != nullptr && setting->PowerSetting == kConsoleDisplayState &&
        setting->DataLength >= sizeof(DWORD)) {
      DWORD state = 0;
      std::memcpy(&state, setting->Data, sizeof(state));
      display_on = state != 0;
    }
    return TRUE;
  }
  return DefWindowProcW(window, message, w, l);
}

double now_ms() {
  return std::chrono::duration<double, std::milli>(
             std::chrono::steady_clock::now().time_since_epoch())
      .count();
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
void DesktopMonitor::choose(const DrawChoice& choice) { command(choice); }
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
    painter.choose(open_.choice);
  }
  HPOWERNOTIFY display_power =
      window == nullptr
          ? nullptr
          : RegisterPowerSettingNotification(window, &kConsoleDisplayState,
                                             DEVICE_NOTIFY_WINDOW_HANDLE);
  DisplayBeat beat;
  if (window != nullptr) {
    beat.follow(window);
  }

  wire::Daylight daylight;
  bool paused = false;
  std::optional<double> last_paint;
  std::optional<double> last_beat;
  /** The display's frame, measured between beats: sixty until two. */
  double tick_ms = 1000.0 / 60.0;
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
    if (display_changed && window != nullptr) {
      display_changed = false;
      beat.follow(window);
      last_beat.reset();
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
      } else if (const auto* choice = std::get_if<DrawChoice>(&next)) {
        painter.choose(*choice);
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
    if (open && !paused && display_on && painter.drawing() && heard) {
      const double now = now_ms();
      // Drawn on the turns its pace says are due, as the page drew on the
      // animation frames its pace said were (`framePace.ts`).
      if (!last_paint ||
          is_frame_due(now - *last_paint, painter.pace_ms(), tick_ms)) {
        HeardLampFrame frame = *heard;
        frame.delta_ms =
            last_paint ? std::clamp(now - *last_paint, 0.0, kLongestFrameMs)
                       : 0.0;
        last_paint = now;
        if (!painter.paint(std::move(frame), daylight_now(daylight), now)) {
          // The GPU went from under it, as said; main opens it afresh.
          open = false;
        }
      }
      if (beat.wait()) {
        const double at = now_ms();
        tick_ms = display_tick_ms(at, last_beat, tick_ms);
        last_beat = at;
        continue;
      }
    }
    // Nothing to draw, or no beat to draw on: wait for a word from main, the
    // first sound, or the window's own messages — a display coming back on
    // among them.
    last_beat.reset();
    const bool waits_for_sound =
        open && !paused && display_on && painter.drawing() && !heard;
    const HANDLE waits[]{stop_, commands_ready_, heard_.first_heard()};
    MsgWaitForMultipleObjects(waits_for_sound ? 3 : 2, waits, FALSE, INFINITE,
                              QS_ALLINPUT);
  }
  painter.close();
  if (display_power != nullptr) {
    UnregisterPowerSettingNotification(display_power);
  }
  if (window != nullptr) {
    DestroyWindow(window);
  }
  if (SUCCEEDED(com)) {
    CoUninitialize();
  }
}

}  // namespace feq::scene
