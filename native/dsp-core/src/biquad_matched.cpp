/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Analog-matched biquads: see `feq_biquad_coefficients_matched` in biquad.h.
 *
 * Restated from Martin Vicanek, "Matched Second Order Digital Filters" (2016)
 * — the bell, low-, high- and band-pass — and the appendix of his two-pole
 * shelf note (2024, revised 2025). Checked against the paper's own figures: a
 * +6 dB, Q 2 bell at 10, 12 and 16 kHz on a 44.1 kHz stream stays within
 * 0.21, 0.32 and 0.43 dB of its analog prototype, where the cookbook misses
 * by 1.36, 1.97 and 3.52 dB.
 *
 * Every design here shares one idea. The poles are the analog poles mapped by
 * impulse invariance, z = exp(s T), so the resonance does not narrow the way a
 * bilinear transform narrows it near Nyquist. The numerator is then solved in
 * closed form from the squared magnitude written as
 *
 *   |H|^2 = (B0 phi0 + B1 phi1 + B2 phi2) / (A0 phi0 + A1 phi1 + A2 phi2),
 *   phi1 = sin^2(w/2), phi0 = 1 - phi1, phi2 = 4 phi0 phi1,
 *
 * and turned back into coefficients by taking the minimum-phase root, so the
 * filter keeps the phase an analog equaliser of that shape would have.
 */

#include "fluideq/biquad.h"

#include <cmath>

