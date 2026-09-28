/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createKaraokeMakerProject,
  parseKaraokeMakerProject,
} from '../../../common/karaoke/makerProject';
import { IKaraokeSong } from '../../../common/karaoke/types';

/**
 * A saved Maker project is read back through the parser, and every field it
 * takes has to survive being absent, wrong-typed or hostile. Lyric tokens that
 * end before they start were already refused; melody notes were not, and went
 * on to the pitch lane as the singer's target with no length or a negative one.
 */

const audioFile = new File(['audio'], 'Artist - Song.mp3', {
  type: 'audio/mpeg',
  lastModified: 42,
});

const song = (): IKaraokeSong => ({
  id: 'song-1',
  title: 'Song',
  artist: 'Artist',
  durationMs: 8_000,
  assets: [{ id: 'audio', role: 'audio', extension: 'mp3', file: audioFile }],
  timingPrecision: 'syllable',
  lines: [
    {
      id: 'line-1',
      startMs: 1_000,
      endMs: 2_000,
      tokens: [
        {
          text: 'Hel',
          startsWord: true,
          startMs: 1_000,
          endMs: 1_500,
          targetMidi: 60,
        },
        {
          text: 'lo',
          startsWord: false,
          startMs: 1_500,
          endMs: 2_000,
          targetMidi: 62,
        },
      ],
    },
  ],
  pitch: {
    kind: 'notes',
    source: 'fixture',
    coordinateSystem: 'midi-semitones',
    octavePolicy: 'absolute',
    notes: [
      { text: 'Hel', startMs: 1_000, endMs: 1_500, targetMidi: 60 },
      { text: 'lo', startMs: 1_500, endMs: 2_000, targetMidi: 62 },
    ],
  },
  meta: { sourceFormat: 'ultrastar', gapMs: 100, bpm: 120 },
});

describe('melody notes read back from a saved project', () => {
  it('keeps only the notes that start before they end', () => {
    const project = createKaraokeMakerProject(song());
    const [kept] = project.melody.notes;
    project.melody.notes = [
      kept,
      { ...kept, id: 'reversed', startMs: 3_000, endMs: 2_500 },
      { ...kept, id: 'no-length', startMs: 3_000, endMs: 3_000 },
      { ...kept, id: 'before-zero', startMs: -500, endMs: 200 },
    ];

    const restored = parseKaraokeMakerProject(JSON.stringify(project));

    // The first is the control: an ordinary note survives the same pass.
    expect(restored.melody.notes.map((note) => note.id)).toEqual([kept.id]);
  });
});
