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
  /**
   * Out of chain order, and appended rather than inserted after `normalizer`
   * where the stage actually runs.
   *
   * These are worklet output slots, so renumbering them re-routes every
   * analyser that follows. The name has to exist here because
   * `ANALYSIS_STAGES` is handed straight to `setDspAnalyser` and the two
   * vocabularies are required to match; the slot itself is never written,
   * because Denoise exists only in the native engine and the worklet is a
   * passthrough that stands down. An analyser reading silence is the correct
   * picture of a stage that is not running.
   */
  denoise: 6,
} as const;

export type TDspAnalyserStage = keyof typeof DSP_OUTPUT_INDEX;

export const DSP_OUTPUT_COUNT = Object.keys(DSP_OUTPUT_INDEX).length;
