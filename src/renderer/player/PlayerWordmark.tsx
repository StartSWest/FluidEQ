/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import WordmarkLetters from '../shell/wordmark/WordmarkLetters';
import WordmarkLiveTail from '../shell/wordmark/WordmarkLiveTail';
import { WordmarkRestTail } from '../shell/wordmark/WordmarkStill';

/**
 * The word's height in the amp's header, px: the main window's proportion of
 * name to logo (36px beside its 44px tile) beside the amp's 28px one.
 */
export const PLAYER_WORDMARK_PX = 23;

/**
 * How far the Q's tail runs on in the amp's header, px: the main window's
 * flourish, kept at its length rather than scaled down with the word, so it
 * sways as far with the music as the main window's does.
 */
export const PLAYER_TAIL_PX = 22;

// Set here rather than in the stylesheet: the picture's still tail is drawn
// for this height, and the room after the word is the tail's run, so one
// number each keeps them in step. The tail leaves the Q a little inside the
// word's box, so its run ends just short of that room.
const WORD_STYLE: CSSProperties = {
  height: PLAYER_WORDMARK_PX,
  marginRight: PLAYER_TAIL_PX,
};

/**
 * The amp's name: the main window's "FluidEQ" in the broad pen, its colours
 * and the Q's tail running on as the live sound (Ivan, 2026-11-27: "let's
 * show the FluidEQ new nice title handwritten in the amp app too"). No
 * version over the Q: at the amp's size it would be under 8px, and the
 * window it switches to carries it.
 */
export default function PlayerWordmark() {
  return (
    <span className="player-title__wordmark" style={WORD_STYLE}>
      <WordmarkLetters />
      <WordmarkLiveTail length={PLAYER_TAIL_PX} />
    </span>
  );
}

/**
 * The amp's name as a picture of it, its tail at rest: for the amp drawn by
 * its own parts in Help, What's New and the Studio (`PlayerPicture`), which
 * never show the reader's own playing.
 */
export function PlayerWordmarkStill() {
  return (
    <span className="player-title__wordmark" style={WORD_STYLE}>
      <WordmarkLetters />
      <WordmarkRestTail
        length={PLAYER_TAIL_PX}
        wordHeight={PLAYER_WORDMARK_PX}
      />
    </span>
  );
}
