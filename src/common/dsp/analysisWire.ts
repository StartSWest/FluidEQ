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
 * Bass Forge's band count, matching `FEQ_BASS_FORGE_BANDS`.
 *
 * Eight log-spaced band-pass followers between 20 Hz and 1 kHz, which is the
 * range the graph they feed is zoomed to. Not a free choice either: the two
 * runs are fixed-width fields in the analysis header, so this number is part
 * of `ANALYSIS_HEADER_BYTES`.
 */
export const ANALYSIS_BASS_FORGE_BANDS = 8;

/**
 * The fixed header; its own fields say how much payload follows.
 *
 * 120 before Master loudness took it to 136, and 136 before Denoise appended
 * six words — 160 rather than 156, because the frame is eight-byte aligned.
 * Denoise's forty floor bands then took it to 320. Then the two bass stages:
 * sixteen floats for Forge's eight bands in and out and three for Punch's
 * gains, which is 76 bytes onto 320 and lands on 396 — rounded to 400 by one
 * explicit pad float, for the same alignment reason.
 * Every pre-existing offset is untouched on purpose: this constant, the
 * publisher in `meters.cpp` and the reader in `dspHost/wire.ts` all have to
 * move in one commit, and new fields go after everything already decoded,
 * always.
 *
 * A frame written against a different layout does NOT get read as plausible
 * numbers. `decodeAnalysis` computes the whole length from the header's own
 * bin, pair, band and stage-mask fields and refuses anything that does not
 * match exactly, so drift on either side fails closed. This comment used to
 * say the opposite — that the reader's guards were only floors — and it was
 * believed: three separate readers of it set out to add a check that has been
 * there since the graphs were first fed from the engine.
 */
export const ANALYSIS_HEADER_BYTES = 400;

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
  bassForge: IHostAnalysisBassForge;
  bassPunch: IHostAnalysisBassPunch;
}

/**
 * The low band before Bass Forge and after it, eight bands of each.
 *
 * Two curves rather than one difference, because the card draws the generated
 * content as the AREA BETWEEN them and a single delta cannot say where the
 * energy appeared. The stage's two generators work in opposite directions —
 * `sub_amount` supplies an octave below what the record carries, and
 * `presence_amount` supplies the harmonics above it — so "6 dB of new bass"
 * describes two entirely different results depending on which band it landed
 * in, and the dials cannot tell them apart either.
 */
export interface IHostAnalysisBassForge {
  /** dBFS per band, 20 Hz to 1 kHz on a log grid, floored at -120. */
  inputDb: readonly number[];
  outputDb: readonly number[];
}

/**
 * What Bass Punch is applying, in dB of gain rather than level.
 *
 * The one claim the stage makes that its settings cannot show: the leading
 * edge and the tail are shaped independently, and over a complete note the
 * two envelope followers converge so the gain averages to unity. Watching all
 * three on a time strip is what distinguishes that from a tone control.
 *
 * At rest they are 0 dB, not the -120 the level meters rest at.
 */
export interface IHostAnalysisBassPunch {
  /** The attack section's gain: positive is harder, negative is softer. */
  transientGainDb: number;
  /** The tail's gain: positive is longer and wetter, negative is tighter. */
  sustainGainDb: number;
  /** What the band above the split is being pulled down by. Never positive. */
  duckGainDb: number;
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
  /**
   * The floor the stage is subtracting right now, per profile band.
   *
   * Not the profile it was handed: in Adaptive the two differ every frame, and
   * drawing the handed-over value would show a flat line while the tracker
   * moved underneath it. Same density units as `INoiseProfile.bandsDb`.
   */
  floorBandsDb: readonly number[];
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
