/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Worklet outputs are ordered exactly like the visible processing chain.
 * Output zero alone is audible; every other output terminates at an analyser.
 */
export const DSP_OUTPUT_INDEX = {
  master: 0,
  normalizer: 1,
  exciter: 2,
  eq: 3,
  compressor: 4,
  maximizer: 5,
} as const;

export type TDspAnalyserStage = keyof typeof DSP_OUTPUT_INDEX;

export const DSP_OUTPUT_COUNT = Object.keys(DSP_OUTPUT_INDEX).length;
