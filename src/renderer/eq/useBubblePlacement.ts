/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useLayoutEffect, useState } from 'react';
import placeBubble, { IBubblePlacement, IRect } from './bubblePlacement';

/** The caret half of the pair: the tail aims at the label, left of it. */
const CARET_WIDTH = 24;
const GAP = 9;
const TAIL_INSET = 16;

/**
 * What the bubble must not cover in the EQ page's header, read off the page:
 * the title's own text (its box runs the width of the row), the eyebrow, the
 * Game mode switch and delay beside the title, every other control in the
 * toolbar, and the Also applied row's label and chips.
 */
const occupied = (header: Element, pair: Element): IRect[] => {
  const boxes: IRect[] = [];
  const title = header.querySelector('.main-content-title__heading h2');
  const text = document.createRange();
  // A text range measures only where there is a layout: not in a test DOM.
  if (title && typeof text.getBoundingClientRect === 'function') {
    text.selectNodeContents(title);
    boxes.push(text.getBoundingClientRect());
  }
  header
    .querySelectorAll(
      '.eyebrow, .engine-strip, .eq-toolbar > *, .active-layers > *',
    )
    .forEach((element) => {
      if (element !== pair) {
        boxes.push(element.getBoundingClientRect());
      }
    });
  return boxes;
};

export interface IBubbleSpot extends IBubblePlacement {
  /** From the pair's own corner, which is what the bubble is positioned in. */
  offsetLeft: number;
  offsetTop: number;
}

/**
 * Where the Smart EQ bubble goes, worked out before it is painted.
 *
 * Asked again whenever the header or the bubble changes size — the window
 * resized, the toolbar wrapped, the sentence grew, the delay beside the title
 * gained a digit — which is exactly when what is free around the button
 * changes. Nothing is scheduled: the observer says when.
 */
const useBubblePlacement = (
  pairRef: RefObject<HTMLElement | null>,
  bubbleRef: RefObject<HTMLElement | null>,
  text: string | undefined,
): IBubbleSpot | undefined => {
  const [spot, setSpot] = useState<IBubbleSpot>();

  useLayoutEffect(() => {
    const pair = pairRef.current;
    const bubble = bubbleRef.current;
    const header = pair?.closest('.main-content-title');
    if (!text || !pair || !bubble || !header) {
      setSpot(undefined);
      return undefined;
    }
    const place = () => {
      const anchor = pair.getBoundingClientRect();
      const { width, height } = bubble.getBoundingClientRect();
      const placement = placeBubble({
        anchor,
        aimX: anchor.right - CARET_WIDTH - TAIL_INSET,
        width,
        height,
        // The page's panel, not the header: with nothing applied the header
        // ends under the toolbar, and hanging over the top of the graph is
        // better than covering a control to stay inside it.
        bounds: (header.parentElement ?? header).getBoundingClientRect(),
        avoid: occupied(header, pair),
        gap: GAP,
        tailInset: TAIL_INSET,
      });
      const next = {
        ...placement,
        offsetLeft: Math.round(placement.left - anchor.left),
        offsetTop: Math.round(placement.top - anchor.top),
        tailX: Math.round(placement.tailX),
      };
      setSpot((was) =>
        was &&
        was.offsetLeft === next.offsetLeft &&
        was.offsetTop === next.offsetTop &&
        was.isBelow === next.isBelow &&
        was.tailX === next.tailX
          ? was
          : next,
      );
    };
    place();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(place);
    observer.observe(header);
    observer.observe(bubble);
    const strip = header.querySelector('.engine-strip');
    if (strip) {
      observer.observe(strip);
    }
    return () => observer.disconnect();
  }, [pairRef, bubbleRef, text]);

  return spot;
};

export default useBubblePlacement;
