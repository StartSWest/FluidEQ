/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The three-band Exciter, ported from `exciterStage.ts`.
 *
 * Each band is extracted with a two-pole highpass and lowpass, run through the
 * harmonic generator at the oversampled rate, DC-blocked, held to its own
 * region by a residue filter, and summed back under the dry programme with a
 * quiet foundation. The bands may overlap, so the returns are normalised
 * together when they would otherwise add up to more than one full copy of the
 * filtered signal.
 *
 * No band is a louder copy of its own source. Every return carries harmonics
 * plus 18% of the band, and the harmonics come back at a ratio that does not
 * follow the input level — see `harmonics.h` for the measurements that made
 * that the design.
 *
 * The foundation is restored at the base rate from the already-filtered source
 * rather than through the resampler: sending it round the FIR trip made this
 * additive return comb-filter the mix.
 */
#ifndef FLUIDEQ_EXCITER_H
#define FLUIDEQ_EXCITER_H

#include <stdint.h>

#include "fluideq/analog_diode.h"
#include "fluideq/biquad.h"
#include "fluideq/exciter_guard.h"
#include "fluideq/harmonics.h"
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
  /** Where this band's own harmonics are allowed to reach. */
  FeqBiquadCoefficients residue;
} FeqExciterBandCache;

typedef struct FeqExciterChannel {
  /** One two-pole highpass and lowpass per independently movable band. */
  FeqBiquadState band_filters[FEQ_EXCITER_BANDS][2];
  FeqExciterBandCache band_cache[FEQ_EXCITER_BANDS];
  float* bands[FEQ_EXCITER_BANDS];
  float* wet_return;
  FeqOversampler oversamplers[FEQ_EXCITER_BANDS];
  FeqExciterGuard high_guard;
  float* wide;
  float* wide_dry;
  float* middle;
  double drive[FEQ_EXCITER_BANDS];
  double texture[FEQ_EXCITER_BANDS];
  double mix[FEQ_EXCITER_BANDS];
  FeqExciterTransient transients[FEQ_EXCITER_BANDS];
  FeqHarmonicState harmonics[FEQ_EXCITER_BANDS];
  FeqBiquadState residue_filters[FEQ_EXCITER_BANDS];
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
