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
 * Timed lyrics as the Library holds them, written back out as LRC: how the
 * Lyrics tab hands a song's words to the Karaoke tab, whose player and Maker
 * read songs as an audio file with a lyrics file beside it.
 *
 * Written so `parseLrc` (`lyrics.ts`) and the Karaoke tab's own reader both
 * read every line back at the time it was held: the offset is already in the
 * times, so none is written; word stamps go out as Enhanced LRC's `<mm:ss.xx>`,
 * each piece keeping its own spacing, which is how both readers join them
 * back into the line.
 */

import type { ILyricsLine } from './lyrics';

/**
 * `mm:ss.xx`, or `mm:ss.xxx` where the time is finer than a hundredth: both
 * readers take three digits, and rounding a word stamp to ten milliseconds
 * would move what somebody timed by hand.
 */
export const lrcTime = (timeMs: number): string => {
  const safe = Math.max(0, Math.round(timeMs));
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const millis = safe % 1000;
  const fraction =
    millis % 10 === 0
      ? String(millis / 10).padStart(2, '0')
      : String(millis).padStart(3, '0');
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}.${fraction}`;
};

/** An ID tag's value ends at the first `]`, so a bracket in it would cut it. */
const tagValue = (value: string): string =>
  value.replace(/\[/g, '(').replace(/\]/g, ')').replace(/\s+/g, ' ').trim();

export interface ILrcHeader {
  title?: string;
  artist?: string;
}

/** The lines as an LRC file's text, ending with a line feed. */
export const lrcFromLines = (
  lines: readonly ILyricsLine[],
  header: ILrcHeader = {},
): string => {
  const rows: string[] = [];
  const title = header.title === undefined ? '' : tagValue(header.title);
  const artist = header.artist === undefined ? '' : tagValue(header.artist);
  if (title !== '') {
    rows.push(`[ti:${title}]`);
  }
  if (artist !== '') {
    rows.push(`[ar:${artist}]`);
  }
  lines.forEach((line) => {
    const body =
      line.words === undefined
        ? line.text
        : line.words
            .map((word) => `<${lrcTime(word.timeMs)}>${word.text}`)
            .join('');
    rows.push(`[${lrcTime(line.timeMs)}]${body}`);
  });
  return `${rows.join('\n')}\n`;
};
