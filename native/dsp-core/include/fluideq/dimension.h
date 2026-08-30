/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Stereo width that survives being summed to mono.
 *
 * The three usual ways to widen a finished mix all make it worse, and they are
 * what most processors calling themselves 3D actually do:
 *
 *  - A Haas delay on one channel. It images beautifully in headphones and comb
 *    filters the moment anything sums the two channels — phones, laptop
 *    speakers, Bluetooth, a club PA. The damage is invisible until it is
 *    somebody else's playback.
 *  - Raising the sides. That does not widen the picture so much as push the
 *    centre back, and the centre is the vocal.
 *  - A reverb tail across the master, which trades punch for wash.
 *
 * The whole design here follows from one fact: mid/side is exact, and mono
 * fold-down is the MID. So a stage that only ever touches the side signal
 * cannot change what a mono listener hears — not approximately, exactly. That
 * is why the crossover splits the SIDE only and the mid is passed through
 * untouched rather than filtered and reassembled: the centre keeps its phase,
 * and `(L+R)/2` comes out the way it went in whatever the dials are set to.
 * The test for that is an equality, not a tolerance.
 *
 * Width alone still only scales what the mix already had, so the side also gets
 * an all-pass network. That decorrelates it from the mid — the image widens
 * because the sides stop being a louder copy of the middle — and being confined
 * to the side, it keeps the mono guarantee above.
 *
 * The guard is the last piece. Scaling the side is safe arithmetic, but on
 * material that is ALREADY out of phase it widens a problem: what the stereo
 * listener gains, the mono listener loses. So the correlation is measured and
 * the widening is pulled back toward unity as it falls. Narrowing is never
 * guarded, because narrowing can only improve mono.
 */
#ifndef FLUIDEQ_DIMENSION_H
#define FLUIDEQ_DIMENSION_H

#include <stdint.h>

#include "fluideq/primitives.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Three all-passes, at mutually prime delays.
 *
 * One is a comb filter wearing a different name: its phase rotation repeats and
 * the repetition is audible as a pitched ring. Three whose delays share no
 * factor spread that out into something heard as space instead.
 */
#define FEQ_DIMENSION_ALLPASSES 3

typedef struct FeqDimensionAllPass {
  /** Caller-owned, at least `feq_dimension_allpass_capacity` long. */
  float* buffer;
  uint32_t capacity;
  uint32_t delay;
  uint32_t cursor;
  double gain;
} FeqDimensionAllPass;

typedef struct FeqDimensionSettings {
  int enabled;
  /**
   * Bass width, 0 to 1 — it cannot go above unity, and that is deliberate.
   *
   * Low frequencies carry most of the energy and none of the localisation: the
   * ear cannot place them, so width down there buys no image and costs headroom
   * and mono compatibility. Every mastering chain that has this control has it
   * as a narrowing one.
   */
  double low_width;
  double mid_width;
  double high_width;
  double low_hz;
  double high_hz;
  /** How much of the side is replaced by its decorrelated self, 0 to 1. */
  double decorrelation;
} FeqDimensionSettings;

typedef struct FeqDimension {
  /** Splits the SIDE only. The mid is never filtered. */
  FeqCrossover side_crossover;
  FeqDimensionAllPass allpasses[FEQ_DIMENSION_ALLPASSES];
  /** Each `frames` long, all caller-owned. */
  float* side;
  float* low;
  float* mid_band;
  float* high;
  double low_width;
  double mid_width;
  double high_width;
  double decorrelation;
  /** Smoothed inter-channel correlation, and the guard it produces. */
  double correlation;
  double guard;
  double sample_rate;
} FeqDimension;

/** Longest all-pass delay in samples at this rate, which sizes every buffer. */
uint32_t feq_dimension_allpass_capacity(double sample_rate);

void feq_dimension_init(FeqDimension* state,
                        float* side,
                        float* low,
                        float* mid_band,
                        float* high,
                        float* const* allpass_buffers,
                        uint32_t allpass_capacity);

void feq_dimension_reset(FeqDimension* state);

/**
 * Widen in place. `left` and `right` are one block of a stereo pair.
 *
 * A mono chain must not call this: there is no side signal to work on and the
 * stage has nothing to do.
 */
void feq_dimension_process(FeqDimension* state,
                           float* left,
                           float* right,
                           uint32_t frames,
                           const FeqDimensionSettings* settings,
                           double sample_rate);

/** How much widening the guard is allowing, 0 to 1. **Control thread.** */
double feq_dimension_guard(const FeqDimension* state);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_DIMENSION_H */
