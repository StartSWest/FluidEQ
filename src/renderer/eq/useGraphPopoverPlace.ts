/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useLayoutEffect, useState } from 'react';
import {
  IBandPopoverPlace,
  fitAlong,
  keepPlace,
  POPOVER_ARROW_INSET,
  POPOVER_EDGE,
} from './useBandPopoverPlace';

/** From the handle's dot to the popover's near edge, room for its point. */
const DOT_CLEARANCE = 12;

/**
 * Where the band popover goes on the graph (Ivan, 2026-11-17: "also in the
 * graph it appears above if I press shift"): over the band's handle, its
 * point at the handle, or under it where the card has no room above; centred
 * on the handle and kept inside the graph's card, which it is placed in.
 *
 * Measured again when the handle moves — the dot follows the drawn curve, so
 * its own transform is what says it moved, not the band's values — and when
 * the card or the popover is resized.
 */
const useGraphPopoverPlace = (
  popover: RefObject<HTMLElement | null>,
  filterId: string | undefined,
  /** What moves the handle: the band's values, the popover being shown. */
  moved: unknown,
): IBandPopoverPlace | undefined => {
  const [place, setPlace] = useState<IBandPopoverPlace>();

  useLayoutEffect(() => {
    const element = popover.current;
    const card = element?.offsetParent;
    const handle =
      card && filterId
        ? card.querySelector<SVGGElement>(
            `.graph-edit-point[data-filter-id="${CSS.escape(filterId)}"]`,
          )
        : null;
    if (!element || !(card instanceof HTMLElement) || !handle) {
      setPlace(undefined);
      return undefined;
    }
    const measure = () => {
      const box = card.getBoundingClientRect();
      const dot = (
        handle.querySelector('.graph-edit-point__dot') ?? handle
      ).getBoundingClientRect();
      const originX = box.left + card.clientLeft;
      const originY = box.top + card.clientTop;
      const handleX = dot.left + dot.width / 2 - originX;
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const roomBottom = card.clientHeight - POPOVER_EDGE;
      const left = fitAlong(handleX - width / 2, width, card.clientWidth);
      const above = dot.top - originY - DOT_CLEARANCE - height;
      const below = dot.bottom - originY + DOT_CLEARANCE;
      let side: 'above' | 'below' = 'above';
      if (above < POPOVER_EDGE) {
        // Under it where that fits, or else on whichever side has more room.
        side =
          below + height <= roomBottom || roomBottom - below > dot.top - originY
            ? 'below'
            : 'above';
      }
      const top = fitAlong(
        side === 'above' ? above : below,
        height,
        card.clientHeight,
      );
      const arrow = Math.min(
        Math.max(POPOVER_ARROW_INSET, handleX - left),
        width - POPOVER_ARROW_INSET,
      );
      setPlace(keepPlace({ left, top, arrow, side }));
    };
    measure();
    const moves = new MutationObserver(measure);
    moves.observe(handle, { attributes: true, attributeFilter: ['transform'] });
    if (typeof ResizeObserver === 'undefined') {
      return () => moves.disconnect();
    }
    const sizes = new ResizeObserver(measure);
    sizes.observe(card);
    sizes.observe(element);
    return () => {
      moves.disconnect();
      sizes.disconnect();
    };
  }, [popover, filterId, moved]);

  return place;
};

export default useGraphPopoverPlace;
