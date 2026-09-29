/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ANALYSIS_BASS_FORGE_BANDS,
  IHostAnalysisLoudness,
} from '../../common/dsp/analysisWire';

// What the rack measured last: correlation, peaks, each stage's activity,
// loudness, the Dimension guard, Bass Forge and Punch, the band levels and
// the scatter. Kept as plain values rather than subscribed state: the
// displays read them on their own frames. store.ts re-exports all of it.

/**
 * Phase correlation of what leaves the chain, reported by the worklet.
 *
 * A plain module value read inside the meter's own animation frame, for the
 * same reason the analyser is: it arrives about twenty-three times a second and
 * routing it through React state would be that many renders for something that
 * paints itself.
 *
 * +1 is identical channels, 0 unrelated, negative is content that will partly
 * cancel the moment anything sums to mono. Starts at 1 because silence has no
 * correlation to report and 0 would read as a warning about nothing.
 */
let correlation = 1;

export const setDspCorrelation = (next: number): void => {
  if (Number.isFinite(next)) {
    correlation = Math.max(-1, Math.min(1, next));
  }
};

export const readDspCorrelation = (): number => correlation;

/**
 * Largest sample leaving the chain since the last report, full scale = 1.
 *
 * Above 1 the output is clipping, and that is the one form of distortion the
 * curve itself causes: a boost the graph draws happily is still broken once the
 * sum runs out of headroom. Measured rather than predicted, because what clips
 * depends on the material as much as on the settings.
 */
let peak = 0;

export const setDspPeak = (next: number): void => {
  if (Number.isFinite(next) && next >= 0) {
    peak = next;
  }
};

export const readDspPeak = (): number => peak;

/** Per-channel version of `readDspPeak`, used by the independent output meter. */
let channelPeaks: readonly number[] = [0, 0];

export const setDspChannelPeaks = (next: readonly number[]): void => {
  if (next.every((value) => Number.isFinite(value) && value >= 0)) {
    channelPeaks = next;
  }
};

export const readDspChannelPeaks = (): readonly number[] => channelPeaks;

/**
 * How much of each band is currently being applied, 0 to 1, by band index.
 *
 * Only dynamic bands ever report anything but 1: a static band is always fully
 * applied, which is what makes it static. Reported rather than predicted for
 * the same reason the phase meter is — what a dynamic band is doing depends on
 * the material, and the settings cannot say.
 *
 * Without this the threshold dial had no visible effect at all. The graph drew
 * the curve at full strength and its at-rest twin at zero, and neither of those
 * moves when the threshold does, so the control looked broken while working.
 */
let bandAmounts: readonly number[] = [];

export const setDspBandAmounts = (next: readonly number[]): void => {
  bandAmounts = next;
};

export const readDspBandAmounts = (): readonly number[] => bandAmounts;

/**
 * What the exciter's three bands and its organic stage actually contributed.
 *
 * Reported by the worklet rather than derived from the settings, and that
 * difference is the whole reason the display is worth having. A dynamic
 * band's amount depends on how loud its own passband is this instant, while
 * the smoothed activity values show switch and control transitions without
 * pretending that the nonlinear stage has a fixed EQ transfer curve.
 */
let exciterBands: readonly number[] = [0, 0, 0];

let exciterOrganic = 0;

export const setDspExciterActivity = (
  bands: readonly number[],
  organic: number,
): void => {
  exciterBands = bands;
  exciterOrganic = organic;
};

export const readDspExciterBands = (): readonly number[] => exciterBands;

export const readDspExciterOrganic = (): number => exciterOrganic;

/**
 * How hard the Maximizer is holding the signal down, in dB. Never positive.
 *
 * Polled rather than subscribed, like the exciter activity beside it: this
 * changes every audio block and a React update per block is a repaint the
 * display cannot use.
 */
let maximizerReductionDb = 0;

export const setDspMaximizerReduction = (reductionDb: number): void => {
  maximizerReductionDb = reductionDb;
};

export const readDspMaximizerReduction = (): number => maximizerReductionDb;

/**
 * How loud the output is, by BS.1770, measured where it leaves for the device.
 *
 * Polled rather than subscribed for the same reason as the reduction above:
 * this arrives about twenty-three times a second and is drawn inside an
 * animation frame, so a React update per frame would be a reconcile per frame
 * for a number that is painted onto a canvas either way.
 *
 * The floor is -120 rather than 0 because 0 LUFS is full scale: a display that
 * started at zero would open with the loudest reading it can ever show.
 */
