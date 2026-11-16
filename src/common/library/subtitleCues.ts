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
 * A subtitle file's cues as captions drawn over the film (Ivan, 2026-11-15:
 * "show them on top of the video"): each with its start AND its end, and its
 * rows kept as rows. The lyrics reader (`lyricsMarkup.ts`) keeps neither —
 * a lyric line lasts until the next one and is one line — and it stays as it
 * is, because a song's words are read through it.
 *
 * Styling is not honoured, only removed: `<i>`, `<b>`, `<font>`, WebVTT's
 * voice and class spans and karaoke stamps, and SubRip's `{\an8}` placement
 * codes. The viewer places and styles the captions themselves
 * (`subtitleStyle.ts`); a tag printed raw on a film is the one failure that
 * matters here.
 */

import { clockMs, decodeEntities } from './lyricsMarkup';

export interface ISubtitleCue {
  startMs: number;
  endMs: number;
  /** Its rows, joined by a line feed, every tag gone. */
  text: string;
}

/**
 * A film's dialogue runs to well over a song's line cap: a three-hour film
 * with the hard-of-hearing captions carries about 3000 cues. Past this a
 * file is cut, not refused.
 */
export const MAX_SUBTITLE_CUES = 6000;

/** A cue's timing row, SubRip's comma or WebVTT's point, hours optional;
 * WebVTT's settings after it (`line:90%`) are ignored. */
const TIMING =
  /^\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})/;

/** One row as it is read: markup, placement codes and spacing tidied away. */
const rowText = (row: string): string =>
  decodeEntities(
    row
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/\{\\[^}]*\}/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();

/**
 * SubRip and WebVTT cues: blocks apart by blank lines, each with a timing
 * row and its rows under it. WebVTT's NOTE, STYLE and REGION blocks have no
 * timing row and are passed over by that alone; a cue that ends where it
 * starts, or before, shows for no time and is dropped. In start order, the
 * file's order kept among cues that start together.
 */
export const parseSubtitleCues = (text: string): ISubtitleCue[] => {
  const cues: ISubtitleCue[] = [];
  text.split(/\r?\n[ \t]*\r?\n/).forEach((block) => {
    if (cues.length >= MAX_SUBTITLE_CUES) {
      return;
    }
    const rows = block.split(/\r?\n/);
    const timingAt = rows.findIndex((row) => TIMING.test(row));
    const timing = timingAt < 0 ? null : TIMING.exec(rows[timingAt]);
    if (timing === null) {
      return;
    }
    const startMs = clockMs(timing[1]);
    const endMs = clockMs(timing[2]);
    const words = rows
      .slice(timingAt + 1)
      .map(rowText)
      .filter((row) => row !== '')
      .join('\n');
    if (
      startMs === undefined ||
      endMs === undefined ||
      endMs <= startMs ||
      words === ''
    ) {
      return;
    }
    cues.push({ startMs, endMs, text: words });
  });
  return cues
    .map((cue, index) => ({ cue, index }))
    .sort((a, b) => a.cue.startMs - b.cue.startMs || a.index - b.index)
    .map(({ cue }) => cue);
};

/** The longest any cue lasts, which bounds how far back a cue still on
 * screen can have started. */
export const longestCueMs = (cues: readonly ISubtitleCue[]): number =>
  cues.reduce((longest, cue) => Math.max(longest, cue.endMs - cue.startMs), 0);

/**
 * The cues on screen at `positionMs`, in start order: every one that has
 * started and not yet ended, so two speakers' overlapping cues both show. A
 * binary search finds the last cue started; only cues that began within the
 * longest cue's length before it can still be showing, so a film is never
 * walked whole at every frame.
 */
export const cuesAt = (
  cues: readonly ISubtitleCue[],
  positionMs: number,
  longestMs: number = longestCueMs(cues),
): ISubtitleCue[] => {
  let low = 0;
  let high = cues.length - 1;
  let last = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (cues[middle].startMs <= positionMs) {
      last = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  const showing: ISubtitleCue[] = [];
  for (
    let at = last;
    at >= 0 && cues[at].startMs >= positionMs - longestMs;
    at -= 1
  ) {
    if (cues[at].endMs > positionMs) {
      showing.unshift(cues[at]);
    }
  }
  return showing;
};
