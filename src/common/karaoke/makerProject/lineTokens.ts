/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { splitKaraokeWordSyllables } from '../syllables';

/**
 * Scripts that write a line without spaces between its words. Thai and Lao
 * are here for the same reason as Han and Kana: a whole sung line arrives as
 * one uninterrupted run of characters.
 */
/**
 * Script_Extensions, not Script, and no Thai or Lao.
 *
 * `ー` (U+30FC), the long-vowel mark in every other line of J-pop, is
 * Script=Common and only Script_Extensions puts it with the kana. Under
 * `\p{Script=Katakana}` it reads false, so a line holding one failed the
 * all-unspaced test and fell back to whitespace splitting — the whole line
 * became one token again, which is the exact failure this file exists to fix.
 *
 * Thai and Lao were listed and did nothing: the tokeniser below delegates to
 * `splitKaraokeWordSyllables`, whose branch requires Han, kana or Hangul, so a
 * Thai line came back whole. Claiming support that measures as a no-op is
 * worse than not claiming it. Thai needs a dictionary break and a third token
 * state for the spaces it genuinely writes between phrases; that is its own
 * change.
 */
const UNSPACED_SCRIPT =
  /[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Hangul}]/u;

const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;

/**
 * Cut one lyric line into the units a karaoke highlights.
 *
 * Splitting on whitespace is right for every script that uses it and total
 * failure for the ones that do not: a Japanese line has no spaces, so the
 * whole line became a single token. Nothing could then match it — the word
 * distance falls back to edit distance, and one sung character against a
 * ten-character line is a ratio of 0.9, far past the 0.34 that counts as a
 * match — so a CJK song reported every word untimed and said nothing about
 * why. The authoring path failed the other way, rebuilding the lyrics with a
 * space between every character.
 *
 * A line is treated as unspaced only when it contains no whitespace at all and
 * every lexical character belongs to such a script, so a line mixing Japanese
 * with a spaced English phrase keeps its spacing and is split on it.
 */
/**
 * Whether two adjacent tokens are separated by a space when written out.
 *
 * A line tokenised per character has to come back as the line the user pasted,
 * and joining those tokens with spaces returns "私 は あ な た". The tokens
 * cannot answer this themselves: marking the continuations as non-word-initial
 * would fix the text and break the matching, because the aligner groups on
 * exactly that flag and would see one word per line again. The script knows.
 */
export const karaokeMakerNeedsSpaceBetween = (
  previous: string,
  next: string,
): boolean => {
  const before = Array.from(previous.trim()).pop();
  const after = Array.from(next.trim())[0];
  if (!before || !after) {
    return false;
  }
  return !(UNSPACED_SCRIPT.test(before) && UNSPACED_SCRIPT.test(after));
};

export const karaokeMakerLineTokens = (line: string): string[] => {
  const trimmed = line.trim();
  if (!trimmed) {
    return [];
  }
  const characters = Array.from(trimmed);
  const lexical = characters.filter((character) =>
    LETTER_OR_NUMBER.test(character),
  );
  const isUnspaced =
    !/\s/u.test(trimmed) &&
    lexical.length > 1 &&
    lexical.every((character) => UNSPACED_SCRIPT.test(character));
  if (!isUnspaced) {
    return trimmed.split(/\s+/u).filter(Boolean);
  }
  // Syllable splitting already knows these scripts: a CJK or Hangul grapheme
  // is its own syllable, which is also the unit a karaoke highlights.
  const units = splitKaraokeWordSyllables(trimmed);
  return units.length ? units : [trimmed];
};
