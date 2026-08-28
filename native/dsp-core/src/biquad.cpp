/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The cookbook, transcribed rather than reinterpreted.
 *
 * Every expression below is in the same order and the same grouping as
 * `src/renderer/dsp/biquad.ts`. Floating-point addition is not associative, so
 * rewriting `a + b - c` as `a - c + b` — which reads identically and is
 * algebraically identical — moves the last bits of the result and puts this
 * port outside the parity tolerance on the very cases that matter, the high-Q
 * ones. The shape of the arithmetic is part of the specification here.
 */

#include "fluideq/biquad.h"

#include <cmath>

extern "C" {

FeqBiquadCoefficients feq_biquad_coefficients(FeqFilterType type,
                                              double frequency,
                                              double gain_db,
                                              double quality,
                                              double sample_rate) {
  const double amplitude = std::pow(10.0, gain_db / 40.0);
  const double omega = (2.0 * 3.14159265358979323846 * frequency) / sample_rate;
  const double cosine = std::cos(omega);
  const double sine = std::sin(omega);
  const double alpha = sine / (2.0 * quality);

  double b0 = 1.0;
  double b1 = 0.0;
  double b2 = 0.0;
  double a0 = 1.0;
  double a1 = 0.0;
  double a2 = 0.0;

  switch (type) {
    case FEQ_FILTER_PK:
      b0 = 1.0 + alpha * amplitude;
      b1 = -2.0 * cosine;
      b2 = 1.0 - alpha * amplitude;
      a0 = 1.0 + alpha / amplitude;
      a1 = -2.0 * cosine;
      a2 = 1.0 - alpha / amplitude;
      break;

    case FEQ_FILTER_NO:
      b0 = 1.0;
      b1 = -2.0 * cosine;
      b2 = 1.0;
      a0 = 1.0 + alpha;
      a1 = -2.0 * cosine;
      a2 = 1.0 - alpha;
      break;

    case FEQ_FILTER_LPQ:
      b0 = (1.0 - cosine) / 2.0;
      b1 = 1.0 - cosine;
      b2 = (1.0 - cosine) / 2.0;
      a0 = 1.0 + alpha;
      a1 = -2.0 * cosine;
      a2 = 1.0 - alpha;
      break;

    case FEQ_FILTER_HPQ:
      b0 = (1.0 + cosine) / 2.0;
      b1 = -(1.0 + cosine);
      b2 = (1.0 + cosine) / 2.0;
      a0 = 1.0 + alpha;
      a1 = -2.0 * cosine;
      a2 = 1.0 - alpha;
      break;

    case FEQ_FILTER_BP:
      b0 = alpha;
      b1 = 0.0;
      b2 = -alpha;
      a0 = 1.0 + alpha;
      a1 = -2.0 * cosine;
      a2 = 1.0 - alpha;
      break;

    case FEQ_FILTER_LSC:
    case FEQ_FILTER_HSC:
    default: {
      // Shelves take their own alpha: the cookbook's shelf slope parameter,
      // with S = 1 giving the steepest slope that stays monotonic.
      const double beta = 2.0 * std::sqrt(amplitude) * alpha;
      if (type == FEQ_FILTER_LSC) {
        b0 = amplitude * (amplitude + 1.0 - (amplitude - 1.0) * cosine + beta);
        b1 = 2.0 * amplitude * (amplitude - 1.0 - (amplitude + 1.0) * cosine);
        b2 = amplitude * (amplitude + 1.0 - (amplitude - 1.0) * cosine - beta);
        a0 = amplitude + 1.0 + (amplitude - 1.0) * cosine + beta;
        a1 = -2.0 * (amplitude - 1.0 + (amplitude + 1.0) * cosine);
        a2 = amplitude + 1.0 + (amplitude - 1.0) * cosine - beta;
      } else {
        b0 = amplitude * (amplitude + 1.0 + (amplitude - 1.0) * cosine + beta);
        b1 = -2.0 * amplitude * (amplitude - 1.0 + (amplitude + 1.0) * cosine);
        b2 = amplitude * (amplitude + 1.0 + (amplitude - 1.0) * cosine - beta);
        a0 = amplitude + 1.0 - (amplitude - 1.0) * cosine + beta;
        a1 = 2.0 * (amplitude - 1.0 - (amplitude + 1.0) * cosine);
        a2 = amplitude + 1.0 - (amplitude - 1.0) * cosine - beta;
      }
      break;
    }
  }

  FeqBiquadCoefficients out;
  out.b0 = b0 / a0;
  out.b1 = b1 / a0;
  out.b2 = b2 / a0;
  out.a1 = a1 / a0;
  out.a2 = a2 / a0;
  return out;
}

FeqBiquadCoefficients feq_biquad_coefficients_modelled(FeqFilterType type,
                                                       double frequency,
                                                       double gain_db,
                                                       double quality,
                                                       double sample_rate,
                                                       FeqEqModel model,
                                                       double amount) {
  /**
   * Nothing to model when there is no gain to shape.
   *
   * Every design collapses to the same filter at zero gain, and a notch has no
   * gain to correct in the first place — the types listed here are the ones
   * whose gain term is unused.
   */
  const bool no_gain = type == FEQ_FILTER_BP || type == FEQ_FILTER_LPQ ||
                       type == FEQ_FILTER_HPQ || type == FEQ_FILTER_NO;
  if (model == FEQ_EQ_MODEL_CLEAN || amount <= 0.0 || gain_db == 0.0 ||
      no_gain) {
    return feq_biquad_coefficients(type, frequency, gain_db, quality,
                                   sample_rate);
  }

  if (model == FEQ_EQ_MODEL_PROPORTIONAL) {
    const double narrowed =
        quality * (1.0 + (std::fabs(gain_db) / 24.0) * 1.6 * amount);
    return feq_biquad_coefficients(type, frequency, gain_db,
                                   narrowed < 18.0 ? narrowed : 18.0,
                                   sample_rate);
  }

  const bool is_shelf = type == FEQ_FILTER_LSC || type == FEQ_FILTER_HSC;
  const double full = is_shelf ? 0.4 : 0.45;
  const double broadened = quality * (1.0 - amount * (1.0 - full));
  return feq_biquad_coefficients(type, frequency, gain_db,
                                 broadened > 0.25 ? broadened : 0.25,
                                 sample_rate);
}

void feq_biquad_reset(FeqBiquadState* state) {
  if (state == nullptr) {
    return;
  }
  state->x1 = 0.0;
  state->x2 = 0.0;
  state->y1 = 0.0;
  state->y2 = 0.0;
}

void feq_biquad_process(FeqBiquadState* state,
                        float* buffer,
                        uint32_t frames,
                        const FeqBiquadCoefficients* coefficients) {
  if (state == nullptr || buffer == nullptr || coefficients == nullptr) {
    return;
  }
  const double b0 = coefficients->b0;
  const double b1 = coefficients->b1;
  const double b2 = coefficients->b2;
  const double a1 = coefficients->a1;
  const double a2 = coefficients->a2;
  double x1 = state->x1;
  double x2 = state->x2;
  double y1 = state->y1;
  double y2 = state->y2;

  for (uint32_t at = 0; at < frames; ++at) {
    const double x = static_cast<double>(buffer[at]);
    const double y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    // Unrounded, matching the reference. The buffer below takes the float.
    y1 = y;
    buffer[at] = static_cast<float>(y);
  }

  state->x1 = x1;
  state->x2 = x2;
  state->y1 = y1;
  state->y2 = y2;
}

}  // extern "C"
