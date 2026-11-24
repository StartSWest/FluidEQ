/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Tells `onChange` whether `element` is in the picker's scroller, until the
 * returned function is called.
 */
export type TWatchTile = (
  element: Element,
  onChange: (inView: boolean) => void,
) => () => void;

/**
 * Whether each tile is in the scroller it sits in (`[data-look-picker-
 * scroll]`), on one observer for the grid. Made on the first tile watched,
 * whose own place says which scroller that is: the tiles watch before the
 * grid's effects run. The standard looks' live drawings (`LookStyleGrid`)
 * and the scenes' clips (`lookTileClips.tsx`) both go by it. Where there
 * is no observer at all, a tile is in view.
 */
export const createTileWatcher = () => {
  let observer: IntersectionObserver | undefined;
  const listeners = new Map<Element, (inView: boolean) => void>();
  const watch: TWatchTile = (element, onChange) => {
    if (typeof IntersectionObserver === 'undefined') {
      onChange(true);
      return () => undefined;
    }
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) =>
            listeners.get(entry.target)?.(entry.isIntersecting),
          ),
        { root: element.closest('[data-look-picker-scroll]') },
      );
    }
    listeners.set(element, onChange);
    observer.observe(element);
    return () => {
      listeners.delete(element);
      observer?.unobserve(element);
    };
  };
  return {
    watch,
    dispose: () => {
      observer?.disconnect();
      observer = undefined;
      listeners.clear();
    },
  };
};
