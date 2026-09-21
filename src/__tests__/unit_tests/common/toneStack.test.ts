/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Bass, Mid and Treble over the whole rack.
 *
 * Everything here is measured against the response the graph is drawn from,
 * because every defect this control has had was a number nobody could see: a
 * dial reading 16 while the curve reached 18, a Treble that put a decibel
 * into the 25 Hz band, a reset that moved two dials the user had not touched.
 */
import {
  FixedBandSizeEnum,
  getDefaultFilters,
  IFilter,
} from '../../../common/constants';
import { getResponseGainAtFrequencies } from '../../../common/response';
import {
  fitToneStack,
  FLAT_TONE,
  IToneStack,
  openToneStack,
  rebaseToneStack,
  toneRegionOf,
  toneResponse,
  TONE_MAX_DB,
} from '../../../common/toneStack';

const rack = (size = FixedBandSizeEnum.FIFTEEN): IFilter[] =>
  Object.values(getDefaultFilters(size)).sort(
    (one, other) => one.frequency - other.frequency,
  );

const apply = (
  bands: IFilter[],
  edits: { id: string; gain: number }[],
): IFilter[] => {
  const moved = new Map(edits.map((edit) => [edit.id, edit.gain]));
  return bands.map((band) =>
    moved.has(band.id) ? { ...band, gain: moved.get(band.id) as number } : band,
  );
};

/** One turn of one dial, the way the page makes it. */
const turn = (
  bands: IFilter[],
  from: IToneStack,
  knob: keyof IToneStack,
  to: number,
): IFilter[] => {
  const base = rebaseToneStack(bands, from);
  return apply(bands, fitToneStack(bands, base, { ...from, [knob]: to }, knob));
};

/** The worst the curve misses the shape the dials asked for, over a span. */
const worstMiss = (
  bands: IFilter[],
  tone: IToneStack,
  low: number,
  high: number,
) => {
  const grid = Array.from(
    { length: 121 },
    (_unused, at) => low * (high / low) ** (at / 120),
  );
  const wanted = toneResponse(tone, grid);
  const reached = getResponseGainAtFrequencies({ filters: bands }, grid);
  return reached.reduce(
    (most, value, at) =>
      Math.abs(value - wanted[at]) > Math.abs(most) ? value - wanted[at] : most,
    0,
  );
};

