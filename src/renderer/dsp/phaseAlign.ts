/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ICrossoverState, createCrossoverState, splitBands } from './crossover';

/** Classic three-way enhancer timing: highs lead, mids follow, lows last. */
const LOW_MS = 2.5;
const MID_MS = 0.5;
const DELAY_SMOOTHING_MS = 20;
const CORNERS: readonly [number, number] = [150, 1_200];

interface IVariableDelay {
  buffer: Float32Array;
  write: number;
}

export interface IPhaseAlignState {
  crossover: ICrossoverState;
  low: Float32Array;
  mid: Float32Array;
  high: Float32Array;
  lowLine: IVariableDelay;
  midLine: IVariableDelay;
  lowDelay: number;
  midDelay: number;
}

const createVariableDelay = (maximumSamples: number): IVariableDelay => ({
  buffer: new Float32Array(Math.ceil(maximumSamples) + 2),
  write: 0,
});

export const createPhaseAlign = (
  blockSize: number,
  sampleRate: number,
): IPhaseAlignState => ({
  crossover: createCrossoverState(),
  low: new Float32Array(blockSize),
  mid: new Float32Array(blockSize),
  high: new Float32Array(blockSize),
  lowLine: createVariableDelay((LOW_MS / 1_000) * sampleRate),
  midLine: createVariableDelay((MID_MS / 1_000) * sampleRate),
  lowDelay: 0,
  midDelay: 0,
});

const delaySample = (
  line: IVariableDelay,
  sample: number,
  delay: number,
): number => {
  line.buffer[line.write] = sample;
  let read = line.write - delay;
  if (read < 0) {
    read += line.buffer.length;
  }
  const before = Math.floor(read);
  const after = (before + 1) % line.buffer.length;
  const fraction = read - before;
  const output =
    line.buffer[before] * (1 - fraction) + line.buffer[after] * fraction;
  line.write = (line.write + 1) % line.buffer.length;
  return output;
};

/**
 * Apply the enhancer's timing relationship in place.
 *
 * Delay memory is allocated once at the maximum size. Turning the control no
 * longer replaces a delay line and throws away its history; fractional reads
 * move continuously to the requested value. This removes both whole-sample
 * stepping and the click that came from rebuilding a line while audio was in
 * it. Amount zero returns without filtering once the smooth release finishes.
 */
export const alignChannel = (
  state: IPhaseAlignState,
  target: Float32Array,
  amount: number,
  sampleRate: number,
): void => {
  const safeAmount = Math.max(0, Math.min(1, amount));
  const targetLow = (LOW_MS / 1_000) * sampleRate * safeAmount;
  const targetMid = (MID_MS / 1_000) * sampleRate * safeAmount;
  if (targetLow === 0 && state.lowDelay < 0.0001 && state.midDelay < 0.0001) {
    state.lowDelay = 0;
    state.midDelay = 0;
    return;
  }

  if (state.low.length !== target.length) {
    state.low = new Float32Array(target.length);
    state.mid = new Float32Array(target.length);
    state.high = new Float32Array(target.length);
  }
  splitBands(
    state.crossover,
    target,
    state.low,
    state.mid,
    state.high,
    CORNERS,
    sampleRate,
  );

  const smooth = 1 - Math.exp(-1 / ((DELAY_SMOOTHING_MS / 1_000) * sampleRate));
  for (let i = 0; i < target.length; i += 1) {
    state.lowDelay += (targetLow - state.lowDelay) * smooth;
    state.midDelay += (targetMid - state.midDelay) * smooth;
    const low = delaySample(state.lowLine, state.low[i], state.lowDelay);
    const mid = delaySample(state.midLine, state.mid[i], state.midDelay);
    target[i] = low + mid + state.high[i];
  }
};
