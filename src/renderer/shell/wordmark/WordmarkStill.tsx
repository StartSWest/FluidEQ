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

/** The tail at rest: the still flourish, as the header draws it in silence. */
const REST_TAIL = tailOutline(
  tailOffsets(new Array<number>(TAIL_POINTS).fill(0)),
  TAIL_FLOURISH_PX,
  12,
  (tailWidth * WORDMARK_HEIGHT_PX) / box.height,
);

/**
 * The header's name as a picture of it: the word, its version and the tail
 * at rest, with no music and no song — for Help's drawing of the title bar,
 * which never shows the reader's own playing.
 */
export default function WordmarkStill() {
  const tailInk = `wordmark-still-${useId().replace(/:/g, '')}`;
  return (
    <div className="header-wordmark">
      <span className="header-wordmark__word">
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
          <path d={REST_TAIL} fill={`url(#${tailInk})`} />
        </svg>
      </span>
    </div>
  );
}
