/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fftInPlace from '../../../common/dsp/fft';

describe('the shared FFT', () => {
  /**
   * Forward then inverse is the identity up to the 1/N the caller applies.
   *
   * Checked here rather than trusted after the move out of the separation
   * module: the two callers now share one set of sign and scaling conventions,
   * and this is the assertion that says they still agree.
   */
  it('round-trips a signal', () => {
    const size = 64;
    const real = new Float64Array(size);
    const imaginary = new Float64Array(size);
    for (let i = 0; i < size; i += 1) {
      real[i] = Math.sin(i / 3) + 0.25 * Math.cos(i / 7);
    }
    const original = Float64Array.from(real);

    fftInPlace(real, imaginary, false);
    fftInPlace(real, imaginary, true);

    for (let i = 0; i < size; i += 1) {
      expect(real[i] / size).toBeCloseTo(original[i], 10);
      expect(imaginary[i] / size).toBeCloseTo(0, 10);
    }
  });
});
