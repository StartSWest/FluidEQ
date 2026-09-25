/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useSyncExternalStore } from 'react';
import { frequencyScale, graphFrequencyRange } from './ChartController';
import { getAxisPadding } from './graphPaper';
import { GRID_SIDE_MARGIN } from './plotMargins';
import { handleXInPlot } from './EditablePoint';

/**
 * Where the EQ graph's plot is, for the band row standing under it.
 *
 * Layout A (Ivan 2026-09-25) puts the graph directly above the bands and
 * each band's slider directly under the point on the graph it moves — one
 * instrument, read top to bottom. The slider row cannot know where those
 * points are: the frequency axis is built inside `Chart` from the plot's
 * measured width, its side margins and its gutters, none of which leaves it.
 * The graph publishes the two things the axis is built from here, and
 * `bandXInPlot` rebuilds the same axis from them, so a band's slider and its
 * handle are placed by one calculation rather than by two that agree.
 */
export interface IPlotGeometry {
  /** The `.graph-plot` box; every x below is measured from its left edge. */
  element: HTMLElement;
  /** Its width, which the axis is built across. */
  width: number;
  /** Grid on: the full spectrum inside two label gutters. Off: edge to edge. */
  isGridHidden: boolean;
}

/**
 * A band's handle's x in the plot, as `FrequencyResponseChart` and `Chart`
 * place it: the chart's side margin (`GRID_SIDE_MARGIN` with the grid), the
 * axis gutters inside it (`getAxisPadding`, which only moves the top and
 * bottom when the grid is off), the grid's range (`graphFrequencyRange`), and
 * the same pull in from the plot's ends that keeps a handle whole
 * (`handleXInPlot`).
 */
export const bandXInPlot = (
  frequency: number,
  { width, isGridHidden }: Pick<IPlotGeometry, 'width' | 'isGridHidden'>,
): number => {
  const side = isGridHidden ? 0 : GRID_SIDE_MARGIN;
  const padding = getAxisPadding(isGridHidden);
  const scale = frequencyScale(
    Math.max(width - side * 2, 0),
    padding.left,
    padding.right,
    graphFrequencyRange(isGridHidden),
  );
  return side + handleXInPlot(Number(scale(frequency)) || 0, scale.range());
};

/**
 * How the band row is laid out under the plot: every band `slot` wide, and
 * each one's left margin from the one before it (from the row's own left
 * edge, for the first). A flex row of those is the bands at their points, at
 * the height their content already gives them.
 */
export interface IBandPlacement {
  slot: number;
  leads: number[];
}

/**
 * Narrowest a band is still a band at: the width the row already refuses to
 * go below before it scrolls instead (`--band-min-width` in MainContent.scss),
 * where the frequency caption, the thumb and the gain still read.
 */
export const MIN_BAND_SLOT = 40;

/** Widest a band is drawn: the even layout's own width per band. */
export const MAX_BAND_SLOT = 64;

/**
 * How far a band may stand from its point and still read as under it: a
 * quarter of its width, about half its thumb. Past that the bands stay evenly
 * spaced — thirty-one of them a third of an octave apart are about 30px from
 * each other on a wide window, and spread to 40 the ones at the ends would
 * stand a whole band from their points.
 */
const MAX_BAND_SHIFT = 0.25;

/**
 * The positions nearest `points` (least squares) that keep neighbours at
 * least `slot` apart and inside `[low, high]`, or `undefined` when they
 * cannot all fit.
 *
 * Moving each point left by its index times the slot turns "at least a slot
 * apart" into "never decreasing", which pool-adjacent-violators solves
 * exactly; the bounds then only bind at the two ends, so clamping the pooled
 * values to them is the whole answer. Two points 39.9px apart with a 40px
 * slot come out 0.05px either side of where they were, which is all the row
 * needed at 900px: it used to fall back to even spacing there, sliders up to
 * 30px from their points for want of a tenth of a pixel.
 */
