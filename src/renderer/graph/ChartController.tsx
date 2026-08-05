/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

export const GRAPH_START = 10;
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
  /**
   * A curve whose points are replaced continuously rather than edited, so it
   * is drawn straight to the DOM instead of transitioned. A 100 ms ease onto
   * data that is replaced every 45 ms never arrives, and d3 pays for it by
   * building an interpolator for every number in the path string and rebuilding
   * that string on every animation tick.
   */
  isContinuous?: boolean;
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

export interface IEditableChartPoint {
  id: string;
  name: string;
  color: string;
  mutedColor: string;
  data: IChartPointData;
  selected: boolean;
  hovered: boolean;
  onSelect: (additive: boolean) => void;
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
