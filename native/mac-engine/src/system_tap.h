/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every other process's sound, through the engine, to the output.
 *
 * A Core Audio process tap (macOS 14.2 and later) takes a stereo mixdown of
 * what every process plays — every process but this one, or the engine would
 * hear itself and feed back — and, muted-when-tapped, silences the originals
 * for as long as somebody is reading the tap. A private aggregate device puts
 * that tap in as input and the real output as output, so one I/O cycle reads
 * the sound, runs the graph, and plays the result.
 *
 * Both objects belong to this process: if it exits, however it exits, macOS
 * removes them and the sound goes straight to the speakers again. That is the
 * property that makes it safe to run: the worst this engine can do is stop.
 * And muted-when-tapped means muted while read: with the device paused, the
 * originals play as they are, which is what lets the device rest whenever
 * nothing is playing.
 *
 * Hearing the tap needs macOS's "Screen & System Audio Recording" permission,
 * and macOS asks it of the app responsible for this process, not of this
 * process: FluidEQ once installed, and in development whatever started
 * `pnpm dev`. Seen in the system log on 2026-09-21: coreaudiod checked
 * `kTCCServiceScreenCapture` for the engine, attributed it to Terminal, and
 * was allowed. What a refused tap does has not been observed yet; `carried`
 * is what would show it, and the controller taps only while there is work to
 * do. Quitting FluidEQ always gives the sound back.
 */
#ifndef FLUIDEQ_MAC_ENGINE_SYSTEM_TAP_H
#define FLUIDEQ_MAC_ENGINE_SYSTEM_TAP_H

#include <CoreAudio/CoreAudio.h>

#include <atomic>
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace fluideq_mac {

class Engine;

class SystemTap {
 public:
  /**
   * `first_sound` runs on the I/O thread, once per `start`, when sound — not
   * merely a block — first comes through the tap. It may only wake somebody.
   */
  SystemTap(Engine& engine, std::function<void()> first_sound);
  ~SystemTap();
  SystemTap(const SystemTap&) = delete;
  SystemTap& operator=(const SystemTap&) = delete;

  /**
   * Control thread. The tap and the engine's device for `output`, made and
   * ready, with no audio running yet: `resume` starts it.
   */
  bool start(AudioObjectID output, std::string& error);

  /**
   * Control thread. Everything else's sound, processed, to the output — or
   * back to the output untouched, from `pause`, which returns once the I/O
   * thread has left the engine. Paused while nothing plays: a running device
   * keeps the Mac from sleeping and spends the rack's work on silence.
   */
  bool resume(std::string& error);
  void pause() noexcept;
  bool playing() const noexcept { return playing_; }

  /**
   * Control thread. The sound goes straight to the output again. Returns
   * once the I/O thread has left the engine for good, so the caller may
   * free what it was running.
   */
  void stop() noexcept;

  bool running() const noexcept { return aggregate_ != kAudioObjectUnknown; }
  AudioObjectID output() const noexcept { return output_; }
  /** The aggregate device's clock, in Hz, once started. */
  double sample_rate() const noexcept;

  /**
   * Sound has come through the tap since it started: a sample above -90 dBFS
   * (`EngineStatus::carried`). A tap macOS has not allowed to hear anything
   * delivers silence — the Windows effect's threshold, where an idle stream
   * measured about -180 dBFS — so this is what tells a working engine from
   * one reading nothing.
   */
  bool carried() const noexcept {
    return carried_.load(std::memory_order_relaxed);
  }

 private:
  static OSStatus io_proc(AudioObjectID device, const AudioTimeStamp* now,
                          const AudioBufferList* input,
                          const AudioTimeStamp* input_time,
                          AudioBufferList* output,
                          const AudioTimeStamp* output_time, void* context);

  /** The I/O thread. No allocation, lock, system call or throw. */
  void render(const AudioBufferList* input, AudioBufferList* output) noexcept;

  Engine& engine_;
  std::function<void()> first_sound_;
  std::atomic<bool> carried_{false};
  AudioObjectID tap_ = kAudioObjectUnknown;
  AudioObjectID aggregate_ = kAudioObjectUnknown;
  AudioDeviceIOProcID proc_ = nullptr;
  bool playing_ = false;
  AudioObjectID output_ = kAudioObjectUnknown;
  /** Planar scratch, sized at start to the largest buffer the device uses. */
  std::vector<float> left_;
  std::vector<float> right_;
  uint32_t capacity_ = 0;
};

}  // namespace fluideq_mac

#endif  // FLUIDEQ_MAC_ENGINE_SYSTEM_TAP_H
