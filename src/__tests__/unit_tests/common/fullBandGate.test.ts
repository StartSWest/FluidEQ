/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { BALANCE_FRAME_INTERVAL_MS } from 'renderer/utils/autoBalanceTuning';
import {
  IBalanceFrame,
  accumulateBalanceFrame,
  createBalanceCaptureState,
  evaluateBalanceCapture,
} from 'renderer/utils/autoBalanceCapture';
import {
  advanceFullBandGate,
  createFullBandState,
} from 'renderer/utils/fullBandGate';

/* --- harness ----------------------------------------------------------- */

/** 320 log-spaced points from 20 Hz to 20 kHz, like the live analyser. */
const AXIS = Array.from(
  { length: 320 },
  (_value, index) =>
    10 **
    (Math.log10(20) + (index / 319) * (Math.log10(20000) - Math.log10(20))),
);

/** Where the record's low end ends, for the dropout frames below. */
const DROPOUT_CEILING_HZ = 140;

const buildFrame = (frameIndex: number, hasLowEnd: boolean): IBalanceFrame => {
  const levels = new Float64Array(AXIS.length);
  let peakDb = -Infinity;
  AXIS.forEach((frequency, index) => {
    // Flat, because the question here is what a MISSING range does to the
    // ranges that are still there, and a flat record makes that a single
    // number rather than a shape to argue about.
    const level = !hasLowEnd && frequency < DROPOUT_CEILING_HZ ? -90 : -30;
    levels[index] = level;
    if (level > peakDb) {
      peakDb = level;
    }
  });
  return {
    levels,
    peakDb,
    timestampMs: frameIndex * BALANCE_FRAME_INTERVAL_MS,
  };
};

/**
 * Drives the accumulator the way the hook's pump does, with the presence gate
 * supplied per frame.
 *
 * The pump writes the gate AFTER accumulating, so the accumulator always reads
 * the previous frame's allowances; writing it before the call here is the same
 * one-frame lag with the bookkeeping left out.
 */
const feed = (
  state: ReturnType<typeof createBalanceCaptureState>,
  frames: number,
  hasLowEnd: boolean,
  gates: number[],
  firstFrameIndex: number,
): number => {
  for (let index = 0; index < frames; index += 1) {
    state.presenceGate = Float64Array.from(gates);
    accumulateBalanceFrame(
      state,
      buildFrame(firstFrameIndex + index, hasLowEnd),
    );
  }
  return firstFrameIndex + frames;
};

const ALL_PRESENT = new Array(9).fill(1);
/** Deep bass and bass under their floor lines; everything else playing. */
const LOW_END_GONE = [0, 0, 1, 1, 1, 1, 1, 1, 1];

/** 560–1120 Hz, which plays throughout and is what a dropout corrupts. */
const UPPER_MIDS = 4;

/* --- the state machine ------------------------------------------------- */

