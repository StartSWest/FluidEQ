/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';

/**
 * Whether the card a scene that cannot be drawn leaves on the graph
 * (`SceneTroubleState`) fits its room or has to say itself on one line: the
 * room is what is left between the gallery's corner and its reel
 * (`galleryClearance.ts`), and the card's height is its words', which wrap
 * to three lines in one language and four in another.
 *
 * So it is measured rather than set at a height: the card's height in its
 * ordinary form is remembered, the room's is read, and the card is put on one
 * line (`data-fit="line"` on the room, `_graphThemePlot.scss`) while the room
 * is shorter. Read again whenever either changes size, as their
 * ResizeObserver says.
 */
const useTroubleCardFit = () => {
  const [room, setRoom] = useState<HTMLDivElement | null>(null);
  const [card, setCard] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!room || !card || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    // The card's height in its ordinary form, from the last time it was in
    // it: on one line it says nothing about whether the ordinary form fits.
    let ordinary = 0;
    const fit = () => {
      const isLine = room.dataset.fit === 'line';
      if (!isLine) {
        ordinary = card.offsetHeight;
      }
      const shouldBeLine = room.clientHeight < ordinary;
      if (shouldBeLine !== isLine) {
        if (shouldBeLine) {
          room.dataset.fit = 'line';
        } else {
          delete room.dataset.fit;
        }
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(room);
    observer.observe(card);
    fit();
    return () => {
      observer.disconnect();
      delete room.dataset.fit;
    };
  }, [room, card]);

  return { setRoom, setCard };
};

export default useTroubleCardFit;
