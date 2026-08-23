/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ICrossoverState, createCrossoverState, splitBands } from './crossover';
import {
  IDelayLineState,
  createDelayLine,
  processDelayLine,
} from './delayLine';

/**
 * The part of an enhancer that has no sound of its own.
 *
 * WHAT THIS IS FOR, in the words of the person who asked for it: "a pure
 * non-digital sounding fx that makes the music come alive, very non square or
 * timed, like infinity."
 *
 * That is not a description of harmonics, and it took far too long to hear it
 * as the clue it was. Harmonics are locked to the input — the same instant, at
 * exact multiples of frequencies already present. They are as square and as
 * timed as anything in audio, which is why generating more of them never
 * produced what was being asked for.
 *
 * This is the other half of what an enhancer does, and BBE's Sonic Maximizer is
 * the whole product built from it alone: it adds NO harmonics. It splits the
 * signal and delays the lower bands relative to the higher ones, by a couple of
 * milliseconds at the bottom and a fraction of one in the middle. The claim is
 * that a loudspeaker smears the opposite way — its woofer is later than its
 * tweeter, because a heavy cone takes longer to start — so this is a mirror of
 * that, applied before the speaker gets its hands on the sound.
 *
 * Whatever the theory is worth, the effect is real and it is unlike anything
 * else in this rack: nothing is added, so there is nothing to hear as an
 * effect. Transients arrive aligned instead of spread, which reads as clarity
 * and punch rather than as brightness. And because it is a time relationship
 * rather than a signal, it has no edges, no period, and nothing to repeat —
 * "non square or timed", exactly.
 *
 * The classic 482i splits near 150 Hz and 1.2 kHz and runs about 2.5 ms on the
 * low band against 0.5 ms on the mid, which is where the defaults here come
 * from.
 */

/** The low band's delay at full amount, in milliseconds. @see the header */
const LOW_MS = 2.5;

/** The mid band's, which is roughly a fifth of it. */
const MID_MS = 0.5;

export interface IPhaseAlignState {
  crossover: ICrossoverState;
  low: Float32Array;
  mid: Float32Array;
  high: Float32Array;
  lowLine: IDelayLineState;
  midLine: IDelayLineState;
  /** What the lines were built for, so they are rebuilt only when it moves. */
  builtFor: number;
}

const linesFor = (
  amount: number,
  sampleRate: number,
): { lowLine: IDelayLineState; midLine: IDelayLineState } => ({
  lowLine: createDelayLine(Math.round((LOW_MS / 1_000) * sampleRate * amount)),
  midLine: createDelayLine(Math.round((MID_MS / 1_000) * sampleRate * amount)),
});

export const createPhaseAlign = (
  blockSize: number,
  sampleRate: number,
): IPhaseAlignState => ({
  crossover: createCrossoverState(),
  low: new Float32Array(blockSize),
  mid: new Float32Array(blockSize),
  high: new Float32Array(blockSize),
  ...linesFor(0, sampleRate),
  builtFor: 0,
});

/**
 * Align one channel in place.
 *
 * The bands come from the same perfect-reconstruction split the compressor
 * uses, which matters more here than anywhere: at amount 0 the three sum back
 * to exactly the input, sample for sample, so the control has a true off
 * position rather than a quietest position. An enhancer whose bypass is not
 * silent is one nobody can A/B, and A/B is the only way this stage can be
 * judged at all.
 *
 * The delay lines are rebuilt only when the amount actually moves. A line is an
 * allocation, and this runs in an audio callback — rebuilding one per block
 * would be garbage sixty times a second on a thread with 2.7 ms to spare.
 */
export const alignChannel = (
  state: IPhaseAlignState,
  target: Float32Array,
  amount: number,
  corners: readonly [number, number],
  sampleRate: number,
): void => {
  const frames = target.length;
  if (state.low.length !== frames) {
    state.low = new Float32Array(frames);
    state.mid = new Float32Array(frames);
    state.high = new Float32Array(frames);
  }
  if (Math.abs(amount - state.builtFor) > 0.001) {
    const built = linesFor(amount, sampleRate);
    state.lowLine = built.lowLine;
    state.midLine = built.midLine;
    state.builtFor = amount;
  }

  splitBands(
    state.crossover,
    target,
    state.low,
    state.mid,
    state.high,
    corners,
    sampleRate,
  );

  // Only the two lower bands move. The top is the reference the others are
  // late against, which is also why this adds no latency worth reporting: the
  // earliest thing through is still immediate.
  processDelayLine(state.lowLine, state.low);
  processDelayLine(state.midLine, state.mid);

  for (let i = 0; i < frames; i += 1) {
    target[i] = state.low[i] + state.mid[i] + state.high[i];
  }
};
