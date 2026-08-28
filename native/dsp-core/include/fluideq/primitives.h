/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The small pieces the processors are built from: a delay line, a summing
 * crossover, and a true-peak detector.
 *
 * Ported from `delayLine.ts`, `crossover.ts` and `truePeak.ts`. Grouped into
 * one header because none of them is more than a page and each is used by
 * several processors; splitting them would mean four includes to run a
 * limiter.
 */
#ifndef FLUIDEQ_PRIMITIVES_H
#define FLUIDEQ_PRIMITIVES_H

#include <stdint.h>

#include "fluideq/biquad.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ---------------------------------------------------------------- delay -- */

/**
 * A fixed delay, for the dry path beside a filter that has latency.
 *
 * The buffer holds N+1 slots for N samples of delay: the N being held, plus
 * the one arriving. At exactly N the read and write land on the same slot,
 * which is the right answer for a delay of zero and is never reached above it.
 */
typedef struct FeqDelayLine {
  float* buffer;
  uint32_t capacity;
  uint32_t cursor;
  uint32_t delay;
} FeqDelayLine;

/** `buffer` must hold at least `delay + 1` floats and is owned by the caller. */
void feq_delay_line_init(FeqDelayLine* state,
                         float* buffer,
                         uint32_t capacity,
                         uint32_t delay);

void feq_delay_line_process(FeqDelayLine* state,
                            float* samples,
                            uint32_t frames);

/* ----------------------------------------------------------- crossover -- */

/**
 * Three bands that sum back to the input exactly.
 *
 * Only the two lowpasses are filters; the bands above them are subtractions. A
 * pair of independent lowpass and highpass filters would each contribute their
 * own phase shift and their sum dips at the corner — a notch of a decibel or
 * so that nobody reports as a bug, because it does not sound like a defect. It
 * sounds like the music being thin, which gets blamed on the compressor after
 * it.
 *
 * Subtraction cannot dip: each band is the whole minus the rest. The trade is
 * that the bands are not individually flat — the mid carries the phase
 * difference of two filters — and for a compressor that is the right trade.
 * What matters is that untouched bands recombine to silence against the
 * original.
 */
typedef struct FeqCrossover {
  /** Two cascaded Butterworth stages make one Linkwitz-Riley 4th order. */
  FeqBiquadState low_stages[2];
  FeqBiquadState mid_stages[2];
} FeqCrossover;

void feq_crossover_reset(FeqCrossover* state);

void feq_crossover_split(FeqCrossover* state,
                         const float* input,
                         float* low,
                         float* mid,
                         float* high,
                         uint32_t frames,
                         double low_corner_hz,
                         double high_corner_hz,
                         double sample_rate);

/* ---------------------------------------------------------- true peak -- */

/** ITU-R BS.1770's factor, and what every meter calling itself true peak uses. */
#define FEQ_TRUE_PEAK_FACTOR 4

/** Taps per polyphase branch. Twelve puts the estimate within ~0.1 dB. */
#define FEQ_TRUE_PEAK_TAPS 12

/** Half the filter's span, in input samples: the delay it introduces. */
#define FEQ_TRUE_PEAK_LATENCY (FEQ_TRUE_PEAK_TAPS / 2)

typedef struct FeqTruePeak {
  /** Session-aware density: 4x, 2x, or plain sample peak at 1x. */
  uint32_t factor;
  double history[FEQ_TRUE_PEAK_TAPS];
  int position;
} FeqTruePeak;

void feq_true_peak_init(FeqTruePeak* state, uint32_t factor);

/**
 * Advance by one sample and report the largest magnitude around it.
 *
 * Per-sample, because a limiter needs a magnitude per sample to feed its
 * sliding-window maximum — a peak per block would say a whole block is loud
 * when one sample is.
 *
 * The value lags its input by `FEQ_TRUE_PEAK_LATENCY`: it describes the middle
 * of the filter's window, not its newest end. That is deliberate and harmless
 * for a limiter whose look-ahead is hundreds of samples.
 */
double feq_true_peak_sample(FeqTruePeak* state, double sample);

/** The largest magnitude over a block, samples and the gaps between them. */
double feq_true_peak_block(FeqTruePeak* state,
                           const float* input,
                           uint32_t frames);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_PRIMITIVES_H */
