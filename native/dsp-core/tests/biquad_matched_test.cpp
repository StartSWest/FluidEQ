/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The analog-matched designs (`feq_biquad_coefficients_matched`) against the
 * analog shapes they reproduce and the cookbook they replace.
 *
 * The cookbook squeezes a band toward Nyquist; at 48 kHz a 16 kHz bell plays
 * more than 2 dB off the shape the graph draws. What the matched design
 * promises is narrower than "better": within half a decibel there, never
 * further from its shape than the cookbook anywhere a user can reach, always
 * stable, and a cut that undoes the same boost exactly.
 */

#include "fluideq/biquad.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>

namespace {

int g_failures = 0;

void check(bool condition, const char* what) {
  if (!condition) {
    std::printf("  FAIL %s\n", what);
    ++g_failures;
  } else {
    std::printf("  ok   %s\n", what);
  }
}

/** |H| in dB of one biquad at `f`, from its coefficients. */
double biquad_db(const FeqBiquadCoefficients& k, double f, double rate) {
  const double w = 2.0 * 3.14159265358979323846 * f / rate;
  const double nr = k.b0 + k.b1 * std::cos(w) + k.b2 * std::cos(2 * w);
  const double ni = -(k.b1 * std::sin(w) + k.b2 * std::sin(2 * w));
  const double dr = 1.0 + k.a1 * std::cos(w) + k.a2 * std::cos(2 * w);
  const double di = -(k.a1 * std::sin(w) + k.a2 * std::sin(2 * w));
  return 10.0 * std::log10((nr * nr + ni * ni) / (dr * dr + di * di));
}

/**
 * The analog shape a band is drawn with — the prototype the cookbook is the
 * bilinear image of, and the one a matched design reproduces.
 */
double analog_db(FeqFilterType type, double f0, double gain_db, double q,
                 double f) {
  const double w = f / f0;
  const double real = 1.0 - w * w;
  const double poles = real * real + (w / q) * (w / q);
  const double a = std::pow(10.0, gain_db / 40.0);
  switch (type) {
    case FEQ_FILTER_PK:
      return 10.0 * std::log10((real * real + std::pow(w * a / q, 2)) /
                               (real * real + std::pow(w / (a * q), 2)));
    case FEQ_FILTER_LPQ:
      return 10.0 * std::log10(1.0 / poles);
    case FEQ_FILTER_HPQ:
      return 10.0 * std::log10(std::pow(w, 4) / poles);
    case FEQ_FILTER_BP:
      return 10.0 * std::log10((w / q) * (w / q) / poles);
    case FEQ_FILTER_LSC:
    case FEQ_FILTER_HSC: {
      const double r = std::sqrt(a) * w / q;
      const double low = std::pow(a - w * w, 2) + r * r;
      const double high = std::pow(1.0 - a * w * w, 2) + r * r;
      return 10.0 * std::log10(type == FEQ_FILTER_LSC ? a * a * low / high
                                                      : a * a * high / low);
    }
    case FEQ_FILTER_NO:
      break;
  }
  return 0.0;
}

bool stable(const FeqBiquadCoefficients& k) {
  return std::isfinite(k.b0) && std::isfinite(k.b1) && std::isfinite(k.b2) &&
         std::isfinite(k.a1) && std::isfinite(k.a2) && std::fabs(k.a2) < 1.0 &&
         std::fabs(k.a1) < 1.0 + k.a2;
}

/** Largest miss from the drawn shape, 20 Hz to the top of the audible band. */
double worst_miss(const FeqBiquadCoefficients& k, FeqFilterType type,
                  double f0, double gain_db, double q, double rate) {
  double worst = 0.0;
  const double top = std::min(20000.0, 0.49 * rate);
  for (double f = 20.0; f <= top; f *= 1.02) {
    worst = std::max(worst, std::fabs(biquad_db(k, f, rate) -
                                      analog_db(type, f0, gain_db, q, f)));
  }
  return worst;
}

void test_matched_filters() {
  std::printf("analog-matched filters\n");
  const double rate = 48000.0;
  const auto matched =
      feq_biquad_coefficients_matched(FEQ_FILTER_PK, 16000, 6, 2, rate);
  const auto cookbook = feq_biquad_coefficients(FEQ_FILTER_PK, 16000, 6, 2, rate);
  // POSITIVE CONTROL, and the reason the design exists: at 48 kHz the
  // cookbook squeezes a 16 kHz bell by more than 2 dB.
  check(worst_miss(cookbook, FEQ_FILTER_PK, 16000, 6, 2, rate) > 2.0,
        "the cookbook misses a 16 kHz bell by over 2 dB at 48 kHz");
  check(worst_miss(matched, FEQ_FILTER_PK, 16000, 6, 2, rate) < 0.5,
        "the matched bell stays within 0.5 dB of its drawn shape");
  check(std::fabs(biquad_db(matched, 16000, rate) - 6.0) < 0.01,
        "its centre gain is exact");

  const auto cut = feq_biquad_coefficients_matched(FEQ_FILTER_PK, 16000, -6, 2, rate);
  double undone = 0.0;
  for (double f = 20.0; f < 23000.0; f *= 1.1) {
    undone = std::max(undone, std::fabs(biquad_db(matched, f, rate) +
                                        biquad_db(cut, f, rate)));
  }
  check(undone < 1e-6, "a cut undoes the same boost exactly");

  const auto flat = feq_biquad_coefficients_matched(FEQ_FILTER_PK, 1000, 0, 1, rate);
  check(flat.b0 == 1.0 && flat.b1 == 0.0 && flat.b2 == 0.0 && flat.a1 == 0.0 &&
            flat.a2 == 0.0,
        "no gain is no filter");

  // Shapes without a matched design that measured better keep the cookbook.
  const auto wide = feq_biquad_coefficients_matched(FEQ_FILTER_HSC, 8000, 4, 1.0, rate);
  const auto wide_cookbook = feq_biquad_coefficients(FEQ_FILTER_HSC, 8000, 4, 1.0, rate);
  const auto notch = feq_biquad_coefficients_matched(FEQ_FILTER_NO, 9000, 0, 2, rate);
  const auto notch_cookbook = feq_biquad_coefficients(FEQ_FILTER_NO, 9000, 0, 2, rate);
  check(std::memcmp(&wide, &wide_cookbook, sizeof wide) == 0 &&
            std::memcmp(&notch, &notch_cookbook, sizeof notch) == 0,
        "a non-Butterworth shelf and a notch stay on the cookbook");

  // Across the ground a user can reach: always stable, and never further
  // from the drawn shape than the cookbook it replaces.
  const FeqFilterType types[] = {FEQ_FILTER_PK, FEQ_FILTER_LPQ, FEQ_FILTER_HPQ,
                                 FEQ_FILTER_BP, FEQ_FILTER_LSC, FEQ_FILTER_HSC};
  int unstable = 0;
  int worse = 0;
  for (const double sample_rate : {44100.0, 48000.0, 96000.0}) {
    for (const FeqFilterType type : types) {
      const bool shelf = type == FEQ_FILTER_LSC || type == FEQ_FILTER_HSC;
      for (const double f0 : {30.0, 250.0, 2000.0, 8000.0, 12000.0, 16000.0, 19000.0}) {
        for (const double gain : {-12.0, -3.0, 3.0, 12.0}) {
          for (const double q : {0.3, 0.7071, 2.0, 8.0}) {
            if (shelf && q != 0.7071) {
              continue;
            }
            const auto m = feq_biquad_coefficients_matched(type, f0, gain, q, sample_rate);
            const auto c = feq_biquad_coefficients(type, f0, gain, q, sample_rate);
            unstable += stable(m) ? 0 : 1;
            if (worst_miss(m, type, f0, gain, q, sample_rate) >
                worst_miss(c, type, f0, gain, q, sample_rate) + 0.05) {
              ++worse;
            }
          }
        }
      }
    }
  }
  check(unstable == 0, "every matched design is stable");
  check(worse == 0, "no matched design misses its shape by more than the cookbook");
  check(stable(feq_biquad_coefficients_matched(FEQ_FILTER_PK, 23000, 12, 8, 44100)) &&
            stable(feq_biquad_coefficients_matched(FEQ_FILTER_HSC, 60000, -24, 0.7071, 44100)),
        "a band asked for past Nyquist is still stable");
}

}  // namespace

int main() {
  test_matched_filters();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}
