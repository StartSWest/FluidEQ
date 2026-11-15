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

/**
 * A song's lyrics as the Library's Lyrics tab draws them, and the LRC
 * reading every source goes through.
 *
 * Read in main from the song's own tags or a lyrics file beside it
 * (`libraryLyrics.ts`), by id, and bounded on the way across: a tag can hold
 * anything, and a "lyrics" file can be a novel or a binary renamed.
 */

/** Where the words came from. */
export type TLyricsSource = 'tags' | 'lrc' | 'txt';

export interface ILyricsWord {
  timeMs: number;
  text: string;
}

export interface ILyricsLine {
  /** When the line is sung, the file's offset already applied. */
  timeMs: number;
  /** Empty for a stamped pause: a gap the reader sees as one. */
  text: string;
  /** Enhanced LRC's word stamps, where the file has them. */
  words?: ILyricsWord[];
}

export type ILibraryLyrics =
  | {
      kind: 'synced';
      source: TLyricsSource;
      /** The file it came from, by name only, for a sidecar. */
      fileName?: string;
      lines: ILyricsLine[];
    }
  | {
      kind: 'plain';
      source: TLyricsSource;
      fileName?: string;
      text: string;
    };

export interface ILibraryLyricsAnswer {
  /** Nothing when no source had words. */
  lyrics?: ILibraryLyrics;
  /** The sidecar names looked for, by name only, for the empty state. */
  looked: string[];
}

/** More lines than any song; a file past it is cut there, not refused. */
export const MAX_LYRICS_LINES = 2000;

/** A line longer than this is cut: lyrics, not prose. */
export const MAX_LYRICS_LINE_CHARS = 500;

/** Plain lyrics past this are cut at a line. */
export const MAX_LYRICS_TEXT_CHARS = 64_000;

/** Word stamps a line keeps; the rest of the line is lit as a whole. */
export const MAX_LYRICS_WORDS = 200;

/** A sidecar bigger than this is not a lyrics file, and a tag's text is
 * read no further than this many characters. */
export const MAX_LYRICS_FILE_BYTES = 512 * 1024;

/**
 * `[mm:ss]`, `[mm:ss.x]`, `[mm:ss.xx]`, `[mm:ss.xxx]` and the colon form
 * `[mm:ss:xx]` some editors write, minutes of any length. Global, so a line
 * that repeats (`[00:12.00][01:30.00]chorus`) yields every stamp.
 */
const LINE_STAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

/** Enhanced LRC's word stamps: `<mm:ss.xx>`. */
const WORD_STAMP = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;

/** `[offset:+250]`: milliseconds, positive meaning the words come sooner. */
const OFFSET_TAG = /^\s*\[offset:\s*([+-]?\d+)\s*\]\s*$/i;

