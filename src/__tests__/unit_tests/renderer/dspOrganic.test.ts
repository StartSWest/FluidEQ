/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ORGANIC_FOUNDATION_GAIN,
  createOrganicState,
  organicBlock,
  organicDepth,
  organicEvenWeight,
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

/**
 * What the stage returns for a steady tone, as a percentage of that tone.
 *
 * Measured against the INPUT rather than against the return's own fundamental,
 * because the return no longer has one worth dividing by: `organicBlock` hands
 * back harmonics only and the foundation is restored by the caller. It is also
 * the honest reference — a percentage of the note is what a listener hears this
 * as, and it does not move when the carrier is retuned.
 */
const harmonics = (amount: number, amplitude = AMPLITUDE) => {
  const state = createOrganicState(SIZE);
  const out = new Float32Array(SIZE);
  // Two passes: the level and projection followers need a run at the signal
  // before the second one is the settled stage rather than the stage arriving.
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < SIZE; i += 1) {
      out[i] = amplitude * Math.sin((2 * Math.PI * FREQ * i) / RATE);
    }
    organicBlock(state, out, amount, RATE);
  }
  const measured = Float64Array.from(out);
  const at = (n: number) => (magnitudeAt(measured, FREQ * n) / amplitude) * 100;
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
      // The recipe itself never crosses over either, which is the reason the
      // measurement above can hold: body is what this stage is, at both ends.
      expect(organicEvenWeight(amount)).toBeGreaterThan(0.7);
    });
  });

  it('goes on getting thicker rather than levelling off', () => {
    // The second harmonic rises on every step. A stage
    // whose second harmonic stopped rising would be a dial with a dead half.
    expect(harmonics(0.15).second).toBeGreaterThan(2);
    expect(harmonics(1).second).toBeGreaterThan(harmonics(0.5).second);
    expect(harmonics(0.5).second).toBeGreaterThan(harmonics(0.25).second);
  });

  /**
   * The carrier is the same quiet one the three bands use.
   *
   * It was 0.52 — half a copy of Organic's own focused band, against the bands'
   * 0.18 — which made this the loudest stage in several profiles and its Amount
   * a level control. Measured alone at its focus, the MINIMUM amount already
   * added +1.23 dB and the whole dial reached only +3.18, so turning it down
   * could not take the lift away. It reads +0.41 to +1.36 now.
   */
  it('keeps the foundation subordinate to the harmonic return', () => {
    expect(ORGANIC_FOUNDATION_GAIN).toBeCloseTo(0.18, 10);
    // At the default amount the added octave is a major part of the return,
    // which is the audible definition this stage is for.
    expect(harmonics(0.35).second).toBeGreaterThan(10);
  });

  /**
   * The same harmonics at any playback level, which is what the shared
   * generator bought.
   *
   * The soft diode this replaced drove its curvature with the programme, so on
   * this stage the second order measured -19.2 dB under the note at -6 dBFS,
   * -35.9 at -26 and -55.1 at -46: an effect that arrived on peaks and was
   * absent from everything quieter.
   */
  it('makes the same harmonics whatever the input level is', () => {
    const loud = harmonics(0.35, 0.5);
    const quiet = harmonics(0.35, 0.005);
    expect(quiet.second / loud.second).toBeGreaterThan(0.9);
    expect(quiet.second / loud.second).toBeLessThan(1.1);
    // The positive control: sameness is only worth asserting if there is
    // something there to be the same.
    expect(loud.second).toBeGreaterThan(5);
  });

  /**
   * Regression lock for the version Ivan approved by ear.
   *
   * A lower bound alone would allow Organic to drift all the way back into
   * fuzz. These windows preserve both sides of the decision: enough second
   * harmonic to feel sharp, a restrained third so it stays fluid, and a clear
   * even-family lead so the return never becomes granular.
   *
   * The numbers have moved twice, and neither time was a change of taste.
   *
   * First the reference did: they used to be a percentage of the return's OWN
   * fundamental, which was 0.52 of the input, and the carrier is 0.18 now.
   *
   * Then the depth did. It had been set so the default matched the old
   * soft-diode curve on a -6 dBFS TONE, and that was the wrong place to match —
   * the old curve followed the input level, so on ordinary material it produced
   * far less, while this one produces the same ratio everywhere. Matching at
   * the peak put about ten decibels too much on everything else.
   */
  it('locks the approved sharp-but-fluid harmonic balance', () => {
    const { second, third, fourth, fifth } = harmonics(0.35);
    const evenToOdd = (second + fourth) / (third + fifth);
    expect(second).toBeGreaterThan(9);
    expect(second).toBeLessThan(14);
    expect(third).toBeGreaterThan(1);
    expect(third).toBeLessThan(3);
    expect(evenToOdd).toBeGreaterThan(4);
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
      const state = createOrganicState(128);
      const buffer = new Float32Array(128);
      organicBlock(state, buffer, amount, RATE);
      expect(buffer.every((value) => Math.abs(value) < 1e-12)).toBe(true);
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
  it('holds the authored depth steady on a sustained signal', () => {
    const drives = runBlocks(400, 0.5);
    const settled = drives.slice(200);
    const spread = Math.max(...settled) - Math.min(...settled);
    expect(spread).toBe(0);
    expect(settled[0]).toBeCloseTo(organicDepth(0.6), 8);
  });

  /**
   * Loudness must not secretly rewrite the Amount dial. That block-rate
   * behaviour made sustained music pump and grain; the per-sample transient
   * path supplies motion without moving the foundation or the authored drive.
   */
  it('does not modulate depth from programme level', () => {
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