namespace {

constexpr double kPi = 3.14159265358979323846;

/** The Butterworth shelf the two-pole design is exact for (RBJ's S = 1). */
constexpr double kButterworthQ = 0.70710678118654752440;
/**
 * How far from Butterworth a shelf may be and still take the matched design.
 * Presets write Q 0.7 for it (AutoEQ, oratory1990, FluidEQ's own curves); a
 * shelf that far off has a slope within 0.05 dB of the exact one.
 */
constexpr double kButterworthTolerance = 0.02;

struct Denominator {
  double a1;
  double a2;
  double A0;
  double A1;
  double A2;
};

/**
 * The analog pole pair s^2 + 2 zeta w s + w^2 mapped by impulse invariance,
 * w in radians per sample, with the squared-magnitude terms of the result.
 */
Denominator matched_poles(double w, double zeta) {
  const double decay = std::exp(-zeta * w);
  Denominator d{};
  d.a1 = zeta <= 1.0
             ? -2.0 * decay * std::cos(w * std::sqrt(1.0 - zeta * zeta))
             : -2.0 * decay * std::cosh(w * std::sqrt(zeta * zeta - 1.0));
  d.a2 = std::exp(-2.0 * zeta * w);
  d.A0 = (1.0 + d.a1 + d.a2) * (1.0 + d.a1 + d.a2);
  d.A1 = (1.0 - d.a1 + d.a2) * (1.0 - d.a1 + d.a2);
  d.A2 = -4.0 * d.a2;
  return d;
}

struct Phis {
  double phi0;
  double phi1;
  double phi2;
};

Phis phis_at(double w) {
  const double half = std::sin(w / 2.0);
  Phis p{};
  p.phi1 = half * half;
  p.phi0 = 1.0 - p.phi1;
  p.phi2 = 4.0 * p.phi0 * p.phi1;
  return p;
}

/** Square roots that rounding can push a hair below zero. */
double root(double value) { return std::sqrt(value > 0.0 ? value : 0.0); }

bool is_finite(const FeqBiquadCoefficients& k) {
  return std::isfinite(k.b0) && std::isfinite(k.b1) && std::isfinite(k.b2) &&
         std::isfinite(k.a1) && std::isfinite(k.a2) && k.b0 != 0.0;
}

FeqBiquadCoefficients identity() {
  FeqBiquadCoefficients k{};
  k.b0 = 1.0;
  return k;
}

/**
 * The bell: unity at DC, exactly the band's gain at its centre, and flat
 * there. A cut is the reciprocal of the boost of the same size — a boost and
 * the cut that undoes it then sum to exactly nothing, and the cut's error is
 * half what solving it directly gives.
 */
FeqBiquadCoefficients bell(double w0, double gain_db, double quality) {
  if (gain_db == 0.0) {
    return identity();
  }
  const bool cut = gain_db < 0.0;
  const double g = std::pow(10.0, std::fabs(gain_db) / 20.0);
  // The cookbook prototype's denominator: s^2 + s/(sqrt(g) Q) + 1.
  const Denominator d = matched_poles(w0, 1.0 / (2.0 * quality * std::sqrt(g)));
  const Phis p = phis_at(w0);
  const double B0 = d.A0;
  const double R1 = (d.A0 * p.phi0 + d.A1 * p.phi1 + d.A2 * p.phi2) * g * g;
  const double R2 = (-d.A0 + d.A1 + 4.0 * (p.phi0 - p.phi1) * d.A2) * g * g;
  const double B2 = (R1 - R2 * p.phi1 - B0) / (4.0 * p.phi1 * p.phi1);
  const double B1 = R2 + B0 + 4.0 * (p.phi1 - p.phi0) * B2;
  const double W = 0.5 * (root(B0) + root(B1));
  FeqBiquadCoefficients boost{};
  boost.b0 = 0.5 * (W + root(W * W + B2));
  boost.b1 = 0.5 * (root(B0) - root(B1));
  boost.b2 = -B2 / (4.0 * boost.b0);
  boost.a1 = d.a1;
  boost.a2 = d.a2;
  if (!cut) {
    return boost;
  }
  // The boost's zeros are minimum phase, so its reciprocal's poles are stable.
  FeqBiquadCoefficients reciprocal{};
  reciprocal.b0 = 1.0 / boost.b0;
  reciprocal.b1 = boost.a1 / boost.b0;
  reciprocal.b2 = boost.a2 / boost.b0;
  reciprocal.a1 = boost.b1 / boost.b0;
  reciprocal.a2 = boost.b2 / boost.b0;
  return reciprocal;
}

/** Unity at DC, the prototype's Q at the corner. */
FeqBiquadCoefficients low_pass(double w0, double quality) {
  const Denominator d = matched_poles(w0, 1.0 / (2.0 * quality));
  const Phis p = phis_at(w0);
  const double B0 = d.A0;
  const double R1 = (d.A0 * p.phi0 + d.A1 * p.phi1 + d.A2 * p.phi2) * quality * quality;
  const double B1 = (R1 - B0 * p.phi0) / p.phi1;
  FeqBiquadCoefficients k{};
  k.b0 = 0.5 * (root(B0) + root(B1));
  k.b1 = root(B0) - k.b0;
  k.b2 = 0.0;
  k.a1 = d.a1;
  k.a2 = d.a2;
  return k;
}

/** A double zero at DC, the prototype's Q at the corner. */
FeqBiquadCoefficients high_pass(double w0, double quality) {
  const Denominator d = matched_poles(w0, 1.0 / (2.0 * quality));
  const Phis p = phis_at(w0);
  FeqBiquadCoefficients k{};
  k.b0 = quality * root(d.A0 * p.phi0 + d.A1 * p.phi1 + d.A2 * p.phi2) /
         (4.0 * p.phi1);
  k.b1 = -2.0 * k.b0;
  k.b2 = k.b0;
  k.a1 = d.a1;
  k.a2 = d.a2;
  return k;
}

/** A single zero at DC, unity at the centre and flat there. */
FeqBiquadCoefficients band_pass(double w0, double quality) {
  const Denominator d = matched_poles(w0, 1.0 / (2.0 * quality));
  const Phis p = phis_at(w0);
  const double R1 = d.A0 * p.phi0 + d.A1 * p.phi1 + d.A2 * p.phi2;
  const double R2 = -d.A0 + d.A1 + 4.0 * (p.phi0 - p.phi1) * d.A2;
  const double B2 = (R1 - R2 * p.phi1) / (4.0 * p.phi1 * p.phi1);
  const double B1 = R2 + 4.0 * (p.phi1 - p.phi0) * B2;
  FeqBiquadCoefficients k{};
  k.b1 = -0.5 * root(B1);
  k.b0 = 0.5 * (root(B2 + k.b1 * k.b1) - k.b1);
  k.b2 = -k.b0 - k.b1;
  k.a1 = d.a1;
  k.a2 = d.a2;
  return k;
}

/**
 * The two-pole Butterworth shelf. `fc` is the half-gain frequency in units
 * of Nyquist and may exceed 1; the prototype is exactly the cookbook's shelf
 * with S = 1. A low shelf is the high shelf of the reciprocal gain, scaled.
 */
FeqBiquadCoefficients shelf(bool high, double fc, double gain_db) {
  const double G = std::pow(10.0, gain_db / 20.0);
  double g = high ? G : 1.0 / G;
  if (std::fabs(1.0 - g) < 1e-6) {
    g = 1.00001;
  }
  const double fc4 = fc * fc * fc * fc;
  const double h_nyquist = (fc4 + g) / (fc4 + 1.0 / g);
  // The paper's two fitting frequencies, chosen for accuracy over fc.
  const double f1 = fc / std::sqrt(0.160 + 1.543 * fc * fc);
  const double f2 = fc / std::sqrt(0.947 + 3.806 * fc * fc);
  const auto h_at = [&](double f) {
    const double f4 = f * f * f * f;
    return (fc4 + f4 * g) / (fc4 + f4 / g);
  };
  const double h1 = h_at(f1);
  const double h2 = h_at(f2);
  const double s1 = std::sin(kPi * f1 / 2.0);
  const double s2 = std::sin(kPi * f2 / 2.0);
  const double p1 = s1 * s1;
  const double p2 = s2 * s2;
  const double d1 = (h1 - 1.0) * (1.0 - p1);
  const double d2 = (h2 - 1.0) * (1.0 - p2);
  const double c11 = -p1 * d1;
  const double c12 = p1 * p1 * (h_nyquist - h1);
  const double c21 = -p2 * d2;
  const double c22 = p2 * p2 * (h_nyquist - h2);
  const double alpha = (c22 * d1 - c12 * d2) / (c11 * c22 - c12 * c21);
  const double AA1 = (d1 - c11 * alpha) / c12;
  const double BB1 = h_nyquist * AA1;
  const double AA2 = (alpha - AA1) / 4.0;
  const double BB2 = (alpha - BB1) / 4.0;
  const double v = 0.5 * (1.0 + root(AA1));
  const double w = 0.5 * (1.0 + root(BB1));
  const double a0 = 0.5 * (v + root(v * v + AA2));
  const double beta0 = 0.5 * (w + root(w * w + BB2));
  FeqBiquadCoefficients k{};
  k.a1 = (1.0 - v) / a0;
  k.a2 = -AA2 / (4.0 * a0 * a0);
  k.b0 = beta0 / a0;
  k.b1 = (1.0 - w) / a0;
  k.b2 = -BB2 / (4.0 * beta0 * a0);
  if (!high) {
    k.b0 *= G;
    k.b1 *= G;
    k.b2 *= G;
  }
  return k;
}

}  // namespace

