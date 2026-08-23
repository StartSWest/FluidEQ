/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IEqSettings } from '../../../common/dsp/chain';
import { buildLinearPhaseKernel } from '../../../renderer/dsp/linearPhase';

const RATE = 48_000;

/** The kernel's own response at one frequency, in dB. */
const responseDb = (kernel: Float32Array, hz: number): number => {
  let real = 0;
  let imaginary = 0;
  const step = (2 * Math.PI * hz) / RATE;
  for (let i = 0; i < kernel.length; i += 1) {
    real += kernel[i] * Math.cos(step * i);
    imaginary -= kernel[i] * Math.sin(step * i);
  }
  return 20 * Math.log10(Math.hypot(real, imaginary));
};

const rack = (dynamicAt: number | null): IEqSettings => ({
  ...DSP_DEFAULTS.eq,
  phase: 'linear',
  bands: DSP_DEFAULTS.eq.bands.map((band, index) => ({
    ...band,
    // 80 Hz and 5 kHz, so each can be probed without the other.
    gainDb: index === 2 || index === 11 ? 6 : 0,
    dynamic: index === dynamicAt,
  })),
});

describe('linear phase with a dynamic band', () => {
  /**
   * A kernel is a fixed filter and a dynamic band is not, so the band cannot be
   * in the kernel. Baked in at full strength it would be permanently engaged —
   * a static band with extra steps, and the opposite of what was asked for.
   *
   * It runs after the convolution as a biquad instead, which is why the kernel
   * has to leave it out: in and out, the band would be applied twice.
   */
  it('leaves the reacting band out of the kernel', () => {
    const withDynamic = buildLinearPhaseKernel(rack(2), RATE);
    // The static band is still there in full.
    expect(responseDb(withDynamic, 5_000)).toBeCloseTo(6, 1);
    // The reacting one is not.
    expect(responseDb(withDynamic, 80)).toBeCloseTo(0, 1);
  });

  /**
   * And the positive control: with nothing marked dynamic, both bands are in
   * the kernel. Without this, a kernel builder that had started returning a
   * flat response would pass the test above for the wrong reason.
   */
  it('keeps every static band in it', () => {
    const allStatic = buildLinearPhaseKernel(rack(null), RATE);
    expect(responseDb(allStatic, 80)).toBeCloseTo(6, 1);
    expect(responseDb(allStatic, 5_000)).toBeCloseTo(6, 1);
  });
});

describe('linear phase and the topology', () => {
  /**
   * An impulse pushed through a cascade IS the serial arrangement, so the
   * kernel ignored the engine entirely: choosing parallel and linear phase
   * together built a serial kernel with nothing to say so.
   *
   * The two are not interchangeable. Overlapping bands ADD in parallel and
   * MULTIPLY in serial, so where two bands meet the curves differ — which is
   * the whole reason the control exists.
   */
  it('builds a different kernel for each engine', () => {
    const overlapping = (engine: 'serial' | 'parallel'): IEqSettings => ({
      ...DSP_DEFAULTS.eq,
      phase: 'linear',
      engine,
      bands: DSP_DEFAULTS.eq.bands.map((band, index) => ({
        ...band,
        // Neighbours at 500 and 800 Hz, so their skirts genuinely overlap.
        gainDb: index === 6 || index === 7 ? 6 : 0,
      })),
    });

    const serial = buildLinearPhaseKernel(overlapping('serial'), RATE);
    const parallel = buildLinearPhaseKernel(overlapping('parallel'), RATE);

    // Between the two centres is where the arrangement shows.
    const between = 640;
    expect(
      Math.abs(responseDb(serial, between) - responseDb(parallel, between)),
    ).toBeGreaterThan(0.3);

    // And both still do the job: neither is a broken filter.
    expect(responseDb(serial, 500)).toBeGreaterThan(5);
    expect(responseDb(parallel, 500)).toBeGreaterThan(5);
  });
});