let loudness: IHostAnalysisLoudness = {
  momentaryLufs: -120,
  shortTermLufs: -120,
  integratedLufs: -120,
  rangeLu: 0,
};

export const setDspLoudness = (next: IHostAnalysisLoudness): void => {
  loudness = next;
};

export const readDspLoudness = (): IHostAnalysisLoudness => loudness;

/** How much widening Dimension is allowing, 1 wide open and 0 fully shut. */
let dimensionGuard = 1;

export const setDspDimensionGuard = (guard: number): void => {
  dimensionGuard = guard;
};

export const readDspDimensionGuard = (): number => dimensionGuard;

/**
 * The low band before Bass Forge and after it, eight bands of each.
 *
 * Polled rather than React state, for the reason the guard above is: this
 * arrives once per analysis window, about twenty-three times a second, and is
 * painted onto a canvas inside an animation frame. Putting it in state would
 * be a reconcile per audio window for sixteen numbers no component renders —
 * a repaint the display cannot use at that rate and the reconciler cannot
 * afford beside the rest of the panel.
 *
 * Both runs start at the display floor rather than at zero, because zero dBFS
 * is full scale: a graph fed nothing would open with both curves pinned at
 * the top of it.
 */
const BASS_FORGE_FLOOR_DB = -120;

let bassForgeInputDb: readonly number[] = new Array<number>(
  ANALYSIS_BASS_FORGE_BANDS,
).fill(BASS_FORGE_FLOOR_DB);

let bassForgeOutputDb: readonly number[] = new Array<number>(
  ANALYSIS_BASS_FORGE_BANDS,
).fill(BASS_FORGE_FLOOR_DB);

export const setDspBassForgeBands = (
  inputDb: readonly number[],
  outputDb: readonly number[],
): void => {
  bassForgeInputDb = inputDb;
  bassForgeOutputDb = outputDb;
};

export const readDspBassForgeBands = (): {
  inputDb: readonly number[];
  outputDb: readonly number[];
} => ({ inputDb: bassForgeInputDb, outputDb: bassForgeOutputDb });

/**
 * What Bass Punch is applying, in dB of gain.
 *
 * Polled for the same reason, and with more of it: the strip these feed is a
 * three-second scroll, so it samples on every animation frame whether or not
 * a new window has arrived. A setter that re-rendered would be doing the work
 * twice at two different rates.
 *
 * At rest all three are 0 dB — they are gains, not levels, so the floor the
 * two runs above rest at would read as a stage ducking by 120 decibels while
 * it sits idle.
 */
let bassPunchTransientDb = 0;

let bassPunchSustainDb = 0;

let bassPunchDuckDb = 0;

export const setDspBassPunchActivity = (
  transientDb: number,
  sustainDb: number,
  duckDb: number,
): void => {
  bassPunchTransientDb = transientDb;
  bassPunchSustainDb = sustainDb;
  bassPunchDuckDb = duckDb;
};

export const readDspBassPunchActivity = (): {
  transientDb: number;
  sustainDb: number;
  duckDb: number;
} => ({
  transientDb: bassPunchTransientDb,
  sustainDb: bassPunchSustainDb,
  duckDb: bassPunchDuckDb,
});

/**
 * Each dynamic band's own detected level, in dBFS, by band index.
 *
 * The quantity the threshold is compared against, and NOT the same thing as
 * the spectrum behind the curve. The spectrum is per-FFT-bin, and broadband
 * music spreads its energy across a thousand of them, so every bin reads far
 * below the level of the signal itself — a full-scale track never approaches
 * the top of that display and is not meant to.
 *
 * This is a time-domain envelope where 1.0 is full scale, which is the same
 * reference the threshold dial uses. Reporting it is what makes the threshold
 * readable: the two are drawn on the same axis and compared to each other,
 * rather than to a spectrum that answers a different question.
 */
let bandLevels: readonly number[] = [];

export const setDspBandLevels = (next: readonly number[]): void => {
  bandLevels = next;
};

export const readDspBandLevels = (): readonly number[] => bandLevels;

/**
 * Recent sample pairs leaving the chain, interleaved left, right.
 *
 * What the goniometer draws. The needle answers "how correlated" with one
 * number; this answers "shaped how" — a vertical trace is mono, a circle is
 * wide, a horizontal one is out of phase — and no single figure can.
 */
let scatter: Float32Array = new Float32Array(0);

export const setDspScatter = (next: Float32Array): void => {
  scatter = next;
};

export const readDspScatter = (): Float32Array => scatter;
