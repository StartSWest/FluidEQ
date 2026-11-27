/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import WordmarkLetters from './WordmarkLetters';
import WordmarkLiveTail from './WordmarkLiveTail';
import { VERSION_STYLE, WORDMARK_VERSION } from './wordmarkLayout';
import { TAIL_FLOURISH_PX } from './wordmarkRoom';

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
  return (
    <div className="header-wordmark">
      <span className="header-wordmark__word">
        <WordmarkLetters />
        {WORDMARK_VERSION && (
          <span className="header-wordmark__version" style={VERSION_STYLE}>
            {WORDMARK_VERSION}
          </span>
        )}
        <WordmarkLiveTail length={TAIL_FLOURISH_PX} />
      </span>
    </div>
  );
}
