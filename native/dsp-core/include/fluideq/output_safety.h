/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The final, always-on guard, ported from `outputSafety.ts`.
 *
 * Three hertz removes DC and pathological subsonic drift without putting a
 * user-visible cutoff in the musical bass. The low-frequency cleanup runs
 * BEFORE the limiter deliberately, because any filter can create overshoot.
 *
 * NaN and infinity have undefined rendering behaviour and can poison an IIR's
 * history forever, so an invalid sample also clears that channel's DC state.
 * Every finite value stays floating-point all the way into the look-ahead
 * limiter: an intentionally hot chain must not be hard-clipped by a fault
 * boundary before Master Auto Headroom can turn the intact waveform down.
 */
#ifndef FLUIDEQ_OUTPUT_SAFETY_H
#define FLUIDEQ_OUTPUT_SAFETY_H

#include <stdint.h>

#include "fluideq/limiter.h"

#ifdef __cplusplus
extern "C" {
#endif

#define FEQ_SAFETY_CEILING_DB (-0.1)
#define FEQ_SAFETY_LOOK_AHEAD_MS 2.0
/**
 * How fast the guard hands the level back once the fault stops.
 *
 * This was an infinite release, so the coefficient was exactly one and the
 * release term `(required - gain) * (1 - 1)` was zero: the gain could move
 * down and never up. Peak-holding a guard armed at +10 dBTP means ONE
 * overdriven moment turns the output down for the rest of the session — an
 * exaggerated EQ band ducks it, setting the band back to flat does not bring
 * it back, and nothing says why, because the fault being guarded against is
 * over.
 *
 * One second is two and a half times the slowest release Master offers and far
 * slower than any musical event, so this still cannot behave as a loudness
 * processor, which is what the infinite release was protecting against. It
 * only runs below +10 dBTP, where nothing needs limiting anyway.
 *
 * Mirrors `OUTPUT_SAFETY_RELEASE_MS` in `outputSafety.ts` and must move with
 * it: the frozen parity corpus was generated from that side.
 */
#define FEQ_SAFETY_RELEASE_MS 1000.0
#define FEQ_SAFETY_DC_CUTOFF_HZ 3.0
#define FEQ_SAFETY_DC_METER_CUTOFF_HZ 0.1

typedef struct FeqDcBlock {
  double input;
  double output;
  /**
   * A much slower low-pass estimating only the baseline the blocker guards
   * against. The meter used to report `output - input`, which is the ordinary
   * phase response of a 3 Hz high-pass and therefore lit up on healthy music.
   */
  double estimate;
} FeqDcBlock;

typedef struct FeqOutputSafety {
  FeqDcBlock* dc;
  uint32_t channels;
  double dc_pole;
  double dc_gain;
  double dc_meter_pole;
  FeqLinkedLimiter limiter;
  uint32_t true_peak_factor;
  double ceiling;
  double release_coefficient;
  double minimum_limiter_gain;
  double input_true_peak;
  double dc_offset_peak;
  uint64_t repaired_samples;
} FeqOutputSafety;

typedef struct FeqOutputSafetyTelemetry {
  uint32_t true_peak_factor;
  double gain_reduction_db;
  double input_true_peak_db;
  double dc_correction_db;
  uint64_t repaired_samples;
} FeqOutputSafetyTelemetry;

typedef struct FeqOutputSafetyOptions {
  /** Master owns peak reduction; ordinary safeguards do not. */
  int limiter_enabled;
  double ceiling;
  double activation_threshold;
  double release_coefficient;
  double knee_db;
  double release_hold_samples;
} FeqOutputSafetyOptions;

/**
 * Built once; processing performs no allocations. Every buffer below is the
 * caller's and must outlive the state.
 */
void feq_output_safety_init(FeqOutputSafety* state,
                            FeqDcBlock* dc,
                            FeqTruePeak* detectors,
                            float** delay,
                            float* gain_reduction_db,
                            uint32_t channels,
                            uint32_t limiter_capacity,
                            double sample_rate);

/** The look-ahead the guard needs at this rate, in samples. */
uint32_t feq_output_safety_look_ahead(double sample_rate);

void feq_output_safety_process(FeqOutputSafety* state,
                               float* const* channels,
                               uint32_t frames,
                               const FeqOutputSafetyOptions* options);

/** Read one meter interval and clear it without touching audio histories. */
FeqOutputSafetyTelemetry feq_output_safety_take_telemetry(
    FeqOutputSafety* state);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_OUTPUT_SAFETY_H */
