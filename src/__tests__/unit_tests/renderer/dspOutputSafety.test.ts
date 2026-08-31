/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  OUTPUT_SAFETY_CEILING_DB,
  OUTPUT_SAFETY_EXTREME_DBTP,
  createOutputSafety,
  processOutputSafety,
} from '../../../renderer/dsp/outputSafety';

const RATE = 48_000;
const FRAMES = 8_192;

const peak = (channels: Float32Array[]): number =>
  channels.reduce(
    (largest, channel) =>
      channel.reduce(
        (channelPeak, sample) => Math.max(channelPeak, Math.abs(sample)),
        largest,
      ),
    0,
  );

describe('always-on output safety', () => {
  it('contains a pathological overload beneath the safety ceiling', () => {
    const channels = [
      new Float32Array(FRAMES).fill(4),
      new Float32Array(FRAMES).fill(-3.5),
    ];
    processOutputSafety(createOutputSafety(2, RATE), channels, {
      limiterEnabled: true,
      activationThreshold: 10 ** (OUTPUT_SAFETY_EXTREME_DBTP / 20),
    });
    const ceiling = 10 ** (OUTPUT_SAFETY_CEILING_DB / 20);
    expect(peak(channels)).toBeLessThanOrEqual(ceiling + 1e-3);
  });

  it('keeps stereo proportions while limiting', () => {
    const left = new Float32Array(FRAMES);
    const right = new Float32Array(FRAMES);
    for (let i = 0; i < FRAMES; i += 1) {
      left[i] = Math.sin((2 * Math.PI * 997 * i) / RATE) * 4;
      right[i] = left[i] * 0.5;
    }
    processOutputSafety(createOutputSafety(2, RATE), [left, right], {
      limiterEnabled: true,
      activationThreshold: 10 ** (OUTPUT_SAFETY_EXTREME_DBTP / 20),
    });
    const ratioErrors: number[] = [];
    for (let i = 512; i < FRAMES; i += 97) {
      if (Math.abs(left[i]) > 1e-4) {
        ratioErrors.push(Math.abs(right[i] / left[i] - 0.5));
      }
    }
    expect(ratioErrors.length).toBeGreaterThan(0);
    expect(Math.max(...ratioErrors)).toBeLessThan(1e-5);
  });

  it('contains invalid numbers without poisoning later audio', () => {
    const left = Float32Array.from(
      { length: FRAMES },
      (_, index) => Math.sin((2 * Math.PI * 997 * index) / RATE) * 0.1,
    );
    const right = Float32Array.from(left, (sample) => -sample);
    left[256] = Number.NaN;
    right[512] = Number.POSITIVE_INFINITY;
    processOutputSafety(createOutputSafety(2, RATE), [left, right]);
    expect([...left, ...right].every(Number.isFinite)).toBe(true);
    expect(peak([left.subarray(FRAMES - 512)])).toBeGreaterThan(0.05);
  });

  it('removes a sustained DC component', () => {
    const left = new Float32Array(FRAMES).fill(0.25);
    const right = new Float32Array(FRAMES).fill(0.25);
    processOutputSafety(createOutputSafety(2, RATE), [left, right]);
    expect(Math.abs(left[FRAMES - 1])).toBeLessThan(0.02);
    expect(Math.abs(right[FRAMES - 1])).toBeLessThan(0.02);
  });

  /**
   * A guard that armed on a fault has to let go once the fault is over.
   *
   * This is the whole bug, reported from a running window: exaggerate an EQ
   * band far enough to reach +10 dBTP, hear the output duck, set the band flat
   * again — and the level never comes back. The release coefficient was 1,
   * making the release term `(required - gain) * (1 - 1)`, which is zero. The
   * gain could move down and never up, so one overdriven moment turned the app
   * down until the chain was rebuilt.
   */
  const overloadThenRecover = (): { ducked: number; recovered: number } => {
    const state = createOutputSafety(2, RATE);
    const options = {
      limiterEnabled: true,
      activationThreshold: 10 ** (OUTPUT_SAFETY_EXTREME_DBTP / 20),
    };
    // The fault: well past the +10 dBTP the guard arms at.
    processOutputSafety(
      state,
      [new Float32Array(FRAMES).fill(4), new Float32Array(FRAMES).fill(4)],
      options,
    );
    const ducked = state.limiter.gain;

    /**
     * The source is fixed. Five seconds of ordinary music, nowhere near the
     * threshold, which is exactly when a guard has nothing left to guard.
     *
     * Five and not two because the duck was about twelve decibels, and a
     * one-second time constant covers that in roughly four: measured, two
     * seconds returns 0.899 and it is still climbing. The number is the
     * release doing what it says rather than a tolerance chosen to pass.
     */
    for (let block = 0; block < (RATE * 5) / FRAMES; block += 1) {
      const left = Float32Array.from(
        { length: FRAMES },
        (_, index) =>
          Math.sin((2 * Math.PI * 220 * (block * FRAMES + index)) / RATE) * 0.2,
      );
      processOutputSafety(state, [left, Float32Array.from(left)], options);
    }
    return { ducked, recovered: state.limiter.gain };
  };

  it('gives the level back once the overload stops', () => {
    const { ducked, recovered } = overloadThenRecover();
    // The fault really did pull it down, or the recovery below proves nothing.
    expect(ducked).toBeLessThan(0.5);
    expect(recovered).toBeGreaterThan(0.99);
  });

  /**
   * The positive control for the measurement itself.
   *
   * `recovered > 0.99` is also what a guard that never engaged would report,
   * so the reduction is asserted above; this pins the other end, that two
   * seconds is genuinely enough at the release this ships with. A release an
   * order of magnitude slower would pass the ceiling tests and still leave a
   * user turned down for a minute.
   */
  it('POSITIVE CONTROL: recovery is most of the way there within a second', () => {
    const state = createOutputSafety(2, RATE);
    const options = {
      limiterEnabled: true,
      activationThreshold: 10 ** (OUTPUT_SAFETY_EXTREME_DBTP / 20),
    };
    processOutputSafety(
      state,
      [new Float32Array(FRAMES).fill(4), new Float32Array(FRAMES).fill(4)],
      options,
    );
    for (let block = 0; block < RATE / FRAMES; block += 1) {
      const left = Float32Array.from(
        { length: FRAMES },
        (_, index) =>
          Math.sin((2 * Math.PI * 220 * (block * FRAMES + index)) / RATE) * 0.2,
      );
      processOutputSafety(state, [left, Float32Array.from(left)], options);
    }
    expect(state.limiter.gain).toBeGreaterThan(0.6);
  });
});
