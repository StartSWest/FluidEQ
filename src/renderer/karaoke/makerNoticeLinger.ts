/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** A notice is never up for less than it always was. */
const SHORTEST_SECONDS = 5;

/** Nor so long that it sits over the editor after it has been read. */
const LONGEST_SECONDS = 14;

/**
 * Letters read in a second, at the unhurried pace of somebody glancing over
 * from the lyrics. One Han, kana or Hangul character carries about what two
 * and a half letters do.
 */
const LETTERS_PER_SECOND = 18;
const DENSE_SCRIPT =
  /[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Hangul}]/u;
const DENSE_CHARACTER_LETTERS = 2.5;

/**
 * How long the Maker's corner notice stays up: long enough to read it.
 *
 * It was five seconds whatever it said, which fits "Saved." and not the
 * notice a detection ends on — what was kept of the song's own timing, what
 * was timed, how many notes were found. The length of the text is the only
 * thing that says how long reading it takes, so that is what sets it.
 */
const makerNoticeLingerSeconds = (message: string): number => {
  const letters = Array.from(message).reduce(
    (total, character) =>
      total + (DENSE_SCRIPT.test(character) ? DENSE_CHARACTER_LETTERS : 1),
    0,
  );
  return Math.min(
    LONGEST_SECONDS,
    Math.max(SHORTEST_SECONDS, Math.ceil(letters / LETTERS_PER_SECOND)),
  );
};

export default makerNoticeLingerSeconds;
