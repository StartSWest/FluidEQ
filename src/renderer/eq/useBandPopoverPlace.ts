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
  /**
   * The point's distance along the side that faces the band: from the top
   * beside a slider, from the left over or under a graph handle.
   */
  arrow: number;
  /** Which side of the band it stands on. */
  side: 'right' | 'left' | 'above' | 'below';
}

/** Kept this far inside its panel or card at every edge. */
export const POPOVER_EDGE = 6;

/** The point stays this far from the popover's own corners. */
export const POPOVER_ARROW_INSET = 18;

/**
 * Where along one side of its room a popover of `size` starts, as near
 * `wanted` as the room allows and the edge's margin inside it. A room with
 * no space for the margins — a 1280x800 window's bands are exactly the
 * popover's height — centres it, flush, rather than letting it hang past
 * the foot.
 */
export const fitAlong = (wanted: number, size: number, room: number) =>
  room - size < 2 * POPOVER_EDGE
    ? Math.max(0, (room - size) / 2)
    : Math.min(Math.max(POPOVER_EDGE, wanted), room - size - POPOVER_EDGE);

/** A place measured again, kept as it was when it moved by under a pixel. */
export const keepPlace =
  (next: IBandPopoverPlace) => (before: IBandPopoverPlace | undefined) =>
    before &&
    Math.round(before.left) === Math.round(next.left) &&
    Math.round(before.top) === Math.round(next.top) &&
    Math.round(before.arrow) === Math.round(next.arrow) &&
    before.side === next.side
      ? before
      : next;

/** From the slider's middle to the popover's near edge: clear of the handle. */
const HANDLE_CLEARANCE = 24;

/**
 * Where the selected band's popover goes (Ivan, 2026-11-16: "el 4, el pop
 * over"; 2026-11-17: "make it again attached to band not that line"):
 * against that band's slider, its point at the handle's height, on the right
 * unless the panel ends first and then on the left, and inside the panel top
 * to bottom. Never over the handle, so the slider under it can still be
 * dragged.
 *
 * It stood past the neighbouring band's column for a day, a hairline leading
 * back across it, so the band beside could still be pressed. Ivan asked for
 * it against its band again; the band beside is reached by the popover's own
 * arrows and keys, and the popover is only up while Shift is held.
 *
 * In the panel's own coordinates (the popover is placed absolutely in it), so
 * it moves with the page when the page scrolls. Measured again when the band
 * moves — its gain moves the handle, a frequency drag can trade it places —
 * when the rail is scrolled sideways and when anything is resized.
 */
const useBandPopoverPlace = (
  popover: RefObject<HTMLElement | null>,
  filterId: string | undefined,
  /** What moves the handle or the band: its gain, its frequency. */
  moved: unknown,
): IBandPopoverPlace | undefined => {
  const [place, setPlace] = useState<IBandPopoverPlace>();

  useLayoutEffect(() => {
    const element = popover.current;
    const panel = element?.offsetParent;
    if (!element || !(panel instanceof HTMLElement) || !filterId) {
      setPlace(undefined);
      return undefined;
    }
    const measure = () => {
      const slider = panel.querySelector<HTMLInputElement>(
        `.bandWrapper[data-filter-id="${CSS.escape(filterId)}"] input[type="range"]`,
      );
      if (!slider) {
        setPlace(undefined);
        return;
      }
      const box = panel.getBoundingClientRect();
      const track = slider.getBoundingClientRect();
      const min = Number(slider.min);
      const max = Number(slider.max);
      const value = Number(slider.value);
      const share = max > min ? (value - min) / (max - min) : 0.5;
      const handleY = track.bottom - share * track.height - box.top;
      const handleX = track.left + track.width / 2 - box.left;
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const right = handleX + HANDLE_CLEARANCE;
      const side: 'right' | 'left' =
        right + width <= panel.clientWidth - POPOVER_EDGE ? 'right' : 'left';
      const left =
        side === 'right'
          ? right
          : Math.max(POPOVER_EDGE, handleX - HANDLE_CLEARANCE - width);
      const top = fitAlong(handleY - height / 2, height, panel.clientHeight);
      const arrow = Math.min(
        Math.max(POPOVER_ARROW_INSET, handleY - top),
        height - POPOVER_ARROW_INSET,
      );
      setPlace(keepPlace({ left, top, arrow, side }));
    };
    measure();
    const viewport = panel.querySelector('.bands-rail__viewport');
    viewport?.addEventListener('scroll', measure, { passive: true });
    if (typeof ResizeObserver === 'undefined') {
      return () => viewport?.removeEventListener('scroll', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    observer.observe(element);
    return () => {
      observer.disconnect();
      viewport?.removeEventListener('scroll', measure);
    };
  }, [popover, filterId, moved]);

  return place;
};

export default useBandPopoverPlace;
