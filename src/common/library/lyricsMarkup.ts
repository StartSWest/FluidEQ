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
 * Timed lyrics written as markup — TTML (Apple Music's, word-timed by
 * `<span begin>`), SubRip `.srt` and WebVTT `.vtt` (line-timed, VTT's
 * karaoke `<00:00:08.200>` stamps word-timed) — read into timed lines for
 * `lyricsFormats.ts`. Read with patterns rather than an XML parser: the same
 * code runs in main, which has no DOM, and the text is bounded before it
 * gets here (`MAX_LYRICS_FILE_BYTES`).
 */

/** One sung line: its start and, where the format says, its end, and its
 * timed pieces (a word or a syllable each, with its own spacing). */
export interface ITimedLine {
  startMs: number;
  endMs?: number;
  text: string;
  pieces?: { timeMs: number; text: string }[];
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** XML's and HTML's escapes, numeric ones by their code point. */
export const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name.startsWith('#')) {
      const code =
        name[1] === 'x' || name[1] === 'X'
          ? parseInt(name.slice(2), 16)
          : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

/** `hh:mm:ss.fff`, `mm:ss.fff` or `ss.fff`, the comma SRT writes taken as a
 * point; nothing for anything else. */
export const clockMs = (clock: string): number | undefined => {
  const match = /^(?:(\d+):)?(?:(\d{1,2}):)?(\d{1,2}(?:[.,]\d+)?)$/.exec(
    clock.trim(),
  );
  if (match === null) {
    return undefined;
  }
  const [, first, second, seconds] = match;
  // One colon is minutes and seconds; two are hours, minutes and seconds.
  const hours = second === undefined ? 0 : Number(first ?? 0);
  const minutes = second === undefined ? Number(first ?? 0) : Number(second);
  return Math.round(
    ((hours * 60 + minutes) * 60 + Number(seconds.replace(',', '.'))) * 1000,
  );
};

/** A TTML time: a clock, or an offset in hours, minutes, seconds or ms. */
const ttmlMs = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const offset = /^(\d+(?:\.\d+)?)(h|m|s|ms)$/.exec(value.trim());
  if (offset !== null) {
    const scale = { h: 3_600_000, m: 60_000, s: 1000, ms: 1 }[
      offset[2] as 'h' | 'm' | 's' | 'ms'
    ];
    return Math.round(Number(offset[1]) * scale);
  }
  return clockMs(value);
};

/** An attribute's value, in either quote. */
const attribute = (attributes: string, name: string): string | undefined => {
  const match = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    'i',
  ).exec(attributes);
  return match?.[1] ?? match?.[2];
};

const stripTags = (markup: string): string =>
  decodeEntities(markup.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ''));

/** Whether the text is TTML: a `<tt>` root, with or without its prolog. */
export const isTtml = (text: string): boolean => /<tt[\s>]/i.test(text);

/**
 * TTML's `<p begin end>` lines; a line's `<span begin>` leaves (a span with
 * no span inside, so Apple's background-vocal wrappers give their words and
 * not themselves) are its timed pieces, the text between them kept on the
 * piece before. A line with no timed span is timed as a whole.
 */
export const parseTtml = (text: string): ITimedLine[] => {
  const lines: ITimedLine[] = [];
  const paragraphs = text.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi);
  [...paragraphs].forEach(([, attributes, body]) => {
    const startMs = ttmlMs(attribute(attributes, 'begin'));
    if (startMs === undefined) {
      return;
    }
    const pieces: { timeMs: number; text: string }[] = [];
    let last = 0;
    [...body.matchAll(/<span\b([^>]*)>([^<]*)<\/span>/gi)].forEach((span) => {
      const at = span.index ?? 0;
      const between = stripTags(body.slice(last, at));
      last = at + span[0].length;
      const timeMs = ttmlMs(attribute(span[1], 'begin'));
      if (pieces.length > 0) {
        pieces[pieces.length - 1].text += between;
      }
      if (timeMs === undefined) {
        if (pieces.length > 0) {
          pieces[pieces.length - 1].text += decodeEntities(span[2]);
        }
        return;
      }
      pieces.push({ timeMs, text: decodeEntities(span[2]) });
    });
    lines.push({
      startMs,
      endMs: ttmlMs(attribute(attributes, 'end')),
      text: stripTags(body),
      ...(pieces.length > 0 ? { pieces } : {}),
    });
  });
  return lines;
};

const CUE_TIMING =
  /^\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})/;

/** Whether the text is SubRip: a numbered cue with a `-->` timing under it. */
export const isSrt = (text: string): boolean =>
  /(?:^|\n)\s*\d+\s*\r?\n\s*\d+:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(text);

/** Whether the text is WebVTT: its signature on the first line, a
 * byte-order mark before it dropped by its code. */
export const isVtt = (text: string): boolean =>
  /^WEBVTT(?:[ \t]|\r?\n|$)/.test(
    text.charCodeAt(0) === 0xfeff ? text.slice(1) : text,
  );

/** A cue's text as one line: its rows joined, styling tags and SubRip's
 * `{\an8}` placement codes gone. */
const cueText = (rows: string[]): string =>
  stripTags(rows.join(' ').replace(/\{\\[^}]*\}/g, ''))
    .replace(/\s+/g, ' ')
    .trim();

/** VTT's karaoke stamps inside a cue: `<00:00:08.200>`. */
const VTT_STAMP = /<((?:\d+:)?\d{2}:\d{2}\.\d{3})>/g;

const vttPieces = (
  rows: string[],
  startMs: number,
): { timeMs: number; text: string }[] | undefined => {
  const body = rows.join(' ');
  const stamps = [...body.matchAll(VTT_STAMP)];
  if (stamps.length === 0) {
    return undefined;
  }
  const pieces = [
    { timeMs: startMs, text: stripTags(body.slice(0, stamps[0].index)) },
  ];
  stamps.forEach((stamp, index) => {
    const from = (stamp.index ?? 0) + stamp[0].length;
    const to = stamps[index + 1]?.index ?? body.length;
    pieces.push({
      timeMs: clockMs(stamp[1]) ?? startMs,
      text: stripTags(body.slice(from, to)),
    });
  });
  return pieces.filter((piece) => piece.text !== '');
};

/** SubRip and WebVTT cues: blocks apart by blank lines, each with a timing
 * row and the words under it. VTT's NOTE, STYLE and REGION blocks carry no
 * timing row and are passed over by that alone. */
const parseCues = (text: string, isWebVtt: boolean): ITimedLine[] => {
  const lines: ITimedLine[] = [];
  text.split(/\r?\n\s*\r?\n/).forEach((block) => {
    const rows = block.split(/\r?\n/);
    const timingAt = rows.findIndex((row) => CUE_TIMING.test(row));
    if (timingAt < 0) {
      return;
    }
    const timing = CUE_TIMING.exec(rows[timingAt]);
    const startMs = clockMs(timing?.[1] ?? '');
    if (startMs === undefined) {
      return;
    }
    const words = rows.slice(timingAt + 1).filter((row) => row.trim() !== '');
    const pieces = isWebVtt ? vttPieces(words, startMs) : undefined;
    lines.push({
      startMs,
      endMs: clockMs(timing?.[2] ?? ''),
      text: cueText(words.map((row) => row.replace(VTT_STAMP, ''))),
      ...(pieces === undefined ? {} : { pieces }),
    });
  });
  return lines;
};

export const parseSrt = (text: string): ITimedLine[] => parseCues(text, false);

export const parseVtt = (text: string): ITimedLine[] => parseCues(text, true);
