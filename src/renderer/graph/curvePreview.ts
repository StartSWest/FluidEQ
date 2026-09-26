/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * A layer's combined response, as one SVG path.
 *
 * The maths the Squiglink import panel grew for its preview, lifted out so the
 * headphone correction can draw its applied curve the same way rather than a
 * second approximation of it. Everything here is pure: points in, path string
 * out, no React and no styling.
 */

import { AutoEqFormat, IFiltersMap, IGraphicEqPoint } from 'common/constants';
import { IChartPointData } from './ChartController';
import {
  getCombinedLineData,
  getFilterLineData,
  getGraphicEqLineData,
  getLineGainAtFrequency,
} from './utils';

/** The drawing box, in the units of the caller's `viewBox`. */
export interface ICurveBox {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface ICurvePath {
  path: string;
  min: number;
  max: number;
  points: IChartPointData[];
}

/** The audible span, and the span every curve here is drawn across. */
const MIN_HZ = 20;
const MAX_HZ = 20000;

/**
 * One box for every panel preview.
 *
 * Shared rather than tuned per panel: an SVG at `width: 100%` takes its height
 * from its viewBox, so two charts in two equal columns are the same height only
 * if they are the same shape. The headphone correction and the Squiglink import
 * sit one above the other on the same page, and two curve boxes of nearly the
 * same size is worse than either size.
 */
export const PREVIEW_BOX: ICurveBox = {
  width: 640,
  height: 164,
  // The top inset is what keeps a boosted curve off the heading above it: the
  // line rides the top of the box whenever the correction lifts anything, and
  // at 12 it touched the label.
  padding: { top: 20, right: 12, bottom: 24, left: 30 },
};

/**
 * Where a frequency and a gain land inside the box.
 *
 * Exported because grid lines and axis labels have to agree with the curve to
 * the pixel — two copies of this arithmetic is how a zero line ends up half a
 * decibel off the curve it is supposed to cross.
 */
export const curveScales = (
  box: ICurveBox,
  bounds: { min: number; max: number },
) => {
  const innerWidth = box.width - box.padding.left - box.padding.right;
  const innerHeight = box.height - box.padding.top - box.padding.bottom;
  const logStart = Math.log10(MIN_HZ);
  const logEnd = Math.log10(MAX_HZ);

  return {
    x: (frequency: number) =>
      box.padding.left +
      ((Math.log10(frequency) - logStart) / (logEnd - logStart)) * innerWidth,
    y: (gain: number) =>
      box.padding.top +
      ((bounds.max - gain) / (bounds.max - bounds.min)) * innerHeight,
  };
};

/**
 * The part of a curve these boxes draw, 20 Hz to 20 kHz, ending on both edges.
 *
 * The response is sampled from 10 Hz, where the main graph's plot starts
 * (`RESPONSE_START`), and the octave under 20 Hz, placed by these scales,
 * landed left of the box and ran out over the panel beside it (Ivan,
 * 2026-09-26: "curves in presets eq outside the box"); it also stretched the
 * gain axis for a range nobody sees here. Dropping it is not enough on its
 * own: no sample falls on 20 Hz (the nearest is 20.12), and the last one is
 * 20000.000000000004, so a plain filter stopped the line short of both edges.
 * Each edge the samples reach past gets a point of its own, read between the
 * two samples either side of it in log frequency, as the graph reads them.
 */
const clipToSpan = (points: IChartPointData[]): IChartPointData[] => {
  const inside = points.filter(
    (point) => point.x >= MIN_HZ && point.x <= MAX_HZ,
  );
  if (points.length === 0) {
    return inside;
  }
  const lowest = points[0].x;
  const highest = points[points.length - 1].x;
  const head =
    lowest < MIN_HZ && highest > MIN_HZ && inside[0]?.x !== MIN_HZ
      ? [{ x: MIN_HZ, y: getLineGainAtFrequency(points, MIN_HZ) }]
      : [];
  const tail =
    highest > MAX_HZ &&
    lowest < MAX_HZ &&
    inside[inside.length - 1]?.x !== MAX_HZ
      ? [{ x: MAX_HZ, y: getLineGainAtFrequency(points, MAX_HZ) }]
      : [];
  return [...head, ...inside, ...tail];
};

/**
 * Points to a path, at a fixed ±12 dB floor unless the curve exceeds it.
 *
 * The floor is what makes two curves comparable: a correction that only ever
 * asks for 2 dB should look like a small correction, and it does not if the
 * axis shrinks to fit it.
 */
export const makePath = (
  points: IChartPointData[],
  box: ICurveBox,
  bounds?: { min: number; max: number },
): ICurvePath => {
  const shown = clipToSpan(points);
  if (shown.length === 0) {
    return { path: '', min: -12, max: 12, points };
  }

  const minValue = Math.min(...shown.map((point) => point.y));
  const maxValue = Math.max(...shown.map((point) => point.y));
  const min = bounds?.min ?? Math.min(-12, Math.floor(minValue / 3) * 3);
  const max = bounds?.max ?? Math.max(12, Math.ceil(maxValue / 3) * 3);
  const { x, y } = curveScales(box, { min, max });

  // One point per pixel of width is already more than a 2.6px stroke can show,
  // and the full set is a few thousand.
  const stride = Math.max(1, Math.ceil(shown.length / 180));
  const drawn = shown.filter((_point, index) => index % stride === 0);
  const last = shown[shown.length - 1];
  if (drawn[drawn.length - 1] !== last) {
    drawn.push(last);
  }

  return {
    min,
    max,
    points,
    path: drawn
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'}${x(point.x).toFixed(2)},${y(point.y).toFixed(2)}`,
      )
      .join(' '),
  };
};

/**
 * The combined response of a layer, preamp included.
 *
 * A GraphicEQ curve is drawn from its own points rather than from the bands
 * fitted to it, because the points are what reaches Equalizer APO.
 */
export const getCurvePoints = (
  preAmp: number,
  eqFormat: AutoEqFormat | undefined,
  graphicEq: IGraphicEqPoint[] | undefined,
  filters: IFiltersMap,
) => {
  if (eqFormat === AutoEqFormat.GRAPHIC && graphicEq?.length) {
    return getGraphicEqLineData(graphicEq).map((point) => ({
      x: point.x,
      y: point.y + preAmp,
    }));
  }
  const filterLines = Object.fromEntries(
    Object.values(filters).map((filter) => [
      filter.id,
      getFilterLineData(filter),
    ]),
  );
  return getCombinedLineData(preAmp, filterLines);
};

export const makeCurve = (
  preAmp: number,
  eqFormat: AutoEqFormat | undefined,
  graphicEq: IGraphicEqPoint[] | undefined,
  filters: IFiltersMap,
  box: ICurveBox,
) => makePath(getCurvePoints(preAmp, eqFormat, graphicEq, filters), box);

/** The decade marks every one of these charts labels. */
export const CURVE_FREQUENCY_LABELS: { value: number; label: string }[] = [
  { value: 20, label: '20' },
  { value: 100, label: '100' },
  { value: 1000, label: '1k' },
  { value: 10000, label: '10k' },
  { value: 20000, label: '20k' },
];
