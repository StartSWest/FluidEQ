/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createDrumFeatureState,
  DRUM_HOP_FEATURES,
  hopFeatures,
  restartDrumFeatures,
  type IDrumFeatureState,
} from './drumNetFeatures';
import weights from './drumNetWeights.json';
import type { IRhythmSpectrum } from './rhythmSpectrum';
import { HOP_MS } from './soundHops';

/**
 * The kick, the snare and the hats, heard by a small net taught on real
 * drums (`rhythmKit.ts` shows them; Ivan, 2026-11-13: "really be good
 * detecting each type bass, treble and everything").
 *
 * WHAT WAS WRONG. Each drum had a detector written by hand - a rise in its
 * own part of the spectrum, standing a share of its tallest recent hit over
 * the quiet between hits - tuned on made-up songs whose every hit was
 * known, because nothing said where a real record's hits were. Then
 * something did: thirty-seven real songs split into their drums, bass,
 * voice and the rest by a separator, and the drum track alone read with
 * hindsight for its hits. Against those, the kick lamp showed 40% of the
 * real kicks, the snare lamp 37% of the snares with half its lamps on no
 * snare, and the hats' 24%: a kick over a held bass note rises 3 dB where
 * one in the clear rises 20, and "a share of the tallest" threw it away.
 * No threshold fixes that - the best any one such rise could do, each song
 * given its own perfect threshold, was 0.71, 0.63 and 0.69 (F1).
 *
 * SO IT IS TAUGHT. A hop is 42 numbers (`drumNetFeatures.ts`); the net
 * sees six hops of them, 60 ms, through one hidden layer of 32, and says
 * how likely each drum was just hit - a few thousand multiplications a
 * hop, a hundred hops a second. Its weights (`drumNetWeights.json`)
 * were fitted to those songs' true hits; judged on songs kept out of the
 * fitting, six groups in turn, it shows 75% of the kicks with 84% of its
 * lamps on one, 59% of the snares with 70%, and 63% of the hats with 58%
 * (`rhythmKit.ts` for the lines those are read at) - where the detectors
 * showed 41% with 71%, 41% with 53% and 31% with 56%. Much of what is left
 * is the yardstick's own: a separated drum track is not the drummer.
 *
 * It says a fourth thing: how much of the top of the spectrum is the
 * drums' own, which Treble is weighed by (`energyLevels.ts`). On unseen
 * songs it says 0.65 where the drums have over four fifths of it and 0.22
 * where they have under a fifth.
 *
 * A snare is told from a kick's beater and a hat by how its noise lasts,
 * so it is answered 30 ms later than the other two: taught to answer at
 * once, it found 53% of them with 41% right.
 *
 * The weights are FluidEQ's own, of a model of its own; the separator and
 * the songs taught it and neither is in it or shipped.
 */

export interface IDrumNetState {
  features: IDrumFeatureState;
  /** The last hops' features, a ring; `at` is the newest, `held` how many. */
  hops: Float32Array;
  at: number;
  held: number;
}

/** How likely each drum was just hit, 0..1. */
export interface IDrumsHeard {
  kick: number;
  snare: number;
  hat: number;
  /**
   * How much of the top of the spectrum (6-14 kHz) is the drums' own - the
   * hats and the cymbals - against a voice's and everything else's, 0..1:
   * what Treble is weighed by (`energyLevels.ts`).
   */
  top: number;
}

const CONTEXT = weights.context;
const HIDDEN = weights.hidden;
const INPUTS = CONTEXT * DRUM_HOP_FEATURES;
const MEAN = Float32Array.from(weights.mu);
const SPREAD = Float32Array.from(weights.sd);
const INTO_HIDDEN = Float32Array.from(weights.W1);
const HIDDEN_BIAS = Float32Array.from(weights.B1);
const OUT_OF_HIDDEN = Float32Array.from(weights.W2);
const OUT_BIAS = Float32Array.from(weights.B2);
/** What a hidden unit lets through of a negative sum. */
const LEAK = 0.1;

if (
  weights.perHop !== DRUM_HOP_FEATURES ||
  INTO_HIDDEN.length !== HIDDEN * INPUTS ||
  OUT_OF_HIDDEN.length !== 4 * HIDDEN
) {
  throw new Error("The drum net's weights are not for these features.");
}

export const createDrumNetState = (): IDrumNetState => ({
  features: createDrumFeatureState(),
  hops: new Float32Array(INPUTS),
  at: 0,
  held: 0,
});

/** What comes next is heard from its own first hop. */
export const restartDrumNet = (state: IDrumNetState) => {
  restartDrumFeatures(state.features);
  state.held = 0;
};

const input = new Float32Array(INPUTS);
const hidden = new Float32Array(HIDDEN);

/** One hop: how likely each drum was just hit, written to `out`. */
export const hearDrumNet = (
  state: IDrumNetState,
  spectrum: IRhythmSpectrum,
  stepMs: number,
  out: IDrumsHeard,
) => {
  if (stepMs > 2 * HOP_MS) {
    // Time was lost: the hops kept are from another moment of the music.
    state.held = 0;
  }
  state.at = (state.at + 1) % CONTEXT;
  hopFeatures(
    state.features,
    spectrum,
    stepMs,
    state.hops,
    state.at * DRUM_HOP_FEATURES,
  );
  state.held = Math.min(CONTEXT, state.held + 1);
  // Newest first; before there are six, the oldest stands for the rest.
  for (let back = 0; back < CONTEXT; back += 1) {
    const slot =
      (state.at - Math.min(back, state.held - 1) + CONTEXT) % CONTEXT;
    const from = slot * DRUM_HOP_FEATURES;
    const to = back * DRUM_HOP_FEATURES;
    for (let k = 0; k < DRUM_HOP_FEATURES; k += 1) {
      input[to + k] = (state.hops[from + k] - MEAN[k]) / SPREAD[k];
    }
  }
  for (let unit = 0; unit < HIDDEN; unit += 1) {
    let sum = HIDDEN_BIAS[unit];
    const base = unit * INPUTS;
    for (let k = 0; k < INPUTS; k += 1) {
      sum += INTO_HIDDEN[base + k] * input[k];
    }
    hidden[unit] = sum > 0 ? sum : LEAK * sum;
  }
  const likely = (drum: number) => {
    let sum = OUT_BIAS[drum];
    for (let unit = 0; unit < HIDDEN; unit += 1) {
      sum += OUT_OF_HIDDEN[drum * HIDDEN + unit] * hidden[unit];
    }
    return 1 / (1 + Math.exp(-sum));
  };
  out.kick = likely(0);
  out.snare = likely(1);
  out.hat = likely(2);
  out.top = likely(3);
};
