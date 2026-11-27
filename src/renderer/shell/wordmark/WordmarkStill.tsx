/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import WordmarkLetters, { TailInk, WORDMARK_SHAPE } from './WordmarkLetters';
import {
  VERSION_STYLE,
  WORDMARK_HEIGHT_PX,
  WORDMARK_VERSION,
  tailBoxStyle,
} from './wordmarkLayout';
import { TAIL_FLOURISH_PX } from './wordmarkRoom';
import { TAIL_POINTS, tailOffsets, tailOutline } from './wordmarkTail';

const { box, tailWidth } = WORDMARK_SHAPE;

interface IWordmarkRestTailProps {
  /** The tail's length from the Q, px. */
  length: number;
  /** The word's drawn height, px, which sets the pen's width at the Q. */
  wordHeight: number;
}

/**
 * The Q's tail at rest, the still flourish the live tail settles into in
 * silence: for a picture of a bar, which never shows the reader's own
 * playing. Laid in the word's box, as the live tail is.
 */
export function WordmarkRestTail({
  length,
  wordHeight,
}: IWordmarkRestTailProps) {
  const tailInk = `wordmark-still-${useId().replace(/:/g, '')}`;
  const outline = tailOutline(
    tailOffsets(new Array<number>(TAIL_POINTS).fill(0)),
    length,
    12,
    Math.max(1.5, (tailWidth * wordHeight) / box.height),
  );
  return (
    <svg
      className="header-wordmark__tail"
      style={tailBoxStyle(length)}
      aria-hidden="true"
    >
      <defs>
        <TailInk id={tailInk} />
      </defs>
      <path d={outline} fill={`url(#${tailInk})`} />
    </svg>
  );
}

/**
 * The header's name as a picture of it: the word, its version and the tail
 * at rest, with no music and no song — for Help's drawing of the title bar,
 * which never shows the reader's own playing.
 */
export default function WordmarkStill() {
  return (
    <div className="header-wordmark">
      <span className="header-wordmark__word">
        <WordmarkLetters />
        {WORDMARK_VERSION && (
          <span className="header-wordmark__version" style={VERSION_STYLE}>
            {WORDMARK_VERSION}
          </span>
        )}
        <WordmarkRestTail
          length={TAIL_FLOURISH_PX}
          wordHeight={WORDMARK_HEIGHT_PX}
        />
      </span>
    </div>
  );
}
