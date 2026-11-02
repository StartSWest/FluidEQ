/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/scene/sound_hops.h"

#include <algorithm>
#include <cmath>
#include <numbers>

namespace feq::scene {
namespace {

/** The long window, in seconds of sound: 2048 samples at 48 kHz. */
constexpr double kLowWindowS = 2048.0 / 48000.0;
constexpr double kLowTopHz = 375.0;
constexpr double kHighTopHz = 16000.0;
constexpr double kVoiceTopHz = 4000.0;
/** The bands up to this one are read from the long window. */
constexpr int kLowBandsEnd = 8;

std::vector<double> blackman(std::size_t size) {
  std::vector<double> window(size);
  const double n_size = static_cast<double>(size);
  for (std::size_t n = 0; n < size; ++n) {
    const double phase = 2.0 * std::numbers::pi * static_cast<double>(n);
    window[n] = 0.42 - 0.5 * std::cos(phase / n_size) +
                0.08 * std::cos(2.0 * phase / n_size);
  }
  return window;
}

}  // namespace

std::size_t low_window_size(double rate) {
  const double samples = std::max(256.0, rate * kLowWindowS);
  return static_cast<std::size_t>(
      std::pow(2.0, std::round(std::log2(samples))));
}

double rhythm_band_edge_hz(int band) {
  return kRhythmBandsLowHz *
         std::pow(kRhythmBandsHighHz / kRhythmBandsLowHz,
                  static_cast<double>(band) / kRhythmBandCount);
}

void fft_in_place(double* real, double* imaginary, std::size_t size,
                  bool inverse) {
  for (std::size_t i = 1, j = 0; i < size; ++i) {
    std::size_t bit = size >> 1U;
    for (; (j & bit) != 0U; bit >>= 1U) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      std::swap(real[i], real[j]);
      std::swap(imaginary[i], imaginary[j]);
    }
  }
  for (std::size_t length = 2; length <= size; length <<= 1U) {
    const double angle =
        (inverse ? 2.0 : -2.0) * std::numbers::pi / static_cast<double>(length);
    const double step_real = std::cos(angle);
    const double step_imaginary = std::sin(angle);
    const std::size_t half = length / 2;
    for (std::size_t start = 0; start < size; start += length) {
      double twiddle_real = 1.0;
      double twiddle_imaginary = 0.0;
      for (std::size_t k = 0; k < half; ++k) {
        const double top_real = real[start + k];
        const double top_imaginary = imaginary[start + k];
        const double bottom_real = real[start + k + half] * twiddle_real -
                                   imaginary[start + k + half] * twiddle_imaginary;
        const double bottom_imaginary =
            real[start + k + half] * twiddle_imaginary +
            imaginary[start + k + half] * twiddle_real;
        real[start + k] = top_real + bottom_real;
        imaginary[start + k] = top_imaginary + bottom_imaginary;
        real[start + k + half] = top_real - bottom_real;
        imaginary[start + k + half] = top_imaginary - bottom_imaginary;
        const double next_real =
            twiddle_real * step_real - twiddle_imaginary * step_imaginary;
        twiddle_imaginary =
            twiddle_real * step_imaginary + twiddle_imaginary * step_real;
        twiddle_real = next_real;
      }
    }
  }
}

SoundHops::SoundHops(double rate)
    : rate_(rate),
      hop_samples_(rate * kHopMs / 1000.0),
      low_size_(low_window_size(rate)),
      low_bin_hz_(rate / static_cast<double>(low_window_size(rate))),
      high_bin_hz_(rate / static_cast<double>(low_window_size(rate) / 2)) {
  low_count_ = static_cast<std::size_t>(std::floor(kLowTopHz / low_bin_hz_)) + 1;
  high_count_ = std::min(
      low_size_ / 4,
      static_cast<std::size_t>(
          std::floor(std::min(kHighTopHz, rate / 2.0) / high_bin_hz_)) +
          1);
  voice_count_ = std::min(
      low_size_ / 2,
      static_cast<std::size_t>(
          std::floor(std::min(kVoiceTopHz, rate / 2.0) / low_bin_hz_)) +
          1);
  const auto band_bins = static_cast<std::size_t>(
                             std::ceil(rhythm_band_edge_hz(kLowBandsEnd + 1) /
                                       low_bin_hz_)) +
                         1;
  low_band_bins_.assign(std::max({low_count_, voice_count_, band_bins}),
                        kNothingDb);
  low_window_ = blackman(low_size_);
  high_window_ = blackman(low_size_ / 2);
  real_.assign(low_size_, 0.0);
  imaginary_.assign(low_size_, 0.0);
  // Zeros before the first sample, as an analyser holds them.
  left_.assign(low_size_, 0.0F);
  right_.assign(low_size_, 0.0F);
  hop_.low.assign(low_count_, kNothingDb);
  hop_.high.assign(high_count_, kNothingDb);
  hop_.voice_mid.assign(voice_count_, kNothingDb);
  hop_.voice_side.assign(voice_count_, kNothingDb);
  hop_.low_bin_hz = low_bin_hz_;
  hop_.high_bin_hz = high_bin_hz_;
}

