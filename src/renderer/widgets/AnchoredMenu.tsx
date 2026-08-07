/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A menu that opens over everything, from a control that is inside a box which
 * clips.
 *
 * A `z-index` cannot do this and it is worth being precise about why: the EQ
 * panel is a scroll container, and a scroll container clips its descendants
 * absolutely. Stacking order decides what is drawn in front of what among
 * things that are drawn at all — it has no bearing on a box that was cut off at
 * its ancestor's edge. A dropdown near the bottom of that panel was therefore
 * losing its lower half no matter what number it carried.
 *
 * So the menu is rendered into `document.body`, outside the clip, and told
 * where to be from the trigger's own position on screen. Being out of the DOM
 * flow is also what lets it cover the graph, which is a sibling of the panel
 * rather than a descendant.
 *
 * Upward by default. These triggers live in a toolbar at the top of a panel
 * that scrolls, so "down" is into the part of the window most likely to have
 * run out — and the thing a menu must never do is open into a space that is not
 * there. It flips down only when the room above is genuinely too small.
 */

/** Room above the trigger, below which opening upward stops being sensible. */
const MIN_ROOM_ABOVE = 200;

/** The gap between the trigger and the menu, matching the in-flow menus. */
const OFFSET = 6;

const positionFrom = (rect: DOMRect) => {
  const openUpward = rect.top >= MIN_ROOM_ABOVE;
  return {
    position: 'fixed' as const,
    // Anchored by its bottom edge when opening upward, which means the menu
    // never has to be measured: its height can be whatever it turns out to be
    // and the edge nearest the trigger stays put either way.
    ...(openUpward
      ? { bottom: window.innerHeight - rect.top + OFFSET }
      : { top: rect.bottom + OFFSET }),
    // Right-aligned to the trigger, like every other menu here, and held inside
    // the window so a control near the edge cannot push it off.
    right: Math.max(8, window.innerWidth - rect.right),
  };
};

const AnchoredMenu = ({
  anchor,
  isOpen,
  className,
  children,
}: {
  /** The control it hangs off. Its position on screen is the whole input. */
  anchor: HTMLElement | null;
  isOpen: boolean;
  className: string;
  children: ReactNode;
}) => {
  const [style, setStyle] = useState<React.CSSProperties>();

  useEffect(() => {
    if (!isOpen || !anchor) {
      return undefined;
    }
    const place = () => setStyle(positionFrom(anchor.getBoundingClientRect()));
    place();
    // Anything that moves the trigger moves the menu. `true` on the scroll
    // listener catches scrolling inside the panel as well as the window, which
    // is the case that actually happens here — the trigger is in a toolbar
    // above a list that scrolls under it.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor, isOpen]);

  if (!isOpen || !style || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className={className} style={style} role="menu" data-anchored-menu>
      {children}
    </div>,
    document.body,
  );
};

/**
 * Whether a click landed inside one of these.
 *
 * Every menu here closes on a press elsewhere, and every one of those tests
 * asks whether the press was inside the trigger's own element. Once the menu is
 * portalled it is not — so without this, pressing an item counted as pressing
 * outside, the menu was torn down on `mousedown`, and the `click` that would
 * have chosen something never reached anything. The menu simply shut and did
 * nothing, which is a particularly baffling way for a control to fail.
 */
export const isInsideAnchoredMenu = (target: EventTarget | null) =>
  Boolean((target as Element | null)?.closest?.('[data-anchored-menu]'));

export default AnchoredMenu;
