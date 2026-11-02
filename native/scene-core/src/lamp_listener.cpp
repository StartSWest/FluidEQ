/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/scene/lamp_listener.h"

#include <algorithm>

#include "fluideq/scene/frame_pacing.h"

namespace feq::scene {
namespace {

/** `LIGHTING_TICKS_PER_SECOND`. */
constexpr double kTicksPerSecond = 30.0;
/** The graph's own smoothing, and the lamps' (`useLiveOutputSpectrum`). */
constexpr double kSmoothing = 0.2;
/** `SCENE_TIME_WRAP_S`. */
constexpr double kTimeWrapS = 3600.0;
constexpr double kFadeHalfLifeMs = 80.0;

/** `holdEnergy`: what was last heard, its rhythm no longer running. */
SpectrumEnergy hold(SpectrumEnergy reading) {
  reading.rhythm.running = false;
  return reading;
}

}  // namespace

LampListener::LampListener(double rate, const std::array<double, 3>& accent)
    : rate_(rate),
      hop_samples_(rate * kHopMs / 1000.0),
      tick_frames_(static_cast<std::size_t>(js_round(rate / kTicksPerSecond))),
      analyser_(kFftSize, kFftSize),
      hops_(rate),
      axis_(frequency_axis(rate)),
      cells_(axis_cells(axis_, rate, kFftSize)),
      next_tick_(static_cast<std::size_t>(js_round(rate / kTicksPerSecond))) {
  frame_.scene.accent = accent;
}

void LampListener::wait_hop(const SoundHop& hop) {
  if (waiting_count_ == kWaitingHops) {
    // The window's clock is never a hop behind the samples; a queue this
    // long is a clock gone wrong, and its oldest hop is let go.
    waiting_head_ = (waiting_head_ + 1) % kWaitingHops;
    waiting_count_ -= 1;
  }
  waiting_[(waiting_head_ + waiting_count_) % kWaitingHops] = hop;
  waiting_count_ += 1;
}

void LampListener::count_hops(double at_ms) {
  if (!clock_at_ms_.has_value()) {
    // `update`'s first read: no samples are known to be new yet.
    clock_at_ms_ = at_ms;
    clock_pending_ = 0.0;
    waiting_count_ = 0;
    return;
  }
  clock_pending_ += ((at_ms - *clock_at_ms_) * rate_) / 1000.0;
  clock_at_ms_ = at_ms;
  while (clock_pending_ >= hop_samples_ && waiting_count_ > 0) {
    clock_pending_ -= hop_samples_;
    keep_hop(waiting_[waiting_head_]);
    waiting_head_ = (waiting_head_ + 1) % kWaitingHops;
    waiting_count_ -= 1;
  }
}

void LampListener::keep_hop(const SoundHop& hop) {
  last_seq_ += 1;
  ring_[static_cast<std::size_t>(last_seq_ % kHopRing)] = hop;
}

SpectrumEnergy LampListener::hear_music() {
  if (!cursor_set_) {
    cursor_set_ = true;
    cursor_seq_ = std::max<std::int64_t>(-1, last_seq_ - 1);
  }
  double lost_ms = 0.0;
  const std::int64_t oldest = std::max<std::int64_t>(0, last_seq_ - kHopRing + 1);
  if (cursor_seq_ + 1 < oldest) {
    lost_ms = static_cast<double>(oldest - cursor_seq_ - 1) * kHopMs;
    cursor_seq_ = oldest - 1;
  }
  for (std::int64_t at = cursor_seq_ + 1; at <= last_seq_; ++at) {
    hear_hop(*energy_, ring_[static_cast<std::size_t>(at % kHopRing)],
             at == cursor_seq_ + 1 ? lost_ms : 0.0);
  }
  cursor_seq_ = std::max(cursor_seq_, last_seq_);
  return read_energy(*energy_);
}

void LampListener::make_frame() {
  SceneFrame& scene = frame_.scene;
  const double delta_ms =
      (static_cast<double>(heard_frames_ - framed_at_) / rate_) * 1000.0;
  framed_at_ = heard_frames_;
  points_.clear();
  std::optional<double> peak;
  if (!paused_) {
    analyser_.read_frequency(frequency_data_, kSmoothing);
    absolute_levels(frequency_data_, cells_, levels_);
    peak = peak_level(frequency_data_);
    if (peak.has_value()) {
      // The pump's follower, scaled from its tick to this frame.
      const double release =
          (kTrackReferenceReleaseDb * delta_ms) / kUpdateIntervalMs;
      reference_ = reference_.has_value()
                       ? std::max(*peak, *reference_ - release)
                       : *peak;
      frequency_points(levels_, *reference_, points_);
    }
    analyser_.read_mono(samples_);
    waveform_points({&samples_}, waveform_points_);
  } else {
    std::fill(waveform_points_.begin(), waveform_points_.end(), 0.0);
  }
  // Paused, the lamps hold what they last showed, as the picture does.
  const SpectrumEnergy heard =
      paused_ && last_.has_value() ? hold(*last_) : hear_music();
  last_ = heard;
  spectrum_texels(points_, scene.spectrum);
  waveform_texels(waveform_points_, scene.waveform);
  scene.time_seconds = js_mod(scene.time_seconds + delta_ms / 1000.0, kTimeWrapS);
  scene.fade += (1.0 - scene.fade) * ease_factor(delta_ms, kFadeHalfLifeMs);
  scene.level = heard.level;
  scene.beat = heard.beat;
  scene.bands = {heard.bass, heard.mid, heard.treble};
  scene.music_accent = {heard.accent, heard.accent_serial};
  scene.music_run = {heard.run, heard.run_speed};
  const SceneRhythm& rhythm = heard.rhythm;
  scene.rhythm = {rhythm.beat_phase, rhythm.bar_phase, rhythm.tempo,
                  rhythm.confidence};
  scene.drums = {rhythm.kick, rhythm.snare, rhythm.hat};
  scene.song = {rhythm.intensity, rhythm.build, rhythm.drop, rhythm.drop_serial};
  scene.voice = {heard.voice.open, heard.voice.pitch, heard.voice.sure};
  frame_.delta_ms = delta_ms;
  frame_.silent = !peak.has_value();
  frame_.quiet = frame_.silent || is_silent_waveform(waveform_points_);
}

}  // namespace feq::scene
