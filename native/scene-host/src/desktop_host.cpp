/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "desktop_host.h"

#include <objbase.h>

#include <array>
#include <cstdio>
#include <map>
#include <memory>
#include <mutex>
#include <thread>
#include <vector>

#include "artwork_decode.h"
#include "desktop_messages.h"
#include "desktop_monitor.h"
#include "fluideq/scene/lamp_atmosphere.h"
#include "mouth.h"
#include "output_ear.h"
#include "shown_scene.h"

namespace feq::scene {
namespace {

constexpr int kStopped = 0;
constexpr int kBrokenWire = 4;
/** The app's accent before main says otherwise (`--accent` default). */
constexpr std::array<double, 3> kDefaultAccent{0.0, 229.0 / 255.0,
                                               207.0 / 255.0};

/** Everything the threads share. */
struct Desktop {
  explicit Desktop(std::wstring angle) : angle_dir(std::move(angle)) {}

  const std::wstring angle_dir;
  Mouth mouth;
  HeardNow heard;
  std::mutex mutex;
  LampProfile profile;
  std::array<double, 3> accent = kDefaultAccent;
  bool ear_changed = true;
  /** Main's monitors; touched by the reader alone. */
  std::map<std::uint32_t, std::unique_ptr<DesktopMonitor>> monitors;
  /** Manual-reset: the ear stops, and the program with it. */
  HANDLE stop = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  int stopped_with = kStopped;

  ~Desktop() { CloseHandle(stop); }
  void end(int code) {
    {
      const std::lock_guard lock(mutex);
      if (WaitForSingleObject(stop, 0) != WAIT_OBJECT_0) {
        stopped_with = code;
      }
    }
    SetEvent(stop);
  }
};

void say(const char* what) { std::fprintf(stderr, "FluidEQ-Scenes: %s\n", what); }

DesktopMonitor* monitor_of(Desktop& desktop, std::uint32_t monitor) {
  const auto found = desktop.monitors.find(monitor);
  return found == desktop.monitors.end() ? nullptr : found->second.get();
}

/** One message from main, acted on; false when it is not one. */
bool hear(Desktop& desktop, wire::Kind kind, std::span<const std::uint8_t> payload) {
  if (kind == wire::Kind::kMonitorOpen) {
    wire::MonitorOpen open;
    if (!wire::read_monitor_open(payload, open)) {
      return false;
    }
    // A monitor opened again is a new window: the old one goes first.
    desktop.monitors.erase(open.monitor);
    desktop.monitors.emplace(
        open.monitor, std::make_unique<DesktopMonitor>(
                          open, desktop.angle_dir, desktop.mouth, desktop.heard));
    return true;
  }
  if (kind == wire::Kind::kAccent) {
    std::array<double, 3> accent{};
    if (!wire::read_accent(payload, accent)) {
      return false;
    }
    const std::lock_guard lock(desktop.mutex);
    desktop.accent = accent;
    desktop.ear_changed = true;
    return true;
  }
  if (kind == wire::Kind::kProfile) {
    LampProfile profile;
    if (!wire::read_profile(payload, profile)) {
      return false;
    }
    const std::lock_guard lock(desktop.mutex);
    desktop.profile = profile;
    desktop.ear_changed = true;
    return true;
  }
  wire::ForMonitor addressed;
  if (!wire::read_monitor(payload, addressed)) {
    return false;
  }
  DesktopMonitor* const monitor = monitor_of(desktop, addressed.monitor);
  switch (kind) {
    case wire::Kind::kMonitorShow: {
      bool measured = false;
      wire::Show show;
      if (!wire::read_monitor_show(addressed.rest, measured, show)) {
        return false;
      }
      std::vector<std::uint8_t> artwork;
      std::string why;
      if (!show.scene->webp.empty() &&
          !decode_artwork(show.scene->webp, show.scene->artwork_width,
                          show.scene->artwork_height, artwork, why)) {
        desktop.mouth.say(wire::monitor_failed_message(addressed.monitor, show.id,
                                                       wire::FailReason::kArtwork,
                                                       why),
                          false);
        return true;
      }
      if (monitor != nullptr) {
        DesktopScene scene = scene_of<DesktopScene>(
            show.id, std::move(*show.scene), std::move(artwork));
        scene.measured = measured;
        monitor->show(std::move(scene));
      }
      return true;
    }
    case wire::Kind::kMonitorDaylight: {
      wire::Daylight daylight;
      if (!wire::read_daylight(addressed.rest, daylight)) {
        return false;
      }
      if (monitor != nullptr) {
        monitor->daylight(daylight);
      }
      return true;
    }
    case wire::Kind::kMonitorChoice: {
      DrawChoice choice;
      if (!wire::read_choice(addressed.rest, choice)) {
        return false;
      }
      if (monitor != nullptr) {
        monitor->choose(choice);
      }
      return true;
    }
    case wire::Kind::kMonitorPause: {
      bool paused = false;
      if (!wire::read_flag(addressed.rest, paused)) {
        return false;
      }
      if (monitor != nullptr) {
        monitor->pause(paused);
      }
      return true;
    }
    case wire::Kind::kMonitorClose:
      if (!addressed.rest.empty()) {
        return false;
      }
      desktop.monitors.erase(addressed.monitor);
      return true;
    default:
      return false;
  }
}

/** stdin, until it closes or stops making sense; then every monitor goes. */
void read_main(Desktop& desktop) {
  // WIC decodes the artwork on this thread.
  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  const HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  wire::Framer framer;
  std::vector<std::uint8_t> chunk(64 * 1024);
  int code = kStopped;
  for (bool reading = true; reading;) {
    DWORD read = 0;
    if (ReadFile(input, chunk.data(), static_cast<DWORD>(chunk.size()), &read,
                 nullptr) == FALSE ||
        read == 0) {
      break;
    }
    framer.feed(std::span<const std::uint8_t>(chunk.data(), read));
    bool broken = false;
    while (auto message = framer.next(broken)) {
      if (!hear(desktop, message->first, message->second)) {
        broken = true;
        break;
      }
    }
    if (broken) {
      say("main sent something that is not a message");
      code = kBrokenWire;
      reading = false;
    }
  }
  desktop.monitors.clear();
  if (SUCCEEDED(com)) {
    CoUninitialize();
  }
  desktop.end(code);
}

}  // namespace

int run_desktop(const std::wstring& angle_dir, HANDLE parent) {
  // Each monitor in its own physical pixels: the windows are made over
  // them, and the desktop helper places them by them.
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  // Shared with the stdin reader, which is never joined: a blocked pipe read
  // is let go of only by the process ending under it.
  const auto desktop = std::make_shared<Desktop>(angle_dir);
  std::thread([desktop] { read_main(*desktop); }).detach();
  const int heard_until = hear_default_output(
      desktop->stop, parent, kDefaultAccent,
      EarHooks{[&desktop = *desktop](LampEar& ear) {
                 const std::lock_guard lock(desktop.mutex);
                 if (!desktop.ear_changed) {
                   return;
                 }
                 desktop.ear_changed = false;
                 ear.set_profile(desktop.profile);
                 ear.set_accent(desktop.accent);
               },
               [&desktop = *desktop](const HeardLampFrame& frame) {
                 desktop.heard.set(frame);
               }});
  desktop->end(heard_until);
  const std::lock_guard lock(desktop->mutex);
  return desktop->stopped_with;
}

}  // namespace feq::scene
