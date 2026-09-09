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

// The target curve at one frequency, in dB: piecewise-linear in log10(f),
// clamped to the first/last point's gain outside their range. `points` MUST
// already be sorted by frequency.
//
// An empty curve returns 0 dB unconditionally — not a special case bolted on
// afterwards, but the actual meaning of "no GraphicEQ line applied": every
// bin gets unity magnitude, and the inverse transform of an all-ones
// spectrum is an exact impulse at index 0 (in exact arithmetic; in floating
// point it is exact to well under any tolerance a caller would use). That is
// what turns an empty `points` into a bypass kernel below, with no branch
// dedicated to it.
double interpolated_gain_db(const std::vector<GraphicPoint>& points,
                            double frequency) {
  if (points.empty()) {
    return 0.0;
  }
  // Also covers bin 0 (f == 0 exactly, where log10 is undefined) with the
  // first point's gain, per the brief.
  if (frequency <= points.front().frequency) {
    return points.front().gain_db;
  }
  if (frequency >= points.back().frequency) {
    return points.back().gain_db;
  }
  const double log_f = std::log10(frequency);
  for (size_t i = 1; i < points.size(); ++i) {
    if (frequency <= points[i].frequency) {
      const double log_lo = std::log10(points[i - 1].frequency);
      const double log_hi = std::log10(points[i].frequency);
      const double t = (log_f - log_lo) / (log_hi - log_lo);
      return points[i - 1].gain_db +
             t * (points[i].gain_db - points[i - 1].gain_db);
    }
  }
  return points.back().gain_db;  // Unreachable: the clamp above already
                                 // returned for any frequency at or past the
                                 // last point.
}

}  // namespace

std::vector<float> design_graphic_kernel(const std::vector<GraphicPoint>& points,
                                         uint32_t sample_rate, uint32_t taps) {
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

  std::vector<GraphicPoint> sorted(points);
  std::sort(sorted.begin(), sorted.end(),
           [](const GraphicPoint& a, const GraphicPoint& b) {
             return a.frequency < b.frequency;
           });

  std::vector<double> real(m, 0.0);
  std::vector<double> imaginary(m, 0.0);  // Zero phase throughout: the
                                          // window below, not a phase term,
                                          // is what centres the impulse.
  const uint32_t half = m / 2;
  for (uint32_t k = 0; k <= half; ++k) {
    const double frequency = static_cast<double>(k) *
                             static_cast<double>(sample_rate) /
                             static_cast<double>(m);
    const double magnitude =
        std::pow(10.0, interpolated_gain_db(sorted, frequency) / 20.0);
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

}  // namespace fluideq_engine
