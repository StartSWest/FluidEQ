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
 * Always attached to the trigger and never over it: wholly below, its top
 * edge on the trigger's bottom, or wholly above, its bottom edge on the
 * trigger's top. The trigger is the window's anchor and stays in sight
 * (Ivan, 2026-11-23: "the select must always be the anchor and be seen";
 * "it's like a flip: it shows above or below depending on what the user
 * intends"). A first version let the window reach past the trigger and
 * cover it, and was taken back the same day.
 *
 * So only the far edge moves, and dragging it back across the trigger flips
 * the window to the other side: the far edge goes where the pointer is, and
 * the trigger's own band is never inside the window, at any instant of the
 * drag.
 */

/** The gap between the trigger and the menu, matching the in-flow menus. */
export const MENU_GAP = 6;

/** Clearance kept from the window edge, so it never looks pinned to it. */
export const MENU_MARGIN = 8;

/** Which side of its trigger a menu stands on. */
export type TMenuSide = 'up' | 'down';

/** A framed menu's side and its height there. */
export interface IMenuPlace {
  side: TMenuSide;
  height: number;
}

/** The size and place the reader gave a framed menu. */
export interface IMenuFrame extends IMenuPlace {
  width: number;
  /** How far its aligned edge stands from the trigger's - right is positive. */
  nudge: number;
}

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

/** The smallest and largest a framed menu may be made, top to bottom. */
export interface IHeightLimits {
  min: number;
  max: number;
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

const roomOn = (side: TMenuSide, band: IMenuBand, room: IMenuRoom) =>
  Math.max(0, side === 'up' ? band.top - room.top : room.bottom - band.bottom);

const other = (side: TMenuSide): TMenuSide => (side === 'up' ? 'down' : 'up');

/** `low` gives way to `high`: the room wins over the smallest size. */
const clampRoomWins = (value: number, low: number, high: number) =>
  Math.max(Math.min(low, high), Math.min(high, value));

/**
 * Where a framed menu stands, from what the reader gave it.
 *
 * On the side the reader put it, cut to the room there, whenever that room
 * holds the window or at least its smallest size - never moved for having
 * more room on the other side (Ivan, 2026-11-23: "unless there is not much
 * room, the picker always opens on the side where the user put it"). Only a
 * side too short for the smallest window gives way, to the other side if
 * that one has more room. The reader's side is not changed by it: the next
 * time there is room, it opens where they put it again.
 */
export const placeFrame = (
  place: IMenuPlace,
  band: IMenuBand,
  room: IMenuRoom,
  minHeight: number,
): { top: number; height: number; side: TMenuSide } => {
  const own = roomOn(place.side, band, room);
  const theirs = roomOn(other(place.side), band, room);
  const roomy = own >= Math.min(place.height, minHeight);
  const side = roomy || own >= theirs ? place.side : other(place.side);
  const height = Math.min(place.height, roomOn(side, band, room));
  return {
    top: side === 'up' ? band.top - height : band.bottom,
    height,
    side,
  };
};

/**
 * Whether a window may flip to `to`: only where there is room for it, at
 * least as much as its smallest size or as the side it leaves. A flip into
 * a sliver would leave a window too short to use, for a pointer that only
 * passed over the trigger.
 */
const mayFlip = (
  to: TMenuSide,
  band: IMenuBand,
  room: IMenuRoom,
  limits: IHeightLimits,
) =>
  roomOn(to, band, room) >= Math.min(limits.min, roomOn(other(to), band, room));

/**
 * The window a dragged far edge makes: the edge where the pointer is, on
 * the side of the trigger the pointer is on - past the trigger's middle, the
 * window flips - held between the smallest and largest heights and to the
 * room on that side. The near edge stays on the trigger, so the trigger is
 * never inside the window.
 */
export const dragFarEdge = (
  wanted: number,
  from: TMenuSide,
  band: IMenuBand,
  room: IMenuRoom,
  limits: IHeightLimits,
): IMenuPlace => {
  const middle = (band.top + band.bottom) / 2;
  const pointed: TMenuSide = wanted < middle ? 'up' : 'down';
  const side =
    pointed === from || mayFlip(pointed, band, room, limits) ? pointed : from;
  const reach = side === 'up' ? band.top - wanted : wanted - band.bottom;
  return {
    side,
    height: clampRoomWins(
      reach,
      limits.min,
      Math.min(limits.max, roomOn(side, band, room)),
    ),
  };
};

/**
 * One keyboard step of the far edge, `delta` pixels down (or up, negative).
 * Away from the trigger it grows, towards it it shrinks; a step towards the
 * trigger from the smallest the window can be flips it, at that height, to
 * the other side - the keyboard's way across, since an edge held to the
 * smallest size never reaches the trigger to cross it.
 */
export const stepFarEdge = (
  current: IMenuPlace,
  delta: number,
  band: IMenuBand,
  room: IMenuRoom,
  limits: IHeightLimits,
): IMenuPlace => {
  const grows = current.side === 'up' ? delta < 0 : delta > 0;
  const top = Math.min(limits.max, roomOn(current.side, band, room));
  const height = clampRoomWins(
    current.height + (grows ? Math.abs(delta) : -Math.abs(delta)),
    limits.min,
    top,
  );
  const stuck = !grows && height >= current.height;
  const to = other(current.side);
  if (stuck && mayFlip(to, band, room, limits)) {
    return {
      side: to,
      height: clampRoomWins(
        current.height,
        limits.min,
        Math.min(limits.max, roomOn(to, band, room)),
      ),
    };
  }
  return { side: current.side, height };
};
