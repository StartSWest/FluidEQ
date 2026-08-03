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

import { PointerEvent, useMemo, useRef, useState } from 'react';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { ColorEnum } from '../styles/color';
import Axis from './Axis';
import GridLine from './GridLine';
import useController, {
  IChartCurveData,
  IChartGradientStop,
  IEditableChartPoint,
  IMarginLike,
} from './ChartController';
import Curve from './Curve';
import EditablePoint from './EditablePoint';

export interface ChartDimensions {
  height: number;
  width: number;
  margins: IMarginLike;
}

interface IChartProps {
  data: IChartCurveData[];
  dimensions: ChartDimensions;
  editablePoints?: IEditableChartPoint[];
  onMarqueeSelect?: (ids: string[], additive: boolean) => void;
}

const Chart = ({
  data = [],
  dimensions,
  editablePoints = [],
  onMarqueeSelect,
}: IChartProps) => {
  const { width, height, margins } = dimensions;
  const svgWidth = useMemo(
    () => Math.max(width - margins.left - margins.right, 0),
    [width, margins],
  );
  const svgHeight = useMemo(
    () => Math.max(height - margins.top - margins.bottom, 0),
    [height, margins],
  );

  const padding = useMemo(() => {
    return {
      left: 50,
      top: 0,
      right: 0,
      bottom: 30,
    };
  }, []);

  const chartWidth = useMemo(
    () =>
      Math.max(
        width - margins.left - margins.right - padding.left - padding.right,
        0,
      ),
    [width, margins, padding],
  );
  const chartHeight = useMemo(
    () =>
      Math.max(
        height - margins.top - margins.bottom - padding.top - padding.bottom,
        0,
      ),
    [height, margins, padding],
  );

  const { xTickFormat, yTickFormat, xScaleFreq, yScaleGain } = useController({
    data,
    width: svgWidth,
    height: svgHeight,
    padding,
  });
  const eqGradientStops: IChartGradientStop[] =
    data.find((curve) => curve.id === 'EQ Response')?.line.gradientStops || [];
  const svgRef = useRef<SVGSVGElement>(null);
  const selectionRef = useRef<
    | { startX: number; startY: number; currentX: number; currentY: number }
    | undefined
  >(undefined);
  const [selectionBox, setSelectionBox] =
    useState<typeof selectionRef.current>(undefined);

  const getSvgPoint = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) {
      return undefined;
    }
    const bounds = svg.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const handleSelectionStart = (event: PointerEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    if (target.closest?.('.graph-edit-point')) {
      return;
    }
    const point = getSvgPoint(event);
    if (!point) {
      return;
    }
    const next = {
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    };
    selectionRef.current = next;
    setSelectionBox(next);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSelectionMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!selectionRef.current) {
      return;
    }
    const point = getSvgPoint(event);
    if (!point) {
      return;
    }
    const next = {
      ...selectionRef.current,
      currentX: point.x,
      currentY: point.y,
    };
    selectionRef.current = next;
    setSelectionBox(next);
  };

  const finishSelection = (event: PointerEvent<SVGSVGElement>) => {
    const selection = selectionRef.current;
    if (!selection) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const left = Math.min(selection.startX, selection.currentX);
    const right = Math.max(selection.startX, selection.currentX);
    const top = Math.min(selection.startY, selection.currentY);
    const bottom = Math.max(selection.startY, selection.currentY);
    const isClick = right - left < 6 && bottom - top < 6;
    const selectedIds = isClick
      ? []
      : editablePoints
          .filter((point) => {
            const x = Number(xScaleFreq(point.data.x));
            const y = Number(yScaleGain(point.data.y));
            return x >= left && x <= right && y >= top && y <= bottom;
          })
          .map((point) => point.id);
    onMarqueeSelect?.(
      selectedIds,
      event.ctrlKey || event.metaKey || event.shiftKey,
    );
    selectionRef.current = undefined;
    setSelectionBox(undefined);
  };

  return (
    <svg
      ref={svgRef}
      width={svgWidth}
      height={svgHeight}
      onPointerDown={handleSelectionStart}
      onPointerMove={handleSelectionMove}
      onPointerUp={finishSelection}
      onPointerCancel={finishSelection}
      style={{
        margin: `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`,
      }}
    >
      <defs>
        <linearGradient
          id="chart-eq-spectrum-gradient"
          gradientUnits="userSpaceOnUse"
          x1={padding.left}
          x2={svgWidth - padding.right}
          y1={0}
          y2={0}
        >
          {(eqGradientStops.length > 0
            ? eqGradientStops
            : [
                { offset: 0, color: '#00e5cf' },
                { offset: 1, color: '#8b5cff' },
              ]
          ).map((stop) => (
            <stop
              key={`${stop.offset}-${stop.color}`}
              offset={`${Math.max(0, Math.min(1, stop.offset)) * 100}%`}
              stopColor={stop.color}
            />
          ))}
        </linearGradient>
        <filter
          id="chart-eq-neon-glow"
          x="-30%"
          y="-120%"
          width="160%"
          height="340%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <GridLine
        type="vertical"
        scale={xScaleFreq}
        tickValues={[20, 100, 200, 1000, 2000, 10000, 20000]}
        size={svgHeight - padding.bottom}
        transform={`translate(0, ${svgHeight - padding.bottom})`}
      />
      <GridLine
        type="vertical"
        scale={xScaleFreq}
        tickValues={[
          40, 60, 80, 120, 140, 160, 180, 400, 600, 800, 1200, 1400, 1600, 1800,
          4000, 6000, 8000, 12000, 14000, 16000, 18000,
        ]}
        size={svgHeight - padding.bottom - 20}
        transform={`translate(0, ${svgHeight - padding.bottom - 10})`}
      />
      <GridLine
        type="horizontal"
        scale={yScaleGain}
        tickValues={[MIN_GAIN, -10, 10, MAX_GAIN]}
        size={svgWidth - padding.left}
        transform={`translate(${padding.left}, 0)`}
      />
      <GridLine
        type="horizontal"
        scale={yScaleGain}
        tickValues={[0]}
        size={width - margins.left - margins.right}
        color={ColorEnum.COMPLEMENTARY}
        transform={`translate(${padding.left}, 0)`}
      />
      {selectionBox && (
        <rect
          className="chart-selection-box"
          x={Math.min(selectionBox.startX, selectionBox.currentX)}
          y={Math.min(selectionBox.startY, selectionBox.currentY)}
          width={Math.abs(selectionBox.currentX - selectionBox.startX)}
          height={Math.abs(selectionBox.currentY - selectionBox.startY)}
          pointerEvents="none"
        />
      )}
      {data.map((e: IChartCurveData) => (
        <Curve key={e.id} data={e} xScale={xScaleFreq} yScale={yScaleGain} />
      ))}
      {editablePoints.map((point) => (
        <EditablePoint
          key={point.id}
          point={point}
          svgRef={svgRef}
          xScale={xScaleFreq}
          yScale={yScaleGain}
        />
      ))}
      <clipPath id="chart-clip-path">
        <rect x={padding.left} width={chartWidth} height={chartHeight} />
      </clipPath>
      <Axis
        type="left"
        scale={yScaleGain}
        transform={`translate(${padding.left}, 0)`}
        tickValues={[MIN_GAIN, -10, 0, 10, MAX_GAIN]}
        tickFormat={yTickFormat}
      />
      <Axis
        type="bottom"
        scale={xScaleFreq}
        transform={`translate(0, ${svgHeight - padding.bottom})`}
        tickValues={[20, 100, 200, 1000, 2000, 10000, 20000]}
        tickFormat={xTickFormat}
      />
    </svg>
  );
};

export default Chart;
