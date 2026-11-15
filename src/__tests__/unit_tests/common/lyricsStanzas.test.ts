/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Timed lines parted into the stanzas of the words as written (Ivan,
 * 2026-11-15: the song's page parts the verses five, five, four; its `.lrc`
 * stamps its pauses wherever the music rests). Every line here was written
 * for this test.
 */
import type { ILyricsLine } from '../../../common/library/lyrics';
import {
  stanzaLayoutOf,
  withStanzas,
} from '../../../common/library/lyricsStanzas';

/** A timed file: its empty lines are pauses, in the wrong places. */
const TIMED: ILyricsLine[] = [
  { timeMs: 1000, text: 'Salt on the rope' },
  { timeMs: 3000, text: 'Gulls over the ferry' },
  { timeMs: 4000, text: '' },
  { timeMs: 5000, text: 'Bells in the harbour' },
  { timeMs: 7000, text: 'Lamps on the water,' },
  { timeMs: 9000, text: 'Nets on the stone' },
  { timeMs: 10_000, text: '' },
];

const WRITTEN = [
  'Salt on the rope',
  'Gulls over the ferry',
  'Bells in the harbour',
  '',
  'Lamps on the water',
  'Nets on the stone',
].join('\n');

const textsOf = (lines: readonly ILyricsLine[] | undefined) =>
  lines?.map((line) => [line.timeMs, line.text]);

describe('the stanzas of the words as written', () => {
  it('parts the timed lines where the written words part, and drops the file’s own pauses', () => {
    const layout = stanzaLayoutOf({
      kind: 'plain',
      source: 'txt',
      text: WRITTEN,
    });
    expect(layout).toBeDefined();
    expect(textsOf(withStanzas(TIMED, layout ?? []))).toEqual([
      [1000, 'Salt on the rope'],
      [3000, 'Gulls over the ferry'],
      [5000, 'Bells in the harbour'],
      // Found despite the comma: punctuation and accents are not words.
      [6990, ''],
      [7000, 'Lamps on the water,'],
      [9000, 'Nets on the stone'],
    ]);
  });

  it('parts nothing with words that are another song', () => {
    const layout = stanzaLayoutOf({
      kind: 'plain',
      source: 'txt',
      text: 'A kettle on the stove\n\nA radio too low',
    });
    expect(withStanzas(TIMED, layout ?? [])).toBeUndefined();
  });

  it('offers no stanzas from words written in one block', () => {
    expect(
      stanzaLayoutOf({
        kind: 'plain',
        source: 'txt',
        text: 'Salt on the rope\nGulls over the ferry',
      }),
    ).toBeUndefined();
  });

  it('reads the stanzas of timed words that carry them', () => {
    const layout = stanzaLayoutOf({
      kind: 'synced',
      source: 'txt',
      lines: [
        { timeMs: 1000, text: 'Salt on the rope' },
        { timeMs: 4990, text: '' },
        { timeMs: 5000, text: 'Bells in the harbour' },
      ],
    });
    expect(layout?.map((line) => line.opens)).toEqual([false, true]);
  });
});
