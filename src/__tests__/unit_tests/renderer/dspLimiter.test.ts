/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createLimiterState,
  processLimiter,
} from '../../../renderer/dsp/limiter';

const LOOK_AHEAD = 64;
const CEILING = 0.5;
const OPTIONS = { ceiling: CEILING, releaseCoefficient: 0.999 };

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
    expect(peak(settled)).toBeLessThanOrEqual(CEILING + 1e-6);
    expect(peak(settled)).toBeGreaterThan(CEILING - 1e-3);
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
    expect(peak(run(input))).toBeLessThanOrEqual(CEILING + 1e-6);
  });

  it('limits a negative peak as hard as a positive one', () => {
    const output = run(new Float32Array(1_024).fill(-0.9));
    const settled = output.subarray(LOOK_AHEAD + 32);
    expect(Math.min(...Array.from(settled))).toBeGreaterThanOrEqual(
      -CEILING - 1e-6,
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

  it('works in place when input and output are the same array', () => {
    const buffer = new Float32Array(1_024).fill(0.9);
    const state = createLimiterState(LOOK_AHEAD);
    processLimiter(state, buffer, buffer, OPTIONS);
    expect(peak(buffer.subarray(LOOK_AHEAD + 32))).toBeLessThanOrEqual(
      CEILING + 1e-6,
    );
  });
});
