/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  advanceHeadroom,
  createAdaptiveHeadroom,
  excessDb,
} from '../../../renderer/dsp/adaptiveHeadroom';

/** A chain that boosts one region and leaves the rest alone. */
const chainWithBoost = (bins: number, at: number, gainDb: number) => {
  const chain = new Float32Array(bins);
  chain[at] = gainDb;
  return chain;
};

/** A programme with all its energy in one bin, loud enough to be measured. */
const programmeAt = (bins: number, at: number) => {
  const programme = new Float32Array(bins).fill(-90);
  programme[at] = -6;
  return programme;
};

describe('the excess', () => {
  /**
   * The whole reason this is a difference rather than an absolute level: both
   * terms carry the same unknown reference, so shifting the analyser's
   * calibration by any amount must not change the answer.
   */
  it('does not depend on how loud the reading is', () => {
    const chain = chainWithBoost(64, 10, 6);
    const quiet = programmeAt(64, 10);
    const loud = Float32Array.from(quiet, (value) => value + 37);
    const quietExcess = excessDb(quiet, chain);
    const loudExcess = excessDb(loud, chain);
    expect(quietExcess).not.toBeNull();
    expect(loudExcess).toBeCloseTo(quietExcess as number, 6);
  });

  /**
   * The case the whole feature exists for: the record has nothing where the
   * curve boosts, so the boost costs it nothing and the reserve is wasted.
   */
  it('is nothing when the boost lands where the record is silent', () => {
    const chain = chainWithBoost(64, 5, 12);
    // All the energy is at bin 40, twelve decibels of boost sit at bin 5.
    expect(excessDb(programmeAt(64, 40), chain)).toBe(0);
  });

  /**
   * And the positive control: when the boost lands ON the loudest part, the
   * excess is the whole boost and nothing may be given back. A measurement that
   * had quietly become "always zero" passes the test above and fails this one.
   */
  it('is the whole boost when it lands on the loudest part', () => {
    const chain = chainWithBoost(64, 40, 12);
    expect(excessDb(programmeAt(64, 40), chain)).toBeCloseTo(12, 6);
  });

  /** A chain that only cuts makes the record quieter, and reading that as
   * licence to turn the output up is an EQ that raises its own level. */
  it('never reads below zero', () => {
    const chain = new Float32Array(64).fill(-6);
    expect(excessDb(programmeAt(64, 20), chain)).toBe(0);
  });

  /**
   * Nothing playing is not the same answer as "the chain adds nothing", and
   * returning the second for the first is what made a paused player hand the
   * whole reserve back and then take it away again, twenty-three times a
   * second. Null says there was no evidence.
   */
  it('reports nothing when there is nothing to measure', () => {
    const chain = chainWithBoost(8, 4, 6);
    expect(excessDb(new Float32Array(8).fill(-Infinity), chain)).toBeNull();
    expect(excessDb(new Float32Array(8).fill(NaN), chain)).toBeNull();
    // A flat noise floor, which is exactly what silence looks like to an
    // analyser and the shape that produced the flicker.
    expect(excessDb(new Float32Array(8).fill(-95), chain)).toBeNull();
  });
});

describe('handing headroom back', () => {
  /** Slowly, and never past what was reserved: the reserve is the guarantee,
   * and anything beyond it is the rack turning itself up. */
  it('rises gradually and stops at the reserve', () => {
    const state = createAdaptiveHeadroom();
    let last = 0;
    for (let step = 0; step < 200; step += 1) {
      const now = advanceHeadroom(state, 6, 0, false);
      expect(now).toBeGreaterThanOrEqual(last);
      expect(now).toBeLessThanOrEqual(6);
      last = now;
    }
    expect(last).toBeCloseTo(6, 6);
  });

  /** The other direction is not gradual. Taking headroom back is what stands
   * between a chorus and a clipped chorus. */
  it('gives it up at once when the material asks for it', () => {
    const state = createAdaptiveHeadroom();
    for (let step = 0; step < 100; step += 1) {
      advanceHeadroom(state, 6, 0, false);
    }
    expect(state.giveBack).toBeCloseTo(6, 6);
    // The chorus arrives and now needs the whole reserve.
    expect(advanceHeadroom(state, 6, 6, false)).toBe(0);
  });

  /** With no evidence it holds still, rather than drifting on noise. */
  it('does not move when there was nothing to measure', () => {
    const state = createAdaptiveHeadroom();
    for (let step = 0; step < 20; step += 1) {
      advanceHeadroom(state, 6, 0, false);
    }
    const held = state.giveBack;
    expect(held).toBeGreaterThan(0);
    for (let step = 0; step < 50; step += 1) {
      expect(advanceHeadroom(state, 6, null, false)).toBe(held);
    }
  });

  /** A measured clip outranks every spectral argument there is. */
  it('drops everything when the output is actually clipping', () => {
    const state = createAdaptiveHeadroom();
    for (let step = 0; step < 100; step += 1) {
      advanceHeadroom(state, 6, 0, false);
    }
    expect(advanceHeadroom(state, 6, 0, true)).toBe(0);
  });
});
