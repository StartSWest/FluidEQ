/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The three-band Exciter, ported from `exciterStage.ts`.
 *
 * Each band is extracted with a two-pole highpass and lowpass, driven through
 * the diode at the oversampled rate, DC-blocked, and summed back under the dry
 * programme. The bands may overlap, so the returns are normalised together
 * when they would otherwise add up to more than one full copy of the filtered
 * signal.
 *
 * High is not a louder copy of its source band: its return is high-passed at
 * the region centre so the generated orders pass and the source-frequency
 * carrier falls, and its linear foundation is restored afterwards from the
 * already-filtered source rather than through the resampler — sending it round
 * the FIR trip made the additive return comb-filter the mix.
 */
#ifndef FLUIDEQ_EXCITER_H
#define FLUIDEQ_EXCITER_H

#include <stdint.h>

#include "fluideq/analog_diode.h"
#include "fluideq/biquad.h"
#include "fluideq/exciter_guard.h"
#include "fluideq/oversample.h"

#ifdef __cplusplus
extern "C" {
#endif

#define FEQ_EXCITER_BANDS 3
#define FEQ_EXCITER_MAX_OVERSAMPLE 4

typedef struct FeqExciterBandSetup {
  int enabled;
  double freq_hz;
  double range;
  double drive;
  double mix;
  double texture;
} FeqExciterBandSetup;

typedef struct FeqExciterSettings {
  int enabled;
  int isolate;
  FeqExciterBandSetup bands[FEQ_EXCITER_BANDS];
} FeqExciterSettings;

typedef struct FeqExciterDc {
  double x;
  double y;
} FeqExciterDc;

typedef struct FeqExciterBandCache {
  double low_hz;
  double high_hz;
  double sample_rate;
  FeqBiquadCoefficients highpass;
  FeqBiquadCoefficients lowpass;
} FeqExciterBandCache;

typedef struct FeqExciterChannel {
  /** One two-pole highpass and lowpass per independently movable band. */
  FeqBiquadState band_filters[FEQ_EXCITER_BANDS][2];
  FeqExciterBandCache band_cache[FEQ_EXCITER_BANDS];
  float* bands[FEQ_EXCITER_BANDS];
  float* wet_return;
  FeqOversampler oversamplers[FEQ_EXCITER_BANDS];
  FeqExciterGuard high_guard;
  FeqBiquadState high_harmonic_filter;
  FeqBiquadCoefficients high_harmonic_coefficients;
  double high_harmonic_hz;
  double high_harmonic_sample_rate;
  float* wide;
  float* wide_dry;
  float* middle;
  double drive[FEQ_EXCITER_BANDS];
  double texture[FEQ_EXCITER_BANDS];
  double mix[FEQ_EXCITER_BANDS];
  FeqExciterTransient transients[FEQ_EXCITER_BANDS];
  /** Unity normally; smoothly reaches zero for the Isolate monitor. */
  double dry_mix;
  FeqExciterDc dc[FEQ_EXCITER_BANDS];
  float* dry;
} FeqExciterChannel;

/**
 * All buffers are the caller's.
 *
 * `bands` are three arrays of `frames`; `wet_return`, `dry` and
 * `guard_scratch` are `frames`; `wide` and `wide_dry` are
 * `frames * FEQ_EXCITER_MAX_OVERSAMPLE`; `middle` is `frames * 2`.
 */
void feq_exciter_channel_init(FeqExciterChannel* state,
                              float* band0,
                              float* band1,
                              float* band2,
                              float* wet_return,
                              float* wide,
                              float* wide_dry,
                              float* middle,
                              float* dry,
                              float* guard_scratch);

/** True while any return or the dry mix is still gliding toward its target. */
int feq_exciter_channel_is_active(const FeqExciterChannel* state);

/**
 * Process one channel in place. `report_bands` receives each band's mean
 * applied mix over the block, for the meter.
 */
void feq_exciter_channel_process(FeqExciterChannel* state,
                                 float* target,
                                 uint32_t frames,
                                 const FeqExciterSettings* settings,
                                 double sample_rate,
                                 double* report_bands);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_EXCITER_H */
