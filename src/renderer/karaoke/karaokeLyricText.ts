/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { IKaraokeToken } from '../../common/karaoke/types';

/**
 * Lyrics as text: grouping it into words, and how far through one the singer is.
 *
 * A hundred and sixty lines that never touched the canvas or React — the
 * remembered text size, the entrance curve, turning a stream of syllable tokens
 * into the words a reader sees, and working out how much of a word should be
 * painted as sung at a given moment.
 *
 * The word grouping is cached against the token array by identity, which is why
 * it is worth having on its own: the cache is only correct because the same
 * tokens are handed back unchanged between frames, and that is a property of
 * this code rather than of the component that calls it.
 */
export const WHEEL_STEP_THRESHOLD = 24;
export const LYRIC_MOTION_TIME_MS = 105;
export const SONG_LYRIC_ENTRANCE_TIME_MS = 560;
export const EUPHORIA_SWEEP_TIME_MS = 3_600;
/**
 * The lyric canvas draws its own text, so it needs the font stack as a string
 * rather than inheriting it. This must mirror the `body` stack in App.scss —
 * one native family per platform, in the order each resolves.
 *
 * It said `Inter, system-ui, -apple-system, sans-serif` until now, and both
 * halves of that were wrong. Inter has never been bundled, so it resolved to
 * nothing. And nothing here named Segoe UI or any Linux family, so the lyrics
 * were picking their font by a different route than every other string in the
 * app — invisibly, because `system-ui` happens to land on Segoe UI too.
 *
 * A canvas is where this kind of drift hides: `check-styles.ts` reads
 * stylesheets and cannot see a font named in TypeScript.
 */
export const LYRIC_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif';
export const LYRIC_TEXT_SIZE_KEY = 'fluideq-karaoke-lyric-text-size';
export const DEFAULT_LYRIC_TEXT_SIZE = 100;
export const MIN_LYRIC_TEXT_SIZE = 75;
export const MAX_LYRIC_TEXT_SIZE = 300;

export const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** A soft ease-out used only when a different song enters the player. */
export const karaokeLyricEntranceOpacity = (elapsedMs: number): number => {
  const progress = clamp(elapsedMs / SONG_LYRIC_ENTRANCE_TIME_MS, 0, 1);
  return 1 - (1 - progress) ** 3;
};

export const readLyricTextSize = (): number => {
  try {
    const stored = Number(window.localStorage.getItem(LYRIC_TEXT_SIZE_KEY));
    return Number.isFinite(stored) && stored > 0
      ? clamp(stored, MIN_LYRIC_TEXT_SIZE, MAX_LYRIC_TEXT_SIZE)
      : DEFAULT_LYRIC_TEXT_SIZE;
  } catch {
    return DEFAULT_LYRIC_TEXT_SIZE;
  }
};

export const writeLyricTextSize = (textSize: number): void => {
  try {
    window.localStorage.setItem(LYRIC_TEXT_SIZE_KEY, String(textSize));
  } catch {
    // The live setting still works when storage is unavailable.
  }
};

export const timingProgress = (
  startMs: number | undefined,
  endMs: number | undefined,
  playheadMs: number,
): number => {
  if (startMs === undefined) {
    return 0;
  }
  if (playheadMs <= startMs) {
    return 0;
  }
  if (endMs === undefined || endMs <= startMs) {
    return 1;
  }
  return clamp((playheadMs - startMs) / (endMs - startMs), 0, 1);
};

/** Preserve provider word boundaries after Maker normalization trims tokens. */
export const karaokeTokenDisplayText = (
  token: IKaraokeToken,
  tokenIndex: number,
  previousToken?: IKaraokeToken,
): string =>
  tokenIndex > 0 &&
  token.startsWord === true &&
  !/^\s/u.test(token.text) &&
  !/\s$/u.test(previousToken?.text ?? '')
    ? ` ${token.text}`
    : token.text;

export interface IKaraokeVisualWord {
  /** Provider syllables that must be painted as one indivisible word. */
  tokens: IKaraokeToken[];
  text: string;
}

export const karaokeVisualWordCache = new WeakMap<
  readonly IKaraokeToken[],
  IKaraokeVisualWord[]
>();

/**
 * Providers such as UltraStar time syllables independently. Keep those
 * timings, but combine continuation tokens before measuring or painting so a
 * glyph run can never acquire a seam in the middle of a word.
 */
export const groupKaraokeTokensIntoWords = (
  tokens: readonly IKaraokeToken[],
): IKaraokeVisualWord[] => {
  const cached = karaokeVisualWordCache.get(tokens);
  if (cached) {
    return cached;
  }
  const words: IKaraokeVisualWord[] = [];
  tokens.forEach((token) => {
    const current = words[words.length - 1];
    if (!current || token.startsWord !== false) {
      words.push({ tokens: [token], text: token.text });
      return;
    }
    current.tokens.push(token);
    current.text += token.text;
  });
  karaokeVisualWordCache.set(tokens, words);
  return words;
};

export const karaokeVisualWordDisplayText = (
  word: IKaraokeVisualWord,
  wordIndex: number,
  previousWord?: IKaraokeVisualWord,
): string =>
  wordIndex > 0 &&
  word.tokens[0]?.startsWord === true &&
  !/^\s/u.test(word.text) &&
  !/\s$/u.test(previousWord?.text ?? '')
    ? ` ${word.text}`
    : word.text;

export const karaokeVisualWordProgressWidth = (
  context: CanvasRenderingContext2D,
  word: IKaraokeVisualWord,
  displayText: string,
  playheadMs: number,
): number => {
  const leadingText = displayText.slice(
    0,
    displayText.length - word.text.length,
  );
  let precedingText = leadingText;
  let paintedWidth = 0;

  word.tokens.forEach((token, tokenIndex) => {
    if (!token.text) {
      return;
    }
    const segmentStart = context.measureText(precedingText).width;
    precedingText += token.text;
    const segmentEnd = context.measureText(precedingText).width;
    let effectiveEndMs = token.endMs;
    // Empty following tokens are sustained melody notes for this same
    // syllable. Include them in its sweep instead of completing the word at
    // the first note boundary.
    for (
      let nextIndex = tokenIndex + 1;
      nextIndex < word.tokens.length && !word.tokens[nextIndex].text;
      nextIndex += 1
    ) {
      const continuation = word.tokens[nextIndex];
      effectiveEndMs = Math.max(
        effectiveEndMs ?? continuation.endMs ?? 0,
        continuation.endMs ?? continuation.startMs ?? 0,
      );
    }
    const progress = timingProgress(token.startMs, effectiveEndMs, playheadMs);
    if (progress > 0) {
      paintedWidth = Math.max(
        paintedWidth,
        segmentStart + (segmentEnd - segmentStart) * progress,
      );
    }
  });

  return paintedWidth;
};
