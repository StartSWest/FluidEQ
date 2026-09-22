/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useLayoutEffect } from 'react';

/**
 * How much a row of controls has had to give up to fit on one line, as a
 * number on the row itself: `data-fit="0"` with every word in place, `"1"`
 * with the names gone, `"2"` with the values gone too. The stylesheet says
 * what each step hides (`_miniPlayerEqRows.scss`).
 *
 * MEASURED, NOT GUESSED FROM THE WIDTH. The rows used to switch on two
 * container-query breakpoints, and a breakpoint cannot know what is in the
 * row: the preset key carries whatever the preset is called, so the same
 * width that fit "Pop" with room to spare cut "Gaming - Warm" — and the
 * numbers chosen for the long name turned every short one into glyphs long
 * before it had to be (Ivan, 2026-09-22: "the breakpoint is making it an
 * icon too soon"). So the row is tried at each step in turn and the first
 * that does not overflow is the one drawn. Three layouts at most, on a
 * resize or a change of label, and nothing between times.
 *
 * Followed on the row's size and on its text: a preset picked from the menu
 * changes what the row holds without changing the row.
 *
 * `onNeed` is told, on every measurement, the width the row needs with
 * everything it can give up gone — its content at the last step — which is
 * what the window is held to (`setPlayerWidthNeed`): a row the window can
 * be narrowed past is a row whose last key gets cut off.
 */
const useRowFit = (
  ref: RefObject<HTMLElement | null>,
  steps: number,
  onNeed?: (cssWidth: number) => void,
) => {
  useLayoutEffect(() => {
    const row = ref.current;
    if (
      !row ||
      typeof ResizeObserver === 'undefined' ||
      typeof MutationObserver === 'undefined'
    ) {
      return undefined;
    }
    /**
     * The width the row's content takes on one line, whatever width the row
     * itself has been given.
     *
     * NOT `scrollWidth`: for a row that fits, that is the row's own width and
     * not its content's, so in a wide window the row reported that it needed
     * exactly what it had, the floor rose to meet the window, and the window
     * could not be narrowed at all (Ivan, 2026-09-22: "it is limiting me to
     * go smaller"). The row is sized to its content for the one reading
     * (`is-measuring`, in `_miniPlayerEqKeys.scss`) and put back before
     * anything is painted — a layout, not a frame.
     */
    const contentWidth = () => {
      row.classList.add('is-measuring');
      const need = row.getBoundingClientRect().width;
      row.classList.remove('is-measuring');
      return need;
    };
    const fit = () => {
      if (onNeed) {
        row.dataset.fit = String(steps);
        onNeed(contentWidth());
      }
      for (let step = 0; step <= steps; step += 1) {
        row.dataset.fit = String(step);
        if (row.scrollWidth <= row.clientWidth) {
          return;
        }
      }
    };
    fit();
    const resized = new ResizeObserver(fit);
    resized.observe(row);
    const changed = new MutationObserver(fit);
    changed.observe(row, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    return () => {
      resized.disconnect();
      changed.disconnect();
    };
  }, [onNeed, ref, steps]);
};

export default useRowFit;
