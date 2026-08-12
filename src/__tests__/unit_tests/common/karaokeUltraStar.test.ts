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
import { parseUltraStar } from '../../../common/karaoke/ultrastar';
import { KaraokeParseError } from '../../../common/karaoke/types';

const fixture = (name: string) =>
  fs.readFileSync(
    path.join(__dirname, '../../data/read_only/karaoke', name),
    'utf8',
  );

describe('UltraStar parser', () => {
  it('normalizes metadata, timing, note types and real target notes', () => {
    const parsed = parseUltraStar(fixture('sample-ultrastar.txt'));

    expect(parsed).toMatchObject({
      title: 'Neon Measure',
      artist: 'FluidEQ Test Artist',
      audioFileName: 'Neon Measure.ogg',
      timingPrecision: 'syllable',
      bpm: 120,
      gapMs: 500,
      sourceFormat: 'ultrastar',
    });
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0]).toMatchObject({ startMs: 500, endMs: 1_500 });
    expect(parsed.lines[0].tokens).toEqual([
      expect.objectContaining({
        text: 'Sing',
        targetMidi: 60,
        kind: 'normal',
      }),
      expect.objectContaining({ text: ' it', targetMidi: 62 }),
    ]);
    expect(parsed.lines[1].tokens).toEqual([
      expect.objectContaining({ text: 'bright', kind: 'golden' }),
      expect.objectContaining({ text: ' tonight', kind: 'free' }),
    ]);
    expect(parsed.pitch.kind).toBe('notes');
    expect(parsed.pitch).toMatchObject({
      source: 'ultrastar',
      coordinateSystem: 'midi-semitones',
      octavePolicy: 'nearest-target',
    });
  });

  it('supports comma BPM and line-relative positions', () => {
    const parsed = parseUltraStar(
      '#TITLE:Relative\n#BPM:120,0\n#RELATIVE:YES\n: 0 4 0 One\n- 20\n: 0 4 2 Two\nE',
    );
    expect(parsed.lines.map((line) => line.startMs)).toEqual([0, 2_500]);
  });

  it('preserves word boundaries and melisma duration across lyric lines', () => {
    const parsed = parseUltraStar(
      '#TITLE:Words\n#BPM:120\n: 0 2 4 rou\n: 2 2 4 ~nd\n-\n: 8 2 5 A\n: 10 2 5 bout\n: 12 2 5 ~\nE',
    );

    expect(parsed.lines.flatMap((line) => line.tokens)).toEqual([
      expect.objectContaining({
        text: 'rou',
        startsWord: true,
        startMs: 0,
        endMs: 250,
      }),
      expect.objectContaining({
        text: 'nd',
        startsWord: false,
        startMs: 250,
        endMs: 500,
      }),
      expect.objectContaining({
        text: 'A',
        startsWord: true,
        startMs: 1_000,
        endMs: 1_250,
      }),
      expect.objectContaining({
        text: 'bout',
        startsWord: false,
        startMs: 1_250,
        endMs: 1_500,
      }),
      expect.objectContaining({
        text: '',
        startsWord: false,
        startMs: 1_500,
        endMs: 1_750,
      }),
    ]);
  });

  it.each([
    ['#TITLE:No BPM\n: 0 4 0 Text\nE', 'missing-bpm'],
    ['#BPM:120\nP1\n: 0 4 0 Text\nE', 'unsupported-variant'],
    ['#BPM:120\nR 0 4 0 Rap\nE', 'malformed-note'],
  ])('rejects malformed or unsupported variants', (contents, code) => {
    let thrown: unknown;
    try {
      parseUltraStar(contents);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(KaraokeParseError);
    expect((thrown as KaraokeParseError).code).toBe(code);
  });
});
