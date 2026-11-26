/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The EQ curve draws the bands at the width Your EQ's Band Q gives them.
 *
 * It used to draw each band at its stored Q while the output curve, and the
 * engine, widened it by Band Q: changing Band Q moved the output curve and
 * left the cyan line where it was (Ivan, 2026-11-26).
 */

import { MutableRefObject } from 'react';
import {
  FilterTypeEnum,
  getDefaultState,
  IFilter,
  IFiltersMap,
} from '../../../common/constants';
import { shapeEqFilters, type TBandQ } from '../../../common/eqShape';
import {
  getDesignedFilterLineData,
  getLineGainAtFrequency,
} from '../../../renderer/graph/utils';
import {
  buildChartData,
  IBuildChartDataParams,
} from '../../../renderer/graph/buildChartData';
import type { IChartLineDataPointsById } from '../../../renderer/graph/ChartController';
import { OUTPUT_CURVE_ID } from '../../../renderer/graph/ChartController';

const EQ_CURVE_ID = 'EQ Response';
const PREAMP = -9;

const band: IFilter = {
  id: 'band',
  frequency: 1000,
  gain: 9,
  quality: 1.44,
  type: FilterTypeEnum.PK,
};

const caches = () => ({
  prevFilters: { current: {} } as MutableRefObject<IFiltersMap>,
  prevFilterLines: {
    current: {},
  } as MutableRefObject<IChartLineDataPointsById>,
});

const build = (
  mainBandQ: TBandQ,
  matched: boolean,
  refs = caches(),
  overrides: Partial<IBuildChartDataParams> = {},
) =>
  buildChartData({
    ...getDefaultState(),
    bypassed: [],
    filters: { band },
    mainBandQ,
    hasConvolution: false,
    // A preamp puts the output curve on the plot whatever Band Q is, so the
    // two curves can be compared: the output is the EQ curve lowered by it.
    hasPreAmp: true,
    preAmp: PREAMP,
    isEqQuiet: false,
    matchedDesign: { eq: matched, curves: matched },
    sampleRate: 48000,
    curveSmoothing: 'off',
    t: ((key: string) => key) as unknown as IBuildChartDataParams['t'],
    ...refs,
    ...overrides,
  }).chartData;

const line = (chart: ReturnType<typeof build>, id: string) =>
  chart.find((curve) => curve.id === id)?.line.points ?? [];

const at = (points: ReturnType<typeof line>, frequency: number) =>
  getLineGainAtFrequency(points, frequency);

// Half an octave up the bell's skirt, where its width shows; and the treble,
// where Precise and Classic part.
const PROBES = [1414, 2000, 16000];

describe.each([
  ['Precise', true],
  ['Classic', false],
])('the EQ curve on %s treble', (_name, matched) => {
  it.each(['off', 'proportional', 'asymmetric'] as const)(
    'draws a +9 dB band at Band Q %s exactly as the engine plays it',
    (mode) => {
      const chart = build(mode, matched);
      const played = getDesignedFilterLineData(
        shapeEqFilters([band], mode)[0],
        matched,
        48000,
      );
      const eq = line(chart, EQ_CURVE_ID);
      const output = line(chart, OUTPUT_CURVE_ID);
      PROBES.forEach((frequency) => {
        expect(at(eq, frequency)).toBeCloseTo(at(played, frequency), 6);
        // The output is the same band, lowered by the preamp and nothing else.
        expect(at(output, frequency) - PREAMP).toBeCloseTo(
          at(eq, frequency),
          6,
        );
      });
      // Band Q never moves the peak: the line still passes through its handle.
      expect(at(eq, 1000)).toBeCloseTo(9, 1);
    },
  );

  it('moves between two Band Q modes exactly as the output does', () => {
    const off = build('off', matched);
    const proportional = build('proportional', matched);
    const move = (id: string) =>
      at(line(proportional, id), 1414) - at(line(off, id), 1414);
    // POSITIVE CONTROL: the output does move — Proportional narrows a
    // +9 dB bell by sqrt(1.75) — so a cyan line that stood still fails.
    expect(Math.abs(move(OUTPUT_CURVE_ID))).toBeGreaterThan(0.5);
    expect(move(EQ_CURVE_ID)).toBeCloseTo(move(OUTPUT_CURVE_ID), 6);
  });

  it('draws the same line when Band Q is unchanged', () => {
    // CONTROL: nothing but Band Q differs above, so the movement there is
    // Band Q's and not the builder's noise.
    const refs = caches();
    const first = line(build('proportional', matched, refs), EQ_CURVE_ID);
    const second = line(build('proportional', matched, refs), EQ_CURVE_ID);
    expect(second).toEqual(first);
  });
});

it('redraws the EQ curve when Band Q changes, though no band moved', () => {
  // The bands are cached by their own values; the same refs across the two
  // builds would hand back the old width if Band Q were not in the key.
  const refs = caches();
  const off = line(build('off', true, refs), EQ_CURVE_ID);
  const proportional = line(build('proportional', true, refs), EQ_CURVE_ID);
  expect(at(off, 1414) - at(proportional, 1414)).toBeGreaterThan(0.5);
});

it('keeps Studio’s gain on the output curve alone', () => {
  const chart = build('proportional', true, caches(), { eqMode: 'studio' });
  // The EQ curve's handle sits at the band's own +9 dB, at Band Q's width.
  expect(at(line(chart, EQ_CURVE_ID), 1000)).toBeCloseTo(9, 1);
  // Studio plays it half as loud again.
  expect(at(line(chart, OUTPUT_CURVE_ID), 1000) - PREAMP).toBeCloseTo(13.5, 1);
});

it('draws no output curve for Band Q alone, which would trace the EQ curve', () => {
  const chart = build('proportional', true, caches(), {
    hasPreAmp: false,
    preAmp: 0,
  });
  expect(line(chart, EQ_CURVE_ID).length).toBeGreaterThan(0);
  expect(chart.some((curve) => curve.id === OUTPUT_CURVE_ID)).toBe(false);
});
