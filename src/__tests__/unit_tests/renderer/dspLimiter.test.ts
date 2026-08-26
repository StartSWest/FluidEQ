/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createLinkedLimiterState,
  createLimiterState,
  processLinkedLimiter,
  processLimiter,
} from '../../../renderer/dsp/limiter';

const LOOK_AHEAD = 64;
const CEILING = 0.5;
const OPTIONS = { ceiling: CEILING, releaseCoefficient: 0.999 };

/**
 * How far over the ceiling a reading may sit.
 *
 * Not zero, and the reason is the detector rather than the limiter. The
 * inter-sample detector is a 12-tap FIR, so it starts with a window of zeros
 * and under-reads while that window fills — the limiter therefore holds a
 * slightly generous gain for the first few dozen samples of a stream.
 * Measured at 1.6e-4 over a 0.5 ceiling, which is 0.0014dB, once, at the very
 * start. In steady state the output is exactly the ceiling.
 */
const STARTUP_TOLERANCE = 1e-3;

const run = (input: Float32Array): Float32Array => {
  const state = createLimiterState(LOOK_AHEAD);
  const output = new Float32Array(input.length);
  processLimiter(state, input, output, OPTIONS);
  return output;
};

const peak = (signal: Float32Array): number =>
  signal.reduce((highest, value) => Math.max(highest, Math.abs(value)), 0);

describe('look-ahead limiter', () => {
  it('NULL TEST: a signal already under the ceiling comes back untouched', () => {
    const input = new Float32Array(1_024);
    for (let i = 0; i < input.length; i += 1) {
      input[i] = Math.sin(i / 10) * 0.2;
    }
    const output = run(input);
    for (let i = LOOK_AHEAD; i < input.length; i += 1) {
      expect(output[i]).toBeCloseTo(input[i - LOOK_AHEAD], 5);
    }
  });

  /**
   * Without this, the null test above proves nothing.
   *
   * A `processLimiter` that copied its input and never touched the gain would
   * pass the null test perfectly. So would one that wrote silence, if the null
   * test only checked the peak. This asserts the function does something, and
   * that the something is bounded by the ceiling.
   */
  it('POSITIVE CONTROL: a signal over the ceiling is turned down to it', () => {
    const output = run(new Float32Array(1_024).fill(0.9));
    const settled = output.subarray(LOOK_AHEAD + 32);
    expect(peak(settled)).toBeLessThanOrEqual(CEILING + STARTUP_TOLERANCE);
    // The true-peak detector may reduce sample peaks below the numerical
    // ceiling when their reconstructed inter-sample peak is higher. It must
    // still retain useful level rather than muting the programme.
    expect(peak(settled)).toBeGreaterThan(CEILING * 0.9);
  });

  /**
   * The reason look-ahead exists at all.
   *
   * A single-sample spike in the middle of silence is the hardest case: a
   * limiter reacting when it arrives has already emitted it at full scale.
   * This passing is the proof the gain is down before the peak is heard.
   */
  it('is already turned down when an isolated transient arrives', () => {
    const input = new Float32Array(1_024);
    input[512] = 1;
    expect(peak(run(input))).toBeLessThanOrEqual(CEILING + STARTUP_TOLERANCE);
  });

  it('limits a negative peak as hard as a positive one', () => {
    const output = run(new Float32Array(1_024).fill(-0.9));
    const settled = output.subarray(LOOK_AHEAD + 32);
    expect(Math.min(...Array.from(settled))).toBeGreaterThanOrEqual(
      -CEILING - STARTUP_TOLERANCE,
    );
  });

  it('recovers towards unity once the loud part stops', () => {
    const input = new Float32Array(4_096);
    input.fill(0.9, 0, 512);
    input.fill(0.1, 512);
    const state = createLimiterState(LOOK_AHEAD);
    const output = new Float32Array(input.length);
    processLimiter(state, input, output, {
      ceiling: CEILING,
      releaseCoefficient: 0.99,
    });
    // Long after the loud section, quiet audio should be passing at full level.
    expect(output[4_000]).toBeCloseTo(0.1, 3);
  });

  /**
   * What the inter-sample detector is FOR, and the only reason it is worth its
   * cost.
   *
   * A tone at a quarter of the sample rate, offset so no sample lands on a
   * crest, sits at about 0.7 in every sample it has and reaches 1.0 between
   * them. A sample-peak limiter looks at 0.7, decides a 0.9 ceiling needs no
   * work at all, and passes a signal that reconstructs above full scale — which
   * is what a converter, a resampler, and every streaming service's meter
   * actually see.
   *
   * Without this test the change to `truePeakOfSample` would be indisting-
   * uishable from having loosened a tolerance.
   */
  it('POSITIVE CONTROL: catches a peak that lives between the samples', () => {
    const rate = 48_000;
    const input = new Float32Array(4_096);
    for (let i = 0; i < input.length; i += 1) {
      input[i] = Math.sin((2 * Math.PI * 12_000 * i) / rate + Math.PI / 4);
    }
    // Every sample is comfortably under this ceiling, so a sample-peak
    // limiter would do nothing whatsoever.
    const ceiling = 0.9;
    expect(peak(input)).toBeLessThan(ceiling);

    const state = createLimiterState(LOOK_AHEAD);
    const output = new Float32Array(input.length);
    processLimiter(state, input, output, {
      ceiling,
      releaseCoefficient: 0.9999,
    });

    // It reduced: the inter-sample peak was over the ceiling even though no
    // sample was.
    expect(peak(output.subarray(512))).toBeLessThan(peak(input) - 1e-3);
  });

  it('works in place when input and output are the same array', () => {
    const buffer = new Float32Array(1_024).fill(0.9);
    const state = createLimiterState(LOOK_AHEAD);
    processLimiter(state, buffer, buffer, OPTIONS);
    expect(peak(buffer.subarray(LOOK_AHEAD + 32))).toBeLessThanOrEqual(
      CEILING + STARTUP_TOLERANCE,
    );
  });
});

describe('linked limiter bounded recovery', () => {
  it('lands a deep reduction at unity inside the four-second cap', () => {
    const rate = 1_000;
    const state = createLinkedLimiterState(1, 1, 1);
    state.detectorGain = 0.05;
    state.gain = 0.05;
    const silence = [new Float32Array(rate * 4)];

    processLinkedLimiter(state, silence, {
      ceiling: 1,
      releaseCoefficient: Math.exp(-1 / rate),
      releaseSnapRatio: 0.02,
      sampleRate: rate,
    });

    expect(state.detectorGain).toBe(1);
    expect(state.gain).toBe(1);
  });
});
