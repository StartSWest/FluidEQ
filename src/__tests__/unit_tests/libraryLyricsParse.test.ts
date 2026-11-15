/*
Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later

The LRC reading every lyrics source goes through (`common/library/lyrics.ts`).
Every line here was written for these tests.
*/

import {
  lyricsFromText,
  MAX_LYRICS_FILE_BYTES,
  MAX_LYRICS_LINE_CHARS,
  MAX_LYRICS_LINES,
  MAX_LYRICS_WORDS,
  parseLrc,
  plainLyrics,
  reachedIndex,
  wordsFromPieces,
} from '../../common/library/lyrics';

const times = (text: string) => parseLrc(text)?.map((line) => line.timeMs);

describe('LRC stamps', () => {
  it('reads every fraction a file can carry, and none', () => {
    expect(
      times(
        [
          '[00:01]whole seconds',
          '[00:02.5]tenths',
          '[00:03.25]hundredths',
          '[00:04.125]thousandths',
          '[00:05:50]a colon before the hundredths',
          '[12:00.00]minutes past ten',
          '[100:00.00]a hundred minutes',
        ].join('\n'),
      ),
    ).toEqual([1000, 2500, 3250, 4125, 5500, 720_000, 6_000_000]);
  });

  it('gives a repeated line every stamp it carries, in time order', () => {
    const lines = parseLrc(
      [
        '[00:20.00][01:10.00]Hold the lantern high',
        '[00:30.00]Walk the river road',
      ].join('\n'),
    );
    expect(lines).toEqual([
      { timeMs: 20_000, text: 'Hold the lantern high' },
      { timeMs: 30_000, text: 'Walk the river road' },
      { timeMs: 70_000, text: 'Hold the lantern high' },
    ]);
  });

  it('keeps the file order of lines that share a stamp', () => {
    const lines = parseLrc('[00:05.00]one\n[00:05.00]two\n[00:01.00]zero');
    expect(lines?.map((line) => line.text)).toEqual(['zero', 'one', 'two']);
  });

  it('applies the offset tag: positive means the words come sooner', () => {
    expect(times('[offset:+500]\n[00:02.00]early')).toEqual([1500]);
    expect(times('[offset:-250]\n[00:02.00]late')).toEqual([2250]);
    // Never before the song starts.
    expect(times('[offset:+5000]\n[00:01.00]clamped')).toEqual([0]);
  });

  it('drops ID tags, keeps a stamped pause as an empty line', () => {
    const lines = parseLrc(
      [
        '[ti:Copper Kettle]',
        '[ar:Nobody in particular]',
        '[length:03:12]',
        '[by:a test]',
        '[00:01.00]Steam on the window',
        '[00:04.00]',
        '[00:09.00]Back to the song',
      ].join('\n'),
    );
    expect(lines).toEqual([
      { timeMs: 1000, text: 'Steam on the window' },
      { timeMs: 4000, text: '' },
      { timeMs: 9000, text: 'Back to the song' },
    ]);
  });

  it('reads Windows and old Mac line ends and drops a byte-order mark', () => {
    expect(
      parseLrc('\uFEFF[00:01.00]crlf\r\n[00:02.00]cr\r[00:03.00]lf\n'),
    ).toEqual([
      { timeMs: 1000, text: 'crlf' },
      { timeMs: 2000, text: 'cr' },
      { timeMs: 3000, text: 'lf' },
    ]);
  });

  it('is nothing for text without a stamp', () => {
    expect(parseLrc('Just a verse\nwith no times')).toBeUndefined();
    expect(parseLrc('[ti:Only tags]\n[ar:Here]')).toBeUndefined();
  });
});

describe('Enhanced LRC word stamps', () => {
  it('rides each word on its line, the line still read whole', () => {
    const [line] =
      parseLrc('[00:10.00]<00:10.00>Tin <00:10.40>roof <00:11.00>rain') ?? [];
    expect(line.text).toBe('Tin roof rain');
    expect(line.words).toEqual([
      { timeMs: 10_000, text: 'Tin ' },
      { timeMs: 10_400, text: 'roof ' },
      { timeMs: 11_000, text: 'rain' },
    ]);
  });

  it('joins syllables back into their word', () => {
    const [line] =
      parseLrc('[00:01.00]<00:01.00>Mor<00:01.30>ning <00:01.80>light') ?? [];
    expect(line.text).toBe('Morning light');
    expect(line.words?.map((word) => word.text).join('')).toBe(line.text);
  });

  it('moves the words with the offset too', () => {
    const [line] =
      parseLrc('[offset:+1000]\n[00:05.00]<00:05.00>a <00:06.00>b') ?? [];
    expect(line.timeMs).toBe(4000);
    expect(line.words?.map((word) => word.timeMs)).toEqual([4000, 5000]);
  });

  it('keeps no words for a line with a single stamp', () => {
    expect(wordsFromPieces([{ timeMs: 1, text: 'alone' }])).toBeUndefined();
  });

  it('keeps at most a bounded number of words', () => {
    const body = Array.from(
      { length: MAX_LYRICS_WORDS + 50 },
      (_, index) => `<00:00.${String(index % 100).padStart(2, '0')}>w `,
    ).join('');
    const [line] = parseLrc(`[00:00.00]${body}`) ?? [];
    expect(line.words).toHaveLength(MAX_LYRICS_WORDS);
  });
});

