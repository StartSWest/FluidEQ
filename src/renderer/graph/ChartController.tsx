/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { useMemo } from 'react';
import * as d3 from 'd3';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { Color } from 'renderer/styles/color';

/**
 * The frequency range the plot covers, which is wider than the audible band at
 * both ends so the 20Hz and 20kHz marks are not sitting on the frame.
 *
 * Chosen as a matched pair rather than as two round numbers. On a log axis the
 * margin is the ratio, so 10Hz put 20Hz a full 8.9% in from the left while
 * 25kHz put 20kHz only 2.9% from the right — three times the gap at one end,
 * and the whole drawing pushed over. `20 / start` and `end / 20000` are now
 * the same ratio, which lands both marks the same distance from their edge and
 * hands the space that was wasted back to the graph.
 *
 * If either is ever changed, change the other: start = 20 * 20000 / end.
 */
export const GRAPH_START = 16;
export const GRAPH_END = 25000;

export const INIT_ANIMATE_DURATION = 750;
export const GRAPH_ANIMATE_DURATION = 100;

export interface IMarginLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface IChartPointData {
  x: number;
  y: number;
}

export interface IChartGradientStop {
  offset: number;
  color: string;
}

export interface IChartLineDataPointsById {
  [id: string]: IChartPointData[];
}

export interface IChartCurveData {
  id: string;
  name: string;
  line: {
    color: Color;
    strokeWidth: number;
    points: IChartPointData[];
    gradientStops?: IChartGradientStop[];
    gradientId?: string;
    glow?: boolean;
    /**
     * How present the curve is. Defaults to full.
     *
     * The layers beneath the response being edited are context for reading it,
     * so they are drawn back rather than competing with it.
     */
    opacity?: number;
  };
  controlPoint?: IChartPointData;
}

/**
 * A live trace, described rather than handed over.
 *
 * The points are deliberately not in here, and that absence is the point. They
 * are replaced about twenty-two times a second, so everything they pass through
 * re-renders at that rate — which for the response graph meant a fourteen
 * hundred line component and every d3 effect beneath it, all so that a canvas at
 * the bottom of the tree could read one array. What travels down instead is the
 * trace's *configuration*: which way up it is drawn, in what colour, how
 * present. That changes when somebody chooses something, which is rare, and
 * `LiveTraceCanvas` subscribes to the frames itself.
 *
 * Separate from `IChartCurveData` rather than a variant of it, because the two
 * are drawn by different renderers with almost nothing in common — the band
 * curves are SVG paths with hit testing and transitions, this is pixels. One
 * shared type meant every band curve carrying four fields only the live trace
 * could use, and a `points` array the canvas no longer wants.
 */
export interface ILiveCurveData {
  /**
   * Draw this copy upside down.
   *
   * A reflection of the rendered geometry, not of the data. The distinction
   * matters: every style draws upward from a baseline, so negating the values
   * gives the *negative* of the wave, tall where it was short, rather than the
   * same wave hanging from the ceiling.
   */
  isFlipped?: boolean;
  /**
   * Draw this copy into half the plot, anchored at the middle.
   *
   * For the mirrored orientation, where two copies share the height rather than
   * both taking all of it — at full height they are two full-size waves drawn
   * over each other, which is a tangle rather than a reflection.
   */
  isHalfHeight?: boolean;
  /**
   * With `isHalfHeight`, grow out of the middle instead of in from the edge.
   *
   * The difference between a waveform as an editor draws one — silence a flat
   * line across the centre, a loud frame reaching both edges — and two spectrum
   * analysers facing each other, which is what growing inward looks like.
   */
  isFromCentre?: boolean;
  /**
   * How much of its available depth this copy uses. 1 by default.
   *
   * Separate from `isHalfHeight`, which is about how two copies *share* the
   * plot. This is about how tall the wave is drawn inside whatever share it
   * has, and it scales about the edge the orientation anchors to — so at 0.5 an
   * upright wave runs along the bottom of the screen at half its height rather
   * than moving to the middle.
   */
  heightScale?: number;
  /** What to paint with when the look brings no colours of its own. */
  colour: Color;
  /**
   * How present the trace is.
   *
   * Held back while it is one of several layers under the response being
   * edited, full strength when solo has taken the others away.
   */
  opacity: number;
}

export interface IEditableChartPoint {
  id: string;
  name: string;
  color: string;
  mutedColor: string;
  data: IChartPointData;
  selected: boolean;
  hovered: boolean;
  /**  is where the press landed, in chart units — see the drag state. */
  onSelect: (additive: boolean, grab: IChartPointData) => void;
  onChange: (data: IChartPointData) => void;
  onCommit: () => void;
  onQualityWheel: (direction: number) => void;
  onHover: (isHovered: boolean) => void;
}

interface IChartControllerProps {
  /**
   * The curves that set the y-scale. Deliberately not the curves that get
   * drawn: the live output trace moves ~22 times a second and must not make
   * the graph rescale under the user, and feeding it in here meant d3 walked
   * every point of every band curve at that rate to recompute an extent that
   * had not changed.
   */
  scaleData: IChartCurveData[];
  width: number;
  height: number;
  padding: IMarginLike;
}

const useController = ({
  scaleData,
  width,
  height,
  padding,
}: IChartControllerProps) => {
  const xScaleFreq = useMemo(
    () =>
      d3
        .scaleLog()
        .domain([GRAPH_START, GRAPH_END])
        .range([padding.left, width - padding.right]),
    [padding.left, padding.right, width],
  );

  const yMin = useMemo(
    () =>
      d3.min(scaleData, ({ line }) => d3.min(line.points, ({ y }) => y)) || 0,
    [scaleData],
  );

  const yMax = useMemo(
    () =>
      d3.max(scaleData, ({ line }) => d3.max(line.points, ({ y }) => y)) || 0,
    [scaleData],
  );

  const yScaleGain = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([
          Math.min(MIN_GAIN, yMin === undefined ? MIN_GAIN : yMin),
          Math.max(MAX_GAIN, yMax === undefined ? MAX_GAIN : yMax),
        ])
        .range([height - padding.bottom, padding.top]),
    [height, padding.bottom, padding.top, yMin, yMax],
  );

  const xTickFormat = (domainValue: d3.NumberValue) =>
    `${d3.format('~s')(domainValue)} Hz`;

  const yTickFormat = (domainValue: d3.NumberValue) =>
    `${Number(domainValue) > 0 ? '+' : ''}${d3.format('.2')(domainValue)} dB`;

  return {
    xTickFormat,
    yTickFormat,
    xScaleFreq,
    yScaleGain,
  };
};

export default useController;
