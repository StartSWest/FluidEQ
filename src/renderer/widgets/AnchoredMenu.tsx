/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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

import { ReactNode, useLayoutEffect, useState } from 'react';
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
 * Upward by preference, downward when that does not fit, and scrolling when
 * neither does.
 *
 * Upward is the preference because these triggers sit in a toolbar at the top of
 * a panel that scrolls, so "down" is into the part of the window most likely to
 * have run out. It was the only behaviour for a while, on a fixed guess at how
 * much room a menu needs — which held until the voicing list grew genre entries
 * and became twice as tall as the guess. A menu that opens into a space it does
 * not fit in loses its far end silently, and the far end is where the new
 * entries are.
 *
 * So the menu is measured, and the answer is the side it actually fits on. If
 * neither side can hold it, it takes the larger side and scrolls — because a
 * menu that is a little awkward to use is still usable, and one whose last three
 * items are off-screen is not.
 */

/** The gap between the trigger and the menu, matching the in-flow menus. */
const OFFSET = 6;

/** Clearance kept from the window edge, so it never looks pinned to it. */
const MARGIN = 8;

const positionFrom = (rect: DOMRect, menuHeight: number) => {
  const roomAbove = rect.top - OFFSET - MARGIN;
  const roomBelow = window.innerHeight - rect.bottom - OFFSET - MARGIN;
  // Unmeasured on the first pass — height 0 fits anywhere, so this takes the
  // preferred side and the measured pass corrects it before the frame is
  // painted.
  const openUpward = menuHeight <= roomAbove || roomAbove >= roomBelow;
  return {
    position: 'fixed' as const,
    // Anchored by the edge nearest the trigger in both directions, so the menu
    // grows away from the control rather than over it.
    ...(openUpward
      ? { bottom: window.innerHeight - rect.top + OFFSET }
      : { top: rect.bottom + OFFSET }),
    maxHeight: Math.max(0, openUpward ? roomAbove : roomBelow),
    // Right-aligned to the trigger, like every other menu here, and held inside
    // the window so a control near the edge cannot push it off.
    right: Math.max(MARGIN, window.innerWidth - rect.right),
  };
};

const AnchoredMenu = ({
  anchor,
  isOpen,
  className,
  role = 'menu',
  ariaLabel,
  children,
}: {
  /** The control it hangs off. Its position on screen is the whole input. */
  anchor: HTMLElement | null;
  isOpen: boolean;
  className: string;
  role?: 'menu' | 'dialog';
  ariaLabel?: string;
  children: ReactNode;
}) => {
  const [style, setStyle] = useState<React.CSSProperties>();
  // The menu element itself, as state rather than a ref, because placing it
  // depends on its measured height and a ref would not re-run the effect when
  // it arrives.
  const [menu, setMenu] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !anchor) {
      return undefined;
    }
    const place = () =>
      setStyle(
        positionFrom(
          anchor.getBoundingClientRect(),
          // `scrollHeight`, so a menu already capped and scrolling still
          // reports how tall it wants to be. `offsetHeight` would report the
          // cap, which would then look like a perfect fit and never flip back.
          menu?.scrollHeight ?? 0,
        ),
      );
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
  }, [anchor, isOpen, menu]);

  if (!isOpen || !style || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={setMenu}
      className={className}
      style={style}
      role={role}
      aria-label={ariaLabel}
      data-anchored-menu
    >
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
