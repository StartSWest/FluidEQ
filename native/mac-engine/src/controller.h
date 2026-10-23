/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the engine does about the output it finds and the configuration it
 * reads, decided in one place on one thread.
 *
 * Every wake — a file written, the default output changed, its clock changed,
 * an app starting or stopping to play, sound first coming through — asks the
 * same question from the top: which output is playing, what does the
 * configuration say for it, and does that need the sound to come through
 * here. Only an EQ or a rack with work to do is tapped, and the tap only runs
 * while some app is playing. FluidEQ switched off, or an output nothing
 * names, sends the sound straight to the speakers, with no tap in the way and
 * nothing added to its delay. And after every answer, the app is told what it
 * was (`status_report.h`), whenever that differs from what it was last told.
 */
#ifndef FLUIDEQ_MAC_ENGINE_CONTROLLER_H
#define FLUIDEQ_MAC_ENGINE_CONTROLLER_H

#include <CoreAudio/CoreAudio.h>

#include <cstdint>
#include <functional>
#include <string>
#include <vector>

#include "status_report.h"

namespace fluideq_engine {
class AnalysisLink;
}

namespace fluideq_mac {

class Engine;
class SystemTap;

class Controller {
 public:
  /** `analysis` may be null: no display connection was asked for. */
  Controller(Engine& engine, SystemTap& tap, StatusFiles statuses,
             fluideq_engine::AnalysisLink* analysis,
             std::function<void()> wake);
  ~Controller();
  Controller(const Controller&) = delete;
  Controller& operator=(const Controller&) = delete;

  /** The watch thread, on every wake. */
  void refresh();

  /** The sound goes straight to the output; nothing is left running. */
  void shutdown() noexcept;

 private:
  static OSStatus property_changed(AudioObjectID object, UInt32 count,
                                   const AudioObjectPropertyAddress* addresses,
                                   void* context);
  void listen_to(AudioObjectID device) noexcept;
  /**
   * Whether any app but this engine is playing, listening from here on to
   * every app Core Audio knows for the moment that changes.
   */
  bool others_playing();
  void stop_tap(const std::string& why) noexcept;
  /** The followed output's status, written when it says something new. */
  void report(bool locked, const std::string& reason) noexcept;
  /** The followed output is no longer this engine's: it says so, once. */
  void let_go(const std::string& reason) noexcept;
  void write(const fluideq_engine::EngineStatus& status) noexcept;

  Engine& engine_;
  SystemTap& tap_;
  StatusFiles statuses_;
  fluideq_engine::AnalysisLink* analysis_;
  /** Raised from Core Audio's own notification thread; only wakes. */
  std::function<void()> wake_;
  bool listening_default_ = false;
  bool listening_processes_ = false;
  AudioObjectID listened_device_ = kAudioObjectUnknown;
  /** The apps whose starting and stopping to play wakes this controller. */
  std::vector<AudioObjectID> listened_processes_;
  /** The output's clock when the tap started: a change restarts the tap. */
  uint32_t tap_device_rate_ = 0;
  /** The clock the running tap actually delivers, which graphs are built at. */
  uint32_t graph_rate_ = 0;
  /**
   * The output being followed, as `{GUID}` (`endpoint_guid`): the name the
   * app gives it in `Device:` lines, statuses and the display connection.
   * Empty while there is none.
   */
  std::string endpoint_;
  /** Its clock, for the status. */
  uint32_t rate_ = 0;
  bool reload_failed_ = false;
  /** The last status written, without its time, so a repeat is not written. */
  std::string written_;
  bool status_failure_said_ = false;
};

}  // namespace fluideq_mac

#endif  // FLUIDEQ_MAC_ENGINE_CONTROLLER_H
