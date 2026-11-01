/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The two levels a loudness reading is judged against, shared by the meter
 * that measures a track (`renderer/dsp/loudnessAnalysis.ts`) and the gains
 * played from what it measured (`trackGains.ts`): a gate one side moved
 * alone would apply a gain to a track the other called silent.
 */

/** What a measurement reports for no signal at all. */
export const SILENCE_DB = -120;
/** BS.1770's absolute gate: nothing quieter counts towards the reading. */
export const ABSOLUTE_GATE_LUFS = -70;
