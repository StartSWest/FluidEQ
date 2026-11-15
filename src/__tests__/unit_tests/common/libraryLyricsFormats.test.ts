/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { lyricsFromText } from 'common/library/lyrics';
import {
  lyricsAsKeptText,
  readLyricsFormat,
} from 'common/library/lyricsFormats';
import {
  checkLyricsImport,
  isLyricsFileName,
} from 'common/library/lyricsImport';
import parseLyricsYaml from 'common/library/lyricsYaml';

/**
 * Every timed-lyrics format the Lyrics tab imports, each in the shape its
 * source writes it, read into the Library's lines and kept as Enhanced LRC:
 * words timed where the format times them, lines where it times only lines.
 * Every line was written for this test.
 */

/** What the song would keep, as the Lyrics tab reads it back. */
const kept = (text: string) => {
  const lyrics = lyricsFromText(lyricsAsKeptText(text), 'lrc');
  if (lyrics?.kind !== 'synced') {
    throw new Error(`not timed: ${lyricsAsKeptText(text)}`);
  }
  return lyrics.lines;
};

const starts = (text: string) =>
  kept(text).map((line) => [line.timeMs, line.text]);

const wordStarts = (text: string, index = 0) =>
  kept(text)[index].words?.map((word) => [word.timeMs, word.text]);

const YAML = `version: '1.0'
metadata:
  title: Harbour Lights
  artist: The Gulls   # as tagged
  duration_ms: 176000
lines:
- text: Salt on the rope
  start_ms: 7930
  end_ms: 9800
  words:
  - text: 'Salt '
    start_ms: 7930
  - text: "on "
    start_ms: 8410
  - text: 'the '
    start_ms: 8700
  - text: rope
    start_ms: 9120
- text: Gulls over the ferry
  start_ms: 14000
  end_ms: 16500
  words:
  - text: 'Gulls '
    start_ms: 14000
  - text: 'over '
    start_ms: 14650
  - text: 'the '
    start_ms: 15200
  - text: ferry
    start_ms: 15600
plain: |-
  Salt on the rope
  Gulls over the ferry
`;

describe('the lines and words JSON, and its YAML twin', () => {
  it('reads the YAML export with its word times, and a pause where it rests', () => {
    expect(readLyricsFormat(YAML).format).toBe('lines-yaml');
    expect(starts(YAML)).toEqual([
      [7930, 'Salt on the rope'],
      [9800, ''],
      [14000, 'Gulls over the ferry'],
      [16500, ''],
    ]);
    expect(wordStarts(YAML)).toEqual([
      [7930, 'Salt '],
      [8410, 'on '],
      [8700, 'the '],
      [9120, 'rope'],
    ]);
    // The song's title and artist travel as the file's tags.
    expect(lyricsAsKeptText(YAML)).toMatch(
      /^\[ti:Harbour Lights\]\n\[ar:The Gulls\]\n/,
    );
  });

  it('reads the same shape as JSON', () => {
    const json = JSON.stringify(parseLyricsYaml(YAML));
    expect(readLyricsFormat(json).format).toBe('lines-json');
    expect(starts(json)).toEqual(starts(YAML));
    expect(wordStarts(json, 2)).toEqual([
      [14000, 'Gulls '],
      [14650, 'over '],
      [15200, 'the '],
      [15600, 'ferry'],
    ]);
  });

  it('reads the YAML a writer leaves with comments, quotes and blocks', () => {
    expect(
      parseLyricsYaml(
        "a: 'it''s'\nb: \"tab\\tthere\"\n# note\nc: |\n  one\n\n  two\nd:\n- 1\n- x: 2\n  y: [3, 4]\n",
      ),
    ).toEqual({
      a: "it's",
      b: 'tab\tthere',
      c: 'one\n\ntwo\n',
      d: [1, { x: 2, y: [3, 4] }],
    });
    expect(parseLyricsYaml('lines:\n\t- text: tabbed')).toBeUndefined();
  });
});

