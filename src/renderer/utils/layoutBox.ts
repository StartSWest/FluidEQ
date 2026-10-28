/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export interface ILayoutBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * An element's box as the page lays it out, in the coordinates of `root`:
 * scrolling counted, transforms not.
 *
 * `getBoundingClientRect` answers where an element is drawn this frame, a
 * running transform included, and that is the wrong question for anything
 * framed to the layout: the Compact player's opening turns its top panel
 * almost flat for its first frames, and a scene framed from the panel's
 * drawn box then was framed for a thin strip — the sun filling the panel —
 * and stayed so, because the laid-out size, the one thing a ResizeObserver
 * watches, had never changed (Ivan, 2026-10-27).
 *
 * Undefined when `element` does not stand inside `root` on the page, or is
 * not laid out at all.
 */
export const layoutBoxIn = (
  element: HTMLElement,
  root: HTMLElement,
): ILayoutBox | undefined => {
  let left = 0;
  let top = 0;
  let node: HTMLElement = element;
  while (node !== root) {
    const parent = node.offsetParent;
    if (!(parent instanceof HTMLElement)) {
      return undefined;
    }
    left += node.offsetLeft;
    top += node.offsetTop;
    // An offset is measured from the parent's padding edge with its content
    // unscrolled, so every scroller from here up to it, the parent included,
    // moves the box by what it has scrolled.
    for (
      let scroller: HTMLElement | null = node.parentElement;
      scroller;
      scroller = scroller === parent ? null : scroller.parentElement
    ) {
      left -= scroller.scrollLeft;
      top -= scroller.scrollTop;
    }
    node = parent;
  }
  return {
    left,
    top,
    width: element.offsetWidth,
    height: element.offsetHeight,
  };
};
