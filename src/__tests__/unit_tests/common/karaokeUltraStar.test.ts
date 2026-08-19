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

  // Two breaks, both in the two-number form real relative files use. The
  // single-break test above passes whether the origin is assigned or added,
  // which is exactly why it never caught the origin failing to advance: every
  // line after the second used to land on top of the one before it.
  it('accumulates the relative origin across several line breaks', () => {
    const parsed = parseUltraStar(
      [
        '#TITLE:Relative',
        '#BPM:120',
        '#RELATIVE:YES',
        ': 0 4 0 One',
        '- 20 20',
        ': 0 4 0 Two',
        '- 20 20',
        ': 0 4 0 Three',
        'E',
      ].join('\n'),
    );
    expect(parsed.lines.map((line) => line.startMs)).toEqual([0, 2_500, 5_000]);
  });

  it('reads rap notes instead of failing the whole song', () => {
    const parsed = parseUltraStar(
      '#BPM:120\n: 0 4 0 Sing\nR 4 4 0  rap\nG 8 4 0  gold\nE',
    );
    expect(parsed.lines.flatMap((line) => line.tokens)).toEqual([
      expect.objectContaining({ text: 'Sing', kind: 'normal' }),
      expect.objectContaining({ text: ' rap', kind: 'free' }),
      expect.objectContaining({ text: ' gold', kind: 'free' }),
    ]);
  });

  it('treats a zero-length note as freestyle rather than an unhittable target', () => {
    const parsed = parseUltraStar('#BPM:120\n: 0 0 4 Blip\n: 4 4 4 Real\nE');
    expect(parsed.lines[0].tokens.map((token) => token.kind)).toEqual([
      'free',
      'normal',
    ]);
  });

  it('skips lines it does not recognise and stops at the end marker', () => {
    const parsed = parseUltraStar(
      [
        '#BPM:120',
        ': 0 4 0 One',
        'B 8 140',
        'ripped by someone, 2004',
        ': 4 4 0  two',
        'E',
        'trailing credits nobody should read',
      ].join('\n'),
    );
    expect(parsed.lines.flatMap((line) => line.tokens)).toHaveLength(2);
  });

  // The format defines the note type as any visible ASCII but space and `#`,
  // and says an implementation MAY substitute freestyle for one it does not
  // model. It does not say drop the syllable — which is what a narrower
  // marker class did, losing the word with no error and no count.
  it('keeps the lyric of a note type it does not model', () => {
    const parsed = parseUltraStar(
      '#BPM:120\n: 0 4 0 keep\nX 4 4 0  strange\n: 8 4 0  keep2\nE',
    );
    expect(parsed.lines.flatMap((line) => line.tokens)).toEqual([
      expect.objectContaining({ text: 'keep', kind: 'normal' }),
      expect.objectContaining({ text: ' strange', kind: 'free' }),
      expect.objectContaining({ text: ' keep2', kind: 'normal' }),
    ]);
  });

  it('still names a row that claims to be a note and is not', () => {
    let thrown: unknown;
    try {
      parseUltraStar('#BPM:120\n: 0 four 0 One\nE');
    } catch (error) {
      thrown = error;
    }
    expect((thrown as KaraokeParseError).code).toBe('malformed-note');
    expect((thrown as KaraokeParseError).line).toBe(2);
  });

  it('prefers #AUDIO over the deprecated #MP3 and never falls back to #VIDEO', () => {
    expect(
      parseUltraStar(
        '#BPM:120\n#MP3:legacy.mp3\n#AUDIO:current.ogg\n: 0 4 0 One\nE',
      ).audioFileName,
    ).toBe('current.ogg');
    expect(
      parseUltraStar('#BPM:120\n#VIDEO:clip.avi\n: 0 4 0 One\nE').audioFileName,
    ).toBeUndefined();
  });

  it('reports no video gap when the song does not declare one', () => {
    expect(
      parseUltraStar('#BPM:120\n: 0 4 0 One\nE').videoGapMs,
    ).toBeUndefined();
    expect(
      parseUltraStar('#BPM:120\n#VIDEOGAP:4,5\n: 0 4 0 One\nE').videoGapMs,
    ).toBe(4_500);
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
    // The duet spellings current files actually use: `#P1`/`#P2` headers and
    // the spaced player row. Recognising only `#DUETSINGERP1` meant a modern
    // duet was reported as a broken file rather than an unsupported one.
    ['#BPM:120\n#P1:Ann\n#P2:Bob\n: 0 4 0 Text\nE', 'unsupported-variant'],
    ['#BPM:120\nP 1\n: 0 4 0 Text\nE', 'unsupported-variant'],
    // Three voices, not two: the format goes to `#P9`, and merging a third
    // singer into one track in silence is the failure this guards.
    ['#BPM:120\nP3\n: 0 4 0 Alice\nP4\n: 4 4 0 Bob\nE', 'unsupported-variant'],
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