describe('LRC and Enhanced LRC', () => {
  it('keeps an Enhanced LRC exactly as written', () => {
    const text =
      '[00:07.93]<00:07.93>Salt <00:08.41>on <00:08.70>the <00:09.12>rope\n[00:14.00]Gulls over the ferry\n';
    expect(readLyricsFormat(text).format).toBe('lrc');
    expect(lyricsAsKeptText(text)).toBe(text);
    expect(wordStarts(text)).toEqual([
      [7930, 'Salt '],
      [8410, 'on '],
      [8700, 'the '],
      [9120, 'rope'],
    ]);
  });
});

describe('TTML', () => {
  const TTML = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" itunes:timing="Word" xml:lang="en">
  <head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head>
  <body dur="3:12.400">
    <div begin="7.930" end="16.500" itunes:songPart="Verse">
      <p begin="7.930" end="9.800" ttm:agent="v1"><span begin="7.930" end="8.410">Salt</span> <span begin="8.410" end="8.700">on</span> <span begin="8.700" end="9.120">the</span> <span begin="9.120" end="9.800">rope</span><span ttm:role="x-bg"><span begin="9.300" end="9.700">(ho)</span></span></p>
      <p begin="00:00:14.000" end="00:00:16.500"><span begin="14s" end="14.6s">Gulls</span> <span begin="14650ms" end="15.1s">over</span> <span begin="0:15.200">the</span> <span begin="0:15.600">fer&amp;ry</span></p>
      <p begin="20.000" end="22.000">A line timed &lt;whole&gt;<br/>on two rows</p>
    </div>
  </body>
</tt>`;

  it('reads Apple-style word spans, background vocals and every time form', () => {
    expect(readLyricsFormat(TTML).format).toBe('ttml');
    expect(starts(TTML)).toEqual([
      [7930, 'Salt on the rope(ho)'],
      [9800, ''],
      [14000, 'Gulls over the fer&ry'],
      [16500, ''],
      [20000, 'A line timed <whole> on two rows'],
      [22000, ''],
    ]);
    expect(wordStarts(TTML)).toEqual([
      [7930, 'Salt '],
      [8410, 'on '],
      [8700, 'the '],
      [9120, 'rope'],
      [9300, '(ho)'],
    ]);
    expect(wordStarts(TTML, 2)?.map(([time]) => time)).toEqual([
      14000, 14650, 15200, 15600,
    ]);
  });
});

describe('SubRip and WebVTT', () => {
  it('reads SubRip cues as lines', () => {
    const srt =
      '1\r\n00:00:07,930 --> 00:00:09,800\r\n<i>Salt on the rope</i>\r\n\r\n2\r\n00:00:14,000 --> 00:00:16,500\r\n{\\an8}Gulls over\r\nthe ferry\r\n';
    expect(readLyricsFormat(srt).format).toBe('srt');
    expect(starts(srt)).toEqual([
      [7930, 'Salt on the rope'],
      [9800, ''],
      [14000, 'Gulls over the ferry'],
      [16500, ''],
    ]);
  });

  it('reads WebVTT cues, and its karaoke stamps as words', () => {
    const vtt = `WEBVTT - Harbour Lights

NOTE written by hand

STYLE
::cue { color: white }

intro
00:07.930 --> 00:09.800 align:center line:90%
<v Singer>Salt <00:00:08.410>on <00:00:08.700>the <00:00:09.120>rope</v>

00:00:14.000 --> 00:00:16.500
<c.lead>Gulls over the ferry</c>
`;
    expect(readLyricsFormat(vtt).format).toBe('vtt');
    expect(starts(vtt)).toEqual([
      [7930, 'Salt on the rope'],
      [9800, ''],
      [14000, 'Gulls over the ferry'],
      [16500, ''],
    ]);
    expect(wordStarts(vtt)).toEqual([
      [7930, 'Salt '],
      [8410, 'on '],
      [8700, 'the '],
      [9120, 'rope'],
    ]);
  });
});

describe('Musixmatch and Spotify', () => {
  const RICHSYNC = [
    {
      ts: 7.93,
      te: 9.8,
      l: [
        { c: 'Salt', o: 0 },
        { c: ' ', o: 0.3 },
        { c: 'on', o: 0.48 },
        { c: ' ', o: 0.6 },
        { c: 'the', o: 0.77 },
        { c: ' ', o: 1.0 },
        { c: 'rope', o: 1.19 },
      ],
      x: 'Salt on the rope',
    },
    {
      ts: 10.2,
      te: 12,
      l: [{ c: 'Gulls', o: 0 }],
      x: 'Gulls',
    },
  ];

  it('reads richsync, each character run at its own offset', () => {
    const text = JSON.stringify(RICHSYNC);
    expect(readLyricsFormat(text).format).toBe('richsync');
    expect(starts(text)).toEqual([
      [7930, 'Salt on the rope'],
      [10200, 'Gulls'],
      [12000, ''],
    ]);
    expect(wordStarts(text)).toEqual([
      [7930, 'Salt '],
      [8410, 'on '],
      [8700, 'the '],
      [9120, 'rope'],
    ]);
  });

  it('reads richsync inside the API envelope, where its body is a string', () => {
    const text = JSON.stringify({
      message: {
        header: { status_code: 200 },
        body: { richsync: { richsync_body: JSON.stringify(RICHSYNC) } },
      },
    });
    expect(starts(text)).toEqual(starts(JSON.stringify(RICHSYNC)));
  });

  it('reads Musixmatch subtitles as lines', () => {
    const text = JSON.stringify([
      { text: 'Salt on the rope', time: { total: 7.93, minutes: 0 } },
      { text: 'Gulls over the ferry', time: { total: 14, minutes: 0 } },
    ]);
    expect(readLyricsFormat(text).format).toBe('musixmatch-subtitle');
    expect(starts(text)).toEqual([
      [7930, 'Salt on the rope'],
      [14000, 'Gulls over the ferry'],
    ]);
  });

  it('reads Spotify’s lines, an instrumental note as a pause', () => {
    const text = JSON.stringify({
      lyrics: {
        syncType: 'LINE_SYNCED',
        lines: [
          { startTimeMs: '7930', words: 'Salt on the rope', endTimeMs: '0' },
          { startTimeMs: '11000', words: '♪', endTimeMs: '0' },
          {
            startTimeMs: '14000',
            words: 'Gulls over the ferry',
            endTimeMs: '0',
          },
        ],
      },
    });
    expect(readLyricsFormat(text).format).toBe('spotify');
    expect(starts(text)).toEqual([
      [7930, 'Salt on the rope'],
      [11000, ''],
      [14000, 'Gulls over the ferry'],
    ]);
  });
});

describe('plain text and the import', () => {
  it('takes a dropped file of every format it reads, and no other', () => {
    [
      'a.lrc',
      'a.ELRC',
      'a.txt',
      'a.srt',
      'a.vtt',
      'a.ttml',
      'a.xml',
      'a.json',
      'a.yaml',
      'a.yml',
    ].forEach((name) => expect(isLyricsFileName(name)).toBe(true));
    ['a.mp3', 'a.docx', 'a.lrc.exe'].forEach((name) =>
      expect(isLyricsFileName(name)).toBe(false),
    );
  });

  it('keeps plain words exactly as they came', () => {
    const text = 'Salt on the rope\nGulls over the ferry\n';
    expect(readLyricsFormat(text).format).toBe('plain');
    expect(lyricsAsKeptText(text)).toBe(text);
    expect(checkLyricsImport(text)).toMatchObject({
      ok: true,
      extension: '.txt',
    });
  });

  it('keeps any timed format with the song as an Enhanced LRC', () => {
    const check = checkLyricsImport(YAML);
    expect(check).toMatchObject({ ok: true, extension: '.lrc' });
    expect(check.ok && check.text).toContain(
      '[00:07.93]<00:07.93>Salt <00:08.41>on <00:08.70>the <00:09.12>rope',
    );
  });

  it('calls a timed file with no words in it, or other data, empty', () => {
    expect(checkLyricsImport('{"lines": []}')).toMatchObject({
      ok: false,
      reason: 'empty',
    });
    expect(checkLyricsImport('{"tracks": [1, 2]}')).toMatchObject({
      ok: false,
      reason: 'empty',
    });
    expect(
      checkLyricsImport('WEBVTT\n\n00:01.000 --> 00:02.000\n\n'),
    ).toMatchObject({ ok: false, reason: 'empty' });
  });
});
