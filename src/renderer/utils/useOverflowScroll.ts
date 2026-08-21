/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

/** How much of the row one press moves: most of a screenful, not all of it,
 * so what you were looking at stays on screen as a landmark. */
const SCROLL_FRACTION = 0.7;

export interface IOverflowScroll {
  ref: RefObject<HTMLDivElement | null>;
  /** There is something past the left edge. */
  canScrollBack: boolean;
  /** There is something past the right edge. */
  canScrollForward: boolean;
  scrollBy: (direction: 1 | -1) => void;
  /** Call from the element's own `onScroll`. */
  onScroll: () => void;
}

/**
 * A row too wide for its window, and whether there is more either way.
 *
 * The workspace tabs scrolled at narrow widths already, but with the
 * scrollbar hidden nothing said so: the tabs ended at the window's edge and
 * Config, the last of them, could not be reached with a pointer at all.
 *
 * `ResizeObserver` is absent in the jsdom the tests run under, so the
 * measurement is a no-op there rather than something to mock; the arrows then
 * stay hidden, which is what a row that has never been laid out deserves.
 */
export const useOverflowScroll = (dependency?: unknown): IOverflowScroll => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  // A pixel of slack either side: `scrollLeft` is fractional on a scaled
  // display, and an arrow that flickers at the end of the travel is worse
  // than one that gives up a pixel early.
  const measure = useCallback(() => {
    const row = ref.current;
    if (!row) {
      return;
    }
    setCanScrollBack(row.scrollLeft > 1);
    setCanScrollForward(row.scrollLeft + row.clientWidth < row.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const row = ref.current;
    measure();
    // The window's own resize as well as the element's.
    //
    // The observer alone was not enough in practice: a layout change that
    // moves this row without changing the box it is in delivers no entry, and
    // the arrows then say there is nothing past the edge while there is. The
    // listener is the belt to the observer's braces — `measure` reads the DOM
    // and sets two booleans, so an extra call costs nothing.
    window.addEventListener('resize', measure);
    if (!row || typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    Array.from(row.children).forEach((child) => observer.observe(child));
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [measure, dependency]);

  const scrollBy = useCallback((direction: 1 | -1) => {
    const row = ref.current;
    if (!row) {
      return;
    }
    row.scrollBy({
      left: direction * row.clientWidth * SCROLL_FRACTION,
      behavior: 'smooth',
    });
  }, []);

  return { ref, canScrollBack, canScrollForward, scrollBy, onScroll: measure };
};

export default useOverflowScroll;
