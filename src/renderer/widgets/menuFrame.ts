/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import bottomInset from '../utils/shellInset';

/**
 * Where a menu that is a window the reader sizes stands against its trigger
 * (`AnchoredMenu`'s `frame`, the look picker's window).
 *
 * Each of its two edges is on one side of the trigger or the other, never
 * across it: the top edge either hangs from under the trigger or stands
 * somewhere above it, and the bottom edge either rests on top of the trigger
 * or stands somewhere below it. So the window is below its trigger, above it,
 * or over it, reaching past it on both sides (Ivan, 2026-11-23: "resize it
 * down so it shows below the select or up so it shows on top of the
 * select"). An edge half across the trigger would cut the control in two,
 * which reads as a drawing fault rather than a place; a dragged edge that
 * reaches the trigger goes over it in one step, at its middle.
 */

/** The gap between the trigger and the menu, matching the in-flow menus. */
export const MENU_GAP = 6;

/** Clearance kept from the window edge, so it never looks pinned to it. */
export const MENU_MARGIN = 8;

/**
 * How far the window reaches past the trigger on each side, from the line a
 * menu above it ends on (`above`) and the line a menu below it starts on
 * (`below`). `null` is an edge on the trigger's near side: no `above` is a
 * window hanging from under the trigger, no `below` one resting on top of it.
 * Both numbers make a window over the trigger.
 */
export type TMenuReach =
  | { above: null; below: number }
  | { above: number; below: null }
  | { above: number; below: number };

/** The size and place the reader gave a framed menu. */
export type TMenuFrame = TMenuReach & {
  width: number;
  /** How far its aligned edge stands from the trigger's - right is positive. */
  nudge: number;
};

/** A frame put back together from its numbers, when there is one. */
export const frameOf = (
  width: number | undefined,
  nudge: number | undefined,
  above: number | null | undefined,
  below: number | null | undefined,
): TMenuFrame | undefined => {
  if (width === undefined || nudge === undefined) {
    return undefined;
  }
  if (typeof above === 'number') {
    return typeof below === 'number'
      ? { width, nudge, above, below }
      : { width, nudge, above, below: null };
  }
  return typeof below === 'number'
    ? { width, nudge, above: null, below }
    : undefined;
};

/** Which side of its trigger a menu stands on; `over` reaches past both. */
export type TMenuSide = 'up' | 'down' | 'over';

/**
 * The trigger's band, gaps included: `top` is where a menu above it ends,
 * `bottom` where one below it starts.
 */
export interface IMenuBand {
  top: number;
  bottom: number;
}

/** The part of the window a menu may stand in, top and bottom. */
export interface IMenuRoom {
  top: number;
  bottom: number;
}

export const bandOf = (trigger: {
  top: number;
  bottom: number;
}): IMenuBand => ({
  top: trigger.top - MENU_GAP,
  bottom: trigger.bottom + MENU_GAP,
});

/**
 * The window less its margins, and less the now-playing bar at the bottom,
 * which is not room: a menu running under it has its last rows hidden with
 * nothing to say they are there.
 */
export const menuRoom = (): IMenuRoom => ({
  top: MENU_MARGIN,
  bottom: window.innerHeight - MENU_MARGIN - bottomInset(),
});

/**
 * The reach a window with these edges has. An edge is above the trigger, or
 * below it, by which half of the band it stands in: the resting places
 * (`restTop`, `restBottom`) never leave one inside it.
 */
export const reachOf = (
  top: number,
  bottom: number,
  band: IMenuBand,
): TMenuReach => {
  const middle = (band.top + band.bottom) / 2;
  const above = top < middle ? Math.max(0, band.top - top) : null;
  const below = bottom > middle ? Math.max(0, bottom - band.bottom) : null;
  if (above === null) {
    // Both edges on the near half is a window thinner than the band, which
    // no resting place makes; read it as hanging below.
    return { above: null, below: below ?? 0 };
  }
  if (below === null) {
    return { above, below: null };
  }
  return { above, below };
};

/**
 * Where a framed menu stands, from what the reader gave it.
 *
 * A window on one side of its trigger crosses to the other only when it does
 * not fit on its own and the other side has more room, as every menu here
 * does; it opens there at its own height, cut to the room. A window over its
 * trigger keeps each edge where it was put, held inside the room.
 */
