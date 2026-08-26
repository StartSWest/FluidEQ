/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  POST_FILTER_NORMALIZER_MAX_RECOVERY_MS,
  POST_FILTER_NORMALIZER_RELEASE_HOLD_MS,
  createPostFilterNormalizer,
  processPostFilterNormalizer,
} from '../../../renderer/dsp/postFilterNormalizer';

describe('post-filter headroom recovery', () => {
  it('cannot remain pinned after a 26 dB correction', () => {
    const sampleRate = 1_000;
    const state = createPostFilterNormalizer(1, sampleRate, 1);
    const deepGain = 10 ** (-26 / 20);
    state.limiter.detectorGain = deepGain;
    state.limiter.gain = deepGain;
    state.limiter.releaseHoldRemaining = Math.round(
      (POST_FILTER_NORMALIZER_RELEASE_HOLD_MS / 1_000) * sampleRate,
    );
    const silence = [
      new Float32Array(
        Math.round(
          (POST_FILTER_NORMALIZER_MAX_RECOVERY_MS / 1_000) * sampleRate,
        ),
      ),
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