describe('the three tone controls', () => {
  describe('which bands each one speaks for', () => {
    it('draws the same two borders at every frequency it is asked about', () => {
      expect(toneRegionOf(30)).toBe('bass');
      expect(toneRegionOf(300)).toBe('bass');
      expect(toneRegionOf(400)).toBe('mid');
      expect(toneRegionOf(1500)).toBe('mid');
      expect(toneRegionOf(2500)).toBe('treble');
      expect(toneRegionOf(16000)).toBe('treble');
    });

    it('puts the borders where the shelves hand over to the bell', () => {
      // Measured at 342 Hz and 2141 Hz — stated here so a change to the
      // shapes cannot move them silently.
      expect(toneRegionOf(335)).toBe('bass');
      expect(toneRegionOf(350)).toBe('mid');
      expect(toneRegionOf(2100)).toBe('mid');
      expect(toneRegionOf(2180)).toBe('treble');
    });

    it('leaves no band of any layout unspoken for', () => {
      [
        FixedBandSizeEnum.SIX,
        FixedBandSizeEnum.TEN,
        FixedBandSizeEnum.FIFTEEN,
        FixedBandSizeEnum.TWENTY,
        FixedBandSizeEnum.THIRTY_ONE,
      ].forEach((size) => {
        const regions = rack(size).map((band) => toneRegionOf(band.frequency));
        expect(new Set(regions)).toEqual(new Set(['bass', 'mid', 'treble']));
      });
    });
  });

  describe('what a turn of one dial does', () => {
    it('lands the curve on the shape the dial asked for', () => {
      const bands = turn(rack(), FLAT_TONE, 'treble', 8);
      const miss = worstMiss(bands, { ...FLAT_TONE, treble: 8 }, 2500, 16000);
      // About a decibel is what this rack can do; the band widths are what
      // decide it, not the fit. See `bandQuality.ts`.
      expect(Math.abs(miss)).toBeLessThan(1.5);
    });

    it('moves only the bands that dial speaks for', () => {
      (['bass', 'mid', 'treble'] as (keyof IToneStack)[]).forEach((knob) => {
        const before = rack(FixedBandSizeEnum.THIRTY_ONE);
        const after = turn(before, FLAT_TONE, knob, 8);
        const moved = after.filter((band, at) => band.gain !== before[at].gain);
        expect(moved.length).toBeGreaterThan(0);
        expect(
          moved
            .filter((band) => toneRegionOf(band.frequency) !== knob)
            .map((band) => band.frequency),
        ).toEqual([]);
      });
    });

    it('comes back to the curve it started from when turned back', () => {
      const start = rack().map((band, at) =>
        at === 7 ? { ...band, gain: -6 } : band,
      );
      const base = rebaseToneStack(start, FLAT_TONE);
      const lifted = apply(
        start,
        fitToneStack(start, base, { ...FLAT_TONE, treble: 5 }, 'treble'),
      );
      const back = apply(
        lifted,
        fitToneStack(lifted, base, FLAT_TONE, 'treble'),
      );
      back.forEach((band, at) => {
        expect(band.gain).toBeCloseTo(start[at].gain, 1);
      });
    });

    it('leaves a band somebody dipped by hand exactly where it was', () => {
      const dipped = rack().map((band, at) =>
        at === 3 ? { ...band, gain: -7 } : band,
      );
      const after = turn(dipped, FLAT_TONE, 'treble', 10);
      expect(after[3].gain).toBe(-7);
    });

    it('writes nothing when the rack has no band it may move', () => {
      const base = rebaseToneStack([], FLAT_TONE);
      expect(fitToneStack([], base, { ...FLAT_TONE, bass: 6 })).toEqual([]);
    });
  });

  describe('reading a curve back', () => {
    it('reports no tone on a rack that is doing nothing', () => {
      expect(openToneStack(rack()).tone).toEqual(FLAT_TONE);
    });

    /**
     * A rack lifted the same at every band is louder, not brighter or
     * warmer, and the constant term in the split is what says so. Every band
     * at +3 is not a flat +3 curve — overlapping bells accumulate toward the
     * middle — so what is checked is that the three dials agree with each
     * other rather than that they read zero.
     */
    it('reads an overall trim as level rather than as a tilt', () => {
      const lifted = rack().map((band) => ({ ...band, gain: 3 }));
      const { tone } = openToneStack(lifted);
      expect(Math.abs(tone.bass - tone.treble)).toBeLessThan(1.5);
    });

    it('never answers past the range the dials offer', () => {
      const shouted = rack().map((band) => ({ ...band, gain: 20 }));
      const { tone } = openToneStack(shouted);
      [tone.bass, tone.mid, tone.treble].forEach((value) => {
        expect(Math.abs(value)).toBeLessThanOrEqual(TONE_MAX_DB);
      });
    });

    /**
     * A band that is switched off shapes nothing, and it was being measured
     * anyway: one band left at +9 dB and turned off put a decibel and a half
     * onto the Bass dial of a rack drawing a flat line.
     */
    it('ignores a band that is switched off', () => {
      const silenced = rack().map((band, at) =>
        at === 2 ? { ...band, gain: 9, isEnabled: false } : band,
      );
      expect(openToneStack(silenced).tone).toEqual(FLAT_TONE);
    });
  });

  describe('what the dials are measured against', () => {
    it('holds the rest of the curve while the tone comes off it', () => {
      const dipped = rack().map((band, at) =>
        at === 9 ? { ...band, gain: -5 } : band,
      );
      const base = rebaseToneStack(dipped, FLAT_TONE);
      // With no tone on the dials the residual IS the curve.
      const measured = getResponseGainAtFrequencies(
        { filters: dipped },
        base.points,
      );
      base.residual.forEach((value, at) => {
        expect(value).toBeCloseTo(measured[at], 5);
      });
    });

    it('takes the named tone off the curve and leaves the rest', () => {
      const lifted = turn(rack(), FLAT_TONE, 'bass', 6);
      const base = rebaseToneStack(lifted, { ...FLAT_TONE, bass: 6 });
      // What is left under a bass lift the rack is carrying is nearly nothing.
      base.residual.forEach((value) => {
        expect(Math.abs(value)).toBeLessThan(1.5);
      });
    });
  });
});