describe('bounds of a timed line', () => {
  it('lights a line too long for a row whole, keeping none of its words', () => {
    const long = 'x'.repeat(MAX_LYRICS_LINE_CHARS);
    const [line] = parseLrc(`[00:01.00]<00:01.00>${long} <00:02.00>tail`) ?? [];
    expect(line.words).toBeUndefined();
    expect(line.text).toHaveLength(MAX_LYRICS_LINE_CHARS);
    // Beside a control a character under the limit, which keeps them.
    const [short] =
      parseLrc(
        `[00:01.00]<00:01.00>${'x'.repeat(MAX_LYRICS_LINE_CHARS - 6)} <00:02.00>tail`,
      ) ?? [];
    expect(short.words).toHaveLength(2);
  });
});

describe('bounds', () => {
  it('cuts a file at the line limit, never refusing it', () => {
    const text = Array.from(
      { length: MAX_LYRICS_LINES + 10 },
      (_, index) =>
        `[00:${String(index % 60).padStart(2, '0')}.00]line ${index}`,
    ).join('\n');
    expect(parseLrc(text)).toHaveLength(MAX_LYRICS_LINES);
  });

  it('cuts a long line and removes control characters', () => {
    const [line] = parseLrc(`[00:01.00]a\u0007b${'x'.repeat(2000)}`) ?? [];
    expect(line.text.startsWith('ab')).toBe(true);
    expect(line.text).toHaveLength(MAX_LYRICS_LINE_CHARS);
  });

  it('reads a tag no further than a lyrics file would be', () => {
    const lyrics = lyricsFromText(
      `${'y'.repeat(MAX_LYRICS_FILE_BYTES)}\n[00:01.00]past the limit`,
      'tags',
    );
    expect(lyrics?.kind).toBe('plain');
  });
});

describe('plain lyrics', () => {
  it('tidies line ends and runs of blank lines, keeping verses apart', () => {
    expect(plainLyrics('\uFEFF  Verse one\r\n\r\n\r\n\r\nVerse two  \n')).toBe(
      'Verse one\n\nVerse two',
    );
  });

  it('is nothing for empty text', () => {
    expect(plainLyrics(' \n \r\n')).toBeUndefined();
    expect(lyricsFromText('   ', 'txt')).toBeUndefined();
  });

  it('reads stamped text as synced, unstamped as plain, naming the file', () => {
    expect(lyricsFromText('[00:01.00]hi', 'lrc', 'Song.lrc')).toEqual({
      kind: 'synced',
      source: 'lrc',
      fileName: 'Song.lrc',
      lines: [{ timeMs: 1000, text: 'hi' }],
    });
    expect(lyricsFromText('hi there', 'txt', 'Song.txt')).toEqual({
      kind: 'plain',
      source: 'txt',
      fileName: 'Song.txt',
      text: 'hi there',
    });
  });

  it('reads stamps that stamp nothing but pauses as plain words', () => {
    expect(lyricsFromText('[00:01.00]\n[00:02.00]', 'lrc')?.kind).toBe('plain');
  });
});

describe('the line being sung', () => {
  const lines = [
    { timeMs: 1000, text: 'a' },
    { timeMs: 2000, text: 'b' },
    { timeMs: 2000, text: 'c' },
    { timeMs: 5000, text: 'd' },
  ];

  it('is none before the first line, then the last line reached', () => {
    expect(reachedIndex(lines, 0)).toBe(-1);
    expect(reachedIndex(lines, 999)).toBe(-1);
    expect(reachedIndex(lines, 1000)).toBe(0);
    expect(reachedIndex(lines, 1999)).toBe(0);
    expect(reachedIndex(lines, 2000)).toBe(2);
    expect(reachedIndex(lines, 4999)).toBe(2);
    expect(reachedIndex(lines, 600_000)).toBe(3);
  });

  it('is none for no lines', () => {
    expect(reachedIndex([], 1000)).toBe(-1);
  });
});
