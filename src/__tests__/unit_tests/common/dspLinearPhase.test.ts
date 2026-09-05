/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fftInPlace from '../../../common/dsp/fft';
import { DSP_DEFAULTS, IEqSettings } from '../../../common/dsp/chain';
import {
  KERNEL_SIZE,
  buildLinearPhaseKernel,
} from '../../../renderer/dsp/linearPhase';
import { curveResponseDb } from '../../../renderer/dsp/rack';

const RATE = 48_000;

/** The kernel's own response at one frequency, in dB, by direct evaluation. */
const kernelResponseDb = (kernel: Float32Array, hz: number): number => {
  let real = 0;
  let imaginary = 0;
  const step = (2 * Math.PI * hz) / RATE;
  for (let i = 0; i < kernel.length; i += 1) {
    real += kernel[i] * Math.cos(step * i);
    imaginary -= kernel[i] * Math.sin(step * i);
  }
  return 20 * Math.log10(Math.hypot(real, imaginary));
};

const rackWith = (gains: Partial<Record<number, number>>): IEqSettings => ({
  ...DSP_DEFAULTS.eq,
  bands: DSP_DEFAULTS.eq.bands.map((band, index) => ({
    ...band,
    gainDb: gains[index] ?? 0,
  })),
});

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

describe('the linear-phase kernel', () => {
  /**
   * Symmetric about its centre, which is the whole definition.
   *
   * A kernel that is symmetric has constant group delay by construction: every
   * frequency is delayed by exactly half its length and none is delayed
   * relative to another. If this fails the filter is not linear phase, whatever
   * the setting is called.
   */
  it('is symmetric, which is what makes the phase linear', () => {
    const kernel = buildLinearPhaseKernel(rackWith({ 2: 6, 11: -4 }), RATE);
    expect(kernel.length).toBe(KERNEL_SIZE);
    // Five places, not more: the kernel is Float32 and the taps near the centre
    // are of order 1, so the last bit of the mantissa is about 1e-7. A tighter
    // bound would be testing the storage format rather than the symmetry.
    for (let i = 1; i < KERNEL_SIZE / 2; i += 1) {
      expect(kernel[KERNEL_SIZE / 2 + i]).toBeCloseTo(
        kernel[KERNEL_SIZE / 2 - i],
        5,
      );
    }
  });

  /**
   * And it has to be the RIGHT magnitude, not merely a symmetric one.
   *
   * Symmetry alone is satisfied by a kernel of zeros, and by one that filters
   * nothing. This is the positive control: a rack with a known +6 dB at 80 Hz
   * and -4 dB at 5 kHz must come back out of the kernel at those frequencies,
   * or the transform is producing a well-formed filter that does the wrong job.
   */
  it('reproduces the rack it was built from', () => {
    const kernel = buildLinearPhaseKernel(rackWith({ 2: 6, 11: -4 }), RATE);
    // Two places. Measured, the ISO rack comes back exact to 0.00 dB at every
    // probe — the truncation this kernel length costs only shows on bands far
    // narrower than the rack's own.
    expect(kernelResponseDb(kernel, 80)).toBeCloseTo(6, 2);
    expect(kernelResponseDb(kernel, 5_000)).toBeCloseTo(-4, 2);
    expect(kernelResponseDb(kernel, 40)).toBeCloseTo(1.15, 2);
  });

  /** A rack doing nothing is a delay and nothing else: flat everywhere, so
   * choosing linear phase on a flat curve cannot colour anything. */
  it('is flat when the rack is flat', () => {
    const kernel = buildLinearPhaseKernel(rackWith({}), RATE);
    [40, 200, 1_000, 6_000, 15_000].forEach((hz) => {
      expect(kernelResponseDb(kernel, hz)).toBeCloseTo(0, 3);
    });
  });

  /**
   * The limit, written down rather than discovered later.
   *
   * A Q of 8 at 50 Hz rings for about 51 ms and published correction files do
   * contain bands like it. At this kernel length it comes back within 0.8 dB;
   * at half the length it was out by 2.9. This asserts the bound rather than
   * the exact figure — if a change makes it worse, that is the trade moving
   * and somebody should have to look at it.
   */
  it('holds a narrow imported band to within a decibel', () => {
    const narrow: IEqSettings = {
      ...DSP_DEFAULTS.eq,
      bands: DSP_DEFAULTS.eq.bands.map((band, index) =>
        index === 1 ? { ...band, gainDb: 9, quality: 8 } : band,
      ),
    };
    const kernel = buildLinearPhaseKernel(narrow, RATE);
    [45, 50, 55].forEach((hz) => {
      const target = curveResponseDb(narrow.bands, [hz], RATE)[0];
      const error = Math.abs(kernelResponseDb(kernel, hz) - target);
      expect(`${hz} Hz within 1 dB: ${error < 1}`).toBe(
        `${hz} Hz within 1 dB: true`,
      );
    });
  });

  /** The subsonic high pass is part of the rack, so it has to survive the
   * change of engine — a protective filter that switches itself off when the
   * phase mode changes is worse than one that was never offered. */
  it('keeps the subsonic filter', () => {
    const kernel = buildLinearPhaseKernel(
      { ...rackWith({}), subsonicHz: 30 },
      RATE,
    );
    expect(kernelResponseDb(kernel, 10)).toBeLessThan(-12);
    expect(kernelResponseDb(kernel, 1_000)).toBeCloseTo(0, 1);
  });
});
