/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "room_interpolation.h"
#include "room_internal.h"
#include <algorithm>
#include <cmath>
#include <complex>

namespace {
constexpr double kPi = 3.14159265358979323846;
// A gain-independent leading-energy landmark, computed ONCE per measurement.
// Interpolating the landmark avoids selecting a new threshold/peak as a source
// moves. It estimates arrival, not a claim of anatomical/acoustic onset.
double onset(const float* data, uint32_t taps) {
  double total = 0;
  for (uint32_t i = 0; i < taps; ++i) total += double(data[i]) * data[i];
  if (total == 0) return 0;
  const double target = 0.05 * total;
  double sum = 0;
  for (uint32_t i = 0; i < taps; ++i) {
    const double e = double(data[i]) * data[i];
    if (e > 0 && sum + e >= target) return i;
    sum += e;
  }
  return taps - 1.0;
}
}

RoomInterpolation::RoomInterpolation(const FeqRoom* room)
    : sample_rate_(room->sample_rate), directions_(room->directions),
      taps_(room->taps * (room->doubling ? 2u : 1u)),
      budget_(room->settings.renderer_version == 2 ? room_physical_taps(room->sample_rate) : FEQ_ROOM_KERNEL_TAPS) {
  for (int ear = 0; ear < 2; ++ear) {
    const auto& input = ear == 0 ? room->head_left : room->head_right;
    auto& ring = ring_[ear];
    ring.resize(size_t(directions_) * taps_);
    onset_[ear].resize(directions_);
    for (uint32_t d = 0; d < directions_; ++d) {
      float* to = ring.data() + size_t(d) * taps_;
      const float* from = input.data() + size_t(d) * room->taps;
      // Halved with the doubling, as `head_response` does and for its reason:
      // twice the taps at the same height is twice the gain.
      if (!room->doubling) std::copy(from, from + taps_, to);
      else for (uint32_t i = 0; i < room->taps; ++i) {
        to[2 * i] = 0.5f * from[i];
        to[2 * i + 1] = 0.25f * (from[i] + (i + 1 < room->taps ? from[i + 1] : 0));
      }
      onset_[ear][d] = onset(to, taps_);
    }
  }
}

namespace {
using Complex = std::complex<double>;
// The existing control-thread FFT. Zero padding separates the causal response
// from negative-time fractional-delay support; no circular tail is played.
void transform(std::vector<Complex>& bins, bool inverse) {
  const auto n = static_cast<uint32_t>(bins.size());
  std::vector<double> real(n), imaginary(n);
  for (uint32_t i = 0; i < n; ++i) {
    real[i] = bins[i].real();
    imaginary[i] = bins[i].imag();
  }
  feq_fft_in_place(real.data(), imaginary.data(), n, inverse ? 1 : 0);
  const double scale = inverse ? 1.0 / n : 1.0;
  for (uint32_t i = 0; i < n; ++i)
    bins[i] = Complex(real[i] * scale, imaginary[i] * scale);
}
}

