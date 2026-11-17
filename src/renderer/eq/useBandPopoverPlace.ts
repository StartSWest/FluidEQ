/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useLayoutEffect, useState } from 'react';

/** Where the band popover stands, and where its point is. */
export interface IBandPopoverPlace {
  left: number;
  top: number;
  /** The point's distance from the popover's top, at the handle's height. */
  arrow: number;
  /** Which side of the handle it stands on. */
  side: 'right' | 'left';
}

/** A band's handle, in its room's coordinates. */
export interface IPopoverHandle {
  x: number;
  y: number;
  /** From the handle's middle to the popover's near edge. */
  clearance: number;
  /** What moves when the handle does, where its position is its own. */
  moves?: Element;
}

/** Finds a band's handle in the room the popover is placed in. */
export type TLocateHandle = (
  room: HTMLElement,
  filterId: string,
) => IPopoverHandle | undefined;

/** Kept this far inside its room at every edge. */
const EDGE = 6;

/** The point stays this far from the popover's own top and foot. */
const ARROW_INSET = 18;

/**
 * Where along one side of its room a popover of `size` starts, as near
 * `wanted` as the room allows and the edge's margin inside it. A room with
 * no space for the margins — a 1280x800 window's bands are exactly the
 * popover's height — centres it, flush, rather than letting it hang past
 * the foot.
 */
const fitAlong = (wanted: number, size: number, room: number) =>
  room - size < 2 * EDGE
    ? Math.max(0, (room - size) / 2)
    : Math.min(Math.max(EDGE, wanted), room - size - EDGE);

const roomBox = (room: HTMLElement) => {
  const box = room.getBoundingClientRect();
  return { x: box.left + room.clientLeft, y: box.top + room.clientTop };
};

/**
 * A band's handle on its slider: the slider's middle, at its value's height.
 * The slider's own position is its value, so nothing extra is watched.
 */
export const locateBandHandle: TLocateHandle = (room, filterId) => {
  const slider = room.querySelector<HTMLInputElement>(
    `.bandWrapper[data-filter-id="${CSS.escape(filterId)}"] input[type="range"]`,
  );
  if (!slider) {
    return undefined;
  }
  const origin = roomBox(room);
  const track = slider.getBoundingClientRect();
  const min = Number(slider.min);
  const max = Number(slider.max);
  const share = max > min ? (Number(slider.value) - min) / (max - min) : 0.5;
  return {
    x: track.left + track.width / 2 - origin.x,
    y: track.bottom - share * track.height - origin.y,
    // Clear of the cap, so the slider under it can still be dragged.
    clearance: 24,
  };
};

/**
 * A band's handle on the graph: its dot. The dot follows the drawn curve,
 * so its own transform is what says it moved.
 */
export const locateGraphHandle: TLocateHandle = (room, filterId) => {
  const handle = room.querySelector(
    `.graph-edit-point[data-filter-id="${CSS.escape(filterId)}"]`,
  );
  if (!handle) {
    return undefined;
  }
  const origin = roomBox(room);
  const dot = (
    handle.querySelector('.graph-edit-point__dot') ?? handle
  ).getBoundingClientRect();
  return {
    x: dot.left + dot.width / 2 - origin.x,
    y: dot.top + dot.height / 2 - origin.y,
    // The dot's halo and the popover's point between them and the face.
    clearance: dot.width / 2 + 14,
    moves: handle,
  };
};

/**
 * Where the selected band's popover goes, against the slider and on the
 * graph alike (Ivan, 2026-11-16: "el 4, el pop over"; 2026-11-17: "make it
 * again attached to band not that line"; "on the graph ... it must sit to
 * the side, the same as on the bands, not above or below, because I can't
 * see the node when I move it"): beside the band's handle, its point at the
 * handle's height, on the right unless the room ends first and then on the
 * left, and inside the room top to bottom. Never over or under the handle:
 * a drag moves the handle up and down, and a popover there would cover it.
 *
 * In the room's own coordinates (the popover is placed absolutely in it: the
 * bands' panel, or the graph's card), so it moves with the page. Measured
 * again when the band moves, when the room or the popover is resized, when
 * the bands' row is scrolled sideways, and when the handle moves itself.
 */
const useBandPopoverPlace = (
  popover: RefObject<HTMLElement | null>,
  locate: TLocateHandle,
  filterId: string | undefined,
  /** What moves the handle or the band: its gain, its frequency. */
  moved: unknown,
): IBandPopoverPlace | undefined => {
  const [place, setPlace] = useState<IBandPopoverPlace>();

  useLayoutEffect(() => {
    const element = popover.current;
    const room = element?.offsetParent;
    if (!element || !(room instanceof HTMLElement) || !filterId) {
      setPlace(undefined);
      return undefined;
    }
    const measure = () => {
      const handle = locate(room, filterId);
      if (!handle) {
        setPlace(undefined);
        return;
      }
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const right = handle.x + handle.clearance;
      const side: 'right' | 'left' =
        right + width <= room.clientWidth - EDGE ? 'right' : 'left';
      const left =
        side === 'right'
          ? right
          : Math.max(EDGE, handle.x - handle.clearance - width);
      const top = fitAlong(handle.y - height / 2, height, room.clientHeight);
      const arrow = Math.min(
        Math.max(ARROW_INSET, handle.y - top),
        height - ARROW_INSET,
      );
      setPlace((before) =>
        before &&
        Math.round(before.left) === Math.round(left) &&
        Math.round(before.top) === Math.round(top) &&
        Math.round(before.arrow) === Math.round(arrow) &&
        before.side === side
          ? before
          : { left, top, arrow, side },
      );
    };
    measure();
    const stop = new AbortController();
    room
      .querySelector('.bands-rail__viewport')
      ?.addEventListener('scroll', measure, {
        passive: true,
        signal: stop.signal,
      });
    const moves = locate(room, filterId)?.moves;
    const handleMoves = moves ? new MutationObserver(measure) : undefined;
    if (moves) {
      handleMoves?.observe(moves, {
        attributes: true,
        attributeFilter: ['transform'],
      });
    }
    const sizes =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(measure);
    sizes?.observe(room);
    sizes?.observe(element);
    return () => {
      stop.abort();
      handleMoves?.disconnect();
      sizes?.disconnect();
    };
  }, [popover, locate, filterId, moved]);

  return place;
};

export default useBandPopoverPlace;
