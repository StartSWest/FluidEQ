/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import * as d3 from 'd3';
import {
  PointerEvent,
  type CSSProperties,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import {
  GRAPH_END,
  GRAPH_START,
  IEditableChartPoint,
  IChartPointData,
} from './ChartController';

interface IEditablePointProps {
  point: IEditableChartPoint;
  svgRef: React.RefObject<SVGSVGElement | null>;
  xScale: d3.AxisScale<d3.NumberValue>;
  yScale: d3.AxisScale<d3.NumberValue>;
}

const EditablePoint = ({
  point,
  svgRef,
  xScale,
  yScale,
}: IEditablePointProps) => {
  const dragging = useRef(false);
  const { data, selected, hovered } = point;
  const scaledX = useMemo(() => Number(xScale(data.x)) || 0, [data.x, xScale]);
  const scaledY = useMemo(() => Number(yScale(data.y)) || 0, [data.y, yScale]);

  const getPointFromEvent = useCallback(
    (event: PointerEvent<SVGCircleElement>): IChartPointData | undefined => {
      const svg = svgRef.current;
      if (!svg) {
        return undefined;
      }
      const bounds = svg.getBoundingClientRect();
      const xPixel = Math.max(
        0,
        Math.min(bounds.width, event.clientX - bounds.left),
      );
      const yPixel = Math.max(
        0,
        Math.min(bounds.height, event.clientY - bounds.top),
      );
      const invertX = (
        xScale as unknown as { invert: (value: number) => number }
      ).invert;
      const invertY = (
        yScale as unknown as { invert: (value: number) => number }
      ).invert;
      return {
        x: Math.round(
          Math.max(GRAPH_START, Math.min(GRAPH_END, invertX(xPixel))),
        ),
        y:
          Math.round(
            Math.max(MIN_GAIN, Math.min(MAX_GAIN, invertY(yPixel))) * 100,
          ) / 100,
      };
    },
    [svgRef, xScale, yScale],
  );

  const handlePointerDown = (event: PointerEvent<SVGCircleElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    point.onSelect(event.ctrlKey || event.metaKey || event.shiftKey);
  };

  const handlePointerMove = (event: PointerEvent<SVGCircleElement>) => {
    if (!dragging.current) {
      return;
    }
    const next = getPointFromEvent(event);
    if (next) {
      point.onChange(next);
    }
  };

  const handlePointerUp = (event: PointerEvent<SVGCircleElement>) => {
    if (!dragging.current) {
      return;
    }
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    point.onCommit();
  };

  const handleWheel = (event: React.WheelEvent<SVGCircleElement>) => {
    if (!selected || !event.ctrlKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    point.onQualityWheel(event.deltaY < 0 ? 1 : -1);
  };

  return (
    <g
      className={`graph-edit-point${selected ? ' graph-edit-point--selected' : ''}${hovered ? ' graph-edit-point--hovered' : ''}`}
      transform={`translate(${scaledX}, ${scaledY})`}
      role="slider"
      aria-label={`${point.name}. Drag to change frequency and gain. Ctrl-scroll to change Q.`}
      aria-valuetext={`${data.x} Hz, ${data.y.toFixed(2)} dB`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerEnter={() => point.onHover(true)}
      onPointerLeave={() => point.onHover(false)}
      onWheel={handleWheel}
      style={
        {
          touchAction: 'none',
          cursor: dragging.current ? 'grabbing' : 'grab',
          '--point-color': point.color,
          '--point-muted-color': point.mutedColor,
        } as CSSProperties
      }
    >
      <circle
        className="graph-edit-point__halo"
        r={selected || hovered ? 12 : 9}
      />
      <circle
        className="graph-edit-point__dot"
        r={selected || hovered ? 6.5 : 5}
      />
      <title>
        {point.name}: {data.x} Hz · {data.y.toFixed(2)} dB
        {selected ? ' · Ctrl+scroll changes Q' : ' · Click to select'}
      </title>
    </g>
  );
};

export default EditablePoint;
