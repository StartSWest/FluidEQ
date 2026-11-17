/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type RefObject, useEffect, useRef } from 'react';

/**
 * Ctrl+scroll over an element, as notches: 1 up, -1 down — a graph handle's
 * Q and a band slider's (`qualityWheel.ts`).
 *
 * On a listener of its own, registered `passive: false`: React registers
 * `wheel` as passive, so `preventDefault` in an `onWheel` prop is refused and
 * the page zoomed or scrolled under the handle while its Q moved (the same
 * finding as `useCanvasWheel`). Taken in the capture phase and stopped there,
 * so the slider's own plain-wheel gain nudge (`RangeInput`) never sees a
 * Ctrl-scroll. `onNotch` says whether it took the notch; one it declines (a
 * graph handle that is not selected) goes on as an ordinary wheel.
 */
const useCtrlWheel = (
  element: RefObject<Element | null>,
  onNotch: (direction: 1 | -1) => boolean,
) => {
  // Through a ref: the handler is rebuilt with every render, and the
  // listener stays attached for the life of the element.
  const notch = useRef(onNotch);
  notch.current = onNotch;
  useEffect(() => {
    const target = element.current;
    if (!target) {
      return undefined;
    }
    const onWheel = (event: Event) => {
      if (
        !(event instanceof WheelEvent) ||
        !event.ctrlKey ||
        !notch.current(event.deltaY < 0 ? 1 : -1)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    target.addEventListener('wheel', onWheel, {
      capture: true,
      passive: false,
    });
    return () =>
      target.removeEventListener('wheel', onWheel, { capture: true });
  }, [element]);
};

export default useCtrlWheel;
