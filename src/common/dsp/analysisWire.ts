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

/**
 * The fixed header; its own fields say how much payload follows.
 *
 * 120 before Master loudness took it to 136, and 136 before Denoise appended
 * six words at 136 to 156. Every pre-existing offset is untouched on purpose:
 * this constant, the publisher in `meters.cpp` and the reader in
 * `dspHost/wire.ts` all have to move in one commit, and the guards on the
 * reader are `length < ANALYSIS_HEADER_BYTES` — a floor rather than an exact
 * check. A frame written against an older layout therefore does not fail here,
 * it reads whatever has moved into the old offset and hands the panel a
 * plausible number. New fields go after everything already decoded, always.
 */
export const ANALYSIS_HEADER_BYTES = 160;

/** The rack ceiling, matching FEQ_METER_MAX_BANDS. */
export const ANALYSIS_MAX_BANDS = 64;

/**
 * The taps, in the order their bits sit in `stage_mask`.
 *
 * Named exactly as `DSP_OUTPUT_INDEX` names them in the renderer, because these
 * strings are handed straight to `setDspAnalyser`. A rename on one side that did
 * not happen on the other would leave a graph silently unfed — no error, no
 * warning, just one panel that never moves.
 */
export const ANALYSIS_STAGES = [
  'exciter',
  'eq',
  'master',
  // Appended rather than placed in signal order. These are bit positions in
  // `stage_mask`, so inserting `denoise` at the front — where the stage
  // actually runs — would renumber the three taps a running host already
  // publishes and feed each graph its neighbour's spectrum.
  'denoise',
] as const;

export type TAnalysisStage = (typeof ANALYSIS_STAGES)[number];

export interface IHostAnalysis {
  sequence: number;
  /** Only the stages that published a window this frame. */
  spectra: Partial<Record<TAnalysisStage, Float32Array>>;
  /** Interleaved left, right. Absent when the scope had nothing new. */
  scatter?: Float32Array;
  correlation: number;
  peaks: readonly [number, number];
  /**
   * What each EQ band is applying, 0 to 1, and what it is hearing.
   *
   * Only dynamic bands ever report anything but 1 — a static band is always
   * fully applied, which is what makes it static. Measured rather than derived,
   * because what a dynamic band is doing depends on the material and the
   * settings cannot say.
   */
  bandAmounts: readonly number[];
  bandLevels: readonly number[];
  /** What the exciter three bands and its organic stage contributed. */
  exciterBands: readonly number[];
  exciterOrganic: number;
  /**
   * How hard the Maximizer is holding the signal down, in dB. Never positive.
   *
   * The one reading that stage cannot be set without: Drive, ceiling and
   * release only mean anything against how much reduction they are producing,
   * and all three shipped with no way to see any of it.
   */
  maximizerReductionDb: number;
  /**
   * How much widening Dimension is allowing, 1 wide open and 0 fully shut.
   *
   * The stage cannot be trusted without it. Scaling the side is safe
   * arithmetic, but on material whose channels already cancel, widening takes
   * away what a mono listener was going to hear — so the guard closes, and a
   * dial that has stopped doing what it says has to say so.
   */
  dimensionGuard: number;
  master: IHostAnalysisMaster;
  normalizer: IHostAnalysisNormalizer;
  loudness: IHostAnalysisLoudness;
  denoise: IHostAnalysisDenoise;
}

/**
 * How loud the output is, measured where it leaves.
 *
 * The Master page has always offered a loudness target and never had anything
 * to check it against: the only LUFS on screen was the number the user dialled.
 * That is how a makeup that applied exactly zero decibels to every commercially
 * mastered track shipped and stayed shipped — the meter that would have said so
 * did not exist.
 */
export interface IHostAnalysisLoudness {
  /** The last 400 ms, ungated. */
  momentaryLufs: number;
  /** The last 3 s, which is the one to watch while setting a target. */
  shortTermLufs: number;
  /** Gated, over the whole programme since the last track change. */
  integratedLufs: number;
  /**
   * The 95th percentile of short-term blocks minus the 10th, in LU.
   *
   * What says whether a target was reached by mastering or by flattening. Two
   * records at one integrated loudness and eight LU apart in range are not the
   * same master, and no other reading on the page can tell them apart.
   */
  rangeLu: number;
}

/**
 * What the four Denoise modules did, which their settings cannot say.
 *
 * None of this is derivable from the dials. How much a spectral subtractor
 * removed depends on the material; whether the click detector fired at all
 * depends on whether the file has clicks; and whether the neural module is
 * running at all depends on a download. A card showing only dial positions
 * would look identical in every one of those cases.
 */
export interface IHostAnalysisDenoise {
  /** Mean broadband attenuation over the window, dB. Never positive. */
  reductionDb: number;
  /** The floor the hiss module is currently working against, dBFS. */
  noiseFloorDb: number;
  /** Impulses repaired over the window. */
  clicksRepaired: number;
  /**
   * Blocks the neural worker failed to deliver in time over the window.
   *
   * Dry audio was passed through for each one. Reported rather than hidden
   * because the alternative to reporting it is a module that intermittently
   * stops working and never says so.
   */
  voiceUnderruns: number;
  /** Whether a scanned profile is loaded, as opposed to the adaptive tracker. */
  profileReady: boolean;
  /** Whether the neural model is loaded and its session built. */
  voiceModelLoaded: boolean;
}

/**
 * Everything the Master card prints, measured by the tail that produced it.
 *
 * Auto Headroom and the final guard are two separate limiters and the card
 * shows them separately, because they mean different things: the first is the
 * chain reserving room for gain still to come, the second is a fault boundary
 * that should read zero on every piece of music ever made.
 */
export interface IHostAnalysisMaster {
  /** Auto Headroom's deepest reduction over the window, dB. Never positive. */
  autoHeadroomReductionDb: number;
  /** What Auto Headroom saw arriving, dBTP, floored at -120. */
  autoHeadroomTruePeakDb: number;
  /** The guard's own deepest reduction, dB. Never positive. */
  safetyReductionDb: number;
  /** What the guard saw arriving, dBTP, floored at -120. */
  safetyTruePeakDb: number;
  /** The DC baseline the blocker removed, dBFS, floored at -120. */
  dcCorrectionDb: number;
  /** Non-finite samples repaired over the window. */
  repairedSamples: number;
  /** The oversampling the true-peak detectors ran at. */
  truePeakFactor: 1 | 2 | 4;
  /** Whether the guard is armed; development may bypass it. */
  safetyEnabled: boolean;
}

/** The Normalizer's before and after bars, and the gain between them. */
export interface IHostAnalysisNormalizer {
  /** Linear amplitude, peak with a 350 ms release, per channel. */
  inputPeaks: readonly [number, number];
  outputPeaks: readonly [number, number];
  appliedGainDb: number;
}
