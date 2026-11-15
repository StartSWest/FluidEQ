/*
Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node

Main-process file I/O; the parser reads the file through Node, not jsdom.
Each format's file is built byte by byte (`utils/lyricsFixtures.ts`) with
lines written for these tests.
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import { readTrackLyrics } from '../../../main/library/libraryLyrics';
import { MAX_LYRICS_FILE_BYTES } from '../../../common/library/lyrics';
import {
  flacWithComments,
  m4aWithLyrics,
  mp3WithApe,
  mp3WithId3,
  mpegFrames,
  opusWithComments,
  wmaWithLyrics,
} from '../../utils/lyricsFixtures';

const SYNCED = [
  '[ti:Gravel Road]',
  '[00:01.00]Gravel under the tyres',
  '[00:04.50][00:20.00]Headlights on the hill',
  '[00:08.25]Nobody waiting up',
].join('\n');

const SYNCED_LINES = [
  { timeMs: 1000, text: 'Gravel under the tyres' },
  { timeMs: 4500, text: 'Headlights on the hill' },
  { timeMs: 8250, text: 'Nobody waiting up' },
  { timeMs: 20_000, text: 'Headlights on the hill' },
];

const PLAIN = 'A kettle on the stove\nA radio too low';

describe("a song's lyrics, read from its tags and the files beside it", () => {
  let dir = '';
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-lyrics-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const song = (name: string, bytes: Buffer) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, bytes);
    return file;
  };

  describe('in the tags', () => {
    it('reads ID3v2.4 USLT (UTF-8) as plain words', async () => {
      const file = song('a.mp3', mp3WithId3([{ id: 'USLT', text: PLAIN }], 4));
      expect((await readTrackLyrics(file)).lyrics).toEqual({
        kind: 'plain',
        source: 'tags',
        text: PLAIN,
      });
    });

    it('reads ID3v2.3 USLT (UTF-16 with a BOM), accents and all', async () => {
      const text = 'Café de la estación\nÚltimo tren';
      const file = song('a.mp3', mp3WithId3([{ id: 'USLT', text }], 3));
      expect((await readTrackLyrics(file)).lyrics).toEqual({
        kind: 'plain',
        source: 'tags',
        text,
      });
    });

    it('reads an LRC text in USLT as timed lines', async () => {
      const file = song('a.mp3', mp3WithId3([{ id: 'USLT', text: SYNCED }]));
      const { lyrics } = await readTrackLyrics(file);
      expect(lyrics?.kind === 'synced' && lyrics.lines).toEqual(SYNCED_LINES);
    });

    it('reads ID3 SYLT with millisecond stamps, a line per entry', async () => {
      const file = song(
        'a.mp3',
        mp3WithId3([
          {
            id: 'SYLT',
            entries: [
              { text: 'Second, though written first', timeMs: 3000 },
              { text: 'First on the clock', timeMs: 1200 },
            ],
          },
        ]),
      );
      expect((await readTrackLyrics(file)).lyrics).toEqual({
        kind: 'synced',
        source: 'tags',
        lines: [
          { timeMs: 1200, text: 'First on the clock' },
          { timeMs: 3000, text: 'Second, though written first' },
        ],
      });
    });

    it('joins SYLT syllables into lines where entries open lines', async () => {
      const file = song(
        'a.mp3',
        mp3WithId3(
          [
            {
              id: 'SYLT',
              entries: [
                { text: 'Pa', timeMs: 1000 },
                { text: 'per ', timeMs: 1250 },
                { text: 'boats', timeMs: 1600 },
                { text: '\nDown ', timeMs: 3000 },
                { text: 'the drain', timeMs: 3400 },
              ],
            },
          ],
          3,
        ),
      );
      expect((await readTrackLyrics(file)).lyrics).toEqual({
        kind: 'synced',
        source: 'tags',
        lines: [
          {
            timeMs: 1000,
            text: 'Paper boats',
            words: [
              { timeMs: 1000, text: 'Pa' },
              { timeMs: 1250, text: 'per ' },
              { timeMs: 1600, text: 'boats' },
            ],
          },
          {
            timeMs: 3000,
            text: 'Down the drain',
            words: [
              { timeMs: 3000, text: 'Down ' },
              { timeMs: 3400, text: 'the drain' },
            ],
          },
        ],
      });
    });

    it('reads nothing timed from SYLT in MPEG frames, or of chords', async () => {
      const entries = [{ text: 'Not a lyric', timeMs: 10 }];
      const frames = song(
        'frames.mp3',
        mp3WithId3([{ id: 'SYLT', entries, timeStampFormat: 1 }]),
      );
      const chords = song(
        'chords.mp3',
        mp3WithId3([{ id: 'SYLT', entries, contentType: 5 }]),
      );
      // Beside a control that the same frame, as lyrics in milliseconds, reads.
      const control = song(
        'control.mp3',
        mp3WithId3([{ id: 'SYLT', entries }]),
      );
      expect((await readTrackLyrics(frames)).lyrics).toBeUndefined();
      expect((await readTrackLyrics(chords)).lyrics).toBeUndefined();
      expect((await readTrackLyrics(control)).lyrics?.kind).toBe('synced');
    });

    it('reads ID3 TXXX:LYRICS, as some taggers write it', async () => {
      const file = song(
        'a.mp3',
        mp3WithId3([{ id: 'TXXX', description: 'LYRICS', text: SYNCED }], 3),
      );
      const { lyrics } = await readTrackLyrics(file);
      expect(lyrics?.kind === 'synced' && lyrics.lines).toEqual(SYNCED_LINES);
    });

    it.each(['LYRICS', 'UNSYNCEDLYRICS', 'SYNCEDLYRICS'])(
      'reads the Vorbis comment %s in FLAC',
      async (field) => {
        const file = song('a.flac', flacWithComments({ [field]: SYNCED }));
        const { lyrics } = await readTrackLyrics(file);
        expect(lyrics?.kind === 'synced' && lyrics.lines).toEqual(SYNCED_LINES);
      },
    );

    it('reads Vorbis comments in Ogg Opus', async () => {
      const file = song('a.opus', opusWithComments({ LYRICS: PLAIN }));
      expect((await readTrackLyrics(file)).lyrics).toEqual({
        kind: 'plain',
        source: 'tags',
        text: PLAIN,
      });
    });

    it('reads MP4 ©lyr', async () => {
      const file = song('a.m4a', m4aWithLyrics(SYNCED));
      const { lyrics } = await readTrackLyrics(file);
      expect(lyrics?.kind === 'synced' && lyrics.lines).toEqual(SYNCED_LINES);
    });

    it('reads APEv2 Lyrics', async () => {
      const file = song('a.mp3', mp3WithApe({ Lyrics: PLAIN }));
      expect((await readTrackLyrics(file)).lyrics).toEqual({
        kind: 'plain',
        source: 'tags',
        text: PLAIN,
      });
    });

    it('reads ASF WM/Lyrics', async () => {
      const file = song('a.wma', wmaWithLyrics(PLAIN));
      expect((await readTrackLyrics(file)).lyrics).toEqual({
        kind: 'plain',
        source: 'tags',
        text: PLAIN,
      });
    });
  });

  describe('beside the song', () => {
    it('reads a .lrc of the same name, with its offset and word stamps', async () => {
      const file = song('Gravel Road.mp3', mpegFrames());
      fs.writeFileSync(
        path.join(dir, 'Gravel Road.lrc'),
        '[offset:+200]\r\n[00:02.00]<00:02.00>Dust <00:02.60>and <00:03.00>diesel\r\n',
      );
      expect(await readTrackLyrics(file)).toEqual({
        lyrics: {
          kind: 'synced',
          source: 'lrc',
          fileName: 'Gravel Road.lrc',
          lines: [
            {
              timeMs: 1800,
              text: 'Dust and diesel',
              words: [
                { timeMs: 1800, text: 'Dust ' },
                { timeMs: 2400, text: 'and ' },
                { timeMs: 2800, text: 'diesel' },
              ],
            },
          ],
        },
        looked: ['Gravel Road.lrc', 'Gravel Road.txt'],
      });
    });

    it('reads a .txt of the same name as plain words', async () => {
      const file = song('Kettle.flac', flacWithComments({ TITLE: 'Kettle' }));
      fs.writeFileSync(path.join(dir, 'Kettle.txt'), `\uFEFF${PLAIN}`);
      expect((await readTrackLyrics(file)).lyrics).toEqual({
        kind: 'plain',
        source: 'txt',
        fileName: 'Kettle.txt',
        text: PLAIN,
      });
    });

    it('reads a file an older editor saved in the Windows code page', async () => {
      const file = song('Old.mp3', mpegFrames());
      // "Canción" in windows-1252: ó is 0xF3, which is not valid UTF-8.
      fs.writeFileSync(
        path.join(dir, 'Old.lrc'),
        Buffer.from([
          ...Buffer.from('[00:01.00]Canci', 'latin1'),
          0xf3,
          ...Buffer.from('n', 'latin1'),
        ]),
      );
      const { lyrics } = await readTrackLyrics(file);
      expect(lyrics?.kind === 'synced' && lyrics.lines[0].text).toBe('Canción');
    });

    it('takes no file too big to be lyrics', async () => {
      const file = song('Big.mp3', mpegFrames());
      fs.writeFileSync(
        path.join(dir, 'Big.txt'),
        `${'z'.repeat(MAX_LYRICS_FILE_BYTES)}more`,
      );
      // A control just under the limit is read.
      const small = song('Small.mp3', mpegFrames());
      fs.writeFileSync(path.join(dir, 'Small.txt'), 'z'.repeat(1000));
      expect((await readTrackLyrics(file)).lyrics).toBeUndefined();
      expect((await readTrackLyrics(small)).lyrics?.kind).toBe('plain');
    });

    it('says where it looked when nothing had words', async () => {
      const file = song('Silent Night Drive.mp3', mpegFrames());
      expect(await readTrackLyrics(file)).toEqual({
        looked: ['Silent Night Drive.lrc', 'Silent Night Drive.txt'],
      });
    });

    it('still reads the files beside a song whose tags will not parse', async () => {
      const file = song(
        'Broken.flac',
        Buffer.from('fLaC broken beyond repair'),
      );
      fs.writeFileSync(path.join(dir, 'Broken.txt'), PLAIN);
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect((await readTrackLyrics(file)).lyrics?.source).toBe('txt');
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('which one plays', () => {
    it('prefers timed tags to a .lrc, and a .lrc to plain tags', async () => {
      const timedTags = song(
        'One.mp3',
        mp3WithId3([{ id: 'USLT', text: SYNCED }]),
      );
      fs.writeFileSync(path.join(dir, 'One.lrc'), '[00:01.00]from the file');
      expect((await readTrackLyrics(timedTags)).lyrics?.source).toBe('tags');

      const plainTags = song(
        'Two.mp3',
        mp3WithId3([{ id: 'USLT', text: PLAIN }]),
      );
      fs.writeFileSync(path.join(dir, 'Two.lrc'), '[00:01.00]from the file');
      expect((await readTrackLyrics(plainTags)).lyrics).toMatchObject({
        kind: 'synced',
        source: 'lrc',
      });
    });

    it('prefers plain tags to a .txt', async () => {
      const file = song('Three.mp3', mp3WithId3([{ id: 'USLT', text: PLAIN }]));
      fs.writeFileSync(path.join(dir, 'Three.txt'), 'from the file');
      expect((await readTrackLyrics(file)).lyrics).toMatchObject({
        kind: 'plain',
        source: 'tags',
      });
    });
  });

  // Ivan, 2026-11-15: his word-timed YAML had been kept as the song's .txt
  // by an import from before the formats were read, beside a line-timed
  // .lrc, and the Karaoke got the lines without their words.
  describe('a timed format kept under any name', () => {
    const WORD_YAML = [
      "version: '1.0'",
      'lines:',
      '- text: Ayer cuando nos separamos',
      '  start_ms: 7930',
      '  end_ms: 13040',
      '  words:',
      "  - text: 'Ayer '",
      '    start_ms: 7930',
      "  - text: 'cuando '",
      '    start_ms: 11730',
      '  - text: separamos',
      '    start_ms: 13026',
    ].join('\n');

    it('reads a word-timed YAML in a .txt as timed words', async () => {
      const file = song('Four.mp3', mpegFrames());
      fs.writeFileSync(path.join(dir, 'Four.txt'), WORD_YAML);
      const { lyrics } = await readTrackLyrics(file);
      expect(lyrics).toMatchObject({ kind: 'synced', source: 'txt' });
      expect(lyrics?.kind === 'synced' ? lyrics.lines[0] : undefined).toEqual(
        expect.objectContaining({
          timeMs: 7930,
          text: 'Ayer cuando separamos',
          words: [
            { timeMs: 7930, text: 'Ayer ' },
            { timeMs: 11730, text: 'cuando ' },
            { timeMs: 13026, text: 'separamos' },
          ],
        }),
      );
    });

    it('lets word timing in a .txt win over line timing in the .lrc', async () => {
      const file = song('Five.mp3', mpegFrames());
      fs.writeFileSync(path.join(dir, 'Five.lrc'), '[00:07.93]Ayer');
      fs.writeFileSync(path.join(dir, 'Five.txt'), WORD_YAML);
      expect((await readTrackLyrics(file)).lyrics).toMatchObject({
        kind: 'synced',
        source: 'txt',
      });
    });

    it('still takes the .lrc first when both carry the same timing', async () => {
      const file = song('Six.mp3', mpegFrames());
      fs.writeFileSync(path.join(dir, 'Six.lrc'), '[00:07.93]from the lrc');
      fs.writeFileSync(path.join(dir, 'Six.txt'), '[00:01.00]from the txt');
      expect((await readTrackLyrics(file)).lyrics).toMatchObject({
        kind: 'synced',
        source: 'lrc',
      });
    });
  });
});
