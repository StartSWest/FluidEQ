/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The passthrough worklet has one audible output and no monitor branches. */
export const DSP_OUTPUT_INDEX = {
  master: 0,
} as const;

/**
 * Native analysis stages, kept separate from the Web Audio output topology.
 *
 * These names used to double as seven worklet output slots. The rack behind
 * those slots is gone; keeping them allocated left six silent output buffers
 * and seven AnalyserNode FFT stores alive for the whole library session.
 */
export const DSP_ANALYSER_STAGES = [
  'master',
  'normalizer',
  'exciter',
  'eq',
  'compressor',
  'maximizer',
  'denoise',
] as const;

export type TDspAnalyserStage = (typeof DSP_ANALYSER_STAGES)[number];

export const DSP_OUTPUT_COUNT = 1;
