/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The shape of what the native engine reports about its own output.
 *
 * In `src/common` rather than beside the rest of the host wire code, and that
 * is not filing. Both halves of the app need these: main decodes the frames off
 * the pipe, and the renderer registers the spectra into the panel's analysers.
 * A renderer that reached into `src/main` for them would pull Node built-ins
 * and Electron itself into the renderer bundle, and `pnpm build:renderer` fails
 * on it — which is why there is a lint rule that says so, and why it fired the
 * first time this was written the short way.
 *
 * The decoding stays in `src/main/dspHost/wire.ts`, because it works in
 * `Buffer` and only main ever sees bytes. What crosses is the agreement about
 * what those bytes mean.
 */

/**
 * Bins per stage, matching `FEQ_METER_BINS` and, before it,
 * `analyser.frequencyBinCount` on the `AnalyserNode` this replaces.
 *
 * The graphs were drawn and tuned against that node, so this is not a free
 * choice: a different count is every display in the panel changing shape on the
 * day the engine changed, which reads as a regression rather than a port.
 */
export const ANALYSIS_BINS = 1024;

/** Sample pairs per scope window, matching `FEQ_METER_SCOPE_PAIRS`. */
export const ANALYSIS_SCOPE_PAIRS = 256;

/** The fixed header; its own fields say how much payload follows. */
export const ANALYSIS_HEADER_BYTES = 40;

/**
 * The taps, in the order their bits sit in `stage_mask`.
 *
 * Named exactly as `DSP_OUTPUT_INDEX` names them in the renderer, because these
 * strings are handed straight to `setDspAnalyser`. A rename on one side that did
 * not happen on the other would leave a graph silently unfed — no error, no
 * warning, just one panel that never moves.
 */
export const ANALYSIS_STAGES = ['exciter', 'eq', 'master'] as const;

export type TAnalysisStage = (typeof ANALYSIS_STAGES)[number];

export interface IHostAnalysis {
  sequence: number;
  /** Only the stages that published a window this frame. */
  spectra: Partial<Record<TAnalysisStage, Float32Array>>;
  /** Interleaved left, right. Absent when the scope had nothing new. */
  scatter?: Float32Array;
  correlation: number;
  peaks: readonly [number, number];
}
