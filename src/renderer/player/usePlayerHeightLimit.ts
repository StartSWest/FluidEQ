/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useLayoutEffect } from 'react';
import { holdPlayerHeight } from './windowModeStore';
import type { IPlayerDecks } from './playerLayout';

/**
 * How tall the player's window may be, and how short.
 *
 * SHORT: never shorter than its open decks need. The player draws no
 * scrollbar — the window is its layout — so a window dragged under that
 * cut the equalizer off at the knees (Ivan, 2026-09-21). The floor is the
 * strip, the decks and every stretching deck at the least it may have.
 *
 * TALL: while nothing in it can grow — neither the visualizer nor the queue
 * has a deck of its own — the window is exactly as tall as its decks, because
 * there is nothing for a taller one to give them. Then the floor and the
 * ceiling are the same number and the height is simply not the listener's
 * to drag. A DECK OF ITS OWN, not a switch that is on: in one column the
 * visualizer is switched on and drawn inside the equalizer's screen, and
 * counting that as a deck that stretches left the window at whatever height
 * it was unfolded to, with a well of nothing under the equalizer (Ivan,
 * 2026-09-22). The caller says whether the visualizer is standing as a deck
 * (`MiniPlayer`), because it is the one that decides to draw it.
 *
 * Both are measured on the page as it stands, with the layout switched to
 * its natural sizes for the one measurement (`is-measuring`), and followed
 * as the deck row changes: a narrower window wraps the equalizer under the
 * deck, and a Tone face is shorter than the faders. Folded, neither
 * applies. A layout effect, and called before the one that resizes the
 * window for a deck, so the limits are lifted before the window is asked to
 * grow past them.
 */
const usePlayerHeightLimit = (
  rootRef: RefObject<HTMLDivElement | null>,
  decks: IPlayerDecks,
  /** Whether the visualizer is drawn as a deck of its own right now. */
  hasVisDeck: boolean,
  isFolded: boolean,
) => {
  const canGrow = hasVisDeck || decks.queue;
  useLayoutEffect(() => {
    const root = rootRef.current;
    const title = root?.querySelector<HTMLElement>('.player-title');
    const body = root?.querySelector<HTMLElement>('.player-body');
    const row = body?.querySelector<HTMLElement>('.player-body__row');
    if (isFolded || !root || !title || !body || !row) {
      holdPlayerHeight(null, null);
      return undefined;
    }
    const measure = () => {
      const padding = getComputedStyle(body);
      const decksHeight =
        title.getBoundingClientRect().height +
        row.getBoundingClientRect().height +
        parseFloat(padding.paddingTop) +
        parseFloat(padding.paddingBottom);
      if (!canGrow) {
        holdPlayerHeight(decksHeight, decksHeight);
        return;
      }
      // Every stretching deck at its own least, which is where its own
      // stylesheet puts it.
      const least = (selector: string) => {
        const deck = root.querySelector<HTMLElement>(selector);
        return deck ? getComputedStyle(deck).minHeight : undefined;
      };
      const vis = least('.player-vis');
      const queue = least('.player-queue');
      root.classList.add('is-measuring');
      if (vis) {
        root.style.setProperty('--player-held-vis', vis);
      }
      if (queue) {
        root.style.setProperty('--player-held-queue', queue);
      }
      const floor = root.getBoundingClientRect().height;
      root.classList.remove('is-measuring');
      root.style.removeProperty('--player-held-vis');
      root.style.removeProperty('--player-held-queue');
      holdPlayerHeight(null, floor);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [canGrow, decks.vis, decks.queue, isFolded, rootRef]);
};

export default usePlayerHeightLimit;
