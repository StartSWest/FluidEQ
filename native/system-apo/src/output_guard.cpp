#include "output_guard.h"
#include <algorithm>
#include <cmath>
#include <limits>

namespace fluideq_engine {
namespace {
/**
 * How the level comes back up once the music leaves room: after 5 s with the
 * loudest peak at least a decibel under what the level allows, at 0.15 dB/s.
 *
 * Measured on five of Ivan's songs (rock, pop, EDM, a ballad, smooth jazz)
 * through his BlackShark curve, starting from the curve's level, against the
 * normalizer that started at 0 dB: loudness within 0.9 dB on every song, and
 * the limiter's worst second 15 dB cleaner on the rock master and 11 dB on
 * the jazz. Faster costs cleanliness — at 0.3 dB/s after 3 s the level
 * climbs into the limiter over and over, and the jazz came out 10 dB dirtier
 * than before — and slower costs the loudness this normalizer is for: the
 * old 0.1 dB/s left the jazz 2.9 dB quieter.
 */
constexpr double kRecoverAfterSeconds = 5.0;
constexpr double kRecoverDbPerSecond = 0.15;

/**
 * How long an edit's level takes to arrive (`move_target`): the bands' own
 * crossfade (`IirCascade::kFadeSeconds`), so the level and the EQ it is for
 * move together.
 */
constexpr double kEditGlideSeconds = 0.02;

constexpr double kPi = 3.14159265358979323846;
}  // namespace

OutputGuard::OutputGuard(uint32_t rate, uint32_t channels)
    : rate_(rate), latency_(feq_post_filter_normalizer_look_ahead(rate)),
      window_frames_(std::max(1u, rate / 10)),
      detectors_(channels), delay_(channels), planes_(channels),
      reductions_(latency_ + 1, 0.0f),
      processing_planes_(channels) {
  for (uint32_t channel = 0; channel < channels; ++channel) {
    delay_[channel].resize(latency_ + 1, 0.0f);
    planes_[channel] = delay_[channel].data();
  }
  feq_post_filter_normalizer_init(&state_, detectors_.data(), planes_.data(),
      reductions_.data(), channels, latency_ + 1, 4);
  feq_linked_limiter_set_look_ahead(&state_.limiter, latency_);
}
void OutputGuard::process(float* const* planar, uint32_t frames, bool enabled) noexcept {
  FeqLimiterOptions options{};
  options.ceiling = enabled ? std::pow(10.0, -1.0 / 20.0)
                           : std::numeric_limits<double>::infinity();
  options.activation_threshold = options.ceiling;
  options.release_coefficient = std::exp(-1.0 / (rate_ * (enabled ? 0.15 : 1.0)));
  options.limiting_release_coefficient = options.release_coefficient;
  options.release_hold_samples = enabled ? rate_ * 0.05 : 0;
  options.sample_rate = rate_;
  if (!enabled) {
    target_db_ = 0;
    quiet_seconds_ = 0;
    overload_age_ = 10;
    reassess_frames_ = 0;
    edit_recovery_ = false;
    state_.limiter.release_hold_remaining = 0;
    armed_ = true;
    // Off, nothing is held and nothing glides: the next enabled block starts
    // over from the curve's level.
    holding_ = false;
    glide_left_ = 0;
  } else if (armed_) {
    // The limiter meets this as a drop and back-fills it across its
    // look-ahead, so the first sample out is already at the curve's level.
    target_db_ = curve_level_db_;
    glide_left_ = 0;
    armed_ = false;
  }
  last_input_peak_ = 0;
  for (uint32_t offset = 0; offset < frames;) {
    uint32_t count = std::min(frames - offset, window_frames_ - measured_frames_);
    // While an edit's level glides, the limiter is handed it a sample at a
    // time. It takes any drop in its ceiling at the slope of its deepest
    // reduction over the look-ahead, so a millisecond's step still arrived
    // as a small click of its own: -72 dBFS above 5 kHz over a 6 dB glide
    // in a millisecond's steps, and none of that one sample at a time.
    if (glide_left_ > 0) {
      count = 1;
    }
    for (uint32_t channel = 0; channel < delay_.size(); ++channel) {
      processing_planes_[channel] = planar[channel] + offset;
    }
    options.maximum_gain = std::pow(10.0, applied_db() / 20.0);
    feq_linked_limiter_process(&state_.limiter, processing_planes_.data(), count, &options);
    glide_left_ -= std::min(glide_left_, count);
    window_peak_ = std::max(window_peak_, state_.limiter.block_peak);
    last_input_peak_ = std::max(last_input_peak_, state_.limiter.block_peak);
    offset += count;
    measured_frames_ += count;
    if (measured_frames_ == window_frames_) {
      const double peak_db = 20.0 * std::log10(std::max(1e-12, window_peak_));
      const double required = std::min(0.0, -1.0 - peak_db);
      overload_age_ = std::min(10u, overload_age_ + 1);
      if (settling_frames_ > 0) {
        settling_frames_ -= std::min(settling_frames_, window_frames_);
      } else if (enabled && reassess_frames_ > 0 && peak_db > -65.0) {
        reassess_peak_ = std::max(reassess_peak_, window_peak_);
        edit_goal_db_ = std::min(0.0, -1.0 - 20.0 * std::log10(reassess_peak_));
        target_db_ = std::min(edit_goal_db_, target_db_ + static_cast<double>(window_frames_) / rate_);
        edit_recovery_ = target_db_ < edit_goal_db_;
        quiet_seconds_ = 0;
        reassess_frames_ -= std::min(reassess_frames_, window_frames_);
      } else if (enabled && edit_recovery_ && peak_db > -65.0) {
        edit_goal_db_ = std::min(edit_goal_db_, required);
        target_db_ = std::min(edit_goal_db_, target_db_ + static_cast<double>(window_frames_) / rate_);
        edit_recovery_ = target_db_ < edit_goal_db_;
        quiet_seconds_ = 0;
      } else if (enabled && peak_db > -65.0) {
        if (required < target_db_) {
          if (overload_age_ < 10) target_db_ = required;
          overload_age_ = 0;
          quiet_seconds_ = 0;
        } else if (-1.0 - peak_db > target_db_ + 1.0) {
          const double seconds = static_cast<double>(window_frames_) / rate_;
          quiet_seconds_ += seconds;
          if (quiet_seconds_ > kRecoverAfterSeconds) {
            target_db_ = std::min(0.0, target_db_ + kRecoverDbPerSecond * seconds);
          }
        } else {
          quiet_seconds_ = 0;
        }
      } else {
        quiet_seconds_ = 0;
      }
      measured_frames_ = 0;
      window_peak_ = 0;
    }
  }
}

void OutputGuard::reassess(uint32_t settling_frames) noexcept {
  settling_frames_ = settling_frames;
  reassess_frames_ = rate_ * 2;
  reassess_peak_ = 0;
  edit_recovery_ = false;
  measured_frames_ = 0;
  window_peak_ = 0;
  quiet_seconds_ = 0;
}
double OutputGuard::gain_db() const noexcept {
  return 20.0 * std::log10(std::max(1e-12, state_.limiter.gain));
}

void OutputGuard::move_target(double db) noexcept {
  glide_from_db_ = applied_db();
  target_db_ = db;
  glide_frames_ = std::max(
      1u, static_cast<uint32_t>(std::lround(kEditGlideSeconds * rate_)));
  glide_left_ = glide_from_db_ == target_db_ ? 0 : glide_frames_;
}

double OutputGuard::applied_db() const noexcept {
  if (glide_left_ == 0) {
    return target_db_;
  }
  const double done =
      1.0 - static_cast<double>(glide_left_) / static_cast<double>(glide_frames_);
  const double weight = 0.5 - 0.5 * std::cos(kPi * done);
  return glide_from_db_ + weight * (target_db_ - glide_from_db_);
}

void OutputGuard::hold(double curve_level_db, uint32_t settling_frames,
                       bool sound_changed) noexcept {
  const double level = std::min(0.0, curve_level_db);
  if (!sound_changed) {
    // The same sound under another start level (the app sizing the preamp
    // again): what `set_curve_level` has always done — unless a hold is
    // running, whose estimate reads the curve level at the next edit.
    if (holding_) {
      curve_level_db_ = level;
    } else {
      set_curve_level(level);
    }
    return;
  }
  if (armed_) {
    holding_ = false;
    curve_level_db_ = level;
    return;
  }
  if (!holding_) {
    holding_ = true;
    held_db_ = target_db_;
    held_curve_db_ = curve_level_db_;
  }
  curve_level_db_ = level;
  move_target(std::min(0.0, held_db_ + std::min(0.0, level - held_curve_db_)));
  // The window being measured holds the old EQ's peaks, and the next few
  // milliseconds still carry them through the stages' delay and the bands'
  // crossfade: judged against the new level, they would read as room or as
  // an overload that neither EQ made.
  settling_frames_ = settling_frames;
  reassess_frames_ = 0;
  reassess_peak_ = 0;
  edit_recovery_ = false;
  measured_frames_ = 0;
  window_peak_ = 0;
  quiet_seconds_ = 0;
}

void OutputGuard::settle(double shift_db, uint32_t settling_frames) noexcept {
  if (!holding_) {
    return;
  }
  holding_ = false;
  if (!std::isfinite(shift_db)) {
    reassess(settling_frames);
    return;
  }
  move_target(std::min(0.0, held_db_ + shift_db));
  // What the after-edit climb would have measured is known, so none of it
  // runs. The window being measured is the new EQ's already and is kept.
  reassess_frames_ = 0;
  reassess_peak_ = 0;
  edit_recovery_ = false;
  quiet_seconds_ = 0;
}

void OutputGuard::take_level(const OutputGuard& from) noexcept {
  curve_level_db_ = from.curve_level_db_;
  armed_ = from.armed_;
  quiet_seconds_ = from.quiet_seconds_;
  target_db_ = from.target_db_;
  overload_age_ = from.overload_age_;
  settling_frames_ = from.settling_frames_;
  reassess_frames_ = from.reassess_frames_;
  reassess_peak_ = from.reassess_peak_;
  edit_goal_db_ = from.edit_goal_db_;
  edit_recovery_ = from.edit_recovery_;
  holding_ = from.holding_;
  held_db_ = from.held_db_;
  held_curve_db_ = from.held_curve_db_;
  glide_from_db_ = from.glide_from_db_;
  glide_left_ = from.glide_left_;
  glide_frames_ = from.glide_frames_;
  state_.limiter.gain = from.state_.limiter.gain;
  state_.limiter.detector_gain = from.state_.limiter.detector_gain;
  state_.limiter.platform_db = from.state_.limiter.platform_db;
  state_.limiter.release_hold_remaining = from.state_.limiter.release_hold_remaining;
}

void OutputGuard::set_curve_level(double db) noexcept {
  const double level = std::min(0.0, db);
  if (!armed_ && level < curve_level_db_) {
    move_target(std::min(0.0, target_db_ + (level - curve_level_db_)));
  }
  curve_level_db_ = level;
}
}
