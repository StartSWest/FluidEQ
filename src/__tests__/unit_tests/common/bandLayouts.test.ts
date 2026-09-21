/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every quick layout against the standard every other equaliser is labelled
 * in.
 *
 * Nothing checked this, and four of the six-band's centres and two of the
 * ten's were not ISO values at all — 60, 170, 1500, 12000, and 32 and 64 for
 * 31.5 and 63. A band called 64 Hz that is not the 63 Hz every measurement
 * microphone, every room correction file and every hardware graphic EQ means
 * by it is a band that quietly disagrees with the rest of the world.
 */
import {
  FIXED_BAND_FREQUENCIES,
  FIXED_BAND_SIZES,
  FixedBandSizeEnum,
  getDefaultFilters,
} from '../../../common/constants';

/**
 * ISO 266 / ANSI S1.6 nominal third-octave centres, 20 Hz to 20 kHz.
 *
 * Written out rather than computed: the series is a set of ROUNDED numbers
 * (31.5, 63, 125 rather than 31.62, 63.10, 125.89), so generating it from the
 * ratio would produce a different list and agree with nothing.
 */
const ISO_266 = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
  800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500,
  16000, 20000,
];

/** How many third-octave steps apart two neighbouring centres are. */
const steps = (centres: readonly number[]) =>
  centres
    .slice(1)
    .map(
      (frequency, at) =>
        ISO_266.indexOf(frequency) - ISO_266.indexOf(centres[at]),
    );

describe('the quick band layouts', () => {
  it.each(FIXED_BAND_SIZES)(
    'puts every centre of the %i-band on an ISO 266 frequency',
    (size) => {
      FIXED_BAND_FREQUENCIES[size].forEach((frequency) => {
        expect(ISO_266).toContain(frequency);
      });
    },
  );

  it.each(FIXED_BAND_SIZES)(
    'holds the %i-band to whole third-octave steps, low to high',
    (size) => {
      const apart = steps(FIXED_BAND_FREQUENCIES[size]);
      apart.forEach((step) => {
        expect(Number.isInteger(step)).toBe(true);
        expect(step).toBeGreaterThan(0);
      });
    },
  );

  it('spaces each layout as the series it claims to be', () => {
    // One step is the third-octave series, two the two-thirds, three the
    // octave, five the five-thirds. The twenty is the only mixed one, on
    // purpose: third-octave where the ear argues, two-thirds elsewhere.
    expect(steps(FIXED_BAND_FREQUENCIES[FixedBandSizeEnum.THIRTY_ONE])).toEqual(
      new Array(30).fill(1),
    );
    expect(steps(FIXED_BAND_FREQUENCIES[FixedBandSizeEnum.FIFTEEN])).toEqual(
      new Array(14).fill(2),
    );
    expect(steps(FIXED_BAND_FREQUENCIES[FixedBandSizeEnum.TEN])).toEqual(
      new Array(9).fill(3),
    );
    expect(steps(FIXED_BAND_FREQUENCIES[FixedBandSizeEnum.SIX])).toEqual(
      new Array(5).fill(5),
    );
    expect(
      new Set(steps(FIXED_BAND_FREQUENCIES[FixedBandSizeEnum.TWENTY])),
    ).toEqual(new Set([1, 2]));
  });

  it('has as many centres as its name says', () => {
    FIXED_BAND_SIZES.forEach((size) => {
      expect(FIXED_BAND_FREQUENCIES[size]).toHaveLength(size);
    });
  });

  it('keeps every centre in order and free of repeats', () => {
    FIXED_BAND_SIZES.forEach((size) => {
      const centres = FIXED_BAND_FREQUENCIES[size];
      expect([...centres].sort((one, other) => one - other)).toEqual([
        ...centres,
      ]);
      expect(new Set(centres).size).toBe(centres.length);
    });
  });

  /**
   * The twenty is the fifteen with five put back, and that is the whole of
   * its design: if it ever stops being a superset, it has stopped being the
   * layout somebody reaches for when the fifteen is too coarse.
   */
  it('builds the twenty out of the fifteen plus 80, 125, 200, 8k and 12.5k', () => {
    const fifteen = FIXED_BAND_FREQUENCIES[FixedBandSizeEnum.FIFTEEN];
    const twenty = FIXED_BAND_FREQUENCIES[FixedBandSizeEnum.TWENTY];
    fifteen.forEach((frequency) => expect(twenty).toContain(frequency));
    expect(twenty.filter((frequency) => !fifteen.includes(frequency))).toEqual([
      80, 125, 200, 8000, 12500,
    ]);
  });

  /**
   * Twenty sliders across a 1920-wide window are too narrow to read or drag,
   * and the rack is the page. The default is a layout that fits the screen
   * most of this app's users have.
   */
  it('opens on the fifteen when nobody has chosen a layout', () => {
    expect(Object.keys(getDefaultFilters())).toHaveLength(
      FixedBandSizeEnum.FIFTEEN,
    );
  });
});
