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
    expect(parsed.lines.map((line) => line.startMs)).toEqual([
      1_900, 3_900, 11_900,
    ]);
    expect(parsed.lines[0].tokens).toEqual([
      {
        text: 'Clock',
        startsWord: true,
        startMs: 1_900,
        endMs: 2_400,
      },
      {
        text: 'work ',
        startsWord: false,
        startMs: 2_400,
        endMs: 2_900,
      },
      {
        text: 'lights',
        startsWord: true,
        startMs: 2_900,
        endMs: 3_900,
      },
    ]);
  });

  it('sorts out-of-order lines and keeps negative offsets measurable', () => {
    const parsed = parseLrc('[offset:-2000]\n[00:03.00]Later\n[00:01]First');
    expect(parsed.lines.map((line) => line.startMs)).toEqual([-1_000, 1_000]);
    expect(parsed.lines[0].endMs).toBe(1_000);
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
});