void RoomInterpolation::response(double degrees, int ear, double extra_delay,
                                    std::vector<float>& out, RoomInterpolationMetrics* metrics) const {
  if (metrics != nullptr) *metrics = {};
  if (!std::isfinite(degrees)) degrees = 0;
  double angle = std::fmod(degrees, 360.0);
  if (angle < 0) angle += 360.0;
  const double position = angle * directions_ / 360.0;
  const uint32_t a = static_cast<uint32_t>(std::floor(position)) % directions_;
  const uint32_t b = (a + 1) % directions_;
  const double weight = position - std::floor(position);
  const float* first = ring_[ear].data() + size_t(a) * taps_;
  // Identity at measurements, including the existing 192k doubling samples.
  if (weight == 0 && extra_delay == 0) {
    out.assign(first, first + taps_);
    if (metrics != nullptr) for (float v : out) metrics->retained_energy += double(v) * v;
    return;
  }
  const double delta = onset_[ear][b] - onset_[ear][a];
  // A phase ramp is a bandlimited fractional delay in sample units. Removing
  // each onset, interpolating residual phase and restoring the blended onset
  // avoids the two separated arrivals of a raw HRIR sum. Interpolate magnitude
  // independently: even aligned real heads have enough residual phase to make
  // a linear blend introduce measured 10-15 dB notches between directions.
  size_t length = 4096;
  while (length < size_t(budget_) * 2) length *= 2;
  while (length < size_t(taps_) * 2) length *= 2;
  std::vector<Complex> first_bins(length), second_bins(length);
  const float* second = ring_[ear].data() + size_t(b) * taps_;
  for (uint32_t i = 0; i < taps_; ++i) {
    first_bins[i] = first[i];
    second_bins[i] = second[i];
  }
  transform(first_bins, false);
  transform(second_bins, false);
  first_bins[0] = (1.0 - weight) * first_bins[0] + weight * second_bins[0];
  for (size_t k = 1; k <= length / 2; ++k) {
    const double frequency = 2 * kPi * double(k) / double(length);
    const Complex a_bin = first_bins[k];
    const Complex b_bin = second_bins[k];
    const double a_magnitude = std::abs(a_bin);
    const double b_magnitude = std::abs(b_bin);
    double a_phase = std::arg(a_bin) + frequency * onset_[ear][a];
    double b_phase = std::arg(b_bin) + frequency * onset_[ear][b];
    // A zero bin has no phase. Borrow the nonzero neighbor's aligned phase:
    // arg(b * conj(a)) instead becomes zero and loses b's phase completely,
    // making silent directions and isolated spectral zeros jump at the grid.
    if (a_magnitude == 0.0) a_phase = b_phase;
    if (b_magnitude == 0.0) b_phase = a_phase;
    const double residual = std::remainder(b_phase - a_phase, 2 * kPi);
    const double magnitude = (1.0 - weight) * a_magnitude + weight * b_magnitude;
    const double phase = a_phase + weight * residual;
    const Complex value = std::polar(magnitude, phase);
    first_bins[k] = k == length / 2 ? Complex(value.real(), 0) : value;
    if (k < length / 2) first_bins[length - k] = std::conj(value);
  }
  transform(first_bins, true);
  // Restore the interpolated landmark with ONE finite fractional-delay FIR.
  // Integer landmarks keep alignment exact; using an unconstrained fractional
  // FFT phase ramp here creates long sinc tails even for a delayed impulse.
  const double delay = onset_[ear][a] + weight * delta + extra_delay;
  const int whole = static_cast<int>(std::floor(delay));
  const double fraction = delay - whole;
  const int radius = std::clamp(static_cast<int>(std::ceil(
      16.0 * sample_rate_ / 48000.0)), 8, 128);
  std::array<double, 257> coefficients{};
  double sum = 0;
  for (int k = -radius; k <= radius; ++k) {
    const double x = k - fraction;
    const double u = x / radius;
    const double sinc = std::fabs(x) < 1e-12 ? 1.0 : std::sin(kPi * x) / (kPi * x);
    const double c = std::fabs(u) > 1.0 ? 0.0 :
        sinc * (0.42 + 0.5 * std::cos(kPi * u) + 0.08 * std::cos(2 * kPi * u));
    coefficients[size_t(k + radius)] = c;
    sum += c;
  }
  // No hidden bulk delay: discard negative-time support and content beyond
  // the existing kernel budget. Source diffuse-field correction stays intact.
  out.assign(budget_, 0);
  const int begin = metrics == nullptr ? 0 : -static_cast<int>(length / 2);
  const int end = metrics == nullptr ? static_cast<int>(out.size()) : static_cast<int>(length / 2);
  for (int i = begin; i < end; ++i) {
    double value = 0;
    for (int k = -radius; k <= radius; ++k) {
      const int source = i - whole - k;
      if (source < -static_cast<int>(length / 2) || source >= static_cast<int>(length / 2)) continue;
      const size_t at = source < 0 ? size_t(static_cast<int>(length) + source) : size_t(source);
      value += first_bins[at].real() * coefficients[size_t(k + radius)] / sum;
    }
    if (i >= 0 && size_t(i) < out.size()) out[size_t(i)] = static_cast<float>(value);
    if (metrics != nullptr) {
      if (i < 0) metrics->negative_energy += value * value;
      else if (size_t(i) >= out.size()) metrics->late_energy += value * value;
      else metrics->retained_energy += value * value;
    }
  }
}