export const placeFrame = (
  reach: TMenuReach,
  band: IMenuBand,
  room: IMenuRoom,
): { top: number; height: number; side: TMenuSide } => {
  if (reach.above !== null && reach.below !== null) {
    const top = Math.max(room.top, band.top - reach.above);
    const bottom = Math.min(room.bottom, band.bottom + reach.below);
    return { top, height: Math.max(0, bottom - top), side: 'over' };
  }
  const roomAbove = Math.max(0, band.top - room.top);
  const roomBelow = Math.max(0, room.bottom - band.bottom);
  const wantsUp = reach.below === null;
  const wanted = reach.below === null ? reach.above : reach.below;
  const fits = wanted <= (wantsUp ? roomAbove : roomBelow);
  const up = fits ? wantsUp : roomAbove > roomBelow;
  const height = Math.min(wanted, up ? roomAbove : roomBelow);
  return {
    top: up ? band.top - height : band.bottom,
    height,
    side: up ? 'up' : 'down',
  };
};

/** The smallest and largest a framed menu may be made, top to bottom. */
export interface IHeightLimits {
  min: number;
  max: number;
}

/**
 * Which way a keyboard step is going. A pointer lands an edge on the nearer
 * side of the trigger; a step has to cross it, or an edge beside the trigger
 * would ask for a place inside the band and come back where it was, for
 * ever.
 */
export type TEdgeLean = 'up' | 'down';

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * The resting place nearest to `wanted` among a run of places from `runLow`
 * to `runHigh` and one place on its own, `point`, inside [low, high]. Inside
 * the band a lean picks the side; elsewhere the nearer one wins.
 */
const nearestRest = (
  wanted: number,
  run: { low: number; high: number },
  point: number,
  bounds: { low: number; high: number },
  inBand: { leanToRun: boolean } | undefined,
): number => {
  const runLow = Math.max(bounds.low, run.low);
  const runHigh = Math.min(bounds.high, run.high);
  const onRun = runLow <= runHigh ? clamp(wanted, runLow, runHigh) : undefined;
  const onPoint =
    point >= bounds.low && point <= bounds.high ? point : undefined;
  if (onRun === undefined || onPoint === undefined) {
    // A window shorter than its smallest size has no resting place at all;
    // the room wins over the size, as everywhere else here.
    return (
      onRun ??
      onPoint ??
      Math.max(Math.min(bounds.low, bounds.high), Math.min(bounds.high, wanted))
    );
  }
  if (inBand) {
    return inBand.leanToRun ? onRun : onPoint;
  }
  return Math.abs(wanted - onRun) <= Math.abs(wanted - onPoint)
    ? onRun
    : onPoint;
};

/**
 * Where a dragged top edge comes to rest: anywhere above the trigger, up to
 * the room, or hanging from under it - and never so close to the bottom edge
 * that the window is under its smallest size, nor so far that it is over its
 * largest.
 */
export const restTop = (
  wanted: number,
  bottom: number,
  band: IMenuBand,
  room: IMenuRoom,
  limits: IHeightLimits,
  lean?: TEdgeLean,
): number =>
  nearestRest(
    wanted,
    { low: -Infinity, high: band.top },
    band.bottom,
    {
      low: Math.max(room.top, bottom - limits.max),
      high: bottom - limits.min,
    },
    lean && wanted > band.top && wanted < band.bottom
      ? { leanToRun: lean === 'up' }
      : undefined,
  );

/** The bottom edge's resting place, as `restTop` with the sides swapped. */
export const restBottom = (
  wanted: number,
  top: number,
  band: IMenuBand,
  room: IMenuRoom,
  limits: IHeightLimits,
  lean?: TEdgeLean,
): number =>
  nearestRest(
    wanted,
    { low: band.bottom, high: Infinity },
    band.top,
    {
      low: top + limits.min,
      high: Math.min(room.bottom, top + limits.max),
    },
    lean && wanted > band.top && wanted < band.bottom
      ? { leanToRun: lean === 'down' }
      : undefined,
  );
