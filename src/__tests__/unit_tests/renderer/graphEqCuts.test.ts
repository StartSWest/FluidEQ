/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the graph draws for the Tone panel's cuts and for a correction that
 * reaches past a slider's range.
 *
 * The cuts are drawn on the final output alone, as the Tone is a line of its
 * own and the EQ curve is the bands and nothing else (Ivan, 2026-09-23: "the
 * cut applies only to final output since the cyan eq line now doesn't get
 * affected by tone so cuts neither"), and a headphone correction is drawn as
 * it plays, which in Studio mode is half as much again of a band a slider
 * could never reach.
 */

import { MutableRefObject } from 'react';
import {
  FilterTypeEnum,
  getDefaultState,
  IFilter,
  IFiltersMap,
} from '../../../common/constants';
import { getLineGainAtFrequency } from '../../../renderer/graph/utils';
import {
  buildChartData,
  IBuildChartDataParams,
} from '../../../renderer/graph/buildChartData';
import {
  IChartLineDataPointsById,
  OUTPUT_CURVE_ID,
} from '../../../renderer/graph/ChartController';

const EQ_CURVE_ID = 'EQ Response';
const HEADPHONE_CURVE_ID = 'Headphone Correction';

const band = (overrides: Partial<IFilter> = {}): IFilter => ({
  id: 'band',
  frequency: 1000,
  gain: 3,
  quality: 1,
  type: FilterTypeEnum.PK,
  ...overrides,
});

const build = (overrides: Partial<IBuildChartDataParams>) =>
  buildChartData({
    ...getDefaultState(),
    bypassed: [],
    filters: { band: band() },
    hasConvolution: false,
    hasPreAmp: false,
    isEqQuiet: false,
    matchedDesign: { eq: false, curves: false },
    preAmp: 0,
    sampleRate: 48000,
    t: ((key: string) => key) as unknown as IBuildChartDataParams['t'],
    prevFilters: { current: {} } as MutableRefObject<IFiltersMap>,
    prevFilterLines: {
      current: {},
    } as MutableRefObject<IChartLineDataPointsById>,
    ...overrides,
  }).chartData;

const curve = (chartData: ReturnType<typeof build>, id: string) =>
  chartData.find((entry) => entry.id === id)?.line.points;

const at = (points: ReturnType<typeof curve>, frequency: number) =>
  getLineGainAtFrequency(points ?? [], frequency);

describe('the Tone panel’s cuts on the graph', () => {
  it('draws them on the final output, at the edges and nowhere else', () => {
    const plain = curve(build({ hasPreAmp: true }), OUTPUT_CURVE_ID);
    const cut = curve(
      build({ hasPreAmp: true, eqCuts: { low: 24, high: 12 } }),
      OUTPUT_CURVE_ID,
    );
    // POSITIVE CONTROL: the band is on both curves, so the difference below
    // is the cuts and not a missing line.
    expect(at(plain, 1000)).toBeCloseTo(3, 1);
    expect(at(cut, 1000)).toBeCloseTo(at(plain, 1000), 2);
    // Three decibels down at each corner, whatever the slope.
    expect(at(plain, 20) - at(cut, 20)).toBeCloseTo(3, 1);
    expect(at(plain, 20000) - at(cut, 20000)).toBeCloseTo(3, 1);
    // Steeper below the low corner than the gentler high cut is above its own.
    expect(at(plain, 16) - at(cut, 16)).toBeGreaterThan(8);
  });

  it('leaves the EQ curve as the bands alone', () => {
    const plain = curve(build({}), EQ_CURVE_ID);
    const cut = curve(build({ eqCuts: { low: 24, high: 12 } }), EQ_CURVE_ID);
    expect(at(plain, 1000)).toBeCloseTo(3, 1);
    expect(at(cut, 20)).toBeCloseTo(at(plain, 20), 6);
    expect(at(cut, 20000)).toBeCloseTo(at(plain, 20000), 6);
  });

  it('brings the output curve in on their own, to carry them', () => {
    // CONTROL: without a cut, a plain EQ draws no output curve at all.
    expect(curve(build({}), OUTPUT_CURVE_ID)).toBeUndefined();
    const chartData = build({ eqCuts: { low: 24, high: 0 } });
    expect(at(curve(chartData, OUTPUT_CURVE_ID), 20)).toBeCloseTo(
      at(curve(chartData, EQ_CURVE_ID), 20) - 3,
      1,
    );
  });

  it('shows them on the output curve while the EQ is switched off', () => {
    const chartData = build({
      bypassed: ['eq'],
      eqCuts: { low: 24, high: 0 },
    });
    expect(curve(chartData, EQ_CURVE_ID)).toBeUndefined();
    const output = curve(chartData, OUTPUT_CURVE_ID);
    expect(output).toBeDefined();
    expect(at(output, 20)).toBeCloseTo(-3, 1);
  });
});

describe('the Tone on the graph', () => {
  const tone = { bass: 6, mid: 0, treble: -4 };

  it('is a line of its own, beside the bands and not inside them', () => {
    const chartData = build({ tone });
    const toneLine = curve(chartData, 'Tone');
    // A Butterworth shelf is half its gain at the corner.
    expect(at(toneLine, 100)).toBeCloseTo(3, 1);
    expect(at(toneLine, 10000)).toBeCloseTo(-2, 1);
    expect(at(toneLine, 1000)).toBeCloseTo(0, 1);
    // The EQ curve is the band alone: 3 dB at 1 kHz, nothing at 20 Hz.
    expect(at(curve(chartData, EQ_CURVE_ID), 20)).toBeCloseTo(0, 1);
    // And the output curve carries both.
    expect(at(curve(chartData, OUTPUT_CURVE_ID), 20)).toBeCloseTo(6, 0);
  });

  it('is drawn at full strength, like the bands it is read against', () => {
    const line = build({ tone }).find((entry) => entry.id === 'Tone')?.line;
    expect(line?.opacity).toBeUndefined();
  });

  it('draws nothing while it is switched off or flat', () => {
    expect(curve(build({ tone, bypassed: ['tone'] }), 'Tone')).toBeUndefined();
    expect(curve(build({}), 'Tone')).toBeUndefined();
  });

  it('follows Your EQ’s strength, not the corrections’', () => {
    const studio = curve(build({ tone, eqMode: 'studio' }), 'Tone');
    const curvesStudio = curve(build({ tone, curveEqMode: 'studio' }), 'Tone');
    // CONTROL: the corrections' row leaves it alone.
    expect(at(curvesStudio, 20)).toBeCloseTo(6, 0);
    expect(at(studio, 20)).toBeCloseTo(9, 0);
  });
});

describe('a headphone correction past a slider’s range', () => {
  const correction = {
    filters: { deep: band({ id: 'deep', frequency: 3000, gain: -22 }) },
    intensity: 1,
  };

  it('is drawn as it plays', () => {
    const chartData = build({ headphone: correction });
    expect(at(curve(chartData, HEADPHONE_CURVE_ID), 3000)).toBeCloseTo(-22, 1);
  });

  it('is drawn at Studio mode’s half as much again, not from ±20 dB', () => {
    const chartData = build({ headphone: correction, curveEqMode: 'studio' });
    // Studio narrows a bell as it deepens it, so only the centre is exact.
    expect(at(curve(chartData, HEADPHONE_CURVE_ID), 3000)).toBeCloseTo(-33, 0);
  });
});
