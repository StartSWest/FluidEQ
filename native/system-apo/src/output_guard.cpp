#include "output_guard.h"
#include <algorithm>
#include <cmath>
#include <limits>

namespace fluideq_engine {
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
  }
  for (uint32_t offset = 0; offset < frames;) {
    const uint32_t count = std::min(frames - offset, window_frames_ - measured_frames_);
    for (uint32_t channel = 0; channel < delay_.size(); ++channel) {
      processing_planes_[channel] = planar[channel] + offset;
    }
    options.maximum_gain = std::pow(10.0, target_db_ / 20.0);
    feq_linked_limiter_process(&state_.limiter, processing_planes_.data(), count, &options);
    window_peak_ = std::max(window_peak_, state_.limiter.block_peak);
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
          if (quiet_seconds_ > 5.0) target_db_ = std::min(0.0, target_db_ + 0.1 * seconds);
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
}
