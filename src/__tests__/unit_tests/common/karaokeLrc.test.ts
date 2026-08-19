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

import fs from 'fs';
import path from 'path';
import { parseLrc } from '../../../common/karaoke/lrc';
import { KaraokeParseError } from '../../../common/karaoke/types';

const fixture = (name: string) =>
  fs.readFileSync(
    path.join(__dirname, '../../data/read_only/karaoke', name),
    'utf8',
  );

describe('LRC parser', () => {
  it('handles BOM, metadata, offset, multiple timestamps and enhanced words', () => {
    const parsed = parseLrc(fixture('enhanced.lrc').replace(/\n/g, '\r\n'));

    expect(parsed.title).toBe('Clockwork Lights');
    expect(parsed.artist).toBe('FluidEQ Test Artist');
    expect(parsed.sourceFormat).toBe('elrc');
    expect(parsed.timingPrecision).toBe('word');
    // The fixture carries `[offset:-100]`, which DELAYS the words by 100 ms.
    expect(parsed.lines.map((line) => line.startMs)).toEqual([
      2_100, 4_100, 12_100,
    ]);
    expect(parsed.lines[0].tokens).toEqual([
      {
        text: 'Clock',
        startsWord: true,
        startMs: 2_100,
        endMs: 2_600,
      },
      {
        text: 'work ',
        startsWord: false,
        startMs: 2_600,
        endMs: 3_100,
      },
      {
        text: 'lights',
        startsWord: true,
        startMs: 3_100,
        endMs: 4_100,
      },
    ]);
    // The repeat ten seconds later carries its word times with it rather than
    // replaying the first copy's, which arrived already fully sung.
    expect(parsed.lines[2].tokens.map((token) => token.startMs)).toEqual([
      12_100, 12_600, 13_100,
    ]);
  });

  // A negative offset delays the words, a positive one brings them forward:
  // the effective time is `timestamp − offset`. The parser used to add it,
  // which moved every offset file by twice its own correction the wrong way.
  it('sorts out-of-order lines and applies the offset in the direction LRC means', () => {
    const parsed = parseLrc('[offset:-2000]\n[00:03.00]Later\n[00:01]First');
    expect(parsed.lines.map((line) => line.startMs)).toEqual([3_000, 5_000]);
    expect(parsed.lines[0].endMs).toBe(5_000);
    expect(parseLrc('[offset:+500]\n[00:10.00]Sooner').lines[0].startMs).toBe(
      9_500,
    );
    // `gapMs` says when the singing starts, which LRC cannot express — and
    // the offset is already inside the times above, so repeating it here made
    // the UltraStar export subtract it twice.
    expect(parsed.gapMs).toBe(0);
  });

  it('keeps common timed section markers separate from sung lyrics', () => {
    const parsed = parseLrc(
      '[00:01.00][Intro]\n[00:03.00]First line\n[00:06.00][Chorus 2]',
    );
    expect(parsed.lines.map((line) => line.kind)).toEqual([
      'section',
      'lyrics',
      'section',
    ]);
    expect(parsed.lines[0].tokens[0].text).toBe('[Intro]');
  });

  it.each(['', '[ar:Nobody]\nNo timestamps'])(
    'rejects an empty or untimed document',
    (contents) => {
      expect(() => parseLrc(contents)).toThrow(KaraokeParseError);
    },
  );

  it('marks a bracketed heading as a section in any language', () => {
    const parsed = parseLrc(
      [
        '[00:01.00][Estribillo]',
        '[00:03.00][サビ]',
        '[00:05.00][Verse 2: Kendrick]',
        '[00:07.00][Припев]',
        '[00:09.00]An actual sung line',
      ].join('\n'),
    );
    expect(parsed.lines.map((line) => line.kind)).toEqual([
      'section',
      'section',
      'section',
      'section',
      'lyrics',
    ]);
  });

  // The expensive mistake runs the other way: a heading is skipped in the
  // singing lane, so calling a real line a heading deletes it from the song.
  // Bracketed ad-libs are written exactly like headings and are sung.
  it('does not mistake a bracketed ad-lib for a heading', () => {
    const parsed = parseLrc(
      [
        '[00:01.00][Ooh ooh ooh]',
        '[00:03.00][x2]',
        '[00:05.00][Laughing]',
        '[00:07.00][Chorus]',
      ].join('\n'),
    );
    expect(parsed.lines.map((line) => line.kind)).toEqual([
      'lyrics',
      'lyrics',
      'lyrics',
      'section',
    ]);
  });

  // The closing stamp is written against the first occurrence, the same
  // anchor the word tags use, so a repeat carries it forward by its own
  // distance. Handing every copy the literal first end held the first line
  // open across the second.
  it('gives a repeated line its own closing time, not the first copy’s', () => {
    const parsed = parseLrc('[00:10.00][00:40.00]repeat me[00:15.00]');
    expect(parsed.lines.map((line) => [line.startMs, line.endMs])).toEqual([
      [10_000, 15_000],
      [40_000, 45_000],
    ]);
  });

  it('never leaves a line lit once the next one has started', () => {
    const parsed = parseLrc(
      '[00:10.00]held far too long[00:59.00]\n[00:20.00]next',
    );
    expect(parsed.lines.map((line) => [line.startMs, line.endMs])).toEqual([
      [10_000, 20_000],
      [20_000, undefined],
    ]);
  });

  it('carries a repeated line forward instead of replaying the first word times', () => {
    const parsed = parseLrc(
      '[00:10.00][01:00.00]<00:10.000>Star <00:10.500>light',
    );
    expect(
      parsed.lines.map((line) => line.tokens.map((token) => token.startMs)),
    ).toEqual([
      [10_000, 10_500],
      [60_000, 60_500],
    ]);
  });

  it('keeps the words before a mid-row timestamp, and reads a closing stamp as an end', () => {
    const split = parseLrc('[00:10.00]la la [00:20.00]la');
    expect(
      split.lines.map((line) => [
        line.startMs,
        line.tokens.map((token) => token.text).join(''),
      ]),
    ).toEqual([
      [10_000, 'la la '],
      [20_000, 'la'],
    ]);

    const closed = parseLrc('[00:40.00]Some words[00:43.00]');
    expect(closed.lines).toHaveLength(1);
    expect(closed.lines[0].tokens[0].text).toBe('Some words');
    expect(closed.lines[0].endMs).toBe(43_000);
  });

  it('reads the hour form and a millisecond fraction rather than dropping the row', () => {
    const parsed = parseLrc(
      [
        '[01:02:03.45]hour form',
        '[00:12.345]milliseconds',
        '[00:12:34]centiseconds',
      ].join('\n'),
    );
    expect(parsed.lines.map((line) => line.startMs)).toEqual([
      12_340, 12_345, 3_723_450,
    ]);
  });

  it('keeps one line per instant so no line is unreachable', () => {
    const parsed = parseLrc(
      ['[00:30.00]', '[00:30.00]The words', '[00:40.00]Later'].join('\n'),
    );
    expect(
      parsed.lines.map((line) => [
        line.startMs,
        line.tokens.map((token) => token.text).join(''),
      ]),
    ).toEqual([
      [30_000, 'The words'],
      [40_000, 'Later'],
    ]);
    // The positive control: a lone blank stamp is the instrumental marker and
    // must survive, or this dedupe would be silently deleting real lines.
    const instrumental = parseLrc('[00:30.00]\n[00:40.00]Later');
    expect(instrumental.lines).toHaveLength(2);
  });

  it('does not start a new word when an enhanced tag opens mid-word', () => {
    const parsed = parseLrc('[00:10.00]Hel<00:10.50>lo world');
    expect(
      parsed.lines[0].tokens.map((token) => [token.text, token.startsWord]),
    ).toEqual([
      ['Hel', undefined],
      ['lo world', false],
    ]);
  });
});
