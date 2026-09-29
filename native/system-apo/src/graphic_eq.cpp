/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "graphic_eq.h"

#include <algorithm>
#include <cmath>

#include "fluideq/convolver.h"

namespace fluideq_engine {

namespace {

constexpr double kPi = 3.14159265358979323846;

// The target curve at ascending frequencies, in dB: piecewise-linear in
// log10(f), clamped to the first/last point's gain outside their range.
// `points` MUST already be sorted by frequency, and `gain_db` MUST be asked in
// ascending order: the segment cursor only moves forward, so one spectrum
// costs O(points + bins). The linear scan this replaced was O(points) per
// bin, and a GraphicEQ line is text anybody can write into the config folder.
//
// An empty curve returns 0 dB unconditionally — not a special case bolted on
// afterwards, but the actual meaning of "no GraphicEQ line applied": every
// bin gets unity magnitude, and the inverse transform of an all-ones
// spectrum is an exact impulse at index 0 (in exact arithmetic; in floating
// point it is exact to well under any tolerance a caller would use). That,
// and a sum over no curves being 0 dB too, is what turns "nothing to apply"
// into a bypass kernel below, with no branch dedicated to it.
class CurveWalk {
 public:
  explicit CurveWalk(const std::vector<GraphicPoint>& points)
      : points_(points) {}

  double gain_db(double frequency) {
    if (points_.empty()) {
      return 0.0;
    }
    // Also covers bin 0 (f == 0 exactly, where log10 is undefined) with the
    // first point's gain, per the brief.
    if (frequency <= points_.front().frequency) {
      return points_.front().gain_db;
    }
    if (frequency >= points_.back().frequency) {
      return points_.back().gain_db;
    }
    // The first point at or above `frequency`. The one before it is then
    // strictly below, so the segment below has width and the divide is safe.
    while (points_[next_].frequency < frequency) {
      ++next_;
    }
    const GraphicPoint& lo = points_[next_ - 1];
    const GraphicPoint& hi = points_[next_];
    const double log_lo = std::log10(lo.frequency);
    const double log_hi = std::log10(hi.frequency);
    const double t = (std::log10(frequency) - log_lo) / (log_hi - log_lo);
    return lo.gain_db + t * (hi.gain_db - lo.gain_db);
  }

