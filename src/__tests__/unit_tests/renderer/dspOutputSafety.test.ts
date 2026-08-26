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
});
