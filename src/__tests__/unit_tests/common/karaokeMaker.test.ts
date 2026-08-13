/* FluidEQ Karaoke Maker tests. GPL-3.0-or-later. */

import {
  createKaraokeMakerProject,
  importLyricsIntoKaraokeMakerProject,
  karaokeMakerProjectToSong,
  karaokeMakerTokenWasUserTouched,
  makerLinesFromPlainText,
  parseKaraokeMakerProject,
  serializeKaraokeMakerProject,
  shiftKaraokeMakerFromToken,
  shiftKaraokeMakerTimeline,
  validateKaraokeMakerProject,
} from '../../../common/karaoke/makerProject';
import {
  exportKaraokeMakerLrc,
  exportKaraokeMakerUltraStar,
  karaokeMakerExportFileName,
} from '../../../common/karaoke/makerExport';
import { parseKaraokeText } from '../../../common/karaoke/files';
import { IKaraokeSong } from '../../../common/karaoke/types';
import {
  autoAlignKaraokeMakerProject,
  autoAlignNewKaraokeMakerLyrics,
  karaokeMakerAnalysisNotesFromMelody,
} from '../../../renderer/karaoke/makerAnalysis';
import {
  applyBasicPitchMelody,
  applyWhisperTranscript,
} from '../../../renderer/karaoke/makerAi';
import {
  karaokeMakerResizedViewport,
  karaokeMakerViewportStart,
} from '../../../renderer/karaoke/KaraokeMakerNavigator';
import {
  karaokeMakerLyricLane,
  karaokeMakerFittedLyricViewport,
  karaokeMakerLyricFocus,
  karaokeMakerNoteIsActive,
  karaokeMakerNoteProgress,
  karaokeMakerPannedViewportStart,
  karaokeMakerWordProgress,
  layoutKaraokeMakerAnchoredLyricLabels,
  layoutKaraokeMakerLyricLabels,
} from '../../../renderer/karaoke/makerCanvasLayout';

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

describe('Karaoke Maker section markers', () => {
  it('does not validate or auto-align section labels as sung words', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText(
      '[Verse 1]\nThis line is sung\n[Chorus]',
    );
    const aligned = autoAlignKaraokeMakerProject(project, [
      { startMs: 1_000, endMs: 2_000, targetMidi: 60, confidence: 0.9 },
      { startMs: 2_100, endMs: 3_000, targetMidi: 62, confidence: 0.9 },
      { startMs: 3_100, endMs: 4_000, targetMidi: 64, confidence: 0.9 },
    ]);
    const sections = aligned.lyrics.lines.filter(
      (line) => line.kind === 'section',
    );
    expect(sections).toHaveLength(2);
    expect(sections.every((line) => line.startMs !== undefined)).toBe(true);
    expect(
      aligned.melody.notes.some((note) =>
        sections.some((line) =>
          line.tokens.some((token) => token.id === note.tokenId),
        ),
      ),
    ).toBe(false);
    expect(
      validateKaraokeMakerProject(aligned).some((issue) =>
        issue.message.includes('[Verse 1]'),
      ),
    ).toBe(false);
  });
});

