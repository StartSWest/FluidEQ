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
  memo,
  useCallback,
  useEffect,
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

/**
 * What a handle has to say about itself to something outside React.
 *
 * Deliberately the three things euphoria needs and nothing else. `frequency`
 * puts the handle in the frequency order the analyser's axis is in, which is
 * how it finds the slice of spectrum that belongs to this band; `selected` is
 * the gate, because only the handle being edited lights; and `published` is the
 * last stepped level it was told, so a frame where nothing moved can decide to
 * write nothing without reading the element back.
 *
 * `published` living here rather than in the pump is what keeps the bookkeeping
 * correct across a handle appearing and disappearing. A shared array indexed by
 * position goes wrong the moment a band is added, removed or dragged past its
 * neighbour: the entry survives and now describes a different band.
 */
export interface IGraphPointState {
  frequency: number;
  selected: boolean;
  published: number;
}

/**
 * Every handle currently drawn on the graph.
 *
 * Euphoria lights these with the music, and it has to reach them from outside
 * React: the level arrives with the analyser frame around twenty-two times a
 * second, and waking memoised components that often — to change a glow — is
 * exactly the cost the mode is built to avoid. It writes a custom property
 * straight to the element instead, which is what the slider row already does.
 *
 * A registry rather than a `querySelectorAll`, because the graph comes and
 * goes. It is a pane the user can switch off entirely, and even when it is on
 * the chart holds a spinner before it holds any handles. Anything that caches
 * the result of a query then has to guess when to run it again, and every
 * signal available for that guess — the band count, the view toggle — is a
 * proxy for "the handles were replaced" rather than the fact itself. Mounting
 * is the fact itself, so mounting is what maintains this.
 */
const mountedPoints = new Map<SVGGElement, IGraphPointState>();

/**
 * Visit every handle on the graph, in mount order.
 *
 * Empty whenever the graph is not showing, which is the caller's answer to
 * "is there anything to light" without asking anybody. Mount order and not
 * frequency order, which is why the state carries a frequency at all — the
 * chart builds these from `Object.values(filters)` and only the colours are
 * sorted, so where a handle sits in the map says nothing about where it sits on
 * the axis.
 */
export const forEachGraphPoint = (
  visit: (element: SVGGElement, state: IGraphPointState) => void,
) => {
  mountedPoints.forEach((state, element) => visit(element, state));
};

/**
 * How many there are, which is the band count whenever the graph is showing.
 *
 * The spectrum is divided across the bands by index, so anything working out
 * which slice belongs to a handle needs to know how many slices there are.
 */
export const graphPointCount = () => mountedPoints.size;

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
  const groupRef = useRef<SVGGElement>(null);
  const { data, selected, hovered } = point;

  // One record per handle, created once and then kept current in place.
  //
  // Written during render rather than from an effect, the way the trace canvas
  // holds on to its look: both of these change when a band is dragged or the
  // selection moves and at no other time, so an effect would be a second render
  // pass and a second set of dependencies to get wrong. The assignment is
  // idempotent, which is what makes it safe to do here.
  const stateRef = useRef<IGraphPointState>({
    frequency: data.x,
    selected,
    published: -1,
  });
  stateRef.current.frequency = data.x;
  stateRef.current.selected = selected;

  // In and out of the registry with the element itself. Empty deps because the
  // group is created once per handle and never swapped — a band being dragged
  // moves this node, it does not replace it — and because the record above is
  // the same object for the life of the handle, so registering it once is
  // registering it for good.
  useEffect(() => {
    const group = groupRef.current;
    const state = stateRef.current;
    if (!group) {
      return undefined;
    }
    mountedPoints.set(group, state);
    return () => {
      mountedPoints.delete(group);
    };
  }, []);

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
      ref={groupRef}
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

// One of these per band, all reconciled whenever the chart re-renders — which
// the live trace makes happen ~22 times a second. Their props only change when
// a band, the selection or the hover does, so memoising skips the lot.
export default memo(EditablePoint);
