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
 * Every timed-lyrics format a listener is likely to bring, read into the
 * Library's own timed lines and written back as Enhanced LRC — the one form
 * the song's `.lrc` is kept in, so word timing persists with the song the
 * way line timing always has, and the Lyrics tab, the Karaoke tab and every
 * other player read it back (Ivan, 2026-11-15: "we need to cover all major
 * formats").
 *
 * Read: LRC and Enhanced LRC (left exactly as written), the lines/words
 * JSON and its YAML twin (`start_ms`, `end_ms`, `words[]`), Spotify's
 * `lyrics.lines[]` (`startTimeMs` as a string), Musixmatch's richsync
 * (`ts`/`te` seconds, `l[]` characters at `o` offsets) and its subtitle
 * JSON, TTML (`lyricsMarkup.ts`), SubRip and WebVTT. Anything else is plain
 * text, kept as it came.
 */

import {
  type ILyricsLine,
  MAX_LYRICS_LINES,
  MAX_LYRICS_WORDS,
  parseLrc,
  wordsFromPieces,
} from './lyrics';
import { type ILrcHeader, lrcFromLines } from './lyricsLrc';
import {
  type ITimedLine,
  isSrt,
  isTtml,
  isVtt,
  parseSrt,
  parseTtml,
  parseVtt,
} from './lyricsMarkup';
import parseLyricsYaml from './lyricsYaml';

export type TLyricsFormat =
  | 'lrc'
  | 'lines-json'
  | 'lines-yaml'
  | 'spotify'
  | 'richsync'
  | 'musixmatch-subtitle'
  | 'ttml'
  | 'srt'
  | 'vtt'
  /** A JSON document in none of the shapes above: data, not words. */
  | 'unreadable'
  | 'plain';

interface IReadLyrics {
  format: TLyricsFormat;
  lines?: ITimedLine[];
  header?: ILrcHeader;
  /**
   * The words as written, for a shape that brings them and no timed line
   * (`lines: []` beside `plain`): kept as plain lyrics, and the rest of the
   * document - title, artist, album, duration - never taken for words (Ivan,
   * 2026-11-15: "make sure we don't include that metadata in the lyric").
   */
  plainText?: string;
}

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A time in milliseconds from a number or a numeric string. */
const msOf = (value: unknown): number | undefined => {
  const number =
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number >= 0
    ? Math.round(number)
    : undefined;
};

const textOf = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const headerOf = (record: TRecord): ILrcHeader => {
  const meta = isRecord(record.metadata) ? record.metadata : record;
  return {
    ...(typeof meta.title === 'string' ? { title: meta.title } : {}),
    ...(typeof meta.artist === 'string' ? { artist: meta.artist } : {}),
  };
};

/** `{ lines: [{ text, start_ms, end_ms, words: [{ text, start_ms }] }] }`,
 * the camel-cased spellings too. */
const fromLinesShape = (record: TRecord): ITimedLine[] | undefined => {
  if (!Array.isArray(record.lines)) {
    return undefined;
  }
  const lines = record.lines.flatMap((entry): ITimedLine[] => {
    if (!isRecord(entry)) {
      return [];
    }
    const startMs = msOf(entry.start_ms ?? entry.startMs);
    if (startMs === undefined) {
      return [];
    }
    const pieces = Array.isArray(entry.words)
      ? entry.words.flatMap((word) => {
          const timeMs = isRecord(word)
            ? msOf(word.start_ms ?? word.startMs)
            : undefined;
          return timeMs === undefined || !isRecord(word)
            ? []
            : [{ timeMs, text: textOf(word.text) }];
        })
      : [];
    return [
      {
        startMs,
        endMs: msOf(entry.end_ms ?? entry.endMs),
        text: textOf(entry.text),
        ...(pieces.length > 0 ? { pieces } : {}),
      },
    ];
  });
  return lines.length > 0 ? lines : undefined;
};

/** Spotify's `{ lyrics: { lines: [{ startTimeMs: "7930", words }] } }`,
 * where `words` is the line's text; `endTimeMs` is "0" when unknown. */
const fromSpotify = (record: TRecord): ITimedLine[] | undefined => {
  const lyrics = isRecord(record.lyrics) ? record.lyrics : undefined;
  if (lyrics === undefined || !Array.isArray(lyrics.lines)) {
    return undefined;
  }
  const lines = lyrics.lines.flatMap((entry): ITimedLine[] => {
    const startMs = isRecord(entry) ? msOf(entry.startTimeMs) : undefined;
    if (startMs === undefined || !isRecord(entry)) {
      return [];
    }
    const endMs = msOf(entry.endTimeMs);
    return [
      {
        startMs,
        endMs: endMs === undefined || endMs === 0 ? undefined : endMs,
        // A lone note glyph is Spotify's mark for an instrumental stretch.
        text: textOf(entry.words).replace(/^♪$/, ''),
      },
    ];
  });
  return lines.length > 0 ? lines : undefined;
};

/** Musixmatch richsync: `[{ ts, te, l: [{ c, o }], x }]`, seconds, each
 * character run at `ts + o`. */
const fromRichsync = (entries: unknown[]): ITimedLine[] | undefined => {
  const lines = entries.flatMap((entry): ITimedLine[] => {
    if (!isRecord(entry) || typeof entry.ts !== 'number') {
      return [];
    }
    const start = entry.ts;
    const pieces = Array.isArray(entry.l)
      ? entry.l.flatMap((run) =>
          isRecord(run) && typeof run.o === 'number'
            ? [
                {
                  timeMs: Math.round((start + run.o) * 1000),
                  text: textOf(run.c),
                },
              ]
            : [],
        )
      : [];
    return [
      {
        startMs: Math.round(start * 1000),
        endMs:
          typeof entry.te === 'number'
            ? Math.round(entry.te * 1000)
            : undefined,
        text: textOf(entry.x),
        ...(pieces.length > 0 ? { pieces } : {}),
      },
    ];
  });
  return lines.length > 0 ? lines : undefined;
};

/** Musixmatch subtitles: `[{ text, time: { total } }]`, seconds. */
const fromSubtitle = (entries: unknown[]): ITimedLine[] | undefined => {
  const lines = entries.flatMap((entry): ITimedLine[] =>
    isRecord(entry) &&
    isRecord(entry.time) &&
    typeof entry.time.total === 'number'
      ? [
          {
            startMs: Math.round(entry.time.total * 1000),
            text: textOf(entry.text),
          },
        ]
      : [],
  );
  return lines.length > 0 ? lines : undefined;
};

/** A body Musixmatch's API hands as a JSON string inside its envelope. */
const innerBody = (record: TRecord): unknown => {
  const body =
    isRecord(record.message) && isRecord(record.message.body)
      ? record.message.body
      : undefined;
  const nested =
    (body && isRecord(body.richsync) && body.richsync.richsync_body) ??
    (body && isRecord(body.subtitle) && body.subtitle.subtitle_body);
  if (typeof nested !== 'string') {
    return undefined;
  }
  try {
    return JSON.parse(nested) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * The stanzas the shape's own `plain` text parts the lines into, as empty
 * lines between them (Ivan, 2026-11-15: "show the same spaces between
 * stanzas the original lyric has"): its timed lines carry no blank line, its
 * plain text does. Read only where the plain text has exactly the timed
 * lines' count of lines with words, so a text that says something else
 * parts nothing. Each space stands a hundredth of a second before the line
 * that opens the next stanza, so the two keep separate stamps in an `.lrc`.
 */
const withPlainStanzas = (
  lines: ITimedLine[],
  plain: unknown,
): ITimedLine[] => {
  if (typeof plain !== 'string') {
    return lines;
  }
  const rows = plain.split('\n').map((row) => row.trim());
  const opensStanza: boolean[] = [];
  let afterBlank = false;
  rows.forEach((row) => {
    if (row === '') {
      afterBlank = opensStanza.length > 0;
      return;
    }
    opensStanza.push(afterBlank);
    afterBlank = false;
  });
  if (opensStanza.length !== lines.length) {
    return lines;
  }
  const sorted = [...lines].sort((a, b) => a.startMs - b.startMs);
  return sorted.flatMap((line, at) => {
    const previous = sorted[at - 1];
    const spaceMs = line.startMs - 10;
    return opensStanza[at] &&
      previous !== undefined &&
      spaceMs > previous.startMs
      ? [{ startMs: spaceMs, text: '' }, line]
      : [line];
  });
};

const fromStructure = (
  value: unknown,
  isYaml: boolean,
): IReadLyrics | undefined => {
  if (Array.isArray(value)) {
    const richsync = fromRichsync(value);
    if (richsync !== undefined) {
      return { format: 'richsync', lines: richsync };
    }
    const subtitle = fromSubtitle(value);
    return subtitle === undefined
      ? undefined
      : { format: 'musixmatch-subtitle', lines: subtitle };
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const inner = innerBody(value);
  if (inner !== undefined) {
    return fromStructure(inner, false);
  }
  const lines = fromLinesShape(value);
  if (
    Array.isArray(value.lines) &&
    value.lines.length === 0 &&
    typeof value.plain === 'string' &&
    value.plain.trim() !== ''
  ) {
    return {
      format: isYaml ? 'lines-yaml' : 'lines-json',
      plainText: value.plain,
      header: headerOf(value),
    };
  }
  if (lines !== undefined) {
    return {
      format: isYaml ? 'lines-yaml' : 'lines-json',
      lines: withPlainStanzas(lines, value.plain),
      header: headerOf(value),
    };
  }
  const spotify = fromSpotify(value);
  return spotify === undefined
    ? undefined
    : { format: 'spotify', lines: spotify };
};

/** Which format the text is, and its timed lines where it has them. */
export const readLyricsFormat = (input: string): IReadLyrics => {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const read = fromStructure(JSON.parse(trimmed) as unknown, false);
      return read ?? { format: 'unreadable', lines: [] };
    } catch {
      // `[00:12.00]` opens an LRC as surely as `[` opens a JSON array.
    }
  }
  if (isVtt(text)) {
    return { format: 'vtt', lines: parseVtt(text) };
  }
  if (isTtml(text)) {
    return { format: 'ttml', lines: parseTtml(text) };
  }
  if (isSrt(text)) {
    return { format: 'srt', lines: parseSrt(text) };
  }
  if (parseLrc(text) !== undefined) {
    return { format: 'lrc' };
  }
  // A YAML export opens its timed lines with `lines:`, followed by the list
  // or by `[]` when the song has none and only its plain words.
  if (/^lines:\s*(\[\s*\])?\s*$/m.test(text)) {
    const read = fromStructure(parseLyricsYaml(text), true);
    if (read !== undefined) {
      return read;
    }
  }
  return { format: 'plain' };
};

/**
 * The read lines as the Library's: each line's text whitespace-tidied, its
 * pieces as words, in time order - and nothing the file does not say.
 *
 * A pause used to be stamped wherever a line ended well before the next and
 * after the last one, from each line's end time; a file's line ends are the
 * least trustworthy numbers it carries (his word-timed YAML ended "Me dieron
 * ganas de llorar" 360 ms after it began), and the tab drew rows of dots
 * between lines sung straight through. Ivan, 2026-11-15: "just do as it
 * comes in the lyric, don't invent - display exactly as it comes". A pause
 * the file writes itself (an empty timed line, Spotify's instrumental note)
 * is still read as one.
 *
 * `limit` is a song's line cap unless the caller reads something longer: a
 * film's subtitles (`subtitles.ts`).
 */
export const libraryLinesOf = (
  timed: readonly ITimedLine[],
  limit: number = MAX_LYRICS_LINES,
): ILyricsLine[] => {
  const sorted = [...timed]
    .sort((a, b) => a.startMs - b.startMs)
    .slice(0, limit);
  const lines: ILyricsLine[] = [];
  sorted.forEach((line) => {
    const words =
      line.pieces === undefined
        ? undefined
        : wordsFromPieces(line.pieces.slice(0, MAX_LYRICS_WORDS));
    const text = (
      words === undefined ? line.text : words.map((word) => word.text).join('')
    )
      .replace(/\s+/g, ' ')
      .trim();
    lines.push({ timeMs: line.startMs, text, ...(words ? { words } : {}) });
  });
  return lines;
};

/**
 * The text to keep with the song: a timed format as Enhanced LRC, LRC and
 * plain text exactly as they came. A timed format with no line that has
 * words is nothing — refused as empty — rather than its markup kept as if
 * it were the words.
 */
export const lyricsAsKeptText = (input: string): string => {
  const read = readLyricsFormat(input);
  if (read.plainText !== undefined) {
    return read.plainText;
  }
  if (read.lines === undefined) {
    return input;
  }
  const lines = libraryLinesOf(read.lines);
  return lines.some((line) => line.text !== '')
    ? lrcFromLines(lines, read.header)
    : '';
};
