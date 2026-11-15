/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * THE STANZAS AS THE WORDS ARE WRITTEN, on timed lines that do not carry
 * them (Ivan, 2026-11-15: "show the same spaces between stanzas the original
 * lyric has", with the song's page beside it: five lines, five, four...).
 *
 * A timed file's empty lines are its pauses, not its stanzas: the `.lrc` of
 * his Silvana Di Lorenzo song stamps one wherever the music rests, and drawn
 * as space they parted the verses in all the wrong places. The stanzas live
 * in the words as written - a plain text, or a timed format that carries its
 * plain text (`withPlainStanzas` in `lyricsFormats.ts`) - so where the song
 * has such words beside its timed ones, the timed lines are parted where
 * those words are parted: each timed line found in them in order, a space
 * before every one that opens a stanza there, and the timed file's own
 * empty lines dropped. Nothing is changed where too few lines are found, so
 * a text that is some other song's, or another version's, parts nothing.
 */
import type { ILibraryLyrics, ILyricsLine } from './lyrics';

interface ILayoutLine {
  /** The line's words, as compared (`comparable`). */
  key: string;
  /** A stanza begins with it. */
  opens: boolean;
}

/** How far ahead a timed line is looked for: a repeated chorus line or a
 * spoken aside in one text and not the other is stepped over. */
const LOOK_AHEAD = 4;

/** The share of timed lines that must be found for the stanzas to be used. */
const ENOUGH_FOUND = 0.8;

/** A line as compared: no accents, no case, no punctuation, one space. */
const comparable = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** The lines of words as written, each saying whether a stanza opens with
 * it; nothing for words that part no stanza at all. */
export const stanzaLayoutOf = (
  lyrics: ILibraryLyrics,
): ILayoutLine[] | undefined => {
  const rows =
    lyrics.kind === 'plain'
      ? lyrics.text.split('\n')
      : lyrics.lines.map((line) => line.text);
  const layout: ILayoutLine[] = [];
  let afterBlank = false;
  rows.forEach((row) => {
    const key = comparable(row);
    if (key === '') {
      afterBlank = layout.length > 0;
      return;
    }
    layout.push({ key, opens: afterBlank });
    afterBlank = false;
  });
  return layout.some((line) => line.opens) ? layout : undefined;
};

/**
 * `lines` parted where `layout` parts its words, or nothing where too few
 * of them were found there. A space stands a hundredth of a second before
 * the line that opens a stanza, so the two keep their own stamps.
 */
export const withStanzas = (
  lines: readonly ILyricsLine[],
  layout: readonly ILayoutLine[],
): ILyricsLine[] | undefined => {
  const sung = lines.filter((line) => line.text !== '');
  if (sung.length === 0) {
    return undefined;
  }
  const parted: ILyricsLine[] = [];
  let at = 0;
  let found = 0;
  sung.forEach((line, index) => {
    const key = comparable(line.text);
    let match = -1;
    for (
      let ahead = at;
      ahead < Math.min(layout.length, at + LOOK_AHEAD);
      ahead += 1
    ) {
      if (layout[ahead].key === key) {
        match = ahead;
        break;
      }
    }
    if (match >= 0) {
      found += 1;
      const opens = layout.slice(at, match + 1).some((entry) => entry.opens);
      const previous = sung[index - 1];
      if (
        opens &&
        previous !== undefined &&
        line.timeMs - 10 > previous.timeMs
      ) {
        parted.push({ timeMs: line.timeMs - 10, text: '' });
      }
      at = match + 1;
    }
    parted.push(line);
  });
  return found / sung.length >= ENOUGH_FOUND ? parted : undefined;
};
