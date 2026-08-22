/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createDelayLine,
  processDelayLine,
} from '../../../renderer/dsp/delayLine';
import {
  LINEAR_PHASE_LATENCY,
  linearPhaseLatencyMs,
} from '../../../renderer/dsp/linearPhase';

/** Push a signal through in 128-sample quanta, as the worklet does. */
const runInQuanta = (delay: number, signal: Float32Array): Float32Array => {
  const state = createDelayLine(delay);
  const output = new Float32Array(signal.length);
  const block = new Float32Array(128);
  for (let at = 0; at < signal.length; at += 128) {
    block.set(signal.subarray(at, at + 128));
    processDelayLine(state, block);
    output.set(block, at);
  }
  return output;
};

describe('the bypass delay', () => {
  /**
   * The one number that matters. It exists so the channel mid/side leaves
   * unfiltered lands at the same moment as the one that went through the
   * convolver — a sample out either way and the decode is combining two
   * different instants of the record.
   */
  it('delays by exactly what it was asked for', () => {
    const signal = new Float32Array(2_048);
    for (let i = 0; i < signal.length; i += 1) {
      signal[i] = Math.sin(i / 4);
    }

    [0, 1, 127, 128, 129, 512, 1_000].forEach((delay) => {
      const output = runInQuanta(delay, signal);
      for (let i = delay; i < signal.length; i += 1) {
        expect(`${delay}@${i}: ${output[i]}`).toBe(
          `${delay}@${i}: ${signal[i - delay]}`,
        );
      }
      // And silence before it, rather than whatever the buffer happened to
      // hold: an uninitialised ring is a burst of noise on the first block.
      for (let i = 0; i < delay; i += 1) {
        expect(output[i]).toBe(0);
      }
    });
  });

  /**
   * The line and the convolver have to agree, and neither knows about the
   * other. This is the assertion that keeps them in step: the delay the worklet
   * builds is the latency the control advertises.
   */
  it('matches the latency linear phase reports', () => {
    expect(LINEAR_PHASE_LATENCY).toBe(8_192 + 512);
    expect(linearPhaseLatencyMs(48_000)).toBe(181);
  });
});
