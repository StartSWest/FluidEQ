/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "controller.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <exception>
#include <optional>
#include <utility>

#include "audio_permission.h"
#include "engine.h"
#include "mac_analysis_link.h"
#include "output_devices.h"
#include "posix_path.h"
#include "system_tap.h"

namespace fluideq_mac {

namespace {

/**
 * The largest block a graph processes in one call; a longer I/O cycle is cut
 * into pieces this size. Fixed rather than taken from the device, because a
 * graph hands its filter histories to the next only when both were built
 * with the same block — a device that changed its buffer would otherwise
 * restart every filter from silence, which is heard as a click.
 */
constexpr uint32_t kBlockFrames = 1024;

AudioObjectPropertyAddress global_address(AudioObjectPropertySelector what) {
  AudioObjectPropertyAddress out{};
  out.mSelector = what;
  out.mScope = kAudioObjectPropertyScopeGlobal;
  out.mElement = kAudioObjectPropertyElementMain;
  return out;
}

/** One line to the app's log, which reads this process's stderr. */
void say(const std::string& line) {
  std::fprintf(stderr, "FluidEQ-Engine: %s\n", line.c_str());
  std::fflush(stderr);
}

uint32_t rounded_rate(double rate) {
  return rate > 0.0 ? static_cast<uint32_t>(std::lround(rate)) : 0u;
}

}  // namespace

Controller::Controller(Engine& engine, SystemTap& tap, StatusFiles statuses,
                       fluideq_engine::AnalysisLink* analysis,
                       std::function<void()> wake)
    : engine_(engine),
      tap_(tap),
      statuses_(std::move(statuses)),
      analysis_(analysis),
      wake_(std::move(wake)) {
  AudioObjectPropertyAddress where =
      global_address(kAudioHardwarePropertyDefaultOutputDevice);
  listening_default_ =
      AudioObjectAddPropertyListener(kAudioObjectSystemObject, &where,
                                     &Controller::property_changed,
                                     this) == noErr;
  // An app opening or closing is when one may start or stop playing.
  AudioObjectPropertyAddress processes =
      global_address(kAudioHardwarePropertyProcessObjectList);
  listening_processes_ =
      AudioObjectAddPropertyListener(kAudioObjectSystemObject, &processes,
                                     &Controller::property_changed,
                                     this) == noErr;
}

Controller::~Controller() {
  shutdown();
  listen_to(kAudioObjectUnknown);
  if (listening_default_) {
    AudioObjectPropertyAddress where =
        global_address(kAudioHardwarePropertyDefaultOutputDevice);
    AudioObjectRemovePropertyListener(kAudioObjectSystemObject, &where,
                                      &Controller::property_changed, this);
    listening_default_ = false;
  }
  if (listening_processes_) {
    AudioObjectPropertyAddress processes =
        global_address(kAudioHardwarePropertyProcessObjectList);
    AudioObjectRemovePropertyListener(kAudioObjectSystemObject, &processes,
                                      &Controller::property_changed, this);
    listening_processes_ = false;
  }
  AudioObjectPropertyAddress running =
      global_address(kAudioProcessPropertyIsRunningOutput);
  for (const AudioObjectID process : listened_processes_) {
    AudioObjectRemovePropertyListener(process, &running,
                                      &Controller::property_changed, this);
  }
  listened_processes_.clear();
}

OSStatus Controller::property_changed(
    AudioObjectID object, UInt32 count,
    const AudioObjectPropertyAddress* addresses, void* context) {
  (void)object;
  (void)count;
  (void)addresses;
  // Core Audio's own thread, where nothing heavy may run: this only wakes
  // the watch thread, which asks the whole question again from the top.
  static_cast<Controller*>(context)->wake_();
  return noErr;
}

void Controller::listen_to(AudioObjectID device) noexcept {
  if (device == listened_device_) {
    return;
  }
  AudioObjectPropertyAddress rate =
      global_address(kAudioDevicePropertyNominalSampleRate);
  if (listened_device_ != kAudioObjectUnknown) {
    AudioObjectRemovePropertyListener(listened_device_, &rate,
                                      &Controller::property_changed, this);
  }
  listened_device_ = device;
  if (device != kAudioObjectUnknown) {
    AudioObjectAddPropertyListener(device, &rate,
                                   &Controller::property_changed, this);
  }
}

bool Controller::others_playing() {
  const AudioObjectID self = own_process_object();
  const std::vector<AudioObjectID> processes = process_objects();
  AudioObjectPropertyAddress running =
      global_address(kAudioProcessPropertyIsRunningOutput);
  // Listened to from the moment each appears and let go when it is gone, so
  // an app starting to play wakes the engine rather than the engine looking.
  for (const AudioObjectID process : processes) {
    if (process != self &&
        std::find(listened_processes_.begin(), listened_processes_.end(),
                  process) == listened_processes_.end() &&
        AudioObjectAddPropertyListener(process, &running,
                                       &Controller::property_changed,
                                       this) == noErr) {
      listened_processes_.push_back(process);
    }
  }
  listened_processes_.erase(
      std::remove_if(listened_processes_.begin(), listened_processes_.end(),
                     [&](AudioObjectID process) {
                       const bool gone =
                           std::find(processes.begin(), processes.end(),
                                     process) == processes.end();
                       if (gone) {
                         AudioObjectRemovePropertyListener(
                             process, &running, &Controller::property_changed,
                             this);
                       }
                       return gone;
                     }),
      listened_processes_.end());
  // This engine's own output is not an app playing: counting it would keep
  // the device running forever once it had started.
  return std::any_of(processes.begin(), processes.end(),
                     [self](AudioObjectID process) {
                       return process != self && is_running_output(process);
                     });
}

void Controller::stop_tap(const std::string& why) noexcept {
  if (!tap_.running()) {
    return;
  }
  // Stopped before the graphs are freed: `stop` returns only once the I/O
  // thread has left the engine for good.
  tap_.stop();
  if (analysis_ != nullptr) {
    analysis_->quiet();
  }
  engine_.release_all();
  tap_device_rate_ = 0;
  graph_rate_ = 0;
  say(why);
}

void Controller::refresh() {
  const AudioObjectID device = default_output_device();
  listen_to(device);
  if (device == kAudioObjectUnknown) {
    stop_tap("no output device: nothing to play to");
    let_go("no output device");
    return;
  }
  const uint32_t device_rate = rounded_rate(nominal_sample_rate(device));
  if (device_rate == 0) {
    stop_tap("the output would not say its sample rate");
    let_go("the output would not say its sample rate");
    return;
  }
  if (tap_.running() &&
      (tap_.output() != device || tap_device_rate_ != device_rate)) {
    stop_tap("the output changed; following it");
  }

  const std::string uid = device_uid(device);
  const std::string name = device_name(device);
  const std::string guid = endpoint_guid(uid);
  if (guid != endpoint_) {
    let_go("the sound goes to another output now");
    endpoint_ = guid;
  }
  const fluideq_engine::Endpoint endpoint{fluideq_engine::wide_path(guid),
                                          fluideq_engine::wide_path(name)};
  const uint32_t rate = tap_.running() ? graph_rate_ : device_rate;
  rate_ = rate;

  ReloadResult result;
  try {
    result = engine_.reload(endpoint, EngineFormat{rate, kBlockFrames});
    reload_failed_ = false;
  } catch (const std::exception& error) {
    say(std::string("the configuration could not be applied: ") +
        error.what());
    reload_failed_ = true;
    report(tap_.running(), "configuration reload failed");
    return;
  } catch (...) {
    say("the configuration could not be applied");
    reload_failed_ = true;
    report(tap_.running(), "configuration reload failed");
    return;
  }
  if (result.rebuilt) {
    say(name + " (" + uid + ") at " + std::to_string(rate) + " Hz: " +
        (result.processing ? "work to do" : "nothing to run") +
        (result.matched ? "" : ", and no profile names this output"));
    if (!result.room_note.empty()) {
      say(result.room_note);
    }
    for (const std::string& warning : result.warnings) {
      say("warning: " + warning);
    }
    for (const std::string& problem : result.problems) {
      say("not running: " + problem);
    }
  }

  if (!result.processing) {
    stop_tap("nothing to process: the sound goes straight to " + name);
    // The Windows effect's own sentences, so a bug report reads the same
    // from either machine.
    report(false, result.matched
                      ? "the configuration asks for nothing on this endpoint"
                      : "no configuration block names this endpoint");
    return;
  }
  // Never a tap macOS will not let this process hear. A muted-when-tapped tap
  // silences the originals for as long as it is read, so one that hears
  // nothing would leave the Mac silent, not merely unequalised. Asked on
  // every wake, so allowing it in System Settings takes effect at the next
  // one: an app starting to play, an EQ change, the output changing.
  if (audio_permission() == AudioPermission::denied) {
    stop_tap("macOS has not allowed FluidEQ to hear the Mac's sound");
    report(false, "macOS has not allowed FluidEQ to hear the Mac's sound");
    return;
  }
  if (!tap_.running()) {
    std::string error;
    if (!tap_.start(device, error)) {
      // Freed so the next wake builds again and tries again: nothing here
      // waits on a clock to retry, and the next change to the EQ is a wake.
      engine_.release_all();
      say("could not take the system's sound: " + error);
      report(false, "could not take the system's sound: " + error);
      return;
    }
    tap_device_rate_ = device_rate;
    graph_rate_ = device_rate;
    const uint32_t running_rate = rounded_rate(tap_.sample_rate());
    if (running_rate != 0 && running_rate != device_rate) {
      // The engine's device runs on another clock than its output reported,
      // and the graph is rebuilt for the clock actually in use — before any
      // audio runs, since the device is made paused.
      graph_rate_ = running_rate;
      rate_ = running_rate;
      try {
        engine_.reload(endpoint, EngineFormat{running_rate, kBlockFrames});
      } catch (...) {
        say("the configuration could not be rebuilt for the device's clock");
      }
    }
    // While no audio thread reads the meters: which output the frames are
    // about, at the clock the graph runs on.
    if (analysis_ != nullptr) {
      analysis_->follow(guid, graph_rate_);
    }
  }

  // The device runs only while some app plays. Stopped, it keeps nothing
  // awake and costs nothing, and the originals play untouched — there are
  // none to hear. The notice that an app started playing is the wake that
  // resumes it.
  if (others_playing()) {
    if (!tap_.playing()) {
      std::string error;
      if (!tap_.resume(error)) {
        say("could not take the system's sound: " + error);
        report(false, "could not take the system's sound: " + error);
        return;
      }
      say("processing every app's sound on " + name + " at " +
          std::to_string(graph_rate_) + " Hz");
    }
  } else if (tap_.playing()) {
    tap_.pause();
    if (analysis_ != nullptr) {
      analysis_->quiet();
    }
    say("nothing is playing: resting until something does");
  }
  report(true, std::string());
}

void Controller::report(bool locked, const std::string& reason) noexcept {
  if (endpoint_.empty()) {
    return;
  }
  try {
    const GraphFacts& facts = engine_.facts();
    fluideq_engine::EngineStatus status;
    status.endpoint = fluideq_engine::wide_path(endpoint_);
    status.locked = locked;
    status.processing = locked && facts.processing;
    status.carried = locked && tap_.carried();
    // This process is FluidEQ's own child and ends with it, so while there
    // is a status to write at all, FluidEQ is there to read it.
    status.owner = true;
    status.reason = status.processing ? std::string() : reason;
    status.problems = facts.problems;
    if (reload_failed_) {
      status.problems.push_back("reload-failed");
    }
    status.channels = kEngineChannels;
    status.room = facts.room;
    status.rate = rate_;
    if (status.processing) {
      status.latency = facts.latency;
      status.latency_parts = facts.latency_parts;
      status.latency_active = facts.latency_active;
      status.game_mode = facts.game_mode;
    }
    if (const std::optional<fluideq_engine::SongReport> song =
            engine_.last_song()) {
      char id[17] = {};
      std::snprintf(id, sizeof(id), "%016llx",
                    static_cast<unsigned long long>(song->song_id));
      status.last_song = fluideq_engine::EngineStatus::FinishedSong{
          id, song->level_lufs, song->peak_db, song->seconds};
    }
    write(status);
  } catch (...) {
    // A status the app never sees costs its notice, not the audio.
  }
}

void Controller::let_go(const std::string& reason) noexcept {
  if (endpoint_.empty()) {
    return;
  }
  try {
    fluideq_engine::EngineStatus status;
    status.endpoint = fluideq_engine::wide_path(endpoint_);
    status.locked = false;
    status.processing = false;
    status.owner = true;
    status.reason = reason;
    write(status);
  } catch (...) {
    // As above: the app misses a notice, the sound misses nothing.
  }
  endpoint_.clear();
  written_.clear();
}

void Controller::write(const fluideq_engine::EngineStatus& status) noexcept {
  try {
    // Only when it says something new: every wake of the directory reaches
    // here, and most of them change nothing the app would show.
    const std::string text = fluideq_engine::status_json(status, 0, "");
    if (text == written_) {
      return;
    }
    std::string why;
    if (statuses_.write(status, why)) {
      written_ = text;
      status_failure_said_ = false;
    } else if (!status_failure_said_) {
      // Once per run of failures; a later success re-arms it.
      status_failure_said_ = true;
      say("could not write this output's status for the app (" + why + ")");
    }
  } catch (...) {
    // Nothing a status can do is worth the sound.
  }
}

void Controller::shutdown() noexcept {
  stop_tap("stopped: the sound goes straight to the output");
  let_go("the engine stopped");
}

}  // namespace fluideq_mac
