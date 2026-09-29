import {
  createKaraokeMakerProject,
  karaokeMakerProjectToSong,
  karaokeMakerTokenWasUserTouched,
  makerLinesFromPlainText,
  parseKaraokeMakerProject,
  serializeKaraokeMakerProject,
  validateKaraokeMakerProject,
} from '../../../common/karaoke/makerProject';
import {
  exportKaraokeMakerLrc,
  exportKaraokeMakerUltraStar,
  karaokeMakerExportFileName,
} from '../../../common/karaoke/makerExport';
import { IKaraokeSong } from '../../../common/karaoke/types';
import { applyWhisperTranscript } from '../../../renderer/karaoke/makerAi';
import {
  groupKaraokeMakerWordSyllables,
  karaokeMakerFittedLyricViewport,
  karaokeMakerLyricFocus,
  karaokeMakerSectionGroups,
  layoutKaraokeMakerAnchoredLyricLabels,
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

describe('Karaoke Maker canonical project and exports', () => {
  it('groups continuation syllables into the same readable editor word', () => {
    const groups = groupKaraokeMakerWordSyllables([
      { id: 'hel', text: 'Hel', startsWord: true },
      { id: 'lo', text: 'lo', startsWord: false },
      { id: 'world', text: 'world', startsWord: true },
      { id: 'melisma', text: '', startsWord: false },
    ]);

    expect(groups.map((group) => group.map(({ id }) => id))).toEqual([
      ['hel', 'lo'],
      ['world', 'melisma'],
    ]);
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

  it('lays section markers into one non-overlapping group row', () => {
    expect(
      karaokeMakerSectionGroups(
        [
          { id: 'chorus', text: '[Chorus]', startMs: 30_000 },
          { id: 'intro', text: '[Intro]', startMs: 0 },
          { id: 'verse', text: '[Verse 1]', startMs: 10_000 },
        ],
        50_000,
      ),
    ).toEqual([
      { id: 'intro', text: '[Intro]', startMs: 0, endMs: 10_000 },
      { id: 'verse', text: '[Verse 1]', startMs: 10_000, endMs: 30_000 },
      { id: 'chorus', text: '[Chorus]', startMs: 30_000, endMs: 50_000 },
    ]);
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
      version: 2,
      id: 'maker-song-1',
      title: 'Song',
      audio: { name: 'Artist - Song.mp3' },
      meta: { bpm: 120, gapMs: 100 },
    });
    expect(restored.lyrics.lines[0].tokens).toHaveLength(2);
    expect(restored.lyrics.lines[0].tokens[0].timingLocked).toBe(true);
    expect(restored.melody.notes).toHaveLength(2);
  });

  it('repairs impossible old draft word timing while preserving the lyric', () => {
    const project = createKaraokeMakerProject(song());
    Object.assign(project.lyrics.lines[0].tokens[0], {
      startMs: 10_000,
      endMs: 50_000,
      confidence: 0.9,
      source: 'whisper',
    });
    const restored = parseKaraokeMakerProject(JSON.stringify(project));
    const word = restored.lyrics.lines[0].tokens[0];

    expect(word.text).toBe('Hel');
    expect(word.startMs).toBeUndefined();
    expect(word.endMs).toBeUndefined();
    expect(word.confidence).toBeUndefined();
  });

  it('removes all automatic timing inherited from the unsafe alignment version', () => {
    const project = createKaraokeMakerProject(song());
    const [estimated, recognized] = project.lyrics.lines[0].tokens;
    Object.assign(estimated, {
      startMs: 30_000,
      endMs: 30_300,
      confidence: 0.48,
      source: 'whisper',
    });
    Object.assign(recognized, {
      startMs: 40_000,
      endMs: 40_300,
      confidence: 0.82,
      source: 'whisper',
    });
    project.melody.notes = [
      {
        id: 'estimated-note',
        tokenId: estimated.id,
        startMs: 30_000,
        endMs: 30_300,
        targetMidi: 60,
        kind: 'normal',
        source: 'basic-pitch',
      },
    ];

    const restored = parseKaraokeMakerProject(JSON.stringify(project));
    const [restoredEstimate, restoredRecognition] =
      restored.lyrics.lines[0].tokens;

    expect(restoredEstimate.text).toBe(estimated.text);
    expect(restoredEstimate.startMs).toBeUndefined();
    expect(restoredEstimate.endMs).toBeUndefined();
    expect(restoredEstimate.confidence).toBeUndefined();
    expect(restoredRecognition.startMs).toBeUndefined();
    expect(restoredRecognition.endMs).toBeUndefined();
    expect(restoredRecognition.confidence).toBeUndefined();
    expect(restored.melody.notes).toEqual([]);
  });

  it('never turns an unreferenced Whisper transcript into visible lyrics', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = [];

    const analyzed = applyWhisperTranscript(project, [
      { text: 'phantom', startMs: 30_000, endMs: 30_400 },
      { text: 'words', startMs: 30_420, endMs: 30_800 },
    ]);

    expect(analyzed.lyrics.lines).toEqual([]);
    expect(analyzed.analysis.whisperPasses).toBe(1);
  });

  it('removes pasted lyrics-site recommendations but keeps the next section', () => {
    const lines = makerLinesFromPlainText(
      'First verse\nYou might also like\nA Suggested Song\nSome Artist\n[Verse 2]\nReal lyric returns',
    );

    expect(
      lines.map((line) => line.tokens.map((token) => token.text).join(' ')),
    ).toEqual(['First verse', '[Verse 2]', 'Real lyric returns']);
    expect(lines[1].kind).toBe('section');
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

  it('keeps lyric timing separate from multiple melody notes in the preview', () => {
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
        startMs: 1_000,
        endMs: 1_500,
      }),
      expect.objectContaining({ text: 'lo', startsWord: false }),
    ]);
    expect(playable.pitch.kind === 'notes' && playable.pitch.notes).toEqual([
      expect.objectContaining({
        text: 'Hel',
        startsWord: true,
        targetMidi: 60,
        startMs: 1_000,
        endMs: 1_300,
      }),
      expect.objectContaining({
        text: '',
        startsWord: false,
        targetMidi: 64,
        startMs: 1_300,
        endMs: 1_800,
        kind: 'golden',
      }),
    ]);
  });

  it('closes bounded detector holes for preview without timing unmatched lines', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText(
      'She leads a lonely life\nUnmatched verse stays safe',
    );
    const first = project.lyrics.lines[0].tokens;
    Object.assign(first[0], { startMs: 1_000, endMs: 1_240 });
    Object.assign(first[1], { startMs: 1_260, endMs: 1_540 });
    Object.assign(first[4], { startMs: 2_100, endMs: 2_420 });

    const playable = karaokeMakerProjectToSong(project, song().assets[0]);
    const repaired = playable.lines[0].tokens;

    expect(repaired.map((word) => word.text)).toEqual([
      'She',
      'leads',
      'a',
      'lonely',
      'life',
    ]);
    expect(repaired[2].startMs).toBe(1_540);
    expect(repaired[3].endMs).toBe(2_100);
    const orderedBoundaries = repaired.slice(1).flatMap((word, index) => {
      const previousEndMs = repaired[index].endMs;
      return word.startMs !== undefined && previousEndMs !== undefined
        ? [[word.startMs, previousEndMs] as const]
        : [];
    });
    expect(
      orderedBoundaries.every(
        ([wordStartMs, previousEndMs]) => wordStartMs >= previousEndMs,
      ),
    ).toBe(true);
    expect(
      playable.lines[1].tokens.every(
        (word) => word.startMs === undefined && word.endMs === undefined,
      ),
    ).toBe(true);
  });

  it('does not preview-fill a weak two-anchor substitution', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText('She leads a lonely life');
    const words = project.lyrics.lines[0].tokens;
    Object.assign(words[0], { startMs: 1_000, endMs: 1_220 });
    Object.assign(words[4], { startMs: 2_100, endMs: 2_400 });

    const playable = karaokeMakerProjectToSong(project, song().assets[0]);

    expect(
      playable.lines[0].tokens
        .slice(1, 4)
        .every(
          (word) => word.startMs === undefined && word.endMs === undefined,
        ),
    ).toBe(true);
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
    // The exported BPM is a 5 ms timing grid, not the project's tempo.
    expect(ultrastar).toContain('#BPM:3000');
    expect(ultrastar.trimEnd()).toMatch(/\nE$/);
    expect(karaokeMakerExportFileName(project, 'project')).toBe(
      'Artist - Song.fluideq-karaoke.json',
    );
  });

  it('blocks export validation for an implausibly long lyric word', () => {
    const project = createKaraokeMakerProject(song());
    Object.assign(project.lyrics.lines[0].tokens[0], {
      startMs: 1_000,
      endMs: 31_000,
    });

    expect(validateKaraokeMakerProject(project)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-word-time',
          severity: 'error',
          targetId: project.lyrics.lines[0].tokens[0].id,
        }),
      ]),
    );
  });

  it('rejects unknown project versions', () => {
    expect(() =>
      parseKaraokeMakerProject('{"version":99,"id":"future"}'),
    ).toThrow(/Unsupported/);
  });
});
