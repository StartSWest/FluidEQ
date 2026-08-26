/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  readDspNormalizerMeter,
  setDspNormalizerMeter,
} from '../../../renderer/dsp/store';

describe('Normalizer live meter stability', () => {
  it('holds valid levels through empty decoder quanta without freezing gain', () => {
    setDspNormalizerMeter({
      inputPeaks: [0.5, 0.4],
      outputPeaks: [0.25, 0.2],
      appliedGainDb: -6,
    });
    setDspNormalizerMeter({
      inputPeaks: [0, 0],
      outputPeaks: [0, 0],
      appliedGainDb: -5.5,
    });

    expect(readDspNormalizerMeter()).toEqual({
      inputPeaks: [0.5, 0.4],
      outputPeaks: [0.25, 0.2],
      appliedGainDb: -5.5,
    });
  });

  it('accepts the next real measurement after a silent window', () => {
    setDspNormalizerMeter({
      inputPeaks: [0.3, 0.35],
      outputPeaks: [0.2, 0.22],
      appliedGainDb: -4,
    });

    expect(readDspNormalizerMeter().inputPeaks).toEqual([0.3, 0.35]);
    expect(readDspNormalizerMeter().outputPeaks).toEqual([0.2, 0.22]);
  });
});
