/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The small pieces the processors are built from: a delay line, a summing
 * crossover, and a true-peak detector.
 *
 * Ported from `delayLine.ts`, `crossover.ts` and `truePeak.ts` — the crossover
 * no longer matches its origin, on purpose, and says below what it traded and
 * why. Grouped into one header because none of them is more than a page and
 * each is used by several processors; splitting them would mean four includes
 * to run a limiter.
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
 * Three bands that stay in step, so gaining one cannot cancel its neighbour.
 *
 * This used to derive the upper bands by subtraction — low was a lowpass, mid
 * was a second lowpass minus it, high was the input minus that — which sums
 * back to the input exactly and is worthless the moment the bands are treated
 * differently, which is the only reason to split a signal at all. A
 * Linkwitz-Riley lowpass is -0.5 at its own corner, so at the first corner the
 * two bands carry -0.5 and +1.5 of the signal: equal gains recombine to 1, and
 * unequal ones subtract. A compressor holding its mid band 12 dB down measured
 * -10 to -14 dB at 120-250 Hz on the Gaming profile, -8.5 on Late night, -4.2
 * on Podcast — a hole where the bands meet, blamed on the compressor being
 * heavy-handed, and the reason compression here could only ever be used at
 * settings that did almost nothing. `bass_split_test.cpp` records the same
 * defect found in the bass stages, which is where the -0.5 first cost a kick.
 *
 * So both corners are real Linkwitz-Riley pairs now: the lowpass and highpass
 * of an LR4 pair carry IDENTICAL phase, and the low band is put through the
 * second corner's all-pass so that it keeps up with the two bands derived
 * above it. All three then share one phase at every frequency, which is the
 * property that matters: the response of any set of band gains is a smooth
 * interpolation between those gains, never outside them. `crossover_test.cpp`
 * holds that, and holds it against the gains that produced the hole.
 *
 * What it costs is that the bands no longer sum to the input sample for
 * sample: they sum to it through an all-pass, flat at every frequency with its
 * phase turned. A stage that has to stay aligned with a signal this split is
 * not applied to — Dimension keeps the mid out of it — runs that same turn
 * with `FeqCrossoverPhase` below.
 */
typedef struct FeqCrossover {
  /** Two cascaded Butterworth stages make one Linkwitz-Riley 4th order. */
  FeqBiquadState low_stages[2];
  FeqBiquadState upper_stages[2];
  FeqBiquadState mid_stages[2];
  FeqBiquadState high_stages[2];
  /**
   * The upper corner's all-pass, on the low band alone.
   *
   * Without it the low band arrives with a phase the other two do not have,
   * and the sum dips where the first corner's bands overlap. One section: the
   * sum of an LR4 pair is a second-order all-pass, which is exactly the phase
   * the bands above the low one are carrying.
   */
  FeqBiquadState low_align;
} FeqCrossover;

/** The phase the split turns, for a signal that is not being split. */
typedef struct FeqCrossoverPhase {
  FeqBiquadState stages[2];
} FeqCrossoverPhase;

/**
 * How long a stage takes to bring a split in, and to take it out.
 *
 * The turn above is inaudible while it is running and a discontinuity at the
 * instant it starts: the first sample out of an empty split is 0.55 of the
 * sample that went in, which beside a stage that was passing the signal
 * through is a click. Ordinary use does this constantly — every preset that
 * has a compressor replacing one that has none — so each stage that owns a
 * split crossfades its own output against its input over this long. Short
 * enough that nobody hears a fade, long enough that no edge is left.
 */
#define FEQ_SPLIT_FADE_MS 12.0

/** That fade's step per sample, which every stage doing it shares. */
double feq_split_fade_step(double sample_rate);

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

void feq_crossover_phase_reset(FeqCrossoverPhase* state);

/**
 * Turn `samples` by exactly what splitting them and summing the bands would.
 *
 * In place, and the corners have to be the ones the split was given, or the
 * two signals part company at them.
 */
void feq_crossover_phase_process(FeqCrossoverPhase* state,
                                 float* samples,
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
