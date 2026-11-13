/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IRhythmSpectrum } from './rhythmSpectrum';
import { HOP_MS } from './soundHops';

/**
 * What the drums' net is shown of each hop (`drumNet.ts`): seven bands,
 * from the kick's thump to the hats' air, and six things about each - none
 * of them a level on its own, so a song says the same turned up or down:
 *
 * - how far its bins rose over the last 30 ms, in dB, on average;
 * - the share of its bins that rose 3 dB or more: a drum lifts a whole
 *   band at once, a note its own harmonics;
 * - how far the band's power climbed over those 30 ms;
 * - where the band stands under the hop's loudest bin;
 * - where it stands against its own last second;
 * - how flat it is: the bins' mean in dB under the dB of their mean power,
 *   near nought for noise and far under for one tone.
 *
 * The net is taught on exactly these numbers (the bench that trains it
 * calls `hopFeatures` itself), so nothing here changes without teaching it
 * again: a feature measured another way is a different feature under the
 * same weights, and fails quietly.
 */

/** Where each band is, in Hz, and which of the hop's two windows hears it. */
const BANDS: readonly (readonly [number, number, 'low' | 'high'])[] = [
  [40, 110, 'low'],
  [110, 250, 'low'],
  [250, 500, 'high'],
  [500, 1_500, 'high'],
  [1_500, 4_000, 'high'],
  [4_000, 8_000, 'high'],
  [8_000, 16_000, 'high'],
];
const PER_BAND = 6;
/** How many numbers a hop is, for the net. */
export const DRUM_HOP_FEATURES = BANDS.length * PER_BAND;
/** A rise is measured against the hop this many before: 30 ms. */
const RISE_HOPS = 3;
/** A bin counts only this far under the hop's loudest, and never under this. */
const FLOOR_BELOW_DB = 50;
const FLOOR_DB = -90;
/** A bin rose "broadly" from this many dB. */
const BROAD_DB = 3;
/** How much of a band's last-second level each hop replaces. */
const SLOW_SHARE = 0.01;

interface IKeptHop {
  low: Float32Array;
  high: Float32Array;
}

export interface IDrumFeatureState {
  /** The last hops' bins, oldest first: what a rise is measured against. */
  kept: IKeptHop[];
  /** Each band's level over its last second, in dB; NaN before the first. */
  slow: Float64Array;
}

export const createDrumFeatureState = (): IDrumFeatureState => ({
  kept: [],
  slow: new Float64Array(BANDS.length).fill(Number.NaN),
});

/** What comes next is measured from its own first hop. */
export const restartDrumFeatures = (state: IDrumFeatureState) => {
  state.kept.length = 0;
  state.slow.fill(Number.NaN);
};

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

/**
 * One hop's features, written to `out` from `at` on. The hop is kept
 * (copied: the hops' arrays are a ring's) for the rises of the next ones.
 */
export const hopFeatures = (
  state: IDrumFeatureState,
  spectrum: IRhythmSpectrum,
  stepMs: number,
  out: Float32Array,
  at: number,
) => {
  // Time was lost: what was kept is from another moment of the music.
  if (stepMs > 2 * HOP_MS) {
    state.kept.length = 0;
  }
  const first = state.kept[0];
  if (
    first &&
    (first.low.length !== spectrum.low.length ||
      first.high.length !== spectrum.high.length)
  ) {
    restartDrumFeatures(state);
  }
  const now: IKeptHop = {
    low: Float32Array.from(spectrum.low),
    high: Float32Array.from(spectrum.high),
  };
  state.kept.push(now);
  if (state.kept.length > RISE_HOPS + 1) {
    state.kept.shift();
  }
  const before = state.kept[0];
  let loudest = -100;
  for (let bin = 0; bin < now.low.length; bin += 1) {
    loudest = Math.max(loudest, now.low[bin]);
  }
  for (let bin = 0; bin < now.high.length; bin += 1) {
    loudest = Math.max(loudest, now.high[bin]);
  }
  const floor = Math.max(FLOOR_DB, loudest - FLOOR_BELOW_DB);
  BANDS.forEach(([fromHz, toHz, window], band) => {
    const bins = window === 'low' ? now.low : now.high;
    const was = window === 'low' ? before.low : before.high;
    const binHz = window === 'low' ? spectrum.lowBinHz : spectrum.highBinHz;
    let power = 0;
    let powerWas = 0;
    let rise = 0;
    let broad = 0;
    let dbSum = 0;
    let count = 0;
    for (
      let bin = Math.max(1, Math.ceil(fromHz / binHz));
      bin * binHz < toHz && bin < bins.length;
      bin += 1
    ) {
      power += 10 ** (bins[bin] / 10);
      powerWas += 10 ** (was[bin] / 10);
      dbSum += bins[bin];
      const up = Math.max(floor, bins[bin]) - Math.max(floor, was[bin]);
      rise += Math.max(0, up);
      if (up >= BROAD_DB) {
        broad += 1;
      }
      count += 1;
    }
    const bandBins = Math.max(1, count);
    const db = 10 * Math.log10(Math.max(1e-12, power));
    const dbWas = 10 * Math.log10(Math.max(1e-12, powerWas));
    const slow = Number.isNaN(state.slow[band]) ? db : state.slow[band];
    const base = at + band * PER_BAND;
    out[base] = rise / bandBins;
    out[base + 1] = broad / bandBins;
    out[base + 2] = clamp(db - dbWas, -6, 30);
    out[base + 3] = Math.max(-60, db - loudest);
    out[base + 4] = clamp(db - slow, -30, 30);
    out[base + 5] = Math.max(
      -30,
      dbSum / bandBins - 10 * Math.log10(Math.max(1e-12, power / bandBins)),
    );
    state.slow[band] = slow + (db - slow) * SLOW_SHARE;
  });
};
