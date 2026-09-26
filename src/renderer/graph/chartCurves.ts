/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IFiltersMap } from 'common/constants';
import {
  GRAPH_END,
  GRAPH_START,
  IChartCurveData,
  IChartGradientStop,
  IChartPointData,
  OUTPUT_CURVE_ID,
  VOICING_CURVE_ID,
} from './ChartController';
import { Color, ColorEnum } from '../styles/color';
import { getBandColor } from '../utils/bandColors';
import type { useTranslation } from '../utils/I18nContext';

/** Supporting curves sit behind the one in focus rather than competing with it. */
export const SUPPORTING_CURVE_OPACITY = 0.5;

const supporting = (
  id: string,
  name: string,
  color: Color,
  points: IChartPointData[],
): IChartCurveData => ({
  id,
  name,
  line: { color, strokeWidth: 2, opacity: SUPPORTING_CURVE_OPACITY, points },
});

/**
 * The EQ curve's spectrum shading: each band's colour at its own frequency,
 * across the whole spectrum the stops are placed in, wherever the plot's
 * edges land.
 */
export const eqGradientStops = (
  filters: IFiltersMap,
  // Rainbow mode's palette, as the graph read it (`useRainbowStops`).
  rainbow?: readonly string[],
): IChartGradientStop[] => {
  const sorted = Object.values(filters).sort(
    (a, b) => a.frequency - b.frequency,
  );
  const logSpan = Math.log(GRAPH_END / GRAPH_START);
  return [
    { offset: 0, color: getBandColor(0, rainbow).color },
    ...sorted.map((filter, index) => ({
      offset: Math.log(filter.frequency / GRAPH_START) / logSpan,
      color: getBandColor(
        sorted.length > 1 ? index / (sorted.length - 1) : 0,
        rainbow,
      ).color,
    })),
    { offset: 1, color: getBandColor(1, rainbow).color },
  ];
};

/** Each curve's points, or nothing where the layer draws none. */
export interface IChartCurvePoints {
  t: ReturnType<typeof useTranslation>['t'];
  convolution?: { name: string; points: IChartPointData[] };
  voicing?: IChartPointData[];
  driver?: IChartPointData[];
  headphone?: IChartPointData[];
  smart?: IChartPointData[];
  custom?: { fileName: string; points: IChartPointData[] };
  tone?: IChartPointData[];
  /** At full weight while an EQ mode is doing something to the sound. */
  total?: { points: IChartPointData[]; isEmphasised: boolean };
  eq?: {
    points: IChartPointData[];
    isQuiet: boolean;
    gradientStops: IChartGradientStop[];
  };
}

/** Every curve the graph draws, in the order they are painted. */
const chartCurves = ({
  t,
  convolution,
  voicing,
  driver,
  headphone,
  smart,
  custom,
  tone,
  total,
  eq,
}: IChartCurvePoints): IChartCurveData[] => [
  ...(convolution
    ? [
        supporting(
          'Headphone Convolution',
          `Convolution · ${convolution.name}`,
          ColorEnum.COMPLEMENTARY,
          convolution.points,
        ),
      ]
    : []),
  // The voicing layer on its own, so its shape is readable next to the bands
  // rather than hidden inside their sum.
  ...(voicing
    ? [
        supporting(
          VOICING_CURVE_ID,
          t('graph.curve.voicing'),
          ColorEnum.TRIADIC1,
          voicing,
        ),
      ]
    : []),
  // Driver compensation gets the same treatment: its own curve, so a
  // correction applied on your behalf is visible rather than taken on trust.
  ...(driver
    ? [supporting('Driver', t('graph.curve.driver'), ColorEnum.DRIVER, driver)]
    : []),
  // Beside the driver, and drawn like it. It was the only one of the four
  // corrections without a line, and frequently the largest of them — so the
  // only way to see its shape was to switch it off and watch the total move.
  ...(headphone
    ? [
        supporting(
          'Headphone Correction',
          t('graph.curve.headphone'),
          ColorEnum.HEADPHONE,
          headphone,
        ),
      ]
    : []),
  // Nobody chose this curve's shape, so it is the one layer that cannot be
  // inspected anywhere else: a correction you can see is a correction you can
  // argue with.
  ...(smart
    ? [supporting('Smart EQ', t('graph.curve.smart'), ColorEnum.SMART, smart)]
    : []),
  ...(custom
    ? [
        supporting(
          'Custom FX',
          `${t('graph.curve.custom')} · ${custom.fileName}`,
          ColorEnum.CUSTOM,
          custom.points,
        ),
      ]
    : []),
  // Over the other layers and under the EQ, and at full strength like the
  // EQ: it is turned while listening, as the bands are, and read against
  // them. Held back at half with the layers nobody turns, its chartreuse sank
  // to an olive that read as orange on the dark plot beside a legend swatch
  // drawn in the real colour (Ivan, 2026-09-23).
  ...(tone
    ? [
        {
          id: 'Tone',
          name: t('graph.curve.tone'),
          line: { color: ColorEnum.TONE, strokeWidth: 2, points: tone },
        },
      ]
    : []),
  // Named for what it is rather than for what went into it: "EQ + voicing +
  // Smart EQ" was the longest chip in the legend and still did not say that
  // this line is the one you are listening to.
  ...(total
    ? [
        {
          id: OUTPUT_CURVE_ID,
          name: t('graph.curve.total'),
          line: {
            color: ColorEnum.TOTAL,
            strokeWidth: total.isEmphasised ? 3 : 2,
            opacity: total.isEmphasised ? 1 : SUPPORTING_CURVE_OPACITY,
            points: total.points,
          },
        },
      ]
    : []),
  // Quietly in the reading state, at full weight everywhere else.
  //
  // The line itself was never what made the layer curves hard to read — its
  // furniture was: three pixels of stroke with a glow under it, a spectrum
  // gradient, and two dozen handles on top of the very curves somebody is
  // trying to see. So in the reading state the furniture goes and the line
  // stays, thin and plain.
  ...(eq
    ? [
        {
          id: 'EQ Response',
          name: t('graph.curve.eq'),
          line: eq.isQuiet
            ? {
                color: 'currentColor' as const,
                strokeWidth: 1.5,
                opacity: SUPPORTING_CURVE_OPACITY,
                points: eq.points,
              }
            : {
                color: 'currentColor' as const,
                strokeWidth: 3,
                points: eq.points,
                gradientId: 'chart-eq-spectrum-gradient',
                gradientStops: eq.gradientStops,
                glow: true,
              },
        },
      ]
    : []),
];

export default chartCurves;
