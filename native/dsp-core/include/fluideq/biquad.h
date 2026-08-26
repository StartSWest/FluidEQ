/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One biquad section, ported from `src/renderer/dsp/biquad.ts`.
 *
 * RBJ's cookbook, deliberately the same source Equalizer APO uses, so a curve
 * dialled in the app and a curve written into an APO config are the same
 * curve. A "better" formula that disagreed with the other half of the app
 * would be worse.
 */
#ifndef FLUIDEQ_BIQUAD_H
#define FLUIDEQ_BIQUAD_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * The order is the protocol's, not the app enum's.
 *
 * It matches `EQ_BAND_TYPES` in `nativeParameters.ts`, which is append-only:
 * the wire carries an index into that list, so reordering here would re-point
 * every band a running host is holding.
 */
typedef enum FeqFilterType {
  FEQ_FILTER_PK = 0,
  FEQ_FILTER_NO = 1,
  FEQ_FILTER_LSC = 2,
  FEQ_FILTER_HSC = 3,
  FEQ_FILTER_LPQ = 4,
  FEQ_FILTER_HPQ = 5,
  FEQ_FILTER_BP = 6
} FeqFilterType;

typedef struct FeqBiquadCoefficients {
  double b0;
  double b1;
  double b2;
  double a1;
  double a2;
} FeqBiquadCoefficients;

/**
 * Direct Form I, and the state is double.
 *
 * Form II accumulates into a single node whose value can far exceed both the
 * input and the output, and a high-Q filter low down — a 30 Hz bell at Q 8 —
 * is exactly where that node blows up at 32-bit float. Form I stores inputs
 * and outputs separately, so nothing in the state ever exceeds the signal.
 *
 * `y1`/`y2` hold the unrounded result while the buffer receives the rounded
 * float. That asymmetry is not an oversight — it is what the TypeScript
 * reference does, and rounding the state as well would put this port a few
 * ULPs off it on every sample and compound down the block.
 */
typedef struct FeqBiquadState {
  double x1;
  double x2;
  double y1;
  double y2;
} FeqBiquadState;

/**
 * The EQ's character models, which reshape a band's Q rather than its curve.
 *
 * Matches `EQ_MODELS` in `chain.ts`. `clean` is the cookbook untouched;
 * `proportional` narrows a band as it is driven, the way an active console EQ
 * does; `wide` broadens it so neighbours blend into a tilt, the way a passive
 * tone stack does. Shelves get `wide` harder than bells on purpose — a shallow
 * shelf is most of what makes that style sound like itself.
 */
typedef enum FeqEqModel {
  FEQ_EQ_MODEL_CLEAN = 0,
  FEQ_EQ_MODEL_PROPORTIONAL = 1,
  FEQ_EQ_MODEL_WIDE = 2
} FeqEqModel;

/** The cookbook, with no character model applied. */
FeqBiquadCoefficients feq_biquad_coefficients(FeqFilterType type,
                                              double frequency,
                                              double gain_db,
                                              double quality,
                                              double sample_rate);

/**
 * With a character model. `amount` of zero collapses every model to the
 * cookbook, so the dial reaches it at zero rather than at an arbitrary middle.
 */
FeqBiquadCoefficients feq_biquad_coefficients_modelled(FeqFilterType type,
                                                       double frequency,
                                                       double gain_db,
                                                       double quality,
                                                       double sample_rate,
                                                       FeqEqModel model,
                                                       double amount);

void feq_biquad_reset(FeqBiquadState* state);

/** In place, over a planar channel. Real-time safe: arithmetic only. */
void feq_biquad_process(FeqBiquadState* state,
                        float* buffer,
                        uint32_t frames,
                        const FeqBiquadCoefficients* coefficients);

#ifdef __cplusplus
}
#endif

#endif /* FLUIDEQ_BIQUAD_H */
