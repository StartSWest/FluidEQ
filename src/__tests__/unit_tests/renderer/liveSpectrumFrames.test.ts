/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { writeChannelWaveformPoints } from '../../../renderer/graph/liveSpectrumFrames';

describe('live output waveform frames', () => {
  it('keeps strong opposite-polarity stereo channels visible', () => {
    const left = new Float32Array([0.8, -0.6, 0.4, -0.2]);
    const right = new Float32Array([-0.8, 0.6, -0.4, 0.2]);

    expect(
      writeChannelWaveformPoints(new Array(2).fill(0), [left, right]),
    ).toEqual([0.800000011920929, 0.4000000059604645]);
  });

  it('uses the loudest real channel rather than averaging channels together', () => {
    const left = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const right = new Float32Array([0.7, 0.1, 0.2, 0.1]);

    expect(
      writeChannelWaveformPoints(new Array(2).fill(0), [left, right]),
    ).toEqual([0.699999988079071, 0.4000000059604645]);
  });

  it('clears the reusable frame when no channel samples are available', () => {
    expect(writeChannelWaveformPoints([0.7, 0.4], [])).toEqual([0, 0]);
  });
});