describe('Karaoke Maker canonical project and exports', () => {
  it('lays lyric labels across three lanes and lights words progressively', () => {
    expect(karaokeMakerLyricLane([120, 80, 160], 100, 0)).toBe(1);
    expect(karaokeMakerLyricLane([40, 180, 210], 100, 0)).toBe(0);
    expect(karaokeMakerWordProgress(1_000, 2_000, 500)).toBe(0);
    expect(karaokeMakerWordProgress(1_000, 2_000, 1_500)).toBe(0.5);
    expect(karaokeMakerWordProgress(1_000, 2_000, 2_500)).toBe(1);
    expect(karaokeMakerNoteIsActive(1_000, 2_000, 999)).toBe(false);
    expect(karaokeMakerNoteIsActive(1_000, 2_000, 1_000)).toBe(true);
    expect(karaokeMakerNoteIsActive(1_000, 2_000, 1_999)).toBe(true);
    expect(karaokeMakerNoteIsActive(1_000, 2_000, 2_000)).toBe(false);
    expect(karaokeMakerNoteProgress(1_000, 2_000, 1_250)).toBe(0.25);
    expect(
      karaokeMakerPannedViewportStart(10_000, 100, 1_000, 5_000, 20_000),
    ).toBe(9_500);
    expect(
      karaokeMakerPannedViewportStart(100, 1_000, 1_000, 5_000, 20_000),
    ).toBe(0);
    const packed = layoutKaraokeMakerLyricLabels(
      [
        { id: 'one', naturalLeft: 10, width: 45, preferredLane: 0 },
        { id: 'two', naturalLeft: 28, width: 52, preferredLane: 0 },
        { id: 'three', naturalLeft: 46, width: 48, preferredLane: 0 },
        { id: 'four', naturalLeft: 62, width: 44, preferredLane: 0 },
      ],
      0,
      180,
    );
    expect(new Set(packed.map((label) => label.lane)).size).toBe(3);
    packed.forEach((label) => {
      expect(label.left).toBeGreaterThanOrEqual(0);
      expect(label.left + label.width).toBeLessThanOrEqual(180);
    });
    for (let lane = 0; lane < 3; lane += 1) {
      const row = packed.filter((label) => label.lane === lane);
      row.slice(1).forEach((label, index) => {
        expect(label.left).toBeGreaterThanOrEqual(
          row[index].left + row[index].width + 12,
        );
      });
    }
  });

  it('keeps one active lyric word when imported timings overlap', () => {
    const focus = karaokeMakerLyricFocus(
      [
        {
          id: 'old-line-word',
          lineIndex: 0,
          lineStartMs: 1_000,
          lineEndMs: 3_000,
          startMs: 1_900,
          endMs: 2_600,
        },
        {
          id: 'new-line-first',
          lineIndex: 1,
          lineStartMs: 2_000,
          lineEndMs: 3_500,
          startMs: 2_000,
          endMs: 2_700,
        },
        {
          id: 'new-line-latest',
          lineIndex: 1,
          lineStartMs: 2_000,
          lineEndMs: 3_500,
          startMs: 2_400,
          endMs: 3_000,
        },
      ],
      2_500,
    );

    expect(focus).toEqual({ lineIndex: 1, tokenId: 'new-line-latest' });
    expect(
      karaokeMakerLyricFocus(
        [
          {
            id: 'first',
            lineIndex: 0,
            lineStartMs: 1_000,
            lineEndMs: 2_000,
            startMs: 1_000,
            endMs: 1_500,
          },
          {
            id: 'second',
            lineIndex: 0,
            lineStartMs: 1_000,
            lineEndMs: 2_000,
            startMs: 1_500,
            endMs: 2_000,
          },
        ],
        1_500,
      )?.tokenId,
    ).toBe('second');
  });

  it('keeps dense lyric culling stable when playback focus changes', () => {
    const labels = [
      { id: 'a', naturalLeft: 40, width: 50, preferredLane: 0 },
      { id: 'b', naturalLeft: 45, width: 50, preferredLane: 0 },
      { id: 'c', naturalLeft: 50, width: 50, preferredLane: 0 },
      {
        id: 'active',
        naturalLeft: 55,
        width: 50,
        preferredLane: 0,
        priority: 100,
      },
    ];
    const placed = layoutKaraokeMakerAnchoredLyricLabels(labels, 0, 200);
    expect(placed.map((label) => label.id)).toEqual(['a', 'b', 'c']);
    placed.forEach((label) => {
      expect(label.left).toBe(label.naturalLeft);
    });
  });

  it('finds a stable lyric-fit zoom without moving labels off their time', () => {
    const labels = [0, 100, 200, 300].map((offset, index) => ({
      id: `word-${index}`,
      startMs: 1_000 + offset,
      endMs: 1_080 + offset,
      width: 70,
      preferredLane: 0,
    }));
    const fitted = karaokeMakerFittedLyricViewport(
      labels,
      1_150,
      300,
      10_000,
      400,
    );

    expect(fitted.durationMs).toBeGreaterThanOrEqual(400);
    expect(fitted.durationMs).toBeLessThan(10_000);
    expect(fitted.startMs).toBeLessThanOrEqual(1_150);
    expect(fitted.startMs + fitted.durationMs).toBeGreaterThanOrEqual(1_150);
  });

  it('round-trips a bounded versioned draft', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines[0].tokens[0].timingLocked = true;
    const restored = parseKaraokeMakerProject(
      serializeKaraokeMakerProject(project),
    );

    expect(restored).toMatchObject({
      version: 1,
      id: 'maker-song-1',
      title: 'Song',
      audio: { name: 'Artist - Song.mp3' },
      meta: { bpm: 120, gapMs: 100 },
    });
    expect(restored.lyrics.lines[0].tokens).toHaveLength(2);
    expect(restored.lyrics.lines[0].tokens[0].timingLocked).toBe(true);
    expect(restored.melody.notes).toHaveLength(2);
  });

  it('distinguishes explicitly adjusted words from automatic timing', () => {
    expect(karaokeMakerTokenWasUserTouched({ timingLocked: true })).toBe(true);
    expect(karaokeMakerTokenWasUserTouched({ timingLocked: false })).toBe(
      false,
    );
    expect(karaokeMakerTokenWasUserTouched({})).toBe(false);
  });

  it('opens already-timed imported lyrics and pitch as editable content', () => {
    const project = createKaraokeMakerProject(song());

    expect(project.lyrics.source).toBe('imported');
    expect(project.lyrics.lines[0].tokens).toEqual([
      expect.objectContaining({
        text: 'Hel',
        startsWord: true,
        startMs: 1_000,
        endMs: 1_500,
        source: 'imported',
      }),
      expect.objectContaining({
        text: 'lo',
        startsWord: false,
        startMs: 1_500,
        endMs: 2_000,
        source: 'imported',
      }),
    ]);
    expect(project.melody.source).toBe('imported');
    expect(project.melody.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          startMs: 1_000,
          endMs: 1_500,
          targetMidi: 60,
          source: 'imported',
        }),
      ]),
    );
  });

  it('preserves multiple melody notes connected to one lyric token', () => {
    const project = createKaraokeMakerProject(song());
    const word = project.lyrics.lines[0].tokens[0];
    project.melody.notes = [
      {
        id: 'a',
        tokenId: word.id,
        startMs: 1_000,
        endMs: 1_300,
        targetMidi: 60,
        kind: 'normal',
        source: 'manual',
      },
      {
        id: 'b',
        tokenId: word.id,
        startMs: 1_300,
        endMs: 1_800,
        targetMidi: 64,
        kind: 'golden',
        source: 'manual',
      },
    ];

    const playable = karaokeMakerProjectToSong(project, song().assets[0]);
    expect(playable.pitch.kind).toBe('notes');
    expect(playable.lines[0].tokens).toEqual([
      expect.objectContaining({
        text: 'Hel',
        startsWord: true,
        targetMidi: 60,
      }),
      expect.objectContaining({
        text: '',
        startsWord: false,
        targetMidi: 64,
        kind: 'golden',
      }),
      expect.objectContaining({ text: 'lo', startsWord: false }),
    ]);
  });

  it('keeps the original imported karaoke asset when applying editor timing', () => {
    const original = song();
    const lyricsFile = new File(['timed lyrics'], 'Artist - Song.txt', {
      type: 'text/plain',
    });
    const lyricsAsset = {
      id: 'lyrics',
      role: 'lyrics' as const,
      extension: 'txt',
      file: lyricsFile,
    };
    const playable = karaokeMakerProjectToSong(
      createKaraokeMakerProject(original),
      original.assets[0],
      [...original.assets, lyricsAsset],
    );

    expect(playable.assets).toContain(original.assets[0]);
    expect(playable.assets).toContain(lyricsAsset);
    expect(playable.lines[0].tokens.map((token) => token.text)).toEqual([
      'Hel',
      'lo',
    ]);
  });

  it('validates bad timing and emits interoperable LRC and UltraStar text', () => {
    const project = createKaraokeMakerProject(song());
    project.meta.rightsConfirmed = true;
    project.lyrics.lines[0].tokens[0].endMs = 500;
    expect(validateKaraokeMakerProject(project)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-word-time',
          severity: 'error',
        }),
      ]),
    );
    project.lyrics.lines[0].tokens[0].endMs = 1_500;
    const lrc = exportKaraokeMakerLrc(project, true);
    const ultrastar = exportKaraokeMakerUltraStar(project);
    expect(lrc).toContain('[ti:Song]');
    expect(lrc).toContain('<00:01.000>Hel');
    expect(ultrastar).toContain('#CREATOR:FluidEQ Karaoke Maker');
    expect(ultrastar).toContain('#BPM:120');
    expect(ultrastar.trimEnd()).toMatch(/\nE$/);
    expect(karaokeMakerExportFileName(project, 'project')).toBe(
      'Artist - Song.fluideq-karaoke.json',
    );
  });

  it('rejects unknown project versions', () => {
    expect(() =>
      parseKaraokeMakerProject('{"version":99,"id":"future"}'),
    ).toThrow(/Unsupported/);
  });

  it('moves all timed lyrics and linked melody notes as one unit', () => {
    const project = createKaraokeMakerProject(song());
    const shifted = shiftKaraokeMakerTimeline(project, 375);

    expect(shifted.lyrics.lines[0].tokens[0]).toMatchObject({
      startMs: 1_375,
      endMs: 1_875,
    });
    expect(shifted.melody.notes[0]).toMatchObject({
      startMs: 1_375,
      endMs: 1_875,
    });
    expect(shifted.meta.gapMs).toBe(475);

    const clamped = shiftKaraokeMakerTimeline(shifted, -10_000);
    expect(clamped.lyrics.lines[0].tokens[0].startMs).toBe(0);
    expect(clamped.melody.notes[0].startMs).toBe(0);
  });

  it('moves lyrics from a selected word while preserving the synced prefix', () => {
    const project = createKaraokeMakerProject(song());
    const [first, second] = project.lyrics.lines[0].tokens;
    const shifted = shiftKaraokeMakerFromToken(project, second.id, 725);

    expect(shifted.lyrics.lines[0].tokens[0]).toMatchObject({
      id: first.id,
      startMs: 1_000,
      endMs: 1_500,
    });
    expect(shifted.lyrics.lines[0].tokens[1]).toMatchObject({
      id: second.id,
      startMs: 2_225,
      endMs: 2_725,
      source: 'manual',
      timingLocked: true,
    });
    expect(shifted.melody.notes[0].startMs).toBe(1_000);
    expect(shifted.melody.notes[1]).toMatchObject({
      startMs: 2_225,
      endMs: 2_725,
    });
    expect(shifted.meta.gapMs).toBe(project.meta.gapMs);

    const clamped = shiftKaraokeMakerFromToken(shifted, second.id, -10_000);
    expect(clamped.lyrics.lines[0].tokens[0].endMs).toBe(1_500);
    expect(clamped.lyrics.lines[0].tokens[1].startMs).toBe(1_500);
  });

  it('imports every interoperable text format that the maker exports', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines.push({
      id: 'second-line',
      tokens: [
        {
          id: 'second-line-word',
          text: 'Again',
          startsWord: true,
          startMs: 3_000,
          endMs: 3_500,
          source: 'manual',
        },
      ],
    });
    project.melody.notes.push({
      id: 'second-line-note',
      tokenId: 'second-line-word',
      startMs: 3_000,
      endMs: 3_500,
      targetMidi: 65,
      kind: 'normal',
      source: 'manual',
    });
    const lrc = exportKaraokeMakerLrc(project, false);
    const elrc = exportKaraokeMakerLrc(project, true);
    const ultrastar = exportKaraokeMakerUltraStar(project);

    const parsedLrc = parseKaraokeText('song.lrc', lrc);
    const parsedElrc = parseKaraokeText('song.elrc', elrc);
    const parsedUltraStar = parseKaraokeText('song.txt', ultrastar);
    expect(parsedLrc).toMatchObject({
      sourceFormat: 'lrc',
      title: 'Song',
    });
    expect(parsedElrc).toMatchObject({
      sourceFormat: 'elrc',
      timingPrecision: 'word',
    });
    expect(parsedUltraStar).toMatchObject({
      sourceFormat: 'ultrastar',
      timingPrecision: 'syllable',
      pitch: { kind: 'notes' },
    });
    expect(parsedUltraStar.lines).toHaveLength(2);
    const imported = importLyricsIntoKaraokeMakerProject(
      project,
      parsedUltraStar,
    );
    expect(imported.audio).toEqual(project.audio);
    expect(imported.lyrics.lines).not.toHaveLength(0);
    expect(imported.melody.notes).not.toHaveLength(0);
  });

  it('keeps the current lyrics offset for every automatic timing source', () => {
    const shifted = shiftKaraokeMakerTimeline(
      createKaraokeMakerProject(song()),
      650,
    );
    const detected = [
      {
        startMs: 1_000,
        endMs: 1_400,
        targetMidi: 69,
        confidence: 0.9,
      },
    ];

    const aligned = autoAlignKaraokeMakerProject(shifted, detected);
    expect(aligned.lyrics.lines[0].tokens[0].startMs).toBe(1_750);
    expect(aligned.melody.notes[0].startMs).toBe(1_750);

    const pitched = applyBasicPitchMelody(shifted, detected);
    expect(pitched.melody.notes[0].startMs).toBe(1_750);

    const transcribed = applyWhisperTranscript(shifted, [
      { text: 'Hel', startMs: 1_000, endMs: 1_400 },
    ]);
    expect(transcribed.lyrics.lines[0].tokens[0].startMs).toBe(1_750);
  });

  it('auto-aligns replacement lyrics while preserving edited melody notes', () => {
    const project = createKaraokeMakerProject(song());
    project.meta.gapMs = 100;
    project.melody.notes[0].source = 'manual';
    const originalNote = { ...project.melody.notes[0] };
    project.lyrics.lines = makerLinesFromPlainText('New replacement lyrics');
    const guides = karaokeMakerAnalysisNotesFromMelody(project);
    const aligned = autoAlignNewKaraokeMakerLyrics(project, guides);

    expect(guides[0].startMs).toBe(originalNote.startMs - 100);
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
