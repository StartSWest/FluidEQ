/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

interface IBiquadState {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

interface IBiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export interface ICrossoverState {
  /** Two cascaded Butterworth stages make one Linkwitz-Riley 4th order. */
  lowStages: IBiquadState[];
  midStages: IBiquadState[];
}

const BUTTERWORTH_Q = Math.SQRT1_2;

const emptyStage = (): IBiquadState => ({ x1: 0, x2: 0, y1: 0, y2: 0 });

export const createCrossoverState = (): ICrossoverState => ({
  lowStages: [emptyStage(), emptyStage()],
  midStages: [emptyStage(), emptyStage()],
});

const lowpassCoefficients = (
  frequency: number,
  sampleRate: number,
): IBiquadCoefficients => {
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const cosine = Math.cos(omega);
  const alpha = Math.sin(omega) / (2 * BUTTERWORTH_Q);
  const a0 = 1 + alpha;
  return {
    b0: (1 - cosine) / 2 / a0,
    b1: (1 - cosine) / a0,
    b2: (1 - cosine) / 2 / a0,
    a1: (-2 * cosine) / a0,
    a2: (1 - alpha) / a0,
  };
};

const runBiquad = (
  state: IBiquadState,
  coefficients: IBiquadCoefficients,
  sample: number,
): number => {
  const { b0, b1, b2, a1, a2 } = coefficients;
  const y =
    b0 * sample + b1 * state.x1 + b2 * state.x2 - a1 * state.y1 - a2 * state.y2;
  state.x2 = state.x1;
  state.x1 = sample;
  state.y2 = state.y1;
  state.y1 = y;
  return y;
};

/**
 * Split into three bands that sum back to the input exactly.
 *
 * Only the two lowpasses are filters; the bands above them are subtractions.
 * A pair of independent lowpass and highpass filters would each contribute
 * their own phase shift, and their sum dips at the corner — a notch of a
 * decibel or so that nobody would ever report as a bug, because it does not
 * sound like a defect. It sounds like the music being thin, which gets blamed
 * on the compressor sitting after it.
 *
 * Subtraction cannot dip, because each band is defined as the whole minus the
 * rest. The test that holds this asserts `low + mid + high === input` sample
 * by sample, which is a property no listening test would have caught.
 *
 * The trade is that the bands are not individually flat-magnitude — the mid
 * band carries the phase difference of two filters. That is the correct trade
 * for a compressor: what matters is that untouched bands recombine to silence
 * against the original, and that is exactly what subtraction guarantees.
 */
export const splitBands = (
  state: ICrossoverState,
  input: Float32Array,
  low: Float32Array,
  mid: Float32Array,
  high: Float32Array,
  corners: readonly [number, number],
  sampleRate: number,
): void => {
  const lowCoefficients = lowpassCoefficients(corners[0], sampleRate);
  const midCoefficients = lowpassCoefficients(corners[1], sampleRate);
  for (let i = 0; i < input.length; i += 1) {
    const sample = input[i];
    let lowBand = sample;
    for (let stage = 0; stage < state.lowStages.length; stage += 1) {
      lowBand = runBiquad(state.lowStages[stage], lowCoefficients, lowBand);
    }
    let belowHigh = sample;
    for (let stage = 0; stage < state.midStages.length; stage += 1) {
      belowHigh = runBiquad(state.midStages[stage], midCoefficients, belowHigh);
    }
    low[i] = lowBand;
    mid[i] = belowHigh - lowBand;
    high[i] = sample - belowHigh;
  }
};
