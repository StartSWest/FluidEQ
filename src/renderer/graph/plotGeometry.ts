/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useSyncExternalStore } from 'react';

/**
 * Where the EQ graph's plot is, for the band row standing under it.
 *
 * Layout A (Ivan 2026-09-25) puts the graph directly above the bands, the
 * row as wide as the plot. Each band keeps its own place in it, the plot's
 * width shared evenly in frequency order: a band's slider does not move
 * when its frequency is dragged on the graph, and two bands trade places
 * only when one passes the other (Ivan, 2026-09-26: "don't move the slider
 * if I move the freq in the graph … their position doesn't change, they
 * just interchange each other if they overpass the prev or next one"). They
 * stood under their handles before, and a drag on the graph slid the slider
 * sideways under the pointer's hand.
 */
export interface IPlotGeometry {
  /** The `.graph-plot` box, whose left edge the row is measured against. */
  element: HTMLElement;
  /** Its width, which the row shares out. */
  width: number;
}

/**
 * How the band row is laid out under the plot: every band `slot` wide, and
 * each one's left margin from the one before it (from the row's own left
 * edge, for the first). A flex row of those is the bands in their places, at
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
 * `count` bands in fixed places under the plot, or `undefined` where they do
 * not fit and the row should scroll instead.
 *
 * `offset` is the plot's left edge in the row's coordinates — the two boxes
 * are in one column, but the row sits inside the page's padding. `visible`
 * is the stretch of the row the page shows, in the same coordinates: the
 * scroller the row stands in clips it at its padding and its scrollbar's
 * gutter, and a band kept only inside the plot was cut in half there (Ivan,
 * 2026-09-25: "EQ never can get trim on the side").
 *
 * The stretch the plot and the page both cover is shared evenly: each band
 * centred in its share, as wide as the share allows up to `MAX_BAND_SLOT`.
 */
export const placeBandsEvenly = (
  count: number,
  geometry: Pick<IPlotGeometry, 'width'>,
  offset: number,
  visible?: { left: number; right: number },
): IBandPlacement | undefined => {
  if (count <= 0 || geometry.width <= 0) {
    return undefined;
  }
  const left = Math.max(offset, visible?.left ?? offset);
  const right = Math.min(
    offset + geometry.width,
    visible?.right ?? offset + geometry.width,
  );
  const share = (right - left) / count;
  if (share < MIN_BAND_SLOT) {
    return undefined;
  }
  const slot = Math.min(MAX_BAND_SLOT, share);
  const leads = Array.from({ length: count }, (_, index) =>
    index === 0 ? left + (share - slot) / 2 : share - slot,
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
 * The graph's report of itself: on every change of width, and
 * `undefined` as it leaves. Unchanged reports are dropped, so a resize
 * observer calling this on every frame of a drag re-renders the row only
 * when the plot has actually changed.
 */
export const publishPlotGeometry = (next: IPlotGeometry | undefined) => {
  if (next?.element === current?.element && next?.width === current?.width) {
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
