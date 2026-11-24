/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * An element's width, whole CSS pixels, for a layout chosen by the room it
 * is given rather than by the window.
 *
 * Read once before the first paint, so what is drawn from it is drawn at its
 * size from the first frame and nothing moves into place after; an observer
 * keeps it from then on. The element should carry no padding or border, so
 * the box the observer reports and the box read at the start are one.
 */
const useBoxWidth = (ref: RefObject<HTMLElement | null>): number => {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }
    setWidth(Math.round(element.getBoundingClientRect().width));
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (box) {
        setWidth(Math.round(box.width));
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
};

export default useBoxWidth;