void SoundHops::append(float left, float right) {
  left_[next_] = left;
  right_[next_] = right;
  next_ = (next_ + 1) % low_size_;
}

void SoundHops::transform_into(std::size_t size,
                               const std::vector<double>& window, bool side,
                               float* out, std::size_t count) {
  // The newest `size` samples, oldest first: the ring's tail.
  const double sign = side ? -1.0 : 1.0;
  const std::size_t start = (next_ + low_size_ - size) % low_size_;
  for (std::size_t n = 0; n < size; ++n) {
    const std::size_t at = (start + n) % low_size_;
    real_[n] = 0.5 *
               (static_cast<double>(left_[at]) +
                sign * static_cast<double>(right_[at])) *
               window[n];
    imaginary_[n] = 0.0;
  }
  fft_in_place(real_.data(), imaginary_.data(), size, false);
  for (std::size_t bin = 0; bin < count; ++bin) {
    const double magnitude =
        std::hypot(real_[bin], imaginary_[bin]) / static_cast<double>(size);
    out[bin] = magnitude > 0.0
                   ? static_cast<float>(std::max(
                         static_cast<double>(kNothingDb),
                         20.0 * std::log10(magnitude)))
                   : kNothingDb;
  }
}

void SoundHops::bands_into(const float* bins, std::size_t count,
                           double bin_hz, int from, int to) {
  for (int band = from; band <= to; ++band) {
    const double low = rhythm_band_edge_hz(band);
    const double high = rhythm_band_edge_hz(band + 1);
    double power = 0.0;
    double heard = 0.0;
    for (auto bin = static_cast<std::size_t>(
             std::max(1.0, std::ceil(low / bin_hz)));
         static_cast<double>(bin) * bin_hz < high && bin < count; ++bin) {
      power += std::pow(10.0, static_cast<double>(bins[bin]) / 10.0);
      heard += 1.0;
    }
    if (heard == 0.0) {
      const double nearest = std::min(
          static_cast<double>(count - 1),
          std::max(1.0, std::round(std::sqrt(low * high) / bin_hz)));
      power = std::pow(10.0,
                       static_cast<double>(bins[static_cast<std::size_t>(
                           nearest)]) /
                           10.0);
      heard = 1.0;
    }
    const double db = 10.0 * std::log10(power / heard);
    hop_.bands[static_cast<std::size_t>(band)] = static_cast<float>(
        std::clamp((db - kNothingDb) / -kNothingDb, 0.0, 1.0));
  }
}

void SoundHops::read_hop(double at_ms) {
  ++hop_.seq;
  hop_.at_ms = at_ms;
  hop_.step_ms = kHopMs + lost_ms_;
  lost_ms_ = 0.0;
  transform_into(low_size_, low_window_, false, low_band_bins_.data(),
                 low_band_bins_.size());
  std::copy_n(low_band_bins_.begin(), low_count_, hop_.low.begin());
  std::copy_n(low_band_bins_.begin(), voice_count_, hop_.voice_mid.begin());
  bands_into(low_band_bins_.data(), low_band_bins_.size(), low_bin_hz_, 0,
             kLowBandsEnd);
  transform_into(low_size_, low_window_, true, hop_.voice_side.data(),
                 voice_count_);
  transform_into(low_size_ / 2, high_window_, false, hop_.high.data(),
                 high_count_);
  bands_into(hop_.high.data(), high_count_, high_bin_hz_, kLowBandsEnd + 1,
             kRhythmBandCount - 1);
}

}  // namespace feq::scene
