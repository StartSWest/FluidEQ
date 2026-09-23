/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The graph draws each band the way the engine playing it builds it.
 *
 * Two things decide that shape above ~8 kHz, and the graph used to know
 * neither: the design (the FluidEQ Engine builds FluidEQ's own layers
 * analog-matched, Equalizer APO builds everything from the cookbook) and the
 * rate the output runs at (the cookbook narrows a treble band more the lower
 * it is). Drawn at a fixed 96 kHz, a +6 dB band at 16 kHz looked a good 2 dB
 * fuller at 20 kHz than either engine played it on a 48 kHz output.
 */

import { MutableRefObject } from 'react';
import {
  FilterTypeEnum,
  getDefaultState,
  IFilter,
  IFiltersMap,
} from '../../../common/constants';
import {
  getDesignedFilterLineData,
  getFilterLineData,
  getLineGainAtFrequency,
  playsAnalogMatched,
} from '../../../renderer/graph/utils';
import {
  buildChartData,
  IBuildChartDataParams,
} from '../../../renderer/graph/buildChartData';
import type { IChartLineDataPointsById } from '../../../renderer/graph/ChartController';

/** The id `buildChartData` gives the EQ's own curve, as the player reads it. */
const EQ_CURVE_ID = 'EQ Response';

const filter = (overrides: Partial<IFilter> = {}): IFilter => ({
  id: 'band',
  frequency: 16000,
  gain: 6,
  quality: 2,
  type: FilterTypeEnum.PK,
  ...overrides,
});

const at = (points: ReturnType<typeof getFilterLineData>, frequency: number) =>
  getLineGainAtFrequency(points, frequency);

describe('a cookbook band drawn at the output’s rate', () => {
  it('narrows toward Nyquist the way the output plays it', () => {
    const band = filter();
    const at48 = at(getFilterLineData(band, 48000), 20000);
    const at96 = at(getFilterLineData(band, 96000), 20000);
    // The squeeze is real and large at 48 kHz, which is the whole reason
    // the rate is not a constant.
    expect(at96 - at48).toBeGreaterThan(1);
    // Below the squeeze the two agree: the centre of the band is exact at
    // any rate.
    expect(at(getFilterLineData(band, 48000), 16000)).toBeCloseTo(6, 1);
  });

  it('draws the old fixed rate while the output’s is not known', () => {
    const band = filter();
    expect(getFilterLineData(band)).toEqual(getFilterLineData(band, 96000));
  });

  it('holds the Nyquist value above Nyquist instead of a mirror image', () => {
    const points = getFilterLineData(filter({ frequency: 12000 }), 44100);
    const above = points.filter((point) => point.x > 22050);
    // POSITIVE CONTROL: the graph does reach past 22 kHz, so the check
    // below covers real points.
    expect(above.length).toBeGreaterThan(0);
    // A cookbook bell is back at exactly 0 dB at Nyquist — the squeeze at its
    // worst — and that is what every point past it shows, not the rise of a
    // mirror image of the band.
    above.forEach((point) => expect(point.y).toBeCloseTo(0, 9));
  });
});

describe('a band drawn with the design that plays it', () => {
  it('draws the analog shape when the engine builds it matched', () => {
    const band = filter();
    const matched48 = getDesignedFilterLineData(band, true, 48000);
    const matched192 = getDesignedFilterLineData(band, true, 192000);
    // Rate-free below Nyquist: the matched design is the analog shape.
    expect(at(matched48, 12500)).toBeCloseTo(at(matched192, 12500), 6);
    // The centre is exact; the graph's own sampling grid misses 16 kHz by a
    // hair, hence two places.
    expect(at(matched48, 16000)).toBeCloseTo(6, 2);
    // And fuller than the cookbook at the same rate — what the engine now
    // plays and Equalizer APO does not.
    expect(
      at(matched48, 20000) - at(getFilterLineData(band, 48000), 20000),
    ).toBeGreaterThan(1);
  });

  it('draws the cookbook for a layer the engine does not build matched', () => {
    const band = filter();
    expect(getDesignedFilterLineData(band, false, 48000)).toEqual(
      getFilterLineData(band, 48000),
    );
  });

  it.each([
    [FilterTypeEnum.NO, 2],
    [FilterTypeEnum.LSC, 1],
    [FilterTypeEnum.HSC, 0.5],
  ])(
    'keeps the cookbook for %s at Q %s, as the engine does',
    (type, quality) => {
      const band = filter({ type, quality, frequency: 9000 });
      expect(playsAnalogMatched(band)).toBe(false);
      expect(getDesignedFilterLineData(band, true, 48000)).toEqual(
        getFilterLineData(band, 48000),
      );
    },
  );

  it.each([
    [FilterTypeEnum.PK, 0.3, true],
    [FilterTypeEnum.LPQ, 3, true],
    [FilterTypeEnum.HPQ, 0.5, true],
    [FilterTypeEnum.BP, 1, true],
    [FilterTypeEnum.LSC, Math.SQRT1_2, true],
    [FilterTypeEnum.HSC, 0.71, true],
    [FilterTypeEnum.HSC, 0.75, false],
  ])('%s at Q %s plays matched: %s', (type, quality, expected) => {
    expect(playsAnalogMatched({ type, quality })).toBe(expected);
  });

  it('holds a bell asked for above Nyquist where the engine holds it', () => {
    const points = getDesignedFilterLineData(
      filter({ frequency: 23000 }),
      true,
      44100,
    );
    // The engine centres it at 0.499 of the rate, so the drawn peak is its
    // full gain right at the top of the output's band.
    expect(at(points, 22000)).toBeGreaterThan(5.5);
  });
});