const spreadApart = (
  points: readonly number[],
  slot: number,
  low: number,
  high: number,
): number[] | undefined => {
  const ceiling = high - (points.length - 1) * slot;
  if (ceiling < low) {
    return undefined;
  }
  const blocks: { sum: number; count: number }[] = [];
  points.forEach((x, index) => {
    let block = { sum: x - index * slot, count: 1 };
    while (blocks.length > 0) {
      const previous = blocks[blocks.length - 1];
      if (previous.sum / previous.count <= block.sum / block.count) {
        break;
      }
      blocks.pop();
      block = {
        sum: previous.sum + block.sum,
        count: previous.count + block.count,
      };
    }
    blocks.push(block);
  });
  return blocks
    .flatMap(({ sum, count }) =>
      Array.from({ length: count }, () =>
        Math.min(ceiling, Math.max(low, sum / count)),
      ),
    )
    .map((y, index) => y + index * slot);
};

/**
 * Each band under its point, or `undefined` where that cannot be done well.
 *
 * `offset` is the plot's left edge in the row's coordinates — the two boxes
 * are in one column, but the row sits inside the page's padding. A band is
 * as wide as the closest pair allows, between `MIN_BAND_SLOT` and
 * `MAX_BAND_SLOT`; where two points are closer than the narrowest band, the
 * bands around them move apart by as little as that takes. The outermost are
 * kept inside the plot's own box, which the column clips, so on a gridless
 * plot (edge to edge, handles 12px from the edge) the first and last give up
 * the few pixels of overhang a band wider than 24px would need.
 */
export const placeBandsUnderPlot = (
  frequencies: readonly number[],
  geometry: Pick<IPlotGeometry, 'width' | 'isGridHidden'>,
  offset: number,
): IBandPlacement | undefined => {
  if (frequencies.length === 0 || geometry.width <= 0) {
    return undefined;
  }
  const points = frequencies.map(
    (frequency) => offset + bandXInPlot(frequency, geometry),
  );
  const gaps = points.slice(1).map((x, index) => x - points[index]);
  const slot = Math.max(MIN_BAND_SLOT, Math.min(MAX_BAND_SLOT, ...gaps));
  const low = offset + slot / 2;
  const high = offset + geometry.width - slot / 2;
  // Pulled in from the plot's ends first, as the row always was: that is the
  // band's own width, not a neighbour in the way, and is not counted below.
  const targets = points.map((x) => Math.min(high, Math.max(low, x)));
  const centres = spreadApart(targets, slot, low, high);
  if (
    !centres ||
    centres.some(
      (x, index) => Math.abs(x - targets[index]) > slot * MAX_BAND_SHIFT,
    )
  ) {
    return undefined;
  }
  const leads = centres.map((x, index) =>
    index === 0 ? x - slot / 2 : x - centres[index - 1] - slot,
  );
  return { slot, leads };
};

/**
 * Two placements nobody could tell apart: within half a pixel everywhere. A
 * resize observer reports fractional boxes, and re-laying the row for a
 * difference of a hundredth of a pixel would re-render it for nothing.
 */
export const isSamePlacement = (
  a: IBandPlacement | undefined,
  b: IBandPlacement | undefined,
): boolean => {
  if (!a || !b) {
    return a === b;
  }
  return (
    Math.abs(a.slot - b.slot) < 0.5 &&
    a.leads.length === b.leads.length &&
    a.leads.every((lead, index) => Math.abs(lead - b.leads[index]) < 0.5)
  );
};

let current: IPlotGeometry | undefined;
const listeners = new Set<() => void>();

/**
 * The graph's report of itself: on every change of width or grid, and
 * `undefined` as it leaves. Unchanged reports are dropped, so a resize
 * observer calling this on every frame of a drag re-renders the row only
 * when the plot has actually changed.
 */
export const publishPlotGeometry = (next: IPlotGeometry | undefined) => {
  if (
    next?.element === current?.element &&
    next?.width === current?.width &&
    next?.isGridHidden === current?.isGridHidden
  ) {
    return;
  }
  current = next;
  listeners.forEach((listener) => listener());
};

/** Only the graph that published may withdraw: a new one may be up already. */
export const withdrawPlotGeometry = (element: HTMLElement) => {
  if (current?.element === element) {
    publishPlotGeometry(undefined);
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const usePlotGeometry = () =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => undefined,
  );
