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

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Where the chosen item in a row of tabs sits, for a highlight that travels
 * to it.
 *
 * Drawn once and moved, rather than each tab lighting its own background: a
 * control whose highlight travels says the row is one choice with one answer,
 * where several backgrounds switching on and off say they are several
 * switches that happen to agree.
 *
 * Measured rather than guessed, because these are words of different lengths.
 * Re-measured when the row changes size — a window resize, a side pane
 * opening — through an observer rather than a clock, and whenever the
 * selection moves, which is what the second observer is for: what is selected
 * lives in the caller's markup, not in a prop this hook is handed.
 */
export const useSlidingIndicator = <TElement extends HTMLElement>() => {
  const ref = useRef<TElement | null>(null);
  const [box, setBox] = useState<{ x: number; width: number } | undefined>(
    undefined,
  );

  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) {
      return undefined;
    }
    const measure = () => {
      const active = row.querySelector<HTMLElement>('[aria-selected="true"]');
      setBox(
        active
          ? { x: active.offsetLeft, width: active.offsetWidth }
          : undefined,
      );
    };
    measure();
    const size = new ResizeObserver(measure);
    size.observe(row);
    const selection = new MutationObserver(measure);
    selection.observe(row, {
      attributeFilter: ['aria-selected'],
      // A label can also change without anything being added or removed: the
      // media tab drops a word on a narrow window, and React rewrites that
      // text node in place rather than replacing it. Without `characterData`
      // the only thing left to notice was the ResizeObserver, and the row is
      // `flex: 0 1 auto` — already shrunk to what the titlebar allows at the
      // width where the swap happens, so its own box need not move at all and
      // the pill would keep the width of the name that is no longer there.
      characterData: true,
      childList: true,
      subtree: true,
    });
    return () => {
      size.disconnect();
      selection.disconnect();
    };
  }, []);

  return { ref, box };
};

export default useSlidingIndicator;