describe('the chart built for the engine and rate playing', () => {
  const caches = () => ({
    prevFilters: { current: {} } as MutableRefObject<IFiltersMap>,
    prevFilterLines: {
      current: {},
    } as MutableRefObject<IChartLineDataPointsById>,
  });

  const params = (
    overrides: Partial<IBuildChartDataParams>,
    refs: ReturnType<typeof caches>,
  ): IBuildChartDataParams => {
    const state = getDefaultState();
    return {
      ...state,
      bypassed: [],
      filters: { band: filter() },
      hasConvolution: false,
      hasPreAmp: false,
      isEqQuiet: false,
      matchedDesign: { eq: false, curves: false },
      preAmp: 0,
      t: ((key: string) => key) as unknown as IBuildChartDataParams['t'],
      ...refs,
      ...overrides,
    };
  };

  const eqCurve = (built: ReturnType<typeof buildChartData>) =>
    built.chartData.find((curve) => curve.id === EQ_CURVE_ID)?.line.points ??
    [];

  it('redraws the bands when the output’s rate becomes known', () => {
    const refs = caches();
    const first = eqCurve(buildChartData(params({}, refs)));
    const second = eqCurve(buildChartData(params({ sampleRate: 48000 }, refs)));
    // Same bands, so without the rate in the cache key the first line would
    // simply have been reused.
    expect(at(first, 20000) - at(second, 20000)).toBeGreaterThan(1);
  });

  it('draws each group by its own Treble choice', () => {
    const refs = caches();
    const built = buildChartData(
      params(
        {
          // Your EQ on Precise, the curves on Classic.
          matchedDesign: { eq: true, curves: false },
          sampleRate: 48000,
          voicing: {
            profileId: 'edited',
            intensity: 1,
            apoOverride: { filters: { treble: filter({ id: 'treble' }) } },
          },
        },
        refs,
      ),
    );
    const preset =
      built.chartData.find((curve) => curve.id === 'Voicing')?.line.points ??
      [];
    const matched = at(getDesignedFilterLineData(filter(), true, 48000), 20000);
    const cookbook = at(getFilterLineData(filter(), 48000), 20000);
    // POSITIVE CONTROL: the two designs of this band differ where it counts.
    expect(matched - cookbook).toBeGreaterThan(1);
    expect(at(eqCurve(built), 20000)).toBeCloseTo(matched, 6);
    expect(at(preset, 20000)).toBeCloseTo(cookbook, 6);
  });

  it('redraws the EQ when its Treble choice changes', () => {
    const refs = caches();
    const precise = eqCurve(
      buildChartData(
        params(
          { matchedDesign: { eq: true, curves: true }, sampleRate: 48000 },
          refs,
        ),
      ),
    );
    const classic = eqCurve(
      buildChartData(
        params(
          { matchedDesign: { eq: false, curves: true }, sampleRate: 48000 },
          refs,
        ),
      ),
    );
    // Same band, same rate: a line reused from the cache would not move.
    expect(at(precise, 20000) - at(classic, 20000)).toBeGreaterThan(1);
  });

  it.each([
    [true, true],
    [false, false],
  ])(
    'draws the headphone correction by the Curves choice (matched: %s)',
    (curves, matched) => {
      const refs = caches();
      const built = buildChartData(
        params(
          {
            matchedDesign: { eq: true, curves },
            sampleRate: 48000,
            headphone: { filters: { treble: filter() }, intensity: 1 },
          },
          refs,
        ),
      );
      const correction =
        built.chartData.find((curve) => curve.id === 'Headphone Correction')
          ?.line.points ?? [];
      // POSITIVE CONTROL: the curve exists and the two designs of its band
      // differ where it counts, so the match below is not a coincidence.
      expect(correction.length).toBeGreaterThan(0);
      const designed = at(
        getDesignedFilterLineData(filter(), true, 48000),
        20000,
      );
      const cookbook = at(getFilterLineData(filter(), 48000), 20000);
      expect(designed - cookbook).toBeGreaterThan(1);
      expect(at(correction, 20000)).toBeCloseTo(
        matched ? designed : cookbook,
        6,
      );
      // Your EQ keeps its own choice whatever the curves do.
      expect(at(eqCurve(built), 20000)).toBeCloseTo(designed, 6);
    },
  );
});
