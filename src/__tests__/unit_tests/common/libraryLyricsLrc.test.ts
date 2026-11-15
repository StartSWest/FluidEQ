/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { parseLrc as parseKaraokeLrc } from 'common/karaoke/lrc';
import { type ILyricsLine, parseLrc } from 'common/library/lyrics';
import { lrcFromLines, lrcTime } from 'common/library/lyricsLrc';

/**
 * Timed lyrics written back out as LRC: every line and word read back by
 * both readers — the Library's and the Karaoke tab's — at the time it held,
 * to the millisecond, and the ID tags written so neither reads them as words.
 */

const LINES: ILyricsLine[] = [
  { timeMs: 905, text: '[Intro]' },
  {
    timeMs: 61_234,
    text: 'Salt on the rope',
    words: [
      { timeMs: 61_234, text: 'Salt ' },
      { timeMs: 61_705, text: 'on ' },
      { timeMs: 62_010, text: 'the ' },
      { timeMs: 62_399, text: 'rope' },
    ],
  },
  { timeMs: 65_000, text: '' },
];

describe('LRC written from Library lyrics', () => {
  it('stamps hundredths where they are enough and milliseconds where not', () => {
    expect(lrcTime(905)).toBe('00:00.905');
    expect(lrcTime(61_230)).toBe('01:01.23');
    expect(lrcTime(61_234)).toBe('01:01.234');
    expect(lrcTime(3_600_000)).toBe('60:00.00');
  });

  it('reads back in the Library at every time it held', () => {
    expect(parseLrc(lrcFromLines(LINES))).toEqual(LINES);
  });

  it('reads back in the Karaoke tab with its words timed', () => {
    const parsed = parseKaraokeLrc(lrcFromLines(LINES, { title: 'Harbour' }));
    expect(parsed.title).toBe('Harbour');
    const sung = parsed.lines.find((line) =>
      line.tokens.some((token) => token.text.includes('Salt')),
    );
    expect(sung?.tokens.map((token) => token.startMs)).toEqual([
      61_234, 61_705, 62_010, 62_399,
    ]);
  });

  it('keeps a bracket in a tag from cutting it', () => {
    const text = lrcFromLines(LINES, {
      title: 'Live [2019]',
      artist: ' A ] B ',
    });
    expect(text.startsWith('[ti:Live (2019)]\n[ar:A ) B]\n')).toBe(true);
  });
});
