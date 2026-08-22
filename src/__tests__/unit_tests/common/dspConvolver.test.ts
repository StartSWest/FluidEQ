/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  CONVOLVER_LATENCY,
  convolve,
  createConvolver,
  prepareKernel,
} from '../../../renderer/dsp/convolver';

/** Run a whole signal through in 128-sample quanta, as the worklet does. */
const runInQuanta = (
  kernel: Float32Array,
  signal: Float32Array,
): Float32Array => {
  const state = createConvolver(prepareKernel(kernel));
  const output = new Float32Array(signal.length);
  const block = new Float32Array(128);
  for (let at = 0; at < signal.length; at += 128) {
    block.set(signal.subarray(at, at + 128));
    convolve(state, block);
    output.set(block, at);
  }
  return output;
};

describe('the partitioned convolver', () => {
  /**
   * A kernel that is a single 1 is a pure delay, and the delay must be exactly
   * what the module claims. Everything else in the linear-phase path depends on
   * this number being right — get it wrong and the two channels still agree
   * with each other while the whole rack sits off the transport.
   */
  it('delays by exactly the latency it reports', () => {
    const kernel = new Float32Array(1_024);
    kernel[0] = 1;
    const signal = new Float32Array(4_096);
    for (let i = 0; i < signal.length; i += 1) {
      signal[i] = Math.sin(i / 5);
    }

    const output = runInQuanta(kernel, signal);
    for (let i = CONVOLVER_LATENCY; i < signal.length; i += 1) {
      expect(output[i]).toBeCloseTo(signal[i - CONVOLVER_LATENCY], 6);
    }
  });

  /**
   * And it has to actually convolve, not merely delay.
   *
   * The positive control: a two-tap kernel is a delay plus half of itself one
   * sample later, which no amount of buffering could produce by accident. A
   * convolver that had quietly become a passthrough sails through the test
   * above and fails here.
   */
  it('convolves rather than passing through', () => {
    const kernel = new Float32Array(1_024);
    kernel[0] = 1;
    kernel[1] = 0.5;
    const signal = new Float32Array(2_048);
    signal[100] = 1;

    const output = runInQuanta(kernel, signal);
    expect(output[100 + CONVOLVER_LATENCY]).toBeCloseTo(1, 6);
    expect(output[101 + CONVOLVER_LATENCY]).toBeCloseTo(0.5, 6);
    expect(output[102 + CONVOLVER_LATENCY]).toBeCloseTo(0, 6);
  });

  /**
   * Every partition has to be reached, not just the first.
   *
   * A kernel longer than one partition is where the ring's indexing either
   * works or is off by one, and an off-by-one there is not silence — it is a
   * plausible-sounding filter with the wrong response, which is exactly the
   * kind of defect that ships.
   */
  it('reaches taps in the last partition', () => {
    const kernel = new Float32Array(2_048);
    kernel[0] = 1;
    kernel[2_000] = 0.25;
    const signal = new Float32Array(8_192);
    signal[10] = 1;

    const output = runInQuanta(kernel, signal);
    expect(output[10 + CONVOLVER_LATENCY]).toBeCloseTo(1, 6);
    expect(output[10 + 2_000 + CONVOLVER_LATENCY]).toBeCloseTo(0.25, 6);
  });

  /** Two channels fed the same samples through their own states must come out
   * identical, or the stereo image moves whenever the mode is switched. */
  it('is deterministic across independent states', () => {
    const kernel = new Float32Array(1_024);
    kernel[0] = 0.7;
    kernel[300] = -0.3;
    const signal = new Float32Array(4_096);
    for (let i = 0; i < signal.length; i += 1) {
      signal[i] = Math.sin(i / 3) * Math.cos(i / 17);
    }

    const left = runInQuanta(kernel, signal);
    const right = runInQuanta(kernel, signal);
    expect(Array.from(left)).toEqual(Array.from(right));
  });
});
