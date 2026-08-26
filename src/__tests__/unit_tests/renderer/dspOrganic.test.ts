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
 * Body is even harmonics; grit is odd ones. The material-voicing target is a
 * warmer, cellulose-like presentation from an otherwise clean, metallic
 * source. Anything can make harmonics — the reason this is a separate stage
 * from fuzz is that it keeps the even ones at least twice as strong all the
 * way up its travel. That leaves enough third harmonic for definition without
 * letting the odd family become the grain.
 */
describe('the organic curve', () => {
  it('keeps even harmonics dominant across the whole travel', () => {
    [0.15, 0.25, 0.5, 0.75, 1].forEach((amount) => {
      const { second, third, fourth, fifth } = harmonics(amount);
      const even = second + fourth;
      const odd = third + fifth;
      expect(even).toBeGreaterThan(odd * 2);
    });
  });

  it('goes on getting thicker rather than levelling off', () => {
    // The second harmonic rises on every step. A stage
    // whose second harmonic stopped rising would be a dial with a dead half.
    expect(harmonics(0.15).second).toBeGreaterThan(2);
    expect(harmonics(1).second).toBeGreaterThan(harmonics(0.5).second);
    expect(harmonics(0.5).second).toBeGreaterThan(harmonics(0.25).second);
  });

  it('keeps the foundation subordinate to the harmonic return', () => {
    const amount = 0.35;
    const drive = organicDrive(amount);
    const asymmetry = organicAsymmetry(amount);
    const smallSignal = 0.01;
    const foundationOnly = organicSample(smallSignal, drive, asymmetry, 0);
    // The former full foundation was 0.65 * input. Organic now retains only
    // 80% of it, enough continuity to avoid detached fizz without presenting a
    // second filtered copy of the programme.
    expect(foundationOnly).toBeCloseTo(smallSignal * 0.65 * 0.8, 3);
    // At the default amount the added octave is deliberately a major part of
    // the return, which is the audible definition this revision is for.
    expect(harmonics(amount).second).toBeGreaterThan(40);
  });

  /**
   * Regression lock for the version Ivan approved by ear.
   *
   * A lower bound alone would allow Organic to drift all the way back into
   * fuzz. These windows preserve both sides of the decision: enough second
   * harmonic to feel sharp, a restrained third so it stays fluid, and a clear
   * even-family lead so the return never becomes granular.
   */
  it('locks the approved sharp-but-fluid harmonic balance', () => {
    const { second, third, fourth, fifth } = harmonics(0.35);
    const evenToOdd = (second + fourth) / (third + fifth);
    expect(second).toBeGreaterThan(45);
    expect(second).toBeLessThan(52);
    expect(third).toBeGreaterThan(12);
    expect(third).toBeLessThan(18);
    expect(evenToOdd).toBeGreaterThan(3.2);
    expect(evenToOdd).toBeLessThan(3.8);
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
   * Random or programme-level drive modulation was the source of the granular
   * version Ivan rejected. The authored amount must settle and stay still;
   * transient discrimination moves only the harmonic residue per sample.
   */
  it('holds the authored drive steady on a sustained signal', () => {
    const drives = runBlocks(400, 0.5);
    const settled = drives.slice(200);
    const spread = Math.max(...settled) - Math.min(...settled);
    expect(spread).toBe(0);
    expect(settled[0]).toBeCloseTo(organicDrive(0.6), 8);
  });

  /**
   * Loudness must not secretly rewrite the Amount dial. That block-rate
   * behaviour made sustained music pump and grain; the per-sample transient
   * path supplies motion without moving the foundation or the authored drive.
   */
  it('does not modulate drive from programme level', () => {
    const quiet = runBlocks(400, 0.05).slice(200);
    const loud = runBlocks(400, 0.9).slice(200);
    const mean = (values: number[]) =>
      values.reduce((total, value) => total + value, 0) / values.length;
    expect(mean(loud)).toBeCloseTo(mean(quiet), 8);
  });

  it('leaves a silent block silent', () => {
    const state = createOrganicState(128);
    const buffer = new Float32Array(128);
    organicBlock(state, buffer, 0.6, RATE);
    expect(buffer.every((value) => Math.abs(value) < 1e-9)).toBe(true);
  });
});
