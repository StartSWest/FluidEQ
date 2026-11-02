/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <Windows.h>

#include <deque>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <variant>

#include "desktop_messages.h"
#include "desktop_painter.h"
#include "fluideq/scene/lamp_ear.h"
#include "mouth.h"

namespace feq::scene {

/**
 * The music as the ear last heard it, for every monitor to draw with. A
 * monitor draws at its own refresh with whatever was heard last, so each
 * takes the newest frame rather than queueing them.
 */
class HeardNow {
 public:
  HeardNow();
  /** On the ear's thread. */
  void set(const HeardLampFrame& frame);
  std::optional<HeardLampFrame> latest() const;
  /** Set once the first frame has been heard, and never reset. */
  HANDLE first_heard() const { return first_heard_; }
  ~HeardNow();
  HeardNow(const HeardNow&) = delete;
  HeardNow& operator=(const HeardNow&) = delete;

 private:
  mutable std::mutex mutex_;
  std::optional<HeardLampFrame> frame_;
  HANDLE first_heard_;
};

/**
 * One monitor's background on a thread of its own: its window — over the
 * monitor, never shown here; the desktop helper places and shows it behind
 * the icons — and the scene drawn into it on the monitor's own beat, at the
 * pace the listener's choice and the scene allow, while it plays and while
 * Windows has the display on. What happens is said to main through
 * `mouth`, naming the monitor.
 */
class DesktopMonitor {
 public:
  DesktopMonitor(wire::MonitorOpen open, std::wstring angle_dir, Mouth& mouth,
                 const HeardNow& heard);
  /** Stops drawing, lets the window go, and waits for its thread. */
  ~DesktopMonitor();
  DesktopMonitor(const DesktopMonitor&) = delete;
  DesktopMonitor& operator=(const DesktopMonitor&) = delete;

  void show(DesktopScene scene);
  void daylight(const wire::Daylight& daylight);
  void choose(const DrawChoice& choice);
  void pause(bool paused);

 private:
  struct Pause {
    bool paused;
  };
  using Command =
      std::variant<DesktopScene, wire::Daylight, DrawChoice, Pause>;

  void command(Command next);
  void run();

  const wire::MonitorOpen open_;
  const std::wstring angle_dir_;
  Mouth& mouth_;
  const HeardNow& heard_;
  std::mutex mutex_;
  std::deque<Command> commands_;
  HANDLE commands_ready_;
  HANDLE stop_;
  std::thread thread_;
};

}  // namespace feq::scene
