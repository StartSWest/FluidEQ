/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../../../common/constants';
import { IEqBandSettings, TEqEngine } from '../../../common/dsp/chain';
import {
  biquadCoefficients,
  createBiquadState,
} from '../../../renderer/dsp/biquad';
import {
  createBandDynamics,
  refreshBandDynamics,
} from '../../../renderer/dsp/dynamics';
import { processEqBands } from '../../../renderer/dsp/eqEngine';

const RATE = 48_000;
const BLOCK = 4_096;

const bandAt = (
  frequency: number,
  gainDb: number,
  extra: Partial<IEqBandSettings> = {},
): IEqBandSettings => ({
  enabled: true,
  type: FilterTypeEnum.PK,
  frequency,
  gainDb,
  quality: 2,
  dynamic: false,
  thresholdDb: -24,
  ...extra,
});

/** A steady tone at `hz`, `amplitude` full-scale. */
const tone = (hz: number, amplitude: number): Float32Array => {
  const signal = new Float32Array(BLOCK);
  for (let i = 0; i < BLOCK; i += 1) {
    signal[i] = Math.sin((2 * Math.PI * hz * i) / RATE) * amplitude;
  }
  return signal;
};

/** Peak of the second half, once any envelope has settled. */
const settledPeak = (signal: Float32Array): number => {
  let peak = 0;
  for (let i = BLOCK / 2; i < BLOCK; i += 1) {
    peak = Math.max(peak, Math.abs(signal[i]));
  }
  return peak;
};

const run = (
  band: IEqBandSettings,
  signal: Float32Array,
  engine: TEqEngine,
): number => {
  const target = Float32Array.from(signal);
  const coefficients = [
    biquadCoefficients(
      {
        type: band.type as FilterTypeEnum,
        frequency: band.frequency,
        gainDb: band.gainDb,
        quality: band.quality,
      },
      RATE,
    ),
  ];
  const dynamics = [createBandDynamics()];
  refreshBandDynamics(dynamics[0], band, RATE);
  processEqBands(
    [createBiquadState()],
    coefficients,
    target,
    engine,
    new Float32Array(BLOCK),
    new Float32Array(BLOCK),
    dynamics,
  );
  return settledPeak(target);
};

describe('a dynamic band', () => {
  (['serial', 'parallel'] as const).forEach((engine) => {
    describe(`in ${engine}`, () => {
      /**
       * The whole point: the same cut arrives on loud material and leaves quiet
       * material alone. A static band cannot tell them apart, which is why a
       * de-esser has to be dynamic rather than just a dip at 6 kHz.
       */
      it('cuts what is over the threshold and not what is under', () => {
        const band = bandAt(6_000, -12, { dynamic: true, thresholdDb: -20 });
        // -6 dBFS: well over the threshold.
        const loud = run(band, tone(6_000, 0.5), engine);
        // -40 dBFS: well under it.
        const quiet = run(band, tone(6_000, 0.01), engine);

        // The loud one is cut hard — most of the 12 dB.
        expect(20 * Math.log10(loud / 0.5)).toBeLessThan(-8);
        // The quiet one passes within a hair of untouched.
        expect(Math.abs(20 * Math.log10(quiet / 0.01))).toBeLessThan(0.5);
      });

      /**
       * The positive control, and it is the one that matters here.
       *
       * The test above passes perfectly for a band that has stopped working
       * altogether: "quiet is untouched" and "loud is cut" both hold trivially
       * if the dynamic path never runs and the band is simply off. This asserts
       * the static band still does its full job, so a dynamics stage that had
       * quietly disabled everything fails.
       */
      it('leaves a static band at full strength', () => {
        const band = bandAt(6_000, -12);
        const quiet = run(band, tone(6_000, 0.01), engine);
        expect(20 * Math.log10(quiet / 0.01)).toBeCloseTo(-12, 0);
      });

      /** Off the band's own frequency there is nothing to detect, so a dynamic
       * band must stay out of the way however loud the record is. */
      it('ignores loud material outside its passband', () => {
        const band = bandAt(6_000, -12, { dynamic: true, thresholdDb: -30 });
        const away = run(band, tone(200, 0.7), engine);
        expect(Math.abs(20 * Math.log10(away / 0.7))).toBeLessThan(0.5);
      });

      /** A boost works the same way round: it arrives on the loud passages and
       * does not inflate the quiet ones. */
      it('applies a boost only over the threshold', () => {
        const band = bandAt(3_000, 9, { dynamic: true, thresholdDb: -20 });
        const loud = run(band, tone(3_000, 0.5), engine);
        const quiet = run(band, tone(3_000, 0.01), engine);
        expect(20 * Math.log10(loud / 0.5)).toBeGreaterThan(6);
        expect(Math.abs(20 * Math.log10(quiet / 0.01))).toBeLessThan(0.5);
      });
    });
  });

  /** A band with no gain has nothing to detect and nothing to scale; the
   * detector divides by that swing, so this is also a division by zero. */
  it('is inert when the band has no gain', () => {
    const state = createBandDynamics();
    refreshBandDynamics(state, bandAt(1_000, 0, { dynamic: true }), RATE);
    expect(state.active).toBe(false);
    expect(Number.isFinite(state.normalise)).toBe(true);
  });
});
