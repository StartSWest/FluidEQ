import {
  createKaraokeMakerProject,
  makerLinesFromPlainText,
} from '../../../common/karaoke/makerProject';
import { IKaraokeSong } from '../../../common/karaoke/types';
import {
  autoAlignKaraokeMakerProject,
  autoAlignNewKaraokeMakerLyrics,
  karaokeMakerAnalysisNotesFromMelody,
} from '../../../renderer/karaoke/makerAlignment';
import {
  karaokeMakerResizedViewport,
  karaokeMakerViewportStart,
} from '../../../renderer/karaoke/KaraokeMakerNavigator';

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

describe('Karaoke Maker auto-alignment and the navigator', () => {
  it('auto-aligns replacement lyrics while preserving edited melody notes', () => {
    const project = createKaraokeMakerProject(song());
    project.meta.gapMs = 100;
    project.melody.notes[0].source = 'manual';
    const originalNote = { ...project.melody.notes[0] };
    project.lyrics.lines = makerLinesFromPlainText('New replacement lyrics');
    const guides = karaokeMakerAnalysisNotesFromMelody(project);
    const aligned = autoAlignNewKaraokeMakerLyrics(project, guides);

    expect(guides[0].startMs).toBe(originalNote.startMs);
    aligned.lyrics.lines[0].tokens.forEach((token) => {
      expect(token.startMs).toBeDefined();
      expect(token.endMs).toBeGreaterThan(token.startMs as number);
      expect(token.source).toBe('auto-align');
    });
    expect(aligned.melody.notes[0]).toMatchObject({
      id: originalNote.id,
      startMs: originalNote.startMs,
      endMs: originalNote.endMs,
      targetMidi: originalNote.targetMidi,
      source: 'manual',
    });
    expect(aligned.melody.notes[0].tokenId).toBeDefined();
  });

  it('aligns lyric lines to vocal phrases without filling silent gaps', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = [
      {
        id: 'first-line',
        tokens: [
          {
            id: 'first-word',
            text: 'First',
            startsWord: true,
            source: 'manual',
          },
          {
            id: 'phrase-word',
            text: 'phrase',
            startsWord: true,
            source: 'manual',
          },
        ],
      },
      {
        id: 'second-line',
        tokens: [
          {
            id: 'second-word',
            text: 'Second',
            startsWord: true,
            source: 'manual',
          },
          {
            id: 'ending-word',
            text: 'ending',
            startsWord: true,
            source: 'manual',
          },
        ],
      },
    ];
    const aligned = autoAlignKaraokeMakerProject(project, [
      { startMs: 1_000, endMs: 1_300, targetMidi: 60, confidence: 0.9 },
      { startMs: 1_340, endMs: 1_700, targetMidi: 62, confidence: 0.9 },
      { startMs: 5_000, endMs: 5_350, targetMidi: 64, confidence: 0.9 },
      { startMs: 5_390, endMs: 5_750, targetMidi: 65, confidence: 0.9 },
    ]);

    expect(aligned.lyrics.lines[0].tokens[1].endMs).toBeLessThan(2_000);
    expect(aligned.lyrics.lines[1].tokens[0].startMs).toBeGreaterThanOrEqual(
      5_000,
    );
  });

  it('auto-aligns only untouched words without overlapping protected work', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = [
      {
        id: 'line',
        tokens: [
          {
            id: 'locked',
            text: 'Keep',
            startsWord: true,
            startMs: 1_000,
            endMs: 1_800,
            source: 'manual',
            timingLocked: true,
          },
          {
            id: 'open-one',
            text: 'these',
            startsWord: true,
            source: 'manual',
          },
          {
            id: 'open-two',
            text: 'editable',
            startsWord: true,
            source: 'manual',
          },
        ],
      },
    ];
    project.melody.notes = [
      {
        id: 'locked-note',
        tokenId: 'locked',
        startMs: 1_000,
        endMs: 1_800,
        targetMidi: 60,
        kind: 'normal',
        source: 'manual',
      },
    ];

    const aligned = autoAlignKaraokeMakerProject(project, [
      { startMs: 1_100, endMs: 1_500, targetMidi: 59, confidence: 0.8 },
      { startMs: 2_000, endMs: 2_350, targetMidi: 62, confidence: 0.9 },
      { startMs: 2_380, endMs: 2_700, targetMidi: 64, confidence: 0.9 },
      { startMs: 3_500, endMs: 3_850, targetMidi: 65, confidence: 0.9 },
      { startMs: 3_880, endMs: 4_200, targetMidi: 67, confidence: 0.9 },
    ]);
    const alignedTokens = aligned.lyrics.lines[0].tokens;
    expect(alignedTokens[0]).toMatchObject({
      id: 'locked',
      startMs: 1_000,
      endMs: 1_800,
      source: 'manual',
      timingLocked: true,
    });
    expect(aligned.melody.notes).toContainEqual(
      expect.objectContaining({ id: 'locked-note', tokenId: 'locked' }),
    );
    const timed = alignedTokens.filter(
      (token) => token.startMs !== undefined && token.endMs !== undefined,
    );
    const ordered = [...timed].sort(
      (left, right) => (left.startMs as number) - (right.startMs as number),
    );
    ordered.slice(1).forEach((token, index) => {
      expect(token.startMs).toBeGreaterThanOrEqual(ordered[index].endMs ?? 0);
    });
    expect(aligned.melody.notes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ startMs: 1_100, endMs: 1_500 }),
      ]),
    );

    const firstPassTimes = alignedTokens.map((token) => [
      token.startMs,
      token.endMs,
    ]);
    const secondPass = autoAlignKaraokeMakerProject(aligned, [
      { startMs: 900, endMs: 1_300, targetMidi: 70, confidence: 1 },
      { startMs: 5_000, endMs: 5_500, targetMidi: 72, confidence: 1 },
    ]);
    expect(
      secondPass.lyrics.lines[0].tokens.map((token) => [
        token.startMs,
        token.endMs,
      ]),
    ).toEqual(firstPassTimes);
  });

  it('clamps the navigator viewport to the complete song', () => {
    expect(karaokeMakerViewportStart(-500, 20_000, 5_000)).toBe(0);
    expect(karaokeMakerViewportStart(8_000, 20_000, 5_000)).toBe(8_000);
    expect(karaokeMakerViewportStart(19_000, 20_000, 5_000)).toBe(15_000);
  });

  it('resizes the navigator from either edge while anchoring the other edge', () => {
    expect(
      karaokeMakerResizedViewport(
        'start',
        7_000,
        5_000,
        10_000,
        30_000,
        3_000,
        20_000,
      ),
    ).toEqual({ startMs: 7_000, durationMs: 8_000 });
    expect(
      karaokeMakerResizedViewport(
        'end',
        18_000,
        5_000,
        10_000,
        30_000,
        3_000,
        20_000,
      ),
    ).toEqual({ startMs: 5_000, durationMs: 13_000 });
  });

  it('clamps navigator edge resizing to its zoom and song limits', () => {
    expect(
      karaokeMakerResizedViewport(
        'start',
        14_000,
        5_000,
        10_000,
        30_000,
        3_000,
        20_000,
      ),
    ).toEqual({ startMs: 12_000, durationMs: 3_000 });
    expect(
      karaokeMakerResizedViewport(
        'end',
        40_000,
        20_000,
        5_000,
        30_000,
        3_000,
        20_000,
      ),
    ).toEqual({ startMs: 20_000, durationMs: 10_000 });
  });
});