extern "C" {

FeqBiquadCoefficients feq_biquad_coefficients_matched(FeqFilterType type,
                                                      double frequency,
                                                      double gain_db,
                                                      double quality,
                                                      double sample_rate) {
  const FeqBiquadCoefficients cookbook = feq_biquad_coefficients(
      type, frequency, gain_db, quality, sample_rate);
  if (!(sample_rate > 0.0) || !(frequency > 0.0) || !(quality > 0.0)) {
    return cookbook;
  }
  // The same bound the cookbook keeps, for the same reason: a band at or
  // past Nyquist has no digital centre to match.
  const double safe = std::fmin(frequency, sample_rate * 0.499);
  const double w0 = 2.0 * kPi * safe / sample_rate;
  FeqBiquadCoefficients matched = cookbook;
  switch (type) {
    case FEQ_FILTER_PK:
      matched = bell(w0, gain_db, quality);
      break;
    case FEQ_FILTER_LPQ:
      matched = low_pass(w0, quality);
      break;
    case FEQ_FILTER_HPQ:
      matched = high_pass(w0, quality);
      break;
    case FEQ_FILTER_BP:
      matched = band_pass(w0, quality);
      break;
    case FEQ_FILTER_LSC:
    case FEQ_FILTER_HSC:
      if (std::fabs(quality - kButterworthQ) > kButterworthTolerance) {
        return cookbook;
      }
      if (gain_db == 0.0) {
        return identity();
      }
      // The shelf's own frequency, not the bell's bound: the design is
      // stated for a corner above Nyquist too. Twice the rate is past any
      // shelf a config means and keeps the fourth powers below finite.
      matched = shelf(type == FEQ_FILTER_HSC,
                      std::fmin(frequency, 2.0 * sample_rate) /
                          (sample_rate / 2.0),
                      gain_db);
      break;
    case FEQ_FILTER_NO:
      return cookbook;
  }
  // Stable and finite, or the cookbook: a matched design is an improvement
  // or nothing.
  const bool stable = std::fabs(matched.a2) < 1.0 &&
                      std::fabs(matched.a1) < 1.0 + matched.a2;
  return is_finite(matched) && stable ? matched : cookbook;
}

}  // extern "C"