/** Every other ID tag (`[ar:…]`, `[ti:…]`, `[length:…]`): not a lyric. */
const ID_TAG = /^\s*\[[a-z#]+:[^\]]*\]\s*$/i;

const toMs = (minutes: string, seconds: string, fraction?: string): number => {
  let ms = 0;
  if (fraction !== undefined) {
    // ".5" is half a second, ".05" five hundredths, ".005" five thousandths.
    ms = Number(fraction.padEnd(3, '0').slice(0, 3));
  }
  return (Number(minutes) * 60 + Number(seconds)) * 1000 + ms;
};

/** A line, cut to what a row can hold, its control characters gone. */
const clean = (text: string): string =>
  text
    // eslint-disable-next-line no-control-regex -- control characters are exactly what is being removed
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_LYRICS_LINE_CHARS);

/**
 * Timed pieces of one line as its words. A piece keeps its own spacing, so
 * the words joined back with nothing between them are the line — a syllable
 * ("Hel", "lo ") is part of a word, not a word of its own. A piece that is
 * only space goes onto the word before it. Nothing for fewer than two words:
 * one word lit is just the line lit.
 */
export const wordsFromPieces = (
  pieces: readonly { timeMs: number; text: string }[],
): ILyricsWord[] | undefined => {
  const words: ILyricsWord[] = [];
  pieces.forEach((piece) => {
    const text = piece.text
      // eslint-disable-next-line no-control-regex -- control characters are exactly what is being removed
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ');
    if (text.trim() === '') {
      if (words.length > 0) {
        words[words.length - 1].text += text;
      }
      return;
    }
    words.push({
      timeMs: Math.max(0, piece.timeMs),
      text: words.length === 0 ? text.trimStart() : text,
    });
  });
  // A line longer than a row holds is cut (`clean`), and its words would no
  // longer join back into it: such a line is lit whole.
  const length = words.reduce((sum, word) => sum + word.text.length, 0);
  if (words.length < 2 || length > MAX_LYRICS_LINE_CHARS) {
    return undefined;
  }
  const last = words[words.length - 1];
  last.text = last.text.trimEnd();
  return words;
};

/** The words of an enhanced line, or nothing when it has no word stamps. */
const wordsOf = (body: string, shiftMs: number): ILyricsWord[] | undefined => {
  const stamps = [...body.matchAll(WORD_STAMP)];
  if (stamps.length === 0) {
    return undefined;
  }
  return wordsFromPieces(
    stamps.slice(0, MAX_LYRICS_WORDS).map((stamp, index) => {
      const start = (stamp.index ?? 0) + stamp[0].length;
      const end = stamps[index + 1]?.index ?? body.length;
      return {
        timeMs: toMs(stamp[1], stamp[2], stamp[3]) - shiftMs,
        text: body.slice(start, end),
      };
    }),
  );
};

/**
 * Reads LRC text into timed lines, or nothing when it holds no stamps — the
 * caller then has plain lyrics. Every stamp a line carries is a line of its
 * own; the file's `[offset]` is applied; ID tags are dropped; Enhanced LRC's
 * word stamps ride along on their line; the lines come back in time order
 * (a stable sort, so lines sharing a stamp keep the file's order).
 */
export const parseLrc = (input: string): ILyricsLine[] | undefined => {
  const rows = input.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  const offsetRow = rows.find((row) => OFFSET_TAG.test(row));
  const offsetMs = offsetRow ? Number(OFFSET_TAG.exec(offsetRow)?.[1] ?? 0) : 0;
  const lines: ILyricsLine[] = [];
  rows.forEach((row) => {
    if (lines.length >= MAX_LYRICS_LINES) {
      return;
    }
    const stamps = [...row.matchAll(LINE_STAMP)];
    if (stamps.length === 0 || ID_TAG.test(row)) {
      return;
    }
    const body = row.replace(LINE_STAMP, '');
    const words = wordsOf(body, offsetMs);
    // The words' joint is the line: an enhanced file's spaces are its own.
    const text = clean(body.replace(WORD_STAMP, '').replace(/\s+/g, ' '));
    stamps.forEach((stamp) => {
      if (lines.length < MAX_LYRICS_LINES) {
        lines.push({
          timeMs: Math.max(0, toMs(stamp[1], stamp[2], stamp[3]) - offsetMs),
          text,
          ...(words === undefined ? {} : { words }),
        });
      }
    });
  });
  if (lines.length === 0) {
    return undefined;
  }
  return lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => a.line.timeMs - b.line.timeMs || a.index - b.index)
    .map(({ line }) => line);
};

/** Plain lyrics as a block of text: tidy line ends, bounded, trimmed. */
export const plainLyrics = (input: string): string | undefined => {
  const lines = input
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\r|\n/)
    .map((line) => clean(line));
  let text = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length > MAX_LYRICS_TEXT_CHARS) {
    text = text.slice(0, text.lastIndexOf('\n', MAX_LYRICS_TEXT_CHARS));
  }
  return text === '' ? undefined : text;
};

/**
 * One source's words as the tab draws them: synced where the text carries
 * stamps, plain otherwise, nothing where it is empty.
 */
export const lyricsFromText = (
  text: string,
  source: TLyricsSource,
  fileName?: string,
): ILibraryLyrics | undefined => {
  const named = fileName === undefined ? {} : { fileName };
  // A tag can hold anything; nothing past a lyrics file's worth is read.
  const bounded = text.slice(0, MAX_LYRICS_FILE_BYTES);
  const lines = parseLrc(bounded);
  if (lines !== undefined && lines.some((line) => line.text !== '')) {
    return { kind: 'synced', source, ...named, lines };
  }
  const plain = plainLyrics(bounded);
  return plain === undefined
    ? undefined
    : { kind: 'plain', source, ...named, text: plain };
};

/**
 * The line (or word) being sung at `positionMs`: the last one already
 * reached, or -1 before the first. A binary search: a long file's lines are
 * looked up at every reading of the clock, and an active line's words at
 * every painted frame.
 */
export const reachedIndex = (
  timed: readonly { timeMs: number }[],
  positionMs: number,
): number => {
  let low = 0;
  let high = timed.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (timed[middle].timeMs <= positionMs) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
};
