/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createOrganicState,
  organicAsymmetry,
  organicBlock,
  organicDrive,
  organicSample,
} from '../../../renderer/dsp/organic';

const RATE = 48_000;
const SIZE = 32_768;
/** A real midrange fundamental, which is the region this stage exists for. */
const FREQ = 400;
const AMPLITUDE = 0.5;

const sine = (hz: number): Float64Array => {
  const out = new Float64Array(SIZE);
  for (let i = 0; i < SIZE; i += 1) {
    out[i] = AMPLITUDE * Math.sin((2 * Math.PI * hz * i) / RATE);
  }
  return out;
};

/** One bin by Goertzel: exact, and far cheaper than an FFT for four bins. */
const magnitudeAt = (buffer: Float64Array, hz: number): number => {
  const k = (hz * SIZE) / RATE;
  const omega = (2 * Math.PI * k) / SIZE;
  const cosine = Math.cos(omega);
  const coefficient = 2 * cosine;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < SIZE; i += 1) {
    const s0 = buffer[i] + coefficient * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return (2 * Math.hypot(s1 - s2 * cosine, s2 * Math.sin(omega))) / SIZE;
};

const harmonics = (amount: number) => {
  const drive = organicDrive(amount);
  const asymmetry = organicAsymmetry(amount);
  const input = sine(FREQ);
  const out = Float64Array.from(input, (value) =>
    organicSample(value, drive, asymmetry),
  );
  const fundamental = magnitudeAt(out, FREQ);
  const at = (n: number) => (magnitudeAt(out, FREQ * n) / fundamental) * 100;
  return { second: at(2), third: at(3), fourth: at(4), fifth: at(5) };
};

/**
 * The stage's claim is a RATIO, not an amount.
 *
 * Body is even harmonics; grit is odd ones. Anything can make harmonics — the
 * reason this is a separate stage from fuzz is that it keeps the even ones
 * ahead by better than five to one all the way up its travel, where fuzz
 * arrives at roughly ten to one and the old fixed-asymmetry fuzz collapsed to
 * 2.3 to 1.
 */
describe('the organic curve', () => {
  it('keeps even harmonics dominant across the whole travel', () => {
    [0.15, 0.25, 0.5, 0.75, 1].forEach((amount) => {
      const { second, third, fourth, fifth } = harmonics(amount);
      const even = second + fourth;
      const odd = third + fifth;
      expect(even).toBeGreaterThan(odd * 5);
    });
  });

  it('goes on getting thicker rather than levelling off', () => {
    // Measured 3.31% at a sixth of the dial and 23.50% at the top. A stage
    // whose second harmonic stopped rising would be a dial with a dead half.
    expect(harmonics(0.15).second).toBeGreaterThan(2);
    expect(harmonics(1).second).toBeGreaterThan(harmonics(0.5).second);
    expect(harmonics(0.5).second).toBeGreaterThan(harmonics(0.25).second);
  });

  /**
   * POSITIVE CONTROL for every measurement above.
   *
   * A symmetric curve cannot produce even harmonics — that is arithmetic, not
   * a design choice. If this returned a healthy second harmonic the analysis
   * would be measuring something other than what it claims, and every ratio in
   * this file would be meaningless. Without it, a bug that produced NO even
   * harmonics at all would look exactly like a stage that was working.
   */
  it('POSITIVE CONTROL: a symmetric curve shows no even harmonics', () => {
    const input = sine(FREQ);
    const out = Float64Array.from(input, (value) => Math.tanh(value * 2) / 2);
    const fundamental = magnitudeAt(out, FREQ);
    const second = (magnitudeAt(out, FREQ * 2) / fundamental) * 100;
    const third = (magnitudeAt(out, FREQ * 3) / fundamental) * 100;
    expect(second).toBeLessThan(0.1);
    expect(third).toBeGreaterThan(5);
  });

  /**
   * An offset curve returns its offset for an input of zero unless the offset
   * is subtracted back out. That is DC — a battery in the signal path — and it
   * is silent, cumulative and exactly the kind of thing no listening test
   * finds.
   */
  it('NULL TEST: silence in is silence out', () => {
    [0, 0.5, 1].forEach((amount) => {
      const quiet = organicSample(
        0,
        organicDrive(amount),
        organicAsymmetry(amount),
      );
      expect(Math.abs(quiet)).toBeLessThan(1e-12);
    });
  });
});

describe('the organic stage in motion', () => {
  const runBlocks = (count: number, level: number): number[] => {
    const state = createOrganicState(128);
    const drives: number[] = [];
    for (let block = 0; block < count; block += 1) {
      const buffer = new Float32Array(128);
      for (let i = 0; i < 128; i += 1) {
        const at = block * 128 + i;
        buffer[i] = level * Math.sin((2 * Math.PI * FREQ * at) / RATE);
      }
      drives.push(organicBlock(state, buffer, 0.6, RATE));
    }
    return drives;
  };

  /**
   * The drive must not sit still. A constant non-linearity adds a constant
   * ring to every sustained note, and ears find constants and stop hearing
   * them as part of the music — which is the whole reason this stage exists
   * rather than a saturator with a nicer name.
   */
  it('wanders: the drive is never the same twice for a steady input', () => {
    const drives = runBlocks(400, 0.5);
    // Settled blocks only, so the follower's own rise is not read as wander.
    const settled = drives.slice(200);
    const spread = Math.max(...settled) - Math.min(...settled);
    expect(spread).toBeGreaterThan(0);
    expect(new Set(settled).size).toBeGreaterThan(settled.length / 2);
  });

  /**
   * And it must follow the programme. Real valve and transformer stages
   * saturate harder when driven harder; a fixed amount is the giveaway that
   * something is a plug-in.
   */
  it('follows the programme: a louder passage is driven harder', () => {
    const quiet = runBlocks(400, 0.05).slice(200);
    const loud = runBlocks(400, 0.9).slice(200);
    const mean = (values: number[]) =>
      values.reduce((total, value) => total + value, 0) / values.length;
    expect(mean(loud)).toBeGreaterThan(mean(quiet));
  });

  it('leaves a silent block silent', () => {
    const state = createOrganicState(128);
    const buffer = new Float32Array(128);
    organicBlock(state, buffer, 0.6, RATE);
    expect(buffer.every((value) => Math.abs(value) < 1e-9)).toBe(true);
  });
});