describe('the full-band gate', () => {
  it('learns from every frame when nothing reports its presence', () => {
    const state = createFullBandState();
    const learned = Array.from({ length: 200 }, () =>
      advanceFullBandGate(state, undefined, BALANCE_FRAME_INTERVAL_MS),
    );
    expect(learned.every(Boolean)).toBe(true);
  });

  it('stops learning the moment a range falls under its floor', () => {
    const state = createFullBandState();
    advanceFullBandGate(state, ALL_PRESENT, BALANCE_FRAME_INTERVAL_MS);
    expect(advanceFullBandGate(state, LOW_END_GONE, 45)).toBe(false);
    expect(state.isHolding).toBe(true);
  });

  it('starts again once the range has been back for a second', () => {
    const state = createFullBandState();
    advanceFullBandGate(state, LOW_END_GONE, BALANCE_FRAME_INTERVAL_MS);
    expect(state.isHolding).toBe(true);

    // Half a second back is not back: a filter sweeping in crosses the floor
    // long before the range is really there.
    for (let index = 0; index < 11; index += 1) {
      advanceFullBandGate(state, ALL_PRESENT, BALANCE_FRAME_INTERVAL_MS);
    }
    expect(state.isHolding).toBe(true);

    for (let index = 0; index < 12; index += 1) {
      advanceFullBandGate(state, ALL_PRESENT, BALANCE_FRAME_INTERVAL_MS);
    }
    expect(state.isHolding).toBe(false);
  });

  it('gives up on a record that is simply band-limited, and stays given up', () => {
    const state = createFullBandState();
    // Twenty-five seconds of a record with no low end at all.
    for (let index = 0; index < 560; index += 1) {
      advanceFullBandGate(state, LOW_END_GONE, BALANCE_FRAME_INTERVAL_MS);
    }
    expect(state.isHolding).toBe(false);
    expect(state.armed).toBe(false);

    // And it does not start holding again on the next frame, which would be
    // the same twenty seconds over and over for the rest of the evening.
    expect(advanceFullBandGate(state, LOW_END_GONE, 45)).toBe(true);
    expect(state.isHolding).toBe(false);
  });

  it('arms again when the record does show its whole spectrum', () => {
    const state = createFullBandState();
    for (let index = 0; index < 560; index += 1) {
      advanceFullBandGate(state, LOW_END_GONE, BALANCE_FRAME_INTERVAL_MS);
    }
    expect(state.armed).toBe(false);

    // The positive control for the test above: the same disarmed gate holds
    // again once a full band has been seen, so "stays given up" is a claim
    // about band-limited material and not about the gate having died.
    for (let index = 0; index < 30; index += 1) {
      advanceFullBandGate(state, ALL_PRESENT, BALANCE_FRAME_INTERVAL_MS);
    }
    expect(state.armed).toBe(true);
    expect(advanceFullBandGate(state, LOW_END_GONE, 45)).toBe(false);
  });
});

/* --- what it saves the measurement from -------------------------------- */

describe('a five-second dropout', () => {
  it('teaches the ranges that are still playing nothing at all', () => {
    const state = createBalanceCaptureState(AXIS);
    let frame = feed(state, 60, true, ALL_PRESENT, 0);
    const settled = state.regionStates[UPPER_MIDS].mean;
    const settledWeight = state.regionStates[UPPER_MIDS].weight;
    const settledMs = state.listenedMs;

    // The low end goes, for about five seconds.
    frame = feed(state, 110, false, LOW_END_GONE, frame);

    expect(state.regionStates[UPPER_MIDS].mean).toBeCloseTo(settled, 10);
    expect(state.regionStates[UPPER_MIDS].weight).toBeCloseTo(
      settledWeight,
      10,
    );
    expect(state.listenedMs).toBe(settledMs);
    expect(evaluateBalanceCapture(state).isBandLimited).toBe(true);

    // And picks up again when the record does.
    feed(state, 60, true, ALL_PRESENT, frame);
    expect(state.listenedMs).toBeGreaterThan(settledMs);
    expect(evaluateBalanceCapture(state).isBandLimited).toBe(false);
  });

  it('would otherwise read the ranges that are still playing as too loud', () => {
    // The positive control, without which the test above cannot tell a gate
    // that works from an accumulator that has stopped accumulating. Same
    // frames, same accumulator, the gate simply never told anything was
    // missing.
    //
    // Measured at +0.93 dB here — the dropout frames themselves read the upper
    // mids 1.43 dB hot, diluted by the sixty clean frames already averaged in.
    // Nearly a decibel of a range being told to come down because a different
    // range stopped playing, which is the whole report.
    const state = createBalanceCaptureState(AXIS);
    let frame = feed(state, 60, true, ALL_PRESENT, 0);
    const settled = state.regionStates[UPPER_MIDS].mean;

    frame = feed(state, 110, false, ALL_PRESENT, frame);

    expect(state.regionStates[UPPER_MIDS].mean - settled).toBeGreaterThan(0.9);
  });
});
