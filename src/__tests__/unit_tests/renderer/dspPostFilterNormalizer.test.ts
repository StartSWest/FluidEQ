/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  POST_FILTER_NORMALIZER_MAX_RELEASE_MS,
  POST_FILTER_NORMALIZER_RELEASE_HOLD_MS,
  POST_FILTER_NORMALIZER_RELEASE_SNAP_RATIO,
  createPostFilterNormalizer,
  processPostFilterNormalizer,
} from '../../../renderer/dsp/postFilterNormalizer';

/** Hold, then the exponential run down to the snap, at the slowest release. */
const recoveryMs =
  POST_FILTER_NORMALIZER_RELEASE_HOLD_MS +
  POST_FILTER_NORMALIZER_MAX_RELEASE_MS *
    Math.log(1 / POST_FILTER_NORMALIZER_RELEASE_SNAP_RATIO);

describe('post-filter headroom recovery', () => {
  it('cannot remain pinned after a 26 dB correction', () => {
    const sampleRate = 1_000;
    const state = createPostFilterNormalizer(1, sampleRate, 1);
    const deepGain = 10 ** (-26 / 20);
    state.limiter.detectorGain = deepGain;
    state.limiter.gain = deepGain;
    // The emitted gain is read from the delayed control ring, so a state this
    // deep has to be written there too or the first sample recovers by itself.
    state.limiter.gainReductionDb.fill(-26);
    state.limiter.releaseHoldRemaining = Math.round(
      (POST_FILTER_NORMALIZER_RELEASE_HOLD_MS / 1_000) * sampleRate,
    );
    const silence = [
      new Float32Array(Math.ceil((recoveryMs / 1_000) * sampleRate)),
    ];

    processPostFilterNormalizer(state, silence, {
      enabled: true,
      outputCeilingDb: -1,
      followingGainDb: 0,
      releaseMs: 2_000,
      sampleRate,
    });

    expect(state.limiter.detectorGain).toBe(1);
    expect(state.limiter.gain).toBe(1);
  });
});

/**
 * The two things a slew-rate attack with no look-ahead cannot do.
 *
 * Both were shipped and both were audible. Measured on the old constants —
 * zero look-ahead, a 5 dB/s attack, a one-second hold — the transient below
 * left at -0.00 dB against a -1.2 dB ceiling, and the bed either side of it
 * was still 1.3 dB down two and a half seconds later. A test that only asserts
 * the ceiling would have passed the second defect; a test that only asserts
 * recovery would have passed the first.
 */
const RATE = 48_000;
const BED_DB = -9;
const CEILING_DB = -1;
/** What the stage actually holds: the ceiling less its reconstruction margin. */
const HELD_DB = CEILING_DB - 0.2;

const programmeWithTransient = (): Float32Array[] => {
  const total = Math.round(2.5 * RATE);
  const bed = 10 ** (BED_DB / 20);
  const samples = new Float32Array(total);
  for (let at = 0; at < total; at += 1) {
    samples[at] = bed * Math.sin((2 * Math.PI * 220 * at) / RATE);
  }
  // 15 ms of full scale at half a second in, which is a snare.
  const from = Math.round(0.5 * RATE);
  const to = from + Math.round(0.015 * RATE);
  for (let at = from; at < to; at += 1) {
    samples[at] = Math.sin((2 * Math.PI * 220 * at) / RATE);
  }
  return [samples, Float32Array.from(samples)];
};

const peakBetween = (samples: Float32Array, fromMs: number, toMs: number) => {
  const from = Math.round((fromMs / 1_000) * RATE);
  const to = Math.round((toMs / 1_000) * RATE);
  let peak = 0;
  for (let at = from; at < to; at += 1) {
    peak = Math.max(peak, Math.abs(samples[at]));
  }
  return 20 * Math.log10(peak);
};

describe('post-filter headroom on a transient', () => {
  const render = () => {
    const channels = programmeWithTransient();
    const state = createPostFilterNormalizer(2, RATE, 4);
    const block = 480;
    for (let at = 0; at < channels[0].length; at += block) {
      const frames = Math.min(block, channels[0].length - at);
      processPostFilterNormalizer(
        state,
        channels.map((channel) => channel.subarray(at, at + frames)),
        {
          enabled: true,
          outputCeilingDb: CEILING_DB,
          followingGainDb: 0,
          releaseMs: 200,
          sampleRate: RATE,
        },
      );
    }
    return channels[0];
  };

  it('holds the ceiling through the transient itself', () => {
    // From 10 ms, because the look-ahead delay starts empty and emits silence.
    expect(peakBetween(render(), 10, 2_500)).toBeLessThanOrEqual(
      HELD_DB + 0.05,
    );
  });

  it('does not ride the programme down after it', () => {
    const output = render();
    // Before the hit, so the assertion below is against a measured level and
    // not against the constant it was written from.
    expect(peakBetween(output, 300, 400)).toBeCloseTo(BED_DB, 1);
    // One release constant later the bed is back; the old stage was still
    // 1.3 dB down here and had another second of recovery to go.
    expect(peakBetween(output, 1_000, 1_100)).toBeCloseTo(BED_DB, 1);
    expect(peakBetween(output, 2_000, 2_100)).toBeCloseTo(BED_DB, 1);
  });
});
