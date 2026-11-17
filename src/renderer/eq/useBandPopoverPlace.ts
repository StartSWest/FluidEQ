/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useLayoutEffect, useState } from 'react';

/** Where the band popover stands in its panel, and where its point is. */
export interface IBandPopoverPlace {
  left: number;
  top: number;
  /** The point's distance from the popover's top, at the handle's height. */
  arrow: number;
  /** Which side of the slider it opened on. */
  side: 'right' | 'left';
}

/** From the slider's middle to the popover's near edge: clear of the handle. */
const HANDLE_CLEARANCE = 24;

/** Kept this far inside the panel at every edge. */
const EDGE = 6;

/** The point stays this far from the popover's own top and foot. */
const ARROW_INSET = 18;

/**
 * Where the selected band's popover goes (Ivan, 2026-11-16: "el 4, el pop
 * over"): beside that band's slider, its point at the handle's height, on
 * the right unless the panel ends first and then on the left, and inside the
 * panel top to bottom. Never over the handle, so the slider under it can
 * still be dragged.
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
      const band = panel.querySelector<HTMLElement>(
        `.bandWrapper[data-filter-id="${CSS.escape(filterId)}"]`,
      );
      const slider = band?.querySelector<HTMLInputElement>(
        'input[type="range"]',
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
      const side: IBandPopoverPlace['side'] =
        right + width <= panel.clientWidth - EDGE ? 'right' : 'left';
      const left =
        side === 'right'
          ? right
          : Math.max(EDGE, handleX - HANDLE_CLEARANCE - width);
      const top = Math.min(
        Math.max(EDGE, handleY - height / 2),
        Math.max(EDGE, panel.clientHeight - height - EDGE),
      );
      const arrow = Math.min(
        Math.max(ARROW_INSET, handleY - top),
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
