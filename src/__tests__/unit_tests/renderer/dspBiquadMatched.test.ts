/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The rack EQ's Precise bands, as the page draws them, against what the
 * engine plays (`biquadMatched.ts`, `feq_biquad_coefficients_designed`).
 *
 * The page evaluates coefficients rather than a formula, so a transcription
 * slip would draw a shape nobody hears. The numbers below are the engine's
 * own, printed by `feq_biquad_coefficients_designed` for these bands with
 * the clean model and matched on (2026-09-23): a bell each way, the pass
 * filters, Butterworth shelves, a bell and both shelves at 0 dB — and a
 * notch and a shelf off Butterworth, which have no matched design and must
 * come back as the cookbook.
 */
import { FilterTypeEnum } from '../../../common/constants';
import {
  biquadCoefficients,
  biquadMagnitudeDb,
  IBandSpec,
} from '../../../renderer/dsp/biquad';

type TCase = [FilterTypeEnum, number, number, number, number, number[]];

const ENGINE: TCase[] = [
  [
    FilterTypeEnum.PK,
    16000,
    6,
    2,
    48000,
    [
      1.31145536217, 0.511472722176, 0.303902870266, 0.650365040254,
      0.476465914363,
    ],
  ],
  [
    FilterTypeEnum.PK,
    16000,
    -6,
    2,
    44100,
    [
      0.758669164157, 0.631669898398, 0.338540705623, 0.523679354585,
      0.205200413593,
    ],
  ],
  [
    FilterTypeEnum.PK,
    8000,
    4,
    1,
    48000,
    [
      1.21629527238, -0.861330006551, 0.324692948036, -0.755598801591,
      0.435257015453,
    ],
  ],
  [
    FilterTypeEnum.HSC,
    10000,
    5,
    0.7071,
    48000,
    [
      1.37014233146, -0.872543097995, 0.265418908832, -0.336291101487,
      0.099309243786,
    ],
  ],
  [
    FilterTypeEnum.LSC,
    100,
    5,
    0.7071,
    48000,
    [
      1.0026768743, -1.98391999784, 0.981469794682, -1.98396959978,
      0.984097066326,
    ],
  ],
  [
    FilterTypeEnum.HPQ,
    30,
    0,
    0.707,
    48000,
    [
      0.997226632065, -1.99445326413, 0.997226632065, -1.99444557645,
      0.994460954937,
    ],
  ],
  [
    FilterTypeEnum.LPQ,
    15000,
    0,
    0.707,
    44100,
    [0.798303563861, 0.223974552928, 0, -0.0263853924416, 0.0486635092314],
  ],
  [
    FilterTypeEnum.BP,
    12000,
    0,
    1.5,
    48000,
    [
      0.458266097736, -0.378933693587, -0.0793324041494, -0.106291093944,
      0.350919807178,
    ],
  ],
  [
    FilterTypeEnum.HSC,
    10000,
    5,
    1,
    48000,
    [
      1.40198672042, -0.74355490077, 0.517290358132, -0.160849143114,
      0.3365713209,
    ],
  ],
  [
    FilterTypeEnum.NO,
    9000,
    0,
    2,
    48000,
    [
      0.812367559683, -0.621759212163, 0.812367559683, -0.621759212163,
      0.624735119366,
    ],
  ],
  // No gain: unity, on the poles the band has beside it (`unity_on`).
  [
    FilterTypeEnum.PK,
    1000,
    0,
    1,
    48000,
    [1, -1.86126804508, 0.877305769098, -1.86126804508, 0.877305769098],
  ],
  [
    FilterTypeEnum.HSC,
    8000,
    0,
    0.7071,
    48000,
    [1, -0.708474679763, 0.22248863338, -0.708474679763, 0.22248863338],
  ],
  [
    FilterTypeEnum.LSC,
    100,
    0,
    0.7071,
    48000,
    [1, -1.9814884677, 0.981658237171, -1.9814884677, 0.981658237171],
  ],
];

const spec = (
  type: FilterTypeEnum,
  frequency: number,
  gainDb: number,
  quality: number,
): IBandSpec => ({ type, frequency, gainDb, quality });

describe('the rack EQ’s Precise bands', () => {
  it.each(ENGINE)(
    '%s at %s Hz, %s dB, Q %s, %s Hz: the engine’s coefficients',
    (type, frequency, gainDb, quality, rate, expected) => {
      const { b0, b1, b2, a1, a2 } = biquadCoefficients(
        spec(type, frequency, gainDb, quality),
        rate,
        'clean',
        1,
        true,
      );
      [b0, b1, b2, a1, a2].forEach((value, index) => {
        expect(value).toBeCloseTo(expected[index], 9);
      });
    },
  );

  it('plays a treble bell as drawn where the cookbook narrows it', () => {
    // A +6 dB, Q 2 bell at 16 kHz on a 48 kHz output: both reach +6 at the
    // centre, and a sixth of an octave above it the cookbook has already
    // fallen further than the band that was drawn.
    const band = spec(FilterTypeEnum.PK, 16000, 6, 2);
    const cookbook = biquadCoefficients(band, 48000, 'clean', 1, false);
    const precise = biquadCoefficients(band, 48000, 'clean', 1, true);
    expect(biquadMagnitudeDb(cookbook, 16000, 48000)).toBeCloseTo(6, 3);
    expect(biquadMagnitudeDb(precise, 16000, 48000)).toBeCloseTo(6, 3);
    const above = 16000 * 2 ** (1 / 6);
    expect(biquadMagnitudeDb(precise, above, 48000)).toBeGreaterThan(
      biquadMagnitudeDb(cookbook, above, 48000) + 0.5,
    );
  });

  it('keeps the cookbook for the shapes with no matched design', () => {
    // A notch and a shelf off Butterworth: Precise is the cookbook there,
    // as the engine's rule says.
    [
      spec(FilterTypeEnum.NO, 9000, 0, 2),
      spec(FilterTypeEnum.HSC, 10000, 5, 1),
      spec(FilterTypeEnum.LSC, 120, -4, 0.5),
    ].forEach((band) => {
      expect(biquadCoefficients(band, 48000, 'clean', 1, true)).toEqual(
        biquadCoefficients(band, 48000, 'clean', 1, false),
      );
    });
    // POSITIVE CONTROL: a Butterworth shelf does change.
    const butterworth = spec(FilterTypeEnum.HSC, 10000, 5, Math.SQRT1_2);
    expect(
      biquadCoefficients(butterworth, 48000, 'clean', 1, true),
    ).not.toEqual(biquadCoefficients(butterworth, 48000, 'clean', 1, false));
  });

  it('shapes the Q by the character first, then matches it', () => {
    // The Focused character narrows a boosted bell; Precise keeps the Q it
    // is given, so the two together are the matched design at the narrowed Q.
    const band = spec(FilterTypeEnum.PK, 12000, 6, 1.2);
    const focused = biquadCoefficients(band, 48000, 'proportional', 1, true);
    const plain = biquadCoefficients(band, 48000, 'clean', 1, true);
    expect(focused).not.toEqual(plain);
    const width = (coefficients: typeof plain) =>
      biquadMagnitudeDb(coefficients, 12000 * 2 ** 0.5, 48000);
    expect(width(focused)).toBeLessThan(width(plain));
  });
});
