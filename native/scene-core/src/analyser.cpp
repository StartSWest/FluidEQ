/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/scene/analyser.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <numbers>

#include "fluideq/scene/sound_hops.h"

namespace feq::scene {

Analyser::Analyser(std::size_t fft_size, std::size_t history_size)
    : fft_size_(fft_size),
      capacity_(std::max(fft_size, history_size)),
      window_(fft_size),
      real_(fft_size),
      imaginary_(fft_size),
      mono_(fft_size),
      left_(fft_size),
      right_(fft_size),
      magnitudes_(fft_size / 2) {
  const auto size = static_cast<double>(fft_size);
  for (std::size_t n = 0; n < fft_size; ++n) {
    const double phase = (2.0 * std::numbers::pi * static_cast<double>(n)) / size;
    window_[n] = 0.42 - 0.5 * std::cos(phase) + 0.08 * std::cos(2.0 * phase);
  }
}

void Analyser::push(const float* interleaved, std::size_t frames,
                    std::size_t channels, double rate) {
  const std::size_t count = std::min<std::size_t>(2, channels);
  // A new format starts a new history and a new average: Blink's node is
  // rebuilt with a new context, and samples of two rates are not one signal.
  if (rate != rate_ || count != format_channels_) {
    rate_ = rate;
    format_channels_ = count;
    channels_.assign(count, History{std::vector<float>(capacity_), 0});
    std::fill(magnitudes_.begin(), magnitudes_.end(), 0.0F);
  }
  for (std::size_t frame = 0; frame < frames; ++frame) {
    for (std::size_t channel = 0; channel < count; ++channel) {
      History& history = channels_[channel];
      history.samples[history.next] = interleaved[frame * channels + channel];
      history.next = (history.next + 1) % capacity_;
    }
  }
  heard_ms_ += (static_cast<double>(frames) * 1000.0) / rate;
}

void Analyser::copy_newest(const History& history,
                           std::vector<float>& target) const {
  const std::size_t count = std::min(target.size(), capacity_);
  const std::size_t start = (history.next + capacity_ - count) % capacity_;
  const std::size_t offset = target.size() - count;
  for (std::size_t index = 0; index < count; ++index) {
    target[offset + index] = history.samples[(start + index) % capacity_];
  }
  std::fill(target.begin(), target.begin() + static_cast<std::ptrdiff_t>(offset),
            0.0F);
}

void Analyser::fold() {
  copy_newest(channels_[0], left_);
  if (channels_.size() < 2) {
    mono_ = left_;
    return;
  }
  copy_newest(channels_[1], right_);
  for (std::size_t index = 0; index < fft_size_; ++index) {
    mono_[index] = static_cast<float>(0.5 * (static_cast<double>(left_[index]) +
                                             static_cast<double>(right_[index])));
  }
}

void Analyser::read_mono(std::vector<float>& target) {
  if (channels_.empty()) {
    std::fill(target.begin(), target.end(), 0.0F);
    return;
  }
  fold();
  target = mono_;
}

void Analyser::read_frequency(std::vector<float>& target, double smoothing) {
  if (channels_.empty()) {
    std::fill(target.begin(), target.end(),
              -std::numeric_limits<float>::infinity());
    return;
  }
  fold();
  for (std::size_t n = 0; n < fft_size_; ++n) {
    real_[n] = static_cast<double>(mono_[n]) * window_[n];
    imaginary_[n] = 0.0;
  }
  fft_in_place(real_.data(), imaginary_.data(), fft_size_, false);
  const double k = std::min(1.0, std::max(0.0, smoothing));
  const double scale = 1.0 / static_cast<double>(fft_size_);
  const std::size_t bins = std::min(target.size(), magnitudes_.size());
  for (std::size_t bin = 0; bin < bins; ++bin) {
    const double magnitude = std::hypot(real_[bin], imaginary_[bin]) * scale;
    const double averaged =
        k * static_cast<double>(magnitudes_[bin]) + (1.0 - k) * magnitude;
    magnitudes_[bin] =
        std::isfinite(averaged) ? static_cast<float>(averaged) : 0.0F;
    target[bin] = static_cast<float>(
        20.0 * std::log10(static_cast<double>(magnitudes_[bin])));
  }
}

void Analyser::read_channel(std::size_t channel,
                            std::vector<float>& target) const {
  if (channel >= channels_.size()) {
    std::fill(target.begin(), target.end(), 0.0F);
    return;
  }
  copy_newest(channels_[channel], target);
}

}  // namespace feq::scene
