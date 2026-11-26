/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useLayoutEffect, useRef, useState } from 'react';
import useReducedMotion from '../../utils/useReducedMotion';
import WordmarkLetters, { TailInk, WORDMARK_SHAPE } from './WordmarkLetters';
import useWordmarkTail from './useWordmarkTail';
import {
  VERSION_STYLE,
  WORDMARK_VERSION,
  tailBoxStyle,
} from './wordmarkLayout';
import { TAIL_FLOURISH_PX } from './wordmarkRoom';

const { box, tailWidth } = WORDMARK_SHAPE;

/**
 * The header's name: "FluidEQ" in the broad pen, the version over the Q's
 * shoulder, and the Q's tail running on as the live sound (Ivan, 2026-11-26).
 * The name says what the app is and nothing about what plays: the song rode
 * the tail on a wide bar until Ivan took it off the same day ("don't put the
 * song name in the title"). The tail is its short flourish everywhere, inside
 * the gap before the first tab, so the name keeps one width and nothing in
 * the bar moves.
 */
export default function HeaderWordmark() {
  const wordRef = useRef<HTMLSpanElement>(null);
  const tailRef = useRef<SVGPathElement>(null);
  const tailInk = `wordmark-tail-${useId().replace(/:/g, '')}`;
  const isStill = useReducedMotion();
  const [scale, setScale] = useState(0);

  // The pen's width where the tail leaves the Q follows the word's drawn
  // size, which the bar decides.
  useLayoutEffect(() => {
    const word = wordRef.current;
    if (!word) {
      return undefined;
    }
    const measure = () => {
      const nextScale = word.getBoundingClientRect().height / box.height;
      setScale((previous) => (previous === nextScale ? previous : nextScale));
    };
    measure();
    // Absent in the jsdom the titlebar's tests run under (`useTitlebarRoom`
    // has the same guard).
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(word);
    return () => observer.disconnect();
  }, []);

  useWordmarkTail(
    tailRef,
    { length: TAIL_FLOURISH_PX, startWidth: Math.max(1.5, tailWidth * scale) },
    isStill,
  );

  return (
    <div className="header-wordmark">
      <span className="header-wordmark__word" ref={wordRef}>
        <WordmarkLetters />
        {WORDMARK_VERSION && (
          <span className="header-wordmark__version" style={VERSION_STYLE}>
            {WORDMARK_VERSION}
          </span>
        )}
        <svg
          className="header-wordmark__tail"
          style={tailBoxStyle(TAIL_FLOURISH_PX)}
          aria-hidden="true"
        >
          <defs>
            <TailInk id={tailInk} />
          </defs>
          <path ref={tailRef} fill={`url(#${tailInk})`} />
        </svg>
      </span>
    </div>
  );
}
