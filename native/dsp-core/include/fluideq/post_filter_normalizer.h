/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Auto Headroom, ported from `postFilterNormalizer.ts`.
 *
 * Clean, linked headroom established after every creative filter and before
 * gain. The target already reserves any positive Master gain, so Output trim
 * at 0 dB is literal unity and positive trim cannot force the emergency guard
 * to reshape a hot waveform.
 *
 * The detector sees a new peak immediately, but the gain moves at a bounded
 * dB-per-second rate and adds no playback delay. Recovery holds through one
 * phrase and then follows the selected release; a bounded time constant plus
 * an inaudible final snap is what guarantees even a 26 dB correction reaches
 * its new target within four seconds instead of leaving the chain pinned at
 * the bottom after the signal changes.
 */
#ifndef FLUIDEQ_POST_FILTER_NORMALIZER_H
#define FLUIDEQ_POST_FILTER_NORMALIZER_H

#include <stdint.h>

#include "fluideq/limiter.h"

#ifdef __cplusplus
extern "C" {
#endif

#define FEQ_AUTO_HEADROOM_LOOK_AHEAD_MS 0.0
#define FEQ_AUTO_HEADROOM_RELEASE_HOLD_MS 1000.0
#define FEQ_AUTO_HEADROOM_MAX_RECOVERY_MS 4000.0
#define FEQ_AUTO_HEADROOM_RELEASE_SNAP_RATIO 0.02
#define FEQ_AUTO_HEADROOM_ATTACK_DB_PER_SECOND 5.0
#define FEQ_AUTO_HEADROOM_BYPASS_RELEASE_MS 1000.0
#define FEQ_AUTO_HEADROOM_MARGIN_DB 0.2

typedef struct FeqPostFilterNormalizer {
  FeqLinkedLimiter limiter;
  double minimum_gain;
  double input_true_peak;
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
