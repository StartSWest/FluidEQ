/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Auto Headroom: the final true-peak boundary once LUFS maximize is on.
 *
 * Clean, linked headroom established after every creative filter and before
 * gain. The target already reserves any positive Master gain, so Output trim
 * at 0 dB is literal unity and positive trim cannot force the emergency guard
 * to reshape a hot waveform.
 *
 * It catches the peak, and that is the whole difference from what it was.
 * Look-ahead here was zero — one sample of delay — while the true-peak
 * detector describes the middle of its own window and so lags six. The stage
 * was five samples BEHIND every peak it answered to and could not attenuate
 * one. What it did instead was duck the programme at 5 dB/s, hold it down a
 * full second and release over another: one transient pulled the record down
 * for two seconds, which is the fluctuation heard on dense material, and the
 * slew in from unity at the start of a track was distortion until it arrived.
 * No cached measurement could help, because the stage learned by listening
 * rather than by looking ahead.
 *
 * The mechanism is now the Maximizer's, which is transparent: real look-ahead,
 * the reduction back-filled as a linear-in-dB ramp that reaches exactly what
 * the peak needs at the sample the peak lands on, a soft knee so the gain law
 * does not snap into limiting, and a hold measured in milliseconds rather than
 * in phrases. The delay is unconditional and matches the safety stage's, so
 * enabling and disabling this stage cannot change the chain's latency.
 */
#ifndef FLUIDEQ_POST_FILTER_NORMALIZER_H
#define FLUIDEQ_POST_FILTER_NORMALIZER_H

#include <stdint.h>

#include "fluideq/limiter.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * The same two milliseconds the safety stage already spends.
 *
 * It has to clear the true-peak detector's six samples of lag with enough left
 * over to be an attack ramp: 96 samples at 48 kHz leaves 90, which is the
 * ramp. Matching the safety stage keeps one number to reason about for the
 * whole Master tail.
 */
#define FEQ_AUTO_HEADROOM_LOOK_AHEAD_MS 2.0
/** Long enough that two peaks a phrase apart do not each get their own dip. */
#define FEQ_AUTO_HEADROOM_RELEASE_HOLD_MS 10.0
/**
 * Hard bound on the release, whatever a stored chain says.
 *
 * Nothing clamps `master.releaseMs` between the renderer and here, and a
 * release measured in seconds is what turned this stage into a level rider.
 */
#define FEQ_AUTO_HEADROOM_MAX_RELEASE_MS 400.0
#define FEQ_AUTO_HEADROOM_RELEASE_SNAP_RATIO 0.02
/**
 * The Maximizer's knee, for the reason the Maximizer has one.
 *
 * A peak arriving at the ceiling must not make the gain law step from unity to
 * reduction. The upper branch is still an exact ceiling; smoothness is never
 * bought with overshoot.
 */
#define FEQ_AUTO_HEADROOM_KNEE_DB 1.5
#define FEQ_AUTO_HEADROOM_BYPASS_RELEASE_MS 1000.0
#define FEQ_AUTO_HEADROOM_MARGIN_DB 0.2

/**
 * How long sustained reduction takes to reach the slow release, in ms.
 *
 * This stage went from catching the occasional transient to holding the
 * programme down for whole choruses the moment the loudness target was allowed
 * to ask for gain the track's peak room could not supply. One release time
 * cannot serve both: fast enough for an isolated peak not to duck the phrase
 * after it, and slow enough that a dense chorus does not have its level
 * modulated at the rate of its own snare. That modulation is what pumping IS.
 *
 * So the release stretches with how long reduction has already persisted. A
 * transient releases at the dialled time because the stage has not been down
 * long enough to stretch; a passage that has been under reduction for a third
 * of a second releases three times slower, and the level between its peaks
 * stops moving.
 */
#define FEQ_AUTO_HEADROOM_SUSTAIN_MS 300.0
/** What the release is multiplied by once reduction is fully sustained. */
#define FEQ_AUTO_HEADROOM_SUSTAIN_STRETCH 3.0
/** Below this much reduction the stage counts as not working. */
#define FEQ_AUTO_HEADROOM_SUSTAIN_THRESHOLD_DB 0.1

typedef struct FeqPostFilterNormalizer {
  FeqLinkedLimiter limiter;
  double minimum_gain;
  double input_true_peak;
  /**
   * How long the stage has been reducing, in samples, decaying when it is not.
   *
   * Per block rather than per sample deliberately: a block is about ten
   * milliseconds and the release times this scales are forty to four hundred,
   * so sampling the state once a block is well inside the quantity it
   * controls — and it keeps every per-sample path in `limiter.cpp` untouched.
   */
  double sustain_samples;
} FeqPostFilterNormalizer;

typedef struct FeqPostFilterNormalizerTelemetry {
  double gain_reduction_db;
  double input_true_peak_db;
} FeqPostFilterNormalizerTelemetry;

typedef struct FeqPostFilterNormalizerOptions {
  int enabled;
  double output_ceiling_db;
  /**
   * The gain still to come. Positive Master gain needs room reserved; negative
   * gain already creates real room and must be credited, or Auto Headroom
   * attenuates twice for the same decibel.
   */
  double following_gain_db;
  double release_ms;
  double sample_rate;
} FeqPostFilterNormalizerOptions;

/** The look-ahead this stage uses at a given rate, in samples. */
uint32_t feq_post_filter_normalizer_look_ahead(double sample_rate);

void feq_post_filter_normalizer_init(FeqPostFilterNormalizer* state,
                                     FeqTruePeak* detectors,
                                     float** delay,
                                     float* gain_reduction_db,
                                     uint32_t channels,
                                     uint32_t capacity,
                                     uint32_t true_peak_factor);

/**
 * Forget headroom learned before whole-track normalization arrived.
 *
 * The audio delay stays continuous, unlike a source-boundary reset, so a
 * background analysis result cannot manufacture a one-sample hole or a pop.
 */
void feq_post_filter_normalizer_rebase(FeqPostFilterNormalizer* state);

void feq_post_filter_normalizer_process(
    FeqPostFilterNormalizer* state,
    float* const* channels,
    uint32_t frames,
    const FeqPostFilterNormalizerOptions* options);

FeqPostFilterNormalizerTelemetry feq_post_filter_normalizer_take_telemetry(
    FeqPostFilterNormalizer* state);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_POST_FILTER_NORMALIZER_H */
