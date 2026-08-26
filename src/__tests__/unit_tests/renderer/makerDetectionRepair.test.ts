/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerProject,
  createKaraokeMakerProject,
} from 'common/karaoke/makerProject';
import { IKaraokeSong } from 'common/karaoke/types';
import {
  mergeKaraokeMakerDetectionRepair,
  protectKaraokeMakerTimedWordsForDetection,
} from 'renderer/karaoke/makerDetectionRepair';

const song = (): IKaraokeSong => ({
  id: 'repair-song',
  title: 'Repair song',
  durationMs: 10_000,
  assets: [],
  lines: [],
  timingPrecision: 'none',
  pitch: { kind: 'none', reason: 'missing' },
  meta: { sourceFormat: 'plain', gapMs: 0 },
});

const baselineProject = (): IKaraokeMakerProject => {
  const empty = createKaraokeMakerProject(song());
  return {
    ...empty,
    lyrics: {
      ...empty.lyrics,
      lines: [
        {
          id: 'line-1',
          startMs: 900,
          endMs: 1_900,
          tokens: [
            {
              id: 'timed-word',
              text: 'already',
              startsWord: true,
              startMs: 1_000,
              endMs: 1_300,
              confidence: 0.91,
              source: 'whisper',
            },
            {
              id: 'missing-word',
              text: 'missing',
              startsWord: true,
              source: 'manual',
            },
          ],
        },
      ],
    },
    melody: {
      ...empty.melody,
      notes: [
        {
          id: 'protected-note',
          tokenId: 'timed-word',
          startMs: 1_000,
          endMs: 1_300,
          targetMidi: 60,
          kind: 'normal',
          source: 'basic-pitch',
        },
        {
          id: 'manual-note',
          startMs: 2_000,
          endMs: 2_200,
          targetMidi: 64,
          kind: 'free',
          source: 'manual',
        },
      ],
    },
  };
};

describe('missing-word detection repair', () => {
  it('temporarily anchors every timed word without changing the project', () => {
    const baseline = baselineProject();
    const protectedProject =
      protectKaraokeMakerTimedWordsForDetection(baseline);

    expect(protectedProject.lyrics.lines[0].tokens[0].timingLocked).toBe(true);
    expect(protectedProject.lyrics.lines[0].tokens[1].timingLocked).toBeFalsy();
    expect(baseline.lyrics.lines[0].tokens[0].timingLocked).toBeUndefined();
  });

  it('keeps existing timing and note links while publishing new repairs', () => {
    const baseline = baselineProject();
    const detected: IKaraokeMakerProject = {
      ...baseline,
      lyrics: {
        ...baseline.lyrics,
        lines: [
          {
            ...baseline.lyrics.lines[0],
            startMs: 900,
            endMs: 1_800,
            tokens: [
              {
                ...baseline.lyrics.lines[0].tokens[0],
                startMs: 900,
                endMs: 1_150,
                confidence: 0.4,
                source: 'auto-align',
                timingLocked: true,
              },
              {
                ...baseline.lyrics.lines[0].tokens[1],
                startMs: 1_350,
                endMs: 1_800,
                confidence: 0.84,
                source: 'whisper',
              },
            ],
          },
        ],
      },
      melody: {
        ...baseline.melody,
        notes: [
          {
            id: 'replacement-protected-note',
            tokenId: 'timed-word',
            startMs: 900,
            endMs: 1_150,
            targetMidi: 61,
            kind: 'normal',
            source: 'basic-pitch',
          },
          {
            id: 'missing-note',
            tokenId: 'missing-word',
            startMs: 1_350,
            endMs: 1_800,
            targetMidi: 62,
            kind: 'normal',
            source: 'basic-pitch',
          },
        ],
      },
    };

    const repaired = mergeKaraokeMakerDetectionRepair(baseline, detected);
    const [existing, missing] = repaired.lyrics.lines[0].tokens;

    expect(existing).toMatchObject({
      startMs: 1_000,
      endMs: 1_300,
      confidence: 0.91,
      source: 'whisper',
      timingLocked: undefined,
    });
    expect(missing).toMatchObject({
      startMs: 1_350,
      endMs: 1_800,
      confidence: 0.84,
      source: 'whisper',
    });
    expect(repaired.lyrics.lines[0]).toMatchObject({
      startMs: 900,
      endMs: 1_900,
    });
    expect(repaired.melody.notes.map((note) => note.id)).toEqual([
      'protected-note',
      'missing-note',
      'manual-note',
    ]);
    expect(
      repaired.melody.notes.find((note) => note.id === 'protected-note'),
    ).toMatchObject({
      tokenId: 'timed-word',
      startMs: 1_000,
      endMs: 1_300,
      targetMidi: 60,
    });
  });
});
