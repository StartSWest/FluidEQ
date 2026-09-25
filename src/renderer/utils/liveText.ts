/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Writes a readout the page rewrites while it is being looked at — a meter's
 * figure, a frame's cost, a peak — into the text node it already has.
 *
 * `textContent =` replaces the node: the old one leaves the document and a
 * new one enters it, and the window's `:has()` rules on its outermost boxes
 * (`#root:has(> .app-workspace.is-app-full)`, `.center-workspace:has(…)`)
 * answer an insertion anywhere under them by restyling everything under
 * `body`. Measured on the Studio with a scene playing: about 1,100 elements
 * restyled nearly every frame, by the two cost readings (on the card and over
 * the stage) taking turns, which was most of the 375 ms of every second the
 * window spent restyling. Changing the data of the node that is there inserts
 * nothing, and restyles only the readout.
 *
 * Only an element whose one child is its text is written this way; anything
 * else is given its text as `textContent` always gave it, once, after which
 * it is.
 */
const writeLiveText = (element: Element | null, text: string) => {
  if (!element) {
    return;
  }
  const { firstChild } = element;
  if (firstChild instanceof Text && firstChild === element.lastChild) {
    if (firstChild.data !== text) {
      firstChild.data = text;
    }
  } else if (element.textContent !== text) {
    element.textContent = text;
  }
};

export default writeLiveText;
