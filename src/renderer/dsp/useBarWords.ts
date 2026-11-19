/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How much taller than one row the bar may stand before it counts as two:
 * between the one row it is and the two a wrap makes.
 */
const WRAPPED = 1.5;

/**
 * Whether the whole chain's bar has the room to say its actions' words.
 *
 * Ivan, 2026-11-19: "for the header bar if there is room we show the text too
 * not just the icons". A width chosen in advance cannot say when there is
 * room: the words are a third longer in German and Russian than in English,
 * so a breakpoint that fitted English broke the German bar onto two lines at
 * a 1820px window, and one that fitted German hid the English words at the
 * widths Ivan works at. So the bar is asked. It shows the words; when the
 * line wraps with them, the width it wrapped at is remembered and the glyphs
 * stand alone; once the line is wider than that, the words are tried again.
 * The remembered width only rises until the words fit, so a resize settles
 * in a step or two and never flips back and forth. Each change of `words`
 * (the language) forgets it, and the words are tried afresh.
 *
 * Decided by the line's own size reports (`ResizeObserver`), never by a
 * timer: the observer speaks after layout, when the wrap is there to see.
 */
const useBarWords = (words: unknown) => {
  const [showWords, setShowWords] = useState(true);
  const showing = useRef(true);
  const tooNarrowAt = useRef(0);
  const line = useRef<HTMLElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  const decide = useCallback((element: HTMLElement) => {
    const width = element.clientWidth;
    const oneRow = parseFloat(getComputedStyle(element).minHeight);
    const wraps = element.offsetHeight > oneRow * WRAPPED;
    if (showing.current && wraps) {
      tooNarrowAt.current = Math.max(tooNarrowAt.current, width);
      showing.current = false;
      setShowWords(false);
    } else if (!showing.current && width > tooNarrowAt.current) {
      showing.current = true;
      setShowWords(true);
    }
  }, []);

  const lineRef = useCallback(
    (element: HTMLElement | null) => {
      observer.current?.disconnect();
      observer.current = null;
      line.current = element;
      if (!element) {
        return;
      }
      const watching = new ResizeObserver(() => decide(element));
      watching.observe(element);
      observer.current = watching;
    },
    [decide],
  );

  // New words, new widths: forget where the old ones wrapped and try these.
  useEffect(() => {
    tooNarrowAt.current = 0;
    if (line.current) {
      decide(line.current);
    }
  }, [words, decide]);

  return { lineRef, showWords };
};

export default useBarWords;