 private:
  const std::vector<GraphicPoint>& points_;
  size_t next_ = 1;
};

std::vector<CurveWalk> walks_of(
    const std::vector<std::vector<GraphicPoint>>& sorted) {
  std::vector<CurveWalk> walks;
  walks.reserve(sorted.size());
  for (const std::vector<GraphicPoint>& curve : sorted) {
    walks.emplace_back(curve);
  }
  return walks;
}

}  // namespace

std::vector<float> design_graphic_kernel(
    const std::vector<std::vector<GraphicPoint>>& curves, uint32_t sample_rate,
    uint32_t taps) {
  const uint32_t n = taps | 1u;  // Force odd: one centre sample, exact
                                 // integer group delay of n/2.

  // Smallest power of two >= 2n. `feq_fft_in_place` refuses anything else,
  // and 2n rather than n leaves room for the mirrored negative-frequency
  // half plus enough resolution that the frequency-sampled curve does not
  // alias into the taps kept below.
  uint32_t m = 1;
  while (m < 2 * n) {
    m <<= 1;
  }

  std::vector<std::vector<GraphicPoint>> sorted(curves);
  for (std::vector<GraphicPoint>& curve : sorted) {
    std::sort(curve.begin(), curve.end(),
              [](const GraphicPoint& a, const GraphicPoint& b) {
                return a.frequency < b.frequency;
              });
  }

  std::vector<double> real(m, 0.0);
  std::vector<double> imaginary(m, 0.0);  // Zero phase throughout: the
                                          // window below, not a phase term,
                                          // is what centres the impulse.
  std::vector<CurveWalk> walks = walks_of(sorted);
  const uint32_t half = m / 2;
  for (uint32_t k = 0; k <= half; ++k) {
    const double frequency = static_cast<double>(k) *
                             static_cast<double>(sample_rate) /
                             static_cast<double>(m);
    double gain_db = 0.0;
    for (CurveWalk& walk : walks) {
      gain_db += walk.gain_db(frequency);
    }
    const double magnitude = std::pow(10.0, gain_db / 20.0);
    real[k] = magnitude;
    if (k != 0 && k != half) {
      // Mirror to the negative-frequency bin so the spectrum is conjugate
      // symmetric and the inverse transform comes out real: with zero
      // imaginary part everywhere, "conjugate" symmetric is just "equal".
      real[m - k] = magnitude;
    }
  }

  feq_fft_in_place(real.data(), imaginary.data(), m, /*inverse=*/1);

  // Sample 0 of the (unnormalised) inverse transform moves to index n/2, and
  // only the first n taps of that rotation are kept: kernel[i] is the
  // transform's sample at (i - n/2) mod m, which for i < n/2 wraps around to
  // the transform's tail — the "negative time" half of a linear-phase
  // response that frequency sampling always produces wrapped to the end of
  // the buffer.
  const uint32_t half_n = n / 2;
  std::vector<float> kernel(n, 0.0f);
  for (uint32_t i = 0; i < n; ++i) {
    const uint32_t source = (i + m - half_n) % m;
    const double value = real[source] / static_cast<double>(m);
    const double window =
        n > 1 ? 0.5 - 0.5 * std::cos(2.0 * kPi * static_cast<double>(i) /
                                     static_cast<double>(n - 1))
             : 1.0;
    kernel[i] = static_cast<float>(value * window);
  }
  return kernel;
}

std::vector<float> design_minimum_graphic_kernel(
    const std::vector<std::vector<GraphicPoint>>& curves, uint32_t sample_rate,
    uint32_t taps) {
  const uint32_t n = std::max<uint32_t>(taps, 1u);
  uint32_t m = 1;
  while (m < 4 * n) {
    m <<= 1;
  }

  std::vector<std::vector<GraphicPoint>> sorted(curves);
  for (std::vector<GraphicPoint>& curve : sorted) {
    std::sort(curve.begin(), curve.end(),
              [](const GraphicPoint& a, const GraphicPoint& b) {
                return a.frequency < b.frequency;
              });
  }

  // The natural log of the target magnitude on every bin, mirrored.
  constexpr double kFloorDb = -100.0;
  const double nepers_per_db = std::log(10.0) / 20.0;
  std::vector<double> real(m, 0.0);
  std::vector<double> imaginary(m, 0.0);
  std::vector<CurveWalk> walks = walks_of(sorted);
  const uint32_t half = m / 2;
  for (uint32_t k = 0; k <= half; ++k) {
    const double frequency = static_cast<double>(k) *
                             static_cast<double>(sample_rate) /
                             static_cast<double>(m);
    double gain_db = 0.0;
    for (CurveWalk& walk : walks) {
      gain_db += walk.gain_db(frequency);
    }
    const double log_magnitude = std::max(gain_db, kFloorDb) * nepers_per_db;
    real[k] = log_magnitude;
    if (k != 0 && k != half) {
      real[m - k] = log_magnitude;
    }
  }

  // Real cepstrum, folded onto positive quefrency: the minimum-phase
  // spectrum's log is then its transform.
  feq_fft_in_place(real.data(), imaginary.data(), m, /*inverse=*/1);
  for (uint32_t q = 0; q < m; ++q) {
    const double weight = q == 0 || q == half ? 1.0 : (q < half ? 2.0 : 0.0);
    real[q] = real[q] * weight / static_cast<double>(m);
    imaginary[q] = 0.0;
  }
  feq_fft_in_place(real.data(), imaginary.data(), m, /*inverse=*/0);
  for (uint32_t k = 0; k < m; ++k) {
    const double magnitude = std::exp(real[k]);
    const double phase = imaginary[k];
    real[k] = magnitude * std::cos(phase);
    imaginary[k] = magnitude * std::sin(phase);
  }
  feq_fft_in_place(real.data(), imaginary.data(), m, /*inverse=*/1);

  // Flat over the first three quarters, a half-cosine to zero over the last.
  std::vector<float> kernel(n, 0.0f);
  const uint32_t taper_from = n - n / 4;
  for (uint32_t i = 0; i < n; ++i) {
    double window = 1.0;
    if (i >= taper_from && n / 4 > 0) {
      const double t = static_cast<double>(i - taper_from) /
                       static_cast<double>(n / 4);
      window = 0.5 + 0.5 * std::cos(kPi * t);
    }
    kernel[i] = static_cast<float>(real[i] / static_cast<double>(m) * window);
  }
  return kernel;
}

}  // namespace fluideq_engine
