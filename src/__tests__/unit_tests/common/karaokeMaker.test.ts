/* FluidEQ Karaoke Maker tests. GPL-3.0-or-later. */

import {
  createKaraokeMakerProject,
  IKaraokeMakerProject,
  importLyricsIntoKaraokeMakerProject,
  karaokeMakerProjectToSong,
  karaokeMakerRecordedLineContainsTime,
  karaokeMakerTokenWasUserTouched,
  karaokeMakerLineIsSection,
  synchronizeKaraokeMakerSections,
  karaokeMakerWordDurationIsPlausible,
  karaokeMakerMaximumAutomaticWordDurationMs,
  makerLinesFromPlainText,
  parseKaraokeMakerProject,
  recordKaraokeMakerLineEntry,
  recordKaraokeMakerLineRange,
  resizeKaraokeMakerTokenBoundary,
  serializeKaraokeMakerProject,
  shiftKaraokeMakerLineTailFromToken,
  shiftKaraokeMakerTimeline,
  splitKaraokeMakerWordIntoSyllables,
  validateKaraokeMakerProject,
} from '../../../common/karaoke/makerProject';
import { isKaraokeSectionText } from '../../../common/karaoke/sections';
import {
  exportKaraokeMakerLrc,
  exportKaraokeMakerUltraStar,
  karaokeMakerExportFileName,
} from '../../../common/karaoke/makerExport';
import { parseKaraokeText } from '../../../common/karaoke/files';
import { plainLyrics } from '../../../renderer/karaoke/useKaraokeMakerLyricsDraft';
import { IKaraokeSong } from '../../../common/karaoke/types';
import { splitKaraokeWordSyllables } from '../../../common/karaoke/syllables';
import {
  autoAlignKaraokeMakerProject,
  autoAlignNewKaraokeMakerLyrics,
  karaokeMakerAnalysisNotesFromMelody,
} from '../../../renderer/karaoke/makerAlignment';
import {
  accumulateKaraokeMakerDownloadProgress,
  applyBasicPitchMelody,
  applyDetectedPitchMelody,
  applyTranscriptAsLyrics,
  applyWhisperTranscript,
  formatKaraokeMakerWhisperLog,
  karaokeMakerMelodyNotesForLyrics,
  karaokeMakerVocalAnalysisWindows,
  karaokeMakerAbortableTask,
  karaokeMakerWhisperErrorDetail,
  karaokeMakerWhisperPipelineProgress,
  karaokeMakerWhisperTranscriptWords,
  karaokeMakerVocalRests,
  karaokeMakerLineBreaks,
  karaokeMakerVoiceOnsets,
  normalizedWord,
  normalizedWordDistance,
  solveMonotonicRoute,
  limitRouteCandidates,
  karaokeMakerSnapWordsToOnsets,
  karaokeMakerRepeatedRuns,
  karaokeMakerInconsistentRepeatWords,
  placeTranscriptWords,
  karaokeMakerRepeatEdgeBreaks,
} from '../../../renderer/karaoke/makerAi';
import {
  karaokeMakerResizedViewport,
  karaokeMakerViewportStart,
} from '../../../renderer/karaoke/KaraokeMakerNavigator';
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

describe('Karaoke Maker Whisper progress', () => {
  it('formats diagnostic stages and preserves nested error causes', () => {
    const root = new Error('WASM compilation was blocked');
    const wrapped = new Error('Whisper runtime failed') as Error & {
      cause?: unknown;
    };
    wrapped.cause = root;
    const detail = karaokeMakerWhisperErrorDetail(wrapped);
    const formatted = formatKaraokeMakerWhisperLog({
      timestamp: '2026-08-12T22:00:00.000Z',
      elapsedMs: 1_250,
      level: 'error',
      event: 'model.load.failed',
      message: 'Whisper model initialization failed.',
      stage: 'load',
      data: { model: 'whisper-tiny' },
      error: detail,
    });

    expect(detail).toContain('Caused by: Error: WASM compilation was blocked');
    expect(formatted).toContain('ERROR [load] model.load.failed');
    expect(formatted).toContain('"model":"whisper-tiny"');
  });

  it('stops awaiting Whisper work as soon as it is cancelled', async () => {
    const controller = new AbortController();
    const neverFinishes = new Promise<string>(() => {
      // This intentionally stays pending until the abort signal wins the race.
    });
    const result = karaokeMakerAbortableTask(neverFinishes, controller.signal);

    controller.abort();

    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('keeps a completed asset in the aggregate download until all files are ready', () => {
    const update = karaokeMakerWhisperPipelineProgress({
      status: 'progress',
      progress: 100,
      loaded: 29.3 * 1024 * 1024,
      total: 29.3 * 1024 * 1024,
      file: 'onnx/encoder_model_quantized.onnx',
    });

    expect(update.stage).toBe('download');
    expect(update.progress).toBeCloseTo(0.4);
    expect(update.download).toMatchObject({
      complete: true,
      file: 'onnx/encoder_model_quantized.onnx',
    });
  });

  it('turns segment timestamps into usable word timings when needed', () => {
    const words = karaokeMakerWhisperTranscriptWords(
      {
        text: 'hello bright world',
        chunks: [
          {
            text: 'hello bright world',
            timestamp: [2, 5],
          },
        ],
      },
      true,
    );

    expect(words).toEqual([
      { text: 'hello', startMs: 2_000, endMs: 3_000 },
      { text: 'bright', startMs: 3_000, endMs: 4_000 },
      { text: 'world', startMs: 4_000, endMs: 5_000 },
    ]);
  });

  it('aligns complete Whisper passes independently instead of interleaving them', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 20_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'She leads a lonely life\nWhen morning finally comes around',
    );
    const completePass = [
      { text: 'She', startMs: 1_000, endMs: 1_220 },
      { text: 'leads', startMs: 1_240, endMs: 1_520 },
      { text: 'a', startMs: 1_540, endMs: 1_620 },
      { text: 'lonely', startMs: 1_640, endMs: 2_000 },
      { text: 'life', startMs: 2_020, endMs: 2_300 },
      { text: 'When', startMs: 8_000, endMs: 8_240 },
      { text: 'morning', startMs: 8_260, endMs: 8_620 },
      { text: 'finally', startMs: 8_640, endMs: 8_920 },
      { text: 'comes', startMs: 8_940, endMs: 9_180 },
      { text: 'around', startMs: 9_200, endMs: 9_520 },
    ];
    const transcript = Object.assign(
      completePass.map((word) => ({ ...word })),
      {
        passes: [
          completePass,
          [
            { text: 'She', startMs: 1_020, endMs: 1_240 },
            { text: 'wrong', startMs: 1_260, endMs: 1_600 },
            { text: 'When', startMs: 8_020, endMs: 8_260 },
            { text: 'morning', startMs: 8_280, endMs: 8_640 },
          ],
        ],
      },
    );

    const aligned = applyWhisperTranscript(project, transcript);
    const words = aligned.lyrics.lines.flatMap((line) => line.tokens);

    expect(words.filter((word) => word.startMs !== undefined)).toHaveLength(10);
    expect(words[0]).toMatchObject({ startMs: 1_000 });
    expect(words[5]).toMatchObject({ startMs: 8_000 });
  });

  it('keeps per-file lifecycle events in download until the model is ready', () => {
    expect(
      karaokeMakerWhisperPipelineProgress({
        status: 'initiate',
        file: 'onnx/encoder_model_quantized.onnx',
      }),
    ).toMatchObject({ stage: 'download', progress: 0.04 });
    expect(
      karaokeMakerWhisperPipelineProgress({
        status: 'done',
        file: 'onnx/decoder_model_merged_quantized.onnx',
      }),
    ).toMatchObject({ stage: 'download', download: { complete: true } });
    expect(
      karaokeMakerWhisperPipelineProgress({ status: 'ready' }),
    ).toMatchObject({ stage: 'load', progress: 0.5 });
  });

  it('aggregates interleaved model assets without replacing earlier files', () => {
    let summary = accumulateKaraokeMakerDownloadProgress(undefined, {
      file: 'onnx/encoder.onnx',
    });
    summary = accumulateKaraokeMakerDownloadProgress(summary, {
      file: 'onnx/decoder.onnx',
    });
    summary = accumulateKaraokeMakerDownloadProgress(summary, {
      file: 'onnx/encoder.onnx',
      loadedBytes: 30,
      totalBytes: 100,
    });
    summary = accumulateKaraokeMakerDownloadProgress(summary, {
      file: 'onnx/decoder.onnx',
      loadedBytes: 120,
      totalBytes: 300,
    });

    expect(summary).toMatchObject({
      loadedBytes: 150,
      totalBytes: 400,
      completeFiles: 0,
      fileCount: 2,
      progress: 0.375,
    });
    expect(summary?.files.map((entry) => entry.file)).toEqual([
      'onnx/encoder.onnx',
      'onnx/decoder.onnx',
    ]);
  });

  it('keeps aggregate bytes monotonic and completes only the reported file', () => {
    let summary = accumulateKaraokeMakerDownloadProgress(undefined, {
      file: 'encoder.onnx',
      loadedBytes: 80,
      totalBytes: 100,
    });
    summary = accumulateKaraokeMakerDownloadProgress(summary, {
      file: 'decoder.onnx',
      loadedBytes: 20,
      totalBytes: 200,
    });
    summary = accumulateKaraokeMakerDownloadProgress(summary, {
      file: 'encoder.onnx',
      loadedBytes: 40,
      totalBytes: 100,
    });
    summary = accumulateKaraokeMakerDownloadProgress(summary, {
      file: 'encoder.onnx',
      complete: true,
    });

    expect(summary).toMatchObject({
      loadedBytes: 120,
      totalBytes: 300,
      completeFiles: 1,
      fileCount: 2,
      progress: 0.4,
    });
    expect(summary?.files[1]).toMatchObject({
      file: 'decoder.onnx',
      loadedBytes: 20,
      complete: false,
    });
  });
});

describe('Karaoke Maker lyric-guided melody', () => {
  it('segments lyric words conservatively without losing any characters', () => {
    expect(splitKaraokeWordSyllables('fantastic', 'en')).toHaveLength(3);
    expect(splitKaraokeWordSyllables('mañana', 'es')).toHaveLength(3);
    expect(splitKaraokeWordSyllables('привет', 'ru').join('')).toBe('привет');
    expect(splitKaraokeWordSyllables('カラオケ', 'ja')).toEqual([
      'カ',
      'ラ',
      'オ',
      'ケ',
    ]);
    ['different', "we're", 'música', 'über', '你好'].forEach((word) => {
      expect(splitKaraokeWordSyllables(word).join('')).toBe(word);
    });
  });

  it('reduces polyphonic detector output to at most three notes per timed word', () => {
    const project = createKaraokeMakerProject(song());
    const candidates = Array.from({ length: 18 }, (_, index) => ({
      startMs: 1_000 + (index % 6) * 150,
      endMs: 1_220 + (index % 6) * 150,
      targetMidi: 42 + index * 2,
      confidence: 0.35 + (index % 4) * 0.12,
    }));

    const melody = karaokeMakerMelodyNotesForLyrics(project, candidates);

    expect(melody.length).toBeGreaterThan(0);
    expect(melody.length).toBeLessThanOrEqual(6);
    expect(
      melody.every((note) => note.startMs >= 1_000 && note.endMs <= 2_000),
    ).toBe(true);
  });

  it('merges timed vocal phrases and the untimed span between them', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 30_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'First sung line\nSecond close line\nUntimed line\nLast distant line',
    );
    const [first, second, _untimed, last] = project.lyrics.lines;
    first.tokens.forEach((token, index) => {
      token.startMs = 1_000 + index * 250;
      token.endMs = 1_220 + index * 250;
    });
    second.tokens.forEach((token, index) => {
      token.startMs = 2_250 + index * 250;
      token.endMs = 2_470 + index * 250;
    });
    last.tokens.forEach((token, index) => {
      token.startMs = 10_000 + index * 250;
      token.endMs = 10_220 + index * 250;
    });

    // The third line has no timing, so the detector is asked about the span
    // between the words that bound it — without that it would never look
    // where those words are waiting, and the melody repair would have no note
    // to place them on.
    expect(karaokeMakerVocalAnalysisWindows(project)).toEqual([
      { startMs: 780, endMs: 10_940 },
    ]);
  });

  it('leaves an instrumental stretch alone when no words are waiting in it', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 30_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'First sung line\nLast distant line',
    );
    const [first, last] = project.lyrics.lines;
    first.tokens.forEach((token, index) => {
      token.startMs = 1_000 + index * 250;
      token.endMs = 1_220 + index * 250;
    });
    last.tokens.forEach((token, index) => {
      token.startMs = 10_000 + index * 250;
      token.endMs = 10_220 + index * 250;
    });

    expect(karaokeMakerVocalAnalysisWindows(project)).toEqual([
      { startMs: 780, endMs: 1_940 },
      { startMs: 9_780, endMs: 10_940 },
    ]);
  });

  it('traces one continuous vocal path through simultaneous chord candidates', () => {
    const project = createKaraokeMakerProject(song());
    const melody = karaokeMakerMelodyNotesForLyrics(project, [
      { startMs: 0, endMs: 4_000, targetMidi: 43, confidence: 0.99 },
      { startMs: 900, endMs: 2_100, targetMidi: 72, confidence: 0.94 },
      { startMs: 1_000, endMs: 1_500, targetMidi: 60, confidence: 0.78 },
      { startMs: 1_500, endMs: 2_000, targetMidi: 62, confidence: 0.8 },
    ]);

    expect(melody).toHaveLength(2);
    expect(melody.map((note) => note.targetMidi)).toEqual([60, 62]);
    expect(melody[0]).toMatchObject({ startMs: 1_000, endMs: 1_500 });
    expect(melody[1]).toMatchObject({ startMs: 1_500, endMs: 2_000 });
  });

  it('returns no generated melody until lyric word timing is available', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines.forEach((line) =>
      line.tokens.forEach((token) => {
        token.startMs = undefined;
        token.endMs = undefined;
      }),
    );

    expect(
      karaokeMakerMelodyNotesForLyrics(project, [
        {
          startMs: 100,
          endMs: 600,
          targetMidi: 60,
          confidence: 0.9,
        },
      ]),
    ).toEqual([]);
  });

  it('makes melody notes cover each exact lyric token window', () => {
    const project = createKaraokeMakerProject(song());
    const melody = karaokeMakerMelodyNotesForLyrics(project, [
      { startMs: 900, endMs: 1_260, targetMidi: 60, confidence: 0.9 },
      { startMs: 1_260, endMs: 1_700, targetMidi: 62, confidence: 0.9 },
      { startMs: 1_700, endMs: 2_100, targetMidi: 64, confidence: 0.9 },
    ]);

    expect(melody).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ startMs: 1_000, targetMidi: 60 }),
        expect.objectContaining({ endMs: 1_500, targetMidi: 62 }),
        expect.objectContaining({ startMs: 1_500, targetMidi: 62 }),
        expect.objectContaining({ endMs: 2_000, targetMidi: 64 }),
      ]),
    );
    expect(
      melody
        .slice(1)
        .every((note, index) => note.startMs >= melody[index].endMs),
    ).toBe(true);
  });

  it('splits a multi-syllable lyric even when its sung pitch stays level', () => {
    const project = createKaraokeMakerProject(song());
    project.meta.gapMs = 0;
    project.lyrics.lines = [
      {
        id: 'line',
        tokens: [
          {
            id: 'fantastic',
            text: 'fantastic',
            startsWord: true,
            startMs: 1_000,
            endMs: 1_750,
            source: 'whisper',
          },
        ],
      },
    ];

    const melody = karaokeMakerMelodyNotesForLyrics(project, [
      { startMs: 1_000, endMs: 1_750, targetMidi: 64, confidence: 0.95 },
    ]);

    expect(melody).toHaveLength(3);
    expect(melody[0].startMs).toBe(1_000);
    expect(melody[2].endMs).toBe(1_750);
    expect(melody.every((note) => note.targetMidi === 64)).toBe(true);
  });

  it('ignores a short pitch flicker instead of creating a false syllable', () => {
    const project = createKaraokeMakerProject(song());
    project.meta.gapMs = 0;
    project.lyrics.lines = [
      {
        id: 'line',
        tokens: [
          {
            id: 'held',
            text: 'held',
            startsWord: true,
            startMs: 1_000,
            endMs: 1_600,
            source: 'whisper',
          },
        ],
      },
    ];

    const melody = karaokeMakerMelodyNotesForLyrics(project, [
      { startMs: 1_000, endMs: 1_280, targetMidi: 60, confidence: 0.95 },
      { startMs: 1_280, endMs: 1_340, targetMidi: 67, confidence: 0.7 },
      { startMs: 1_340, endMs: 1_600, targetMidi: 60, confidence: 0.95 },
    ]);

    expect(melody).toEqual([
      expect.objectContaining({
        startMs: 1_000,
        endMs: 1_600,
        targetMidi: 60,
      }),
    ]);
  });
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

  it('records line entrances while preserving internal word rhythm', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 12_000;
    project.lyrics.lines = makerLinesFromPlainText('First line\nSecond line');
    const [firstLine, secondLine] = project.lyrics.lines;
    Object.assign(firstLine.tokens[0], { startMs: 1_000, endMs: 1_400 });
    Object.assign(firstLine.tokens[1], { startMs: 1_450, endMs: 2_000 });
    Object.assign(secondLine.tokens[0], { startMs: 4_000, endMs: 4_400 });
    Object.assign(secondLine.tokens[1], { startMs: 4_450, endMs: 5_000 });
    project.melody.notes = [
      {
        id: 'linked',
        tokenId: secondLine.tokens[0].id,
        startMs: 4_000,
        endMs: 4_400,
        targetMidi: 60,
        kind: 'normal',
        source: 'imported',
      },
    ];

    const recorded = recordKaraokeMakerLineEntry(
      project,
      secondLine.id,
      6_000,
      firstLine.id,
    );
    const moved = recorded.lyrics.lines[1].tokens;

    expect(moved[0]).toMatchObject({
      startMs: 6_000,
      endMs: 6_400,
      timingLocked: true,
    });
    expect(moved[1]).toMatchObject({ startMs: 6_450, endMs: 7_000 });
    expect(recorded.melody.notes[0]).toMatchObject({
      startMs: 6_000,
      endMs: 6_400,
      source: 'manual',
    });
  });

  it('matches a recorded line only while the playhead is inside its range', () => {
    const [line] = makerLinesFromPlainText('She leads a lonely life');
    line.tokens.forEach((token, index) => {
      Object.assign(token, {
        startMs: 10_000 + index * 500,
        endMs: 10_450 + index * 500,
        source: 'manual',
        timingLocked: true,
      });
    });

    expect(karaokeMakerRecordedLineContainsTime(line, 11_700)).toBe(true);
    expect(karaokeMakerRecordedLineContainsTime(line, 9_999)).toBe(false);
    expect(karaokeMakerRecordedLineContainsTime(line, 13_000)).toBe(false);
  });

  it('keeps a recorded start exact and trims only an overlapping previous end', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 12_000;
    project.lyrics.lines = makerLinesFromPlainText('First line\nSecond line');
    const [firstLine, secondLine] = project.lyrics.lines;
    Object.assign(firstLine.tokens[0], { startMs: 1_000, endMs: 3_000 });
    Object.assign(firstLine.tokens[1], { startMs: 3_000, endMs: 5_000 });
    Object.assign(secondLine.tokens[0], { startMs: 6_000, endMs: 6_400 });
    Object.assign(secondLine.tokens[1], { startMs: 6_450, endMs: 7_000 });

    const recorded = recordKaraokeMakerLineEntry(
      project,
      secondLine.id,
      4_000,
      firstLine.id,
    );
    const previous = recorded.lyrics.lines[0].tokens;
    const current = recorded.lyrics.lines[1].tokens;

    expect(previous[previous.length - 1].endMs).toBe(3_960);
    expect(current[0].startMs).toBe(4_000);
    expect(current[1].startMs).toBe(4_450);
  });

  it('preserves silence before an explicitly recorded start', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 15_000;
    project.lyrics.lines = makerLinesFromPlainText('First line\nSecond line');
    const [firstLine, secondLine] = project.lyrics.lines;
    Object.assign(firstLine.tokens[0], { startMs: 1_000, endMs: 2_000 });
    Object.assign(firstLine.tokens[1], { startMs: 2_000, endMs: 3_000 });
    Object.assign(secondLine.tokens[0], { startMs: 4_000, endMs: 4_400 });
    Object.assign(secondLine.tokens[1], { startMs: 4_450, endMs: 5_000 });

    const recorded = recordKaraokeMakerLineEntry(
      project,
      secondLine.id,
      9_000,
      firstLine.id,
    );

    const previousTokens = recorded.lyrics.lines[0].tokens;
    expect(previousTokens[previousTokens.length - 1].endMs).toBe(3_000);
    expect(recorded.lyrics.lines[1].startMs).toBe(9_000);
  });

  it('pushes every overlapping later line when a recorded end moves forward', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 20_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'First line\nSecond line\nThird line',
    );
    project.lyrics.lines.forEach((line, lineIndex) => {
      line.tokens.forEach((token, tokenIndex) => {
        Object.assign(token, {
          startMs: 1_000 + lineIndex * 2_000 + tokenIndex * 400,
          endMs: 1_350 + lineIndex * 2_000 + tokenIndex * 400,
          source: 'manual',
          timingLocked: true,
        });
      });
      line.startMs = line.tokens[0].startMs;
      line.endMs = line.tokens[line.tokens.length - 1].endMs;
    });
    const [firstLine, secondLine, thirdLine] = project.lyrics.lines;

    const recorded = recordKaraokeMakerLineRange(
      project,
      firstLine.id,
      1_000,
      4_000,
    );

    expect(recorded.lyrics.lines[0].endMs).toBe(4_000);
    expect(recorded.lyrics.lines[1].startMs).toBe(4_040);
    expect(recorded.lyrics.lines[2].startMs).toBeGreaterThanOrEqual(
      (recorded.lyrics.lines[1].endMs as number) + 40,
    );
    expect(recorded.lyrics.lines[1].tokens[0].id).toBe(secondLine.tokens[0].id);
    expect(recorded.lyrics.lines[2].tokens[0].id).toBe(thirdLine.tokens[0].id);
  });

  it('keeps moved words inside a recorded line range and in reading order', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText('Keep every word safe');
    const [line] = project.lyrics.lines;
    line.tokens.forEach((token, index) => {
      Object.assign(token, {
        startMs: 1_000 + index * 500,
        endMs: 1_400 + index * 500,
        source: 'manual',
        timingLocked: true,
      });
    });
    line.startMs = 1_000;
    line.endMs = 2_900;

    const tooLate = shiftKaraokeMakerLineTailFromToken(
      project,
      line.tokens[1].id,
      10_000,
    );
    const lateWords = tooLate.lyrics.lines[0].tokens;
    expect(tooLate.lyrics.lines[0]).toMatchObject({
      startMs: 1_000,
      endMs: 2_900,
    });
    expect(lateWords[lateWords.length - 1].endMs).toBe(2_900);

    const tooEarly = shiftKaraokeMakerLineTailFromToken(
      tooLate,
      lateWords[1].id,
      -10_000,
    );
    const earlyWords = tooEarly.lyrics.lines[0].tokens;
    expect(earlyWords[1].startMs).toBe(earlyWords[0].endMs);
    earlyWords.slice(1).forEach((token, index) => {
      expect(token.startMs).toBeGreaterThanOrEqual(
        earlyWords[index].endMs as number,
      );
    });
    expect(tooEarly.lyrics.lines[0]).toMatchObject({
      startMs: 1_000,
      endMs: 2_900,
    });
  });

  it('fits words and linked notes inside a manually heard line range', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 12_000;
    project.lyrics.lines = makerLinesFromPlainText('Hear this line');
    const line = project.lyrics.lines[0];
    Object.assign(line.tokens[0], { startMs: 1_000, endMs: 1_300 });
    Object.assign(line.tokens[1], { startMs: 1_400, endMs: 2_000 });
    Object.assign(line.tokens[2], { startMs: 2_100, endMs: 3_000 });
    project.melody.notes = [
      {
        id: 'range-note',
        tokenId: line.tokens[2].id,
        startMs: 2_100,
        endMs: 3_000,
        targetMidi: 64,
        kind: 'normal',
        source: 'imported',
      },
    ];

    const recorded = recordKaraokeMakerLineRange(
      project,
      line.id,
      5_000,
      6_000,
    );
    const words = recorded.lyrics.lines[0].tokens;

    expect(words[0].startMs).toBe(5_000);
    expect(words[2].endMs).toBe(6_000);
    expect(
      words
        .slice(1)
        .every(
          (word, index) => (word.startMs ?? 0) >= (words[index].endMs ?? 0),
        ),
    ).toBe(true);
    expect(recorded.melody.notes[0]).toMatchObject({
      endMs: 6_000,
      source: 'manual',
    });
  });

  it('keeps captured word boundaries and gives a held final word the remaining line time', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 10_000;
    project.lyrics.lines = makerLinesFromPlainText('one two three held');
    const line = project.lyrics.lines[0];

    const recorded = recordKaraokeMakerLineRange(
      project,
      line.id,
      1_000,
      6_000,
      undefined,
      [1_500, 2_100, 2_600],
    );
    const words = recorded.lyrics.lines[0].tokens;

    expect(words.map(({ startMs, endMs }) => ({ startMs, endMs }))).toEqual([
      { startMs: 1_000, endMs: 1_500 },
      { startMs: 1_500, endMs: 2_100 },
      { startMs: 2_100, endMs: 2_600 },
      { startMs: 2_600, endMs: 6_000 },
    ]);
    expect((words[3].endMs as number) - (words[3].startMs as number)).toBe(
      3_400,
    );
  });

  it('repairs crossed detector timestamps into written lyric order', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 12_000;
    project.lyrics.lines = makerLinesFromPlainText('She leads a lonely life');
    const line = project.lyrics.lines[0];
    const crossed = [1_000, 2_600, 2_000, 1_700, 3_000];
    line.tokens.forEach((token, index) => {
      token.startMs = crossed[index];
      token.endMs = crossed[index] + 300;
    });

    const recorded = recordKaraokeMakerLineRange(
      project,
      line.id,
      5_000,
      7_000,
    );
    const words = recorded.lyrics.lines[0].tokens;

    expect(words.map((word) => word.text)).toEqual([
      'She',
      'leads',
      'a',
      'lonely',
      'life',
    ]);
    expect(words[0].startMs).toBe(5_000);
    expect(words[4].endMs).toBe(7_000);
    expect(
      words
        .slice(1)
        .every(
          (word, index) => (word.startMs ?? 0) >= (words[index].endMs ?? 0),
        ),
    ).toBe(true);
  });

  it('moves a selected word and the rest of its sentence without reordering', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 12_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'One two three four\nNext sentence',
    );
    const [line, nextLine] = project.lyrics.lines;
    line.tokens.forEach((token, index) => {
      token.startMs = 1_000 + index * 500;
      token.endMs = 1_400 + index * 500;
    });
    nextLine.tokens.forEach((token, index) => {
      token.startMs = 4_000 + index * 500;
      token.endMs = 4_400 + index * 500;
    });
    project.melody.notes = [
      {
        id: 'tail-note',
        tokenId: line.tokens[2].id,
        startMs: 2_000,
        endMs: 2_400,
        targetMidi: 64,
        kind: 'normal',
        source: 'imported',
      },
    ];

    const shifted = shiftKaraokeMakerLineTailFromToken(
      project,
      line.tokens[1].id,
      300,
    );
    const words = shifted.lyrics.lines[0].tokens;

    expect(words.map((word) => word.startMs)).toEqual([
      1_000, 1_800, 2_300, 2_800,
    ]);
    expect(shifted.lyrics.lines[1].tokens[0].startMs).toBe(4_000);
    expect(shifted.melody.notes[0]).toMatchObject({
      startMs: 2_300,
      endMs: 2_700,
    });

    const clamped = shiftKaraokeMakerLineTailFromToken(
      shifted,
      words[1].id,
      -5_000,
    );
    expect(clamped.lyrics.lines[0].tokens[1].startMs).toBe(1_400);
  });

  it('resizes shared word boundaries without moving the sentence range', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText('short very long');
    const line = project.lyrics.lines[0];
    line.startMs = 1_000;
    line.endMs = 4_000;
    line.tokens.forEach((token, index) => {
      token.startMs = 1_000 + index * 1_000;
      token.endMs = 2_000 + index * 1_000;
      token.timingLocked = true;
    });
    project.melody.notes = [
      {
        id: 'very-note',
        tokenId: line.tokens[1].id,
        startMs: 2_250,
        endMs: 2_750,
        targetMidi: 64,
        kind: 'normal',
        source: 'imported',
      },
    ];

    const longerMiddle = resizeKaraokeMakerTokenBoundary(
      project,
      line.tokens[1].id,
      'end',
      3_600,
    );
    const longerWords = longerMiddle.lyrics.lines[0].tokens;
    expect(longerMiddle.lyrics.lines[0]).toMatchObject({
      startMs: 1_000,
      endMs: 4_000,
    });
    expect(
      longerWords.map(({ startMs, endMs }) => ({ startMs, endMs })),
    ).toEqual([
      { startMs: 1_000, endMs: 2_000 },
      { startMs: 2_000, endMs: 3_600 },
      { startMs: 3_600, endMs: 4_000 },
    ]);
    expect(longerMiddle.melody.notes[0]).toMatchObject({
      startMs: 2_400,
      endMs: 3_200,
      source: 'manual',
    });

    const earlierStart = resizeKaraokeMakerTokenBoundary(
      longerMiddle,
      longerWords[1].id,
      'start',
      1_400,
    );
    const earlierWords = earlierStart.lyrics.lines[0].tokens;
    expect(earlierWords[0].endMs).toBe(1_400);
    expect(earlierWords[1].startMs).toBe(1_400);
    expect(earlierStart.lyrics.lines[0]).toMatchObject({
      startMs: 1_000,
      endMs: 4_000,
    });

    const clamped = resizeKaraokeMakerTokenBoundary(
      earlierStart,
      earlierWords[1].id,
      'end',
      10_000,
    );
    expect(clamped.lyrics.lines[0].tokens[1].endMs).toBe(3_980);
    expect(clamped.lyrics.lines[0].tokens[2].startMs).toBe(3_980);
    expect(clamped.lyrics.lines[0].tokens[2].endMs).toBe(4_000);

    const expandedStart = resizeKaraokeMakerTokenBoundary(
      clamped,
      clamped.lyrics.lines[0].tokens[0].id,
      'start',
      500,
    );
    expect(expandedStart.lyrics.lines[0].startMs).toBe(500);
    expect(expandedStart.lyrics.lines[0].tokens[0].startMs).toBe(500);

    const expandedEnd = resizeKaraokeMakerTokenBoundary(
      expandedStart,
      expandedStart.lyrics.lines[0].tokens[2].id,
      'end',
      4_500,
    );
    expect(expandedEnd.lyrics.lines[0].endMs).toBe(4_500);
    expect(expandedEnd.lyrics.lines[0].tokens[2].endMs).toBe(4_500);
  });

  it('splits an attached word and its melody note into linked syllables', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText('fantastic');
    const word = project.lyrics.lines[0].tokens[0];
    word.startMs = 1_000;
    word.endMs = 1_900;
    project.melody.notes = [
      {
        id: 'held-note',
        tokenId: word.id,
        startMs: 1_000,
        endMs: 1_900,
        targetMidi: 64,
        kind: 'normal',
        source: 'manual',
      },
    ];

    const split = splitKaraokeMakerWordIntoSyllables(project, word.id, 'en');
    const syllables = split.lyrics.lines[0].tokens;
    const { notes } = split.melody;

    expect(syllables.map((token) => token.text).join('')).toBe('fantastic');
    expect(syllables).toHaveLength(3);
    expect(syllables.map((token) => token.startsWord)).toEqual([
      true,
      false,
      false,
    ]);
    expect(syllables[0].id).toBe(word.id);
    expect(notes).toHaveLength(3);
    expect(notes.map((note) => note.tokenId)).toEqual(
      syllables.map((token) => token.id),
    );
    expect(notes.every((note) => note.targetMidi === 64)).toBe(true);
    expect(notes[0].startMs).toBe(1_000);
    expect(notes[notes.length - 1].endMs).toBe(1_900);
    notes.slice(1).forEach((note, index) => {
      expect(note.startMs).toBe(notes[index].endMs);
    });

    const manualSplit = splitKaraokeMakerWordIntoSyllables(
      project,
      word.id,
      'en',
      ['fan', 'ta', 'stic'],
    );
    expect(
      manualSplit.lyrics.lines[0].tokens.map((token) => token.text),
    ).toEqual(['fan', 'ta', 'stic']);
    expect(manualSplit.melody.notes.map((note) => note.tokenId)).toEqual(
      manualSplit.lyrics.lines[0].tokens.map((token) => token.id),
    );
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

  it('keeps decoded-audio analysis in absolute song time without reapplying GAP', () => {
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
    expect(aligned.lyrics.lines[0].tokens[0].startMs).toBe(1_000);
    expect(aligned.melody.notes[0].startMs).toBe(1_000);

    const alignedForPitch = applyWhisperTranscript(shifted, [
      { text: 'Hel', startMs: 1_000, endMs: 1_400 },
      { text: 'lo', startMs: 1_400, endMs: 2_000 },
    ]);
    const pitched = applyBasicPitchMelody(alignedForPitch, detected);
    expect(pitched.melody.notes[0].startMs).toBe(1_000);

    const locallyDetected = applyDetectedPitchMelody(alignedForPitch, detected);
    expect(locallyDetected.melody.notes[0]).toMatchObject({
      startMs: 1_000,
      source: 'pitch-analysis',
    });
    expect(locallyDetected.melody.source).toBe('pitch-analysis');

    const transcribed = applyWhisperTranscript(shifted, [
      { text: 'Hel', startMs: 1_000, endMs: 1_400 },
    ]);
    expect(transcribed.lyrics.lines[0].tokens[0].startMs).toBe(1_000);
  });

  it('aligns one readable provider word when Whisper emits fragments', () => {
    const project = createKaraokeMakerProject(song());
    const [first, second] = project.lyrics.lines[0].tokens;
    first.startMs = undefined;
    first.endMs = undefined;
    second.startMs = undefined;
    second.endMs = undefined;

    const aligned = applyWhisperTranscript(project, [
      { text: 'Hel', startMs: 1_000, endMs: 1_260 },
      { text: 'lo', startMs: 1_260, endMs: 1_600 },
    ]);
    const [alignedFirst, alignedSecond] = aligned.lyrics.lines[0].tokens;

    expect(alignedFirst).toMatchObject({ startMs: 1_000 });
    expect(alignedSecond).toMatchObject({ endMs: 1_600 });
    expect(alignedFirst.endMs).toBe(alignedSecond.startMs);
  });

  it('never lets a segment-sized Whisper timestamp turn one word into a verse', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 90_000;
    project.lyrics.lines = makerLinesFromPlainText('what a morning');
    const aligned = applyWhisperTranscript(project, [
      { text: 'what', startMs: 45_000, endMs: 45_300 },
      // Simulate a broken final timestamp covering the rest of a 30 s window.
      { text: 'a', startMs: 45_320, endMs: 75_000 },
      { text: 'morning', startMs: 75_020, endMs: 75_500 },
    ]);
    const article = aligned.lyrics.lines[0].tokens[1];

    expect(article.startMs).toBe(45_320);
    // A 29.68 s span is still refused. The ceiling is a syllable count now, so
    // one syllable may last 2.5 s — a held note, not a verse.
    expect(
      (article.endMs as number) - (article.startMs as number),
    ).toBeLessThanOrEqual(2_500);
  });

  it('does not fill a long instrumental gap with an unmatched lyric block', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 90_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'She sings here\nmissing verse words\nvoices return now',
    );
    const aligned = applyWhisperTranscript(project, [
      { text: 'She', startMs: 10_000, endMs: 10_200 },
      { text: 'sings', startMs: 10_220, endMs: 10_500 },
      { text: 'here', startMs: 10_520, endMs: 10_800 },
      { text: 'voices', startMs: 45_000, endMs: 45_300 },
      { text: 'return', startMs: 45_320, endMs: 45_620 },
      { text: 'now', startMs: 45_640, endMs: 45_900 },
    ]);
    const missing = aligned.lyrics.lines[1].tokens;

    expect(missing.every((word) => word.startMs === undefined)).toBe(true);
  });

  it('rejects an isolated short Whisper fragment inside instrumental audio', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 90_000;
    project.lyrics.lines = makerLinesFromPlainText('what a morning');
    const aligned = applyWhisperTranscript(project, [
      // Common one-letter hallucinations are not enough to prove a voice.
      { text: 'a', startMs: 45_000, endMs: 45_180 },
    ]);

    expect(
      aligned.lyrics.lines[0].tokens.every(
        (word) => word.startMs === undefined && word.endMs === undefined,
      ),
    ).toBe(true);
  });

  it('rejects an isolated content-word hallucination inside instrumental audio', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 90_000;
    project.lyrics.lines = makerLinesFromPlainText('she lives alone');
    const aligned = applyWhisperTranscript(project, [
      { text: 'lives', startMs: 45_000, endMs: 45_420 },
    ]);

    expect(
      aligned.lyrics.lines[0].tokens.every(
        (word) => word.startMs === undefined && word.endMs === undefined,
      ),
    ).toBe(true);
  });

  it('never bridges separated recognition islands with one missing lyric run', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 90_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'start here\nmissing lyric phrase\nvoices return',
    );
    const aligned = applyWhisperTranscript(project, [
      { text: 'start', startMs: 1_000, endMs: 1_300 },
      { text: 'here', startMs: 1_320, endMs: 1_600 },
      { text: 'unrecognized', startMs: 8_000, endMs: 8_400 },
      { text: 'instrumental', startMs: 35_000, endMs: 35_400 },
      { text: 'voices', startMs: 50_000, endMs: 50_300 },
      { text: 'return', startMs: 50_320, endMs: 50_620 },
    ]);
    expect(
      aligned.lyrics.lines[1].tokens.every(
        (token) => token.startMs === undefined && token.endMs === undefined,
      ),
    ).toBe(true);
  });

  it('does not compress a missing verse into too little recognized speech', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 90_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'start here\nthis complete missing verse has far too many lyric words\nvoices return',
    );
    const aligned = applyWhisperTranscript(project, [
      { text: 'start', startMs: 1_000, endMs: 1_240 },
      { text: 'here', startMs: 1_260, endMs: 1_500 },
      { text: 'unclear', startMs: 8_000, endMs: 8_180 },
      { text: 'phrase', startMs: 8_200, endMs: 8_380 },
      { text: 'voices', startMs: 30_000, endMs: 30_280 },
      { text: 'return', startMs: 30_300, endMs: 30_600 },
    ]);

    expect(
      aligned.lyrics.lines[1].tokens.every(
        (token) => token.startMs === undefined && token.endMs === undefined,
      ),
    ).toBe(true);
  });

  it('never estimates unmatched lyric words from nearby Whisper substitutions', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 20_000;
    project.lyrics.lines = makerLinesFromPlainText('She leads a lonely life');
    const aligned = applyWhisperTranscript(project, [
      { text: 'She', startMs: 11_000, endMs: 11_250 },
      { text: 'lives', startMs: 11_270, endMs: 11_600 },
      { text: 'by', startMs: 11_620, endMs: 11_800 },
      { text: 'herself', startMs: 11_820, endMs: 12_260 },
      { text: 'life', startMs: 12_280, endMs: 12_600 },
    ]);
    const words = aligned.lyrics.lines[0].tokens;

    expect(words[0]).toMatchObject({ startMs: 11_000, endMs: 11_250 });
    expect(words[2].startMs).toBeUndefined();
    expect(words[3].startMs).toBeUndefined();
    expect(words[4]).toMatchObject({ startMs: 12_280, endMs: 12_600 });
  });

  it('does not add a 30 second provider GAP to absolute Whisper audio time', () => {
    const project = createKaraokeMakerProject(song());
    project.meta.gapMs = 30_000;
    project.audio.durationMs = 90_000;
    project.lyrics.lines = makerLinesFromPlainText('She sings now');
    const aligned = applyWhisperTranscript(project, [
      { text: 'She', startMs: 4_000, endMs: 4_220 },
      { text: 'sings', startMs: 4_240, endMs: 4_580 },
      { text: 'now', startMs: 4_600, endMs: 4_900 },
    ]);

    expect(aligned.lyrics.lines[0].tokens).toEqual([
      expect.objectContaining({ startMs: 4_000, endMs: 4_220 }),
      expect.objectContaining({ startMs: 4_240, endMs: 4_580 }),
      expect.objectContaining({ startMs: 4_600, endMs: 4_900 }),
    ]);
  });

  it('fills omitted words only inside a strongly confirmed repeated sentence', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 8_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'She lives a lonely life\nShe lives a lonely life',
    );
    const aligned = applyWhisperTranscript(project, [
      { text: 'She', startMs: 500, endMs: 700 },
      { text: 'lives', startMs: 710, endMs: 920 },
      { text: 'a', startMs: 930, endMs: 1_000 },
      { text: 'lonely', startMs: 1_020, endMs: 1_300 },
      { text: 'life', startMs: 1_310, endMs: 1_560 },
      { text: 'She', startMs: 4_500, endMs: 4_700 },
      { text: 'lives', startMs: 4_710, endMs: 4_920 },
      // Simulate Whisper missing "a lonely" in the repeated line.
      { text: 'life', startMs: 5_350, endMs: 5_600 },
    ]);
    const alignedWords = aligned.lyrics.lines.flatMap((line) => line.tokens);

    expect(alignedWords.map((word) => word.text)).toEqual([
      'She',
      'lives',
      'a',
      'lonely',
      'life',
      'She',
      'lives',
      'a',
      'lonely',
      'life',
    ]);
    expect(alignedWords[7].startMs).toBeGreaterThanOrEqual(4_920);
    expect(alignedWords[7].endMs).toBeLessThanOrEqual(
      alignedWords[8].startMs as number,
    );
    expect(alignedWords[8].endMs).toBeLessThanOrEqual(5_350);
    expect(alignedWords[9]).toMatchObject({ startMs: 5_350, endMs: 5_600 });
  });

  it('assigns the first partial performance before a cleaner repeated sentence', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 10_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'She lives a lonely life\nShe lives a lonely life',
    );
    const aligned = applyWhisperTranscript(project, [
      { text: 'She', startMs: 500, endMs: 700 },
      { text: 'lives', startMs: 720, endMs: 940 },
      // Whisper missed the middle of the first performance.
      { text: 'life', startMs: 1_360, endMs: 1_620 },
      { text: 'She', startMs: 4_500, endMs: 4_700 },
      { text: 'lives', startMs: 4_720, endMs: 4_940 },
      { text: 'a', startMs: 4_960, endMs: 5_020 },
      { text: 'lonely', startMs: 5_040, endMs: 5_340 },
      { text: 'life', startMs: 5_360, endMs: 5_620 },
    ]);
    const [first, second] = aligned.lyrics.lines;

    expect(first.tokens[0]).toMatchObject({ startMs: 500 });
    expect(first.tokens[4]).toMatchObject({ startMs: 1_360 });
    expect(second.tokens[0]).toMatchObject({ startMs: 4_500 });
    expect(second.tokens[4]).toMatchObject({ startMs: 5_360 });
  });

  it('keeps a lyric sentence when accompaniment masks its opening words', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 70_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'When she woke up late in the morning light\nAnd the day had just begun',
    );
    const aligned = applyWhisperTranscript(project, [
      // The sung attack was masked, but the rest of the first line is one
      // continuous recognised phrase and must still participate in the route.
      { text: 'up', startMs: 31_000, endMs: 31_180 },
      { text: 'late', startMs: 31_200, endMs: 31_420 },
      { text: 'in', startMs: 31_440, endMs: 31_560 },
      { text: 'the', startMs: 31_580, endMs: 31_700 },
      { text: 'morning', startMs: 31_720, endMs: 32_060 },
      { text: 'light', startMs: 32_080, endMs: 32_340 },
      { text: 'And', startMs: 33_000, endMs: 33_180 },
      { text: 'the', startMs: 33_200, endMs: 33_320 },
      { text: 'day', startMs: 33_340, endMs: 33_580 },
      { text: 'had', startMs: 33_600, endMs: 33_760 },
      { text: 'just', startMs: 33_780, endMs: 34_000 },
      { text: 'begun', startMs: 34_020, endMs: 34_360 },
    ]);

    expect(aligned.lyrics.lines[0].tokens.slice(3)).toEqual([
      expect.objectContaining({ text: 'up', startMs: 31_000 }),
      expect.objectContaining({ text: 'late', startMs: 31_200 }),
      expect.objectContaining({ text: 'in', startMs: 31_440 }),
      expect.objectContaining({ text: 'the', startMs: 31_580 }),
      expect.objectContaining({ text: 'morning', startMs: 31_720 }),
      expect.objectContaining({ text: 'light', startMs: 32_080 }),
    ]);
    expect(aligned.lyrics.lines[1].tokens[0]).toMatchObject({
      text: 'And',
      startMs: 33_000,
    });
  });

  it('keeps a later repeated sentence even when only its opening is masked', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 10_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'She lives a lonely life\nShe lives a lonely life',
    );
    const aligned = applyWhisperTranscript(project, [
      { text: 'She', startMs: 1_000, endMs: 1_180 },
      { text: 'lives', startMs: 1_200, endMs: 1_420 },
      { text: 'a', startMs: 1_440, endMs: 1_500 },
      { text: 'lonely', startMs: 1_520, endMs: 1_820 },
      { text: 'life', startMs: 1_840, endMs: 2_080 },
      // The second performance is real and locally coherent, but Whisper lost
      // its first two words beneath the accompaniment.
      { text: 'a', startMs: 5_000, endMs: 5_080 },
      { text: 'lonely', startMs: 5_100, endMs: 5_420 },
      { text: 'life', startMs: 5_440, endMs: 5_700 },
    ]);

    expect(aligned.lyrics.lines[0].tokens[0]).toMatchObject({ startMs: 1_000 });
    expect(aligned.lyrics.lines[1].tokens.slice(2)).toEqual([
      expect.objectContaining({ text: 'a', startMs: 5_000 }),
      expect.objectContaining({ text: 'lonely', startMs: 5_100 }),
      expect.objectContaining({ text: 'life', startMs: 5_440 }),
    ]);
  });

  it('accepts consecutive repeated intro performances as distinct occurrences', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 40_000;
    project.lyrics.lines = makerLinesFromPlainText(
      '[Intro]\nShe leads a lonely life\nOh, she leads a lonely life\n[Verse 1]\nWhen she woke up late',
    );
    const aligned = applyWhisperTranscript(project, [
      { text: 'She', startMs: 11_000, endMs: 11_180 },
      { text: 'leads', startMs: 11_200, endMs: 11_430 },
      { text: 'a', startMs: 11_450, endMs: 11_520 },
      { text: 'lonely', startMs: 11_540, endMs: 11_860 },
      { text: 'life', startMs: 11_880, endMs: 12_120 },
      { text: 'Oh', startMs: 12_500, endMs: 12_650 },
      { text: 'she', startMs: 12_670, endMs: 12_830 },
      { text: 'leads', startMs: 12_850, endMs: 13_080 },
      { text: 'a', startMs: 13_100, endMs: 13_170 },
      { text: 'lonely', startMs: 13_190, endMs: 13_520 },
      { text: 'life', startMs: 13_540, endMs: 13_780 },
      { text: 'When', startMs: 30_000, endMs: 30_220 },
      { text: 'she', startMs: 30_240, endMs: 30_380 },
      { text: 'woke', startMs: 30_400, endMs: 30_620 },
      { text: 'up', startMs: 30_640, endMs: 30_760 },
      { text: 'late', startMs: 30_780, endMs: 31_020 },
    ]);
    const lyricLines = aligned.lyrics.lines.filter(
      (line) => line.kind !== 'section',
    );

    expect(lyricLines[0].tokens[0]).toMatchObject({ startMs: 11_000 });
    expect(lyricLines[0].tokens[lyricLines[0].tokens.length - 1]).toMatchObject(
      { endMs: 12_120 },
    );
    expect(lyricLines[1].tokens[0]).toMatchObject({ startMs: 12_500 });
    expect(lyricLines[1].tokens[lyricLines[1].tokens.length - 1]).toMatchObject(
      { endMs: 13_780 },
    );
    expect(lyricLines[2].tokens[0]).toMatchObject({ startMs: 30_000 });
  });

  it('uses a later unique phrase to keep a missing repeated verse from shifting the song', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 80_000;
    project.lyrics.lines = makerLinesFromPlainText(
      [
        'She leads a lonely life',
        'She leads a lonely life',
        'When morning finally comes around',
        'All that she wants is another baby',
      ].join('\n'),
    );
    const aligned = applyWhisperTranscript(project, [
      { text: 'She', startMs: 11_000, endMs: 11_250 },
      { text: 'leads', startMs: 11_270, endMs: 11_600 },
      { text: 'a', startMs: 11_620, endMs: 11_720 },
      { text: 'lonely', startMs: 11_740, endMs: 12_160 },
      { text: 'life', startMs: 12_180, endMs: 12_500 },
      // Whisper missed the repeated line completely.
      { text: 'When', startMs: 30_000, endMs: 30_260 },
      { text: 'morning', startMs: 30_280, endMs: 30_700 },
      { text: 'finally', startMs: 30_720, endMs: 31_050 },
      { text: 'comes', startMs: 31_070, endMs: 31_350 },
      { text: 'around', startMs: 31_370, endMs: 31_730 },
      { text: 'All', startMs: 45_000, endMs: 45_220 },
      { text: 'that', startMs: 45_240, endMs: 45_450 },
      { text: 'she', startMs: 45_470, endMs: 45_680 },
      { text: 'wants', startMs: 45_700, endMs: 46_000 },
      { text: 'is', startMs: 46_020, endMs: 46_160 },
      { text: 'another', startMs: 46_180, endMs: 46_600 },
      { text: 'baby', startMs: 46_620, endMs: 47_000 },
    ]);
    const { lines } = aligned.lyrics;

    expect(lines[0].tokens[0]).toMatchObject({ startMs: 11_000 });
    expect(lines[1].tokens.every((word) => word.startMs === undefined)).toBe(
      true,
    );
    expect(lines[2].tokens[0]).toMatchObject({ startMs: 30_000 });
    expect(lines[3].tokens[0]).toMatchObject({ startMs: 45_000 });
  });

  it('keeps every ordered lyric block instead of choosing one cleaner duplicate', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 20_000;
    project.lyrics.lines = makerLinesFromPlainText(
      [
        '[Intro]',
        'alpha bravo charlie delta echo foxtrot golf hotel india juliet',
        '[Post-Chorus]',
        'unique',
        '[Verse 2]',
        'landing',
      ].join('\n'),
    );
    const aligned = applyWhisperTranscript(project, [
      // The real intro is only partially understood beneath the arrangement.
      { text: 'alpha', startMs: 1_000, endMs: 1_180 },
      { text: 'bravo', startMs: 1_200, endMs: 1_380 },
      { text: 'charlie', startMs: 1_400, endMs: 1_580 },
      { text: 'delta', startMs: 1_600, endMs: 1_780 },
      { text: 'unique', startMs: 5_000, endMs: 5_420 },
      // A cleaner duplicate later in the song must not make the route discard
      // the complete Post-Chorus block that precedes it in the reference.
      { text: 'alpha', startMs: 10_000, endMs: 10_180 },
      { text: 'bravo', startMs: 10_200, endMs: 10_380 },
      { text: 'charlie', startMs: 10_400, endMs: 10_580 },
      { text: 'delta', startMs: 10_600, endMs: 10_780 },
      { text: 'echo', startMs: 10_800, endMs: 10_980 },
      { text: 'foxtrot', startMs: 11_000, endMs: 11_180 },
      { text: 'golf', startMs: 11_200, endMs: 11_380 },
      { text: 'hotel', startMs: 11_400, endMs: 11_580 },
      { text: 'india', startMs: 11_600, endMs: 11_780 },
      { text: 'juliet', startMs: 11_800, endMs: 11_980 },
      { text: 'landing', startMs: 16_000, endMs: 16_420 },
    ]);
    const lyricLines = aligned.lyrics.lines.filter(
      (line) => line.kind !== 'section',
    );

    expect(aligned.lyrics.lines.map((line) => line.tokens[0].text)).toEqual([
      '[Intro]',
      'alpha',
      '[Post-Chorus]',
      'unique',
      '[Verse 2]',
      'landing',
    ]);
    expect(lyricLines[0].tokens[0]).toMatchObject({ startMs: 1_000 });
    expect(lyricLines[1].tokens[0]).toMatchObject({
      text: 'unique',
      startMs: 5_000,
      endMs: 5_420,
    });
    expect(lyricLines[2].tokens[0]).toMatchObject({
      text: 'landing',
      startMs: 16_000,
      endMs: 16_420,
    });
    expect(
      aligned.lyrics.lines
        .filter((line) => line.kind === 'section')
        .every((line) => line.startMs !== undefined),
    ).toBe(true);
  });

  it('never splits one lyric line across distant Whisper phrases', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 80_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'She lives a lonely life\nWhen morning comes around',
    );
    const aligned = applyWhisperTranscript(project, [
      { text: 'She', startMs: 11_000, endMs: 11_240 },
      { text: 'lives', startMs: 11_260, endMs: 11_600 },
      // Same words occur again much later and must not finish line one.
      { text: 'a', startMs: 45_000, endMs: 45_120 },
      { text: 'lonely', startMs: 45_140, endMs: 45_500 },
      { text: 'life', startMs: 45_520, endMs: 45_820 },
      { text: 'When', startMs: 50_000, endMs: 50_240 },
      { text: 'morning', startMs: 50_260, endMs: 50_650 },
      { text: 'comes', startMs: 50_670, endMs: 50_940 },
      { text: 'around', startMs: 50_960, endMs: 51_280 },
    ]);
    const firstLine = aligned.lyrics.lines[0].tokens;

    expect(firstLine[0]).toMatchObject({ startMs: 11_000 });
    expect(firstLine[1]).toMatchObject({ startMs: 11_260 });
    expect(firstLine.slice(2).every((word) => word.startMs === undefined)).toBe(
      true,
    );
  });

  it('does not turn melody-only evidence into words inside music', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 10_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'She lives a lonely life\nShe lives a lonely life\nAll that she wants',
    );
    const transcribed = applyWhisperTranscript(project, [
      { text: 'She', startMs: 500, endMs: 700 },
      { text: 'lives', startMs: 720, endMs: 940 },
      { text: 'a', startMs: 960, endMs: 1_020 },
      { text: 'lonely', startMs: 1_040, endMs: 1_340 },
      { text: 'life', startMs: 1_360, endMs: 1_620 },
      // Whisper omits the complete second performance of the repeated line.
      { text: 'All', startMs: 6_000, endMs: 6_180 },
      { text: 'that', startMs: 6_200, endMs: 6_390 },
      { text: 'she', startMs: 6_410, endMs: 6_590 },
      { text: 'wants', startMs: 6_610, endMs: 6_900 },
    ]);
    const repaired = applyBasicPitchMelody(
      transcribed,
      [
        { startMs: 500, endMs: 820, targetMidi: 60, confidence: 0.9 },
        { startMs: 840, endMs: 1_100, targetMidi: 62, confidence: 0.9 },
        { startMs: 1_120, endMs: 1_620, targetMidi: 64, confidence: 0.9 },
        { startMs: 3_300, endMs: 3_620, targetMidi: 60, confidence: 0.9 },
        { startMs: 3_640, endMs: 3_900, targetMidi: 62, confidence: 0.9 },
        { startMs: 3_920, endMs: 4_120, targetMidi: 63, confidence: 0.9 },
        { startMs: 4_140, endMs: 4_520, targetMidi: 64, confidence: 0.9 },
        { startMs: 4_540, endMs: 4_880, targetMidi: 65, confidence: 0.9 },
        { startMs: 6_000, endMs: 6_300, targetMidi: 67, confidence: 0.9 },
        { startMs: 6_320, endMs: 6_900, targetMidi: 69, confidence: 0.9 },
      ],
      true,
    );
    const words = repaired.lyrics.lines.flatMap((line) => line.tokens);
    const repeatedLine = words.slice(5, 10);

    expect(repeatedLine.map((word) => word.text)).toEqual([
      'She',
      'lives',
      'a',
      'lonely',
      'life',
    ]);
    expect(repeatedLine.every((word) => word.startMs === undefined)).toBe(true);
  });

  it('never lets mixed-master melody detection move Whisper lyric timing', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText(
      'She leads a lonely life\nOh she leads a lonely life',
    );
    const transcribed = applyWhisperTranscript(project, [
      { text: 'She', startMs: 11_000, endMs: 11_450 },
      { text: 'leads', startMs: 11_460, endMs: 11_920 },
      { text: 'a', startMs: 12_000, endMs: 12_100 },
      { text: 'lonely', startMs: 12_120, endMs: 12_760 },
      { text: 'life', startMs: 12_780, endMs: 14_200 },
      { text: 'Oh', startMs: 15_000, endMs: 15_300 },
      { text: 'she', startMs: 15_320, endMs: 15_620 },
      { text: 'life', startMs: 17_000, endMs: 17_500 },
    ]);
    const before = transcribed.lyrics.lines.flatMap((line) =>
      line.tokens.map((token) => [token.startMs, token.endMs]),
    );
    const detected = applyBasicPitchMelody(transcribed, [
      { startMs: 500, endMs: 1_500, targetMidi: 38, confidence: 0.99 },
      { startMs: 3_000, endMs: 4_500, targetMidi: 85, confidence: 0.98 },
      { startMs: 11_000, endMs: 11_700, targetMidi: 61, confidence: 0.8 },
      { startMs: 15_000, endMs: 17_500, targetMidi: 64, confidence: 0.8 },
    ]);

    expect(
      detected.lyrics.lines.flatMap((line) =>
        line.tokens.map((token) => [token.startMs, token.endMs]),
      ),
    ).toEqual(before);
  });

  it('repairs an old disordered repeated line on the next Whisper pass', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 8_000;
    project.analysis.whisperPasses = 1;
    project.lyrics.lines = makerLinesFromPlainText(
      'She lives a lonely life\nShe lives a lonely life',
    );
    const existing = project.lyrics.lines.flatMap((line) => line.tokens);
    const oldTiming = [
      [4_500, 4_700],
      [700, 920],
      [930, 1_000],
      [1_020, 1_300],
      [1_310, 1_560],
      [4_500, 4_700],
      [4_710, 4_920],
      [4_930, 5_000],
      [5_020, 5_300],
      [5_310, 5_560],
    ];
    existing.forEach((token, index) => {
      Object.assign(token, {
        startMs: oldTiming[index][0],
        endMs: oldTiming[index][1],
        confidence: 0.82,
        source: 'whisper',
      });
    });

    const repaired = applyWhisperTranscript(project, [
      { text: 'She', startMs: 500, endMs: 700 },
      { text: 'lives', startMs: 710, endMs: 920 },
      { text: 'a', startMs: 930, endMs: 1_000 },
      { text: 'lonely', startMs: 1_020, endMs: 1_300 },
      { text: 'life', startMs: 1_310, endMs: 1_560 },
      { text: 'She', startMs: 4_500, endMs: 4_700 },
      { text: 'lives', startMs: 4_710, endMs: 4_920 },
      { text: 'a', startMs: 4_930, endMs: 5_000 },
      { text: 'lonely', startMs: 5_020, endMs: 5_300 },
      { text: 'life', startMs: 5_310, endMs: 5_560 },
    ]);
    const words = repaired.lyrics.lines.flatMap((line) => line.tokens);

    expect(words[0]).toMatchObject({ startMs: 500, endMs: 700 });
    words.slice(1).forEach((word, index) => {
      expect(word.startMs).toBeGreaterThanOrEqual(words[index].endMs as number);
    });
    expect(words[5]).toMatchObject({ startMs: 4_500, endMs: 4_700 });
  });

  it('refines later Whisper passes while preserving manually locked words', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText('She leads a lonely life');
    const first = applyWhisperTranscript(project, [
      { text: 'She', startMs: 1_000, endMs: 1_300 },
      { text: 'leads', startMs: 1_320, endMs: 1_700 },
      { text: 'life', startMs: 2_400, endMs: 2_700 },
    ]);
    const [she, leads, article, lonely] = first.lyrics.lines[0].tokens;
    Object.assign(lonely, {
      startMs: 2_000,
      endMs: 2_380,
      timingLocked: true,
      source: 'manual',
    });
    const trustedShe = [she.startMs, she.endMs];
    const trustedLeads = [leads.startMs, leads.endMs];
    const refined = applyWhisperTranscript(first, [
      { text: 'She', startMs: 1_060, endMs: 1_360 },
      { text: 'leads', startMs: 1_380, endMs: 1_760 },
      { text: 'a', startMs: 1_780, endMs: 1_900 },
      { text: 'lonely', startMs: 2_020, endMs: 2_400 },
      { text: 'life', startMs: 2_420, endMs: 2_720 },
    ]);
    const refinedWords = refined.lyrics.lines[0].tokens;

    expect([refinedWords[0].startMs, refinedWords[0].endMs]).toEqual([
      (trustedShe[0]! + 1_060) / 2,
      (trustedShe[1]! + 1_360) / 2,
    ]);
    expect([refinedWords[1].startMs, refinedWords[1].endMs]).toEqual([
      (trustedLeads[0]! + 1_380) / 2,
      (trustedLeads[1]! + 1_760) / 2,
    ]);
    expect(refinedWords[2]).toMatchObject({
      text: article.text,
      startMs: 1_780,
      endMs: 1_900,
    });
    expect(refinedWords[3]).toMatchObject({
      startMs: 2_000,
      endMs: 2_380,
      timingLocked: true,
      source: 'manual',
    });
    expect(refined.analysis.whisperPasses).toBe(2);
  });

  it('removes unsupported automatic timing on a later Whisper pass', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 60_000;
    project.analysis.whisperPasses = 1;
    project.lyrics.lines = makerLinesFromPlainText('voice phantom returns');
    project.lyrics.lines[0].tokens.forEach((token, index) =>
      Object.assign(token, {
        startMs: 20_000 + index * 500,
        endMs: 20_400 + index * 500,
        confidence: 0.9,
        source: 'whisper',
      }),
    );

    const refined = applyWhisperTranscript(project, [
      { text: 'voice', startMs: 4_000, endMs: 4_300 },
      { text: 'returns', startMs: 4_700, endMs: 5_100 },
    ]);
    const words = refined.lyrics.lines[0].tokens;

    expect(words[0]).toMatchObject({ startMs: 4_000, endMs: 4_300 });
    expect(words[1].startMs).toBeUndefined();
    expect(words[2]).toMatchObject({ startMs: 4_700, endMs: 5_100 });
  });

  it('keeps a trusted complete line missed by a later window profile', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 30_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'She lives a lonely life\nWhen morning finally comes',
    );
    const first = applyWhisperTranscript(project, [
      { text: 'She', startMs: 5_000, endMs: 5_200 },
      { text: 'lives', startMs: 5_220, endMs: 5_480 },
      { text: 'a', startMs: 5_500, endMs: 5_580 },
      { text: 'lonely', startMs: 5_600, endMs: 5_940 },
      { text: 'life', startMs: 5_960, endMs: 6_220 },
      { text: 'When', startMs: 12_000, endMs: 12_240 },
      { text: 'morning', startMs: 12_260, endMs: 12_600 },
      { text: 'finally', startMs: 12_620, endMs: 12_900 },
      { text: 'comes', startMs: 12_920, endMs: 13_180 },
    ]);
    const refined = applyWhisperTranscript(first, [
      // This profile misses line one but measures line two slightly better.
      { text: 'When', startMs: 12_060, endMs: 12_280 },
      { text: 'morning', startMs: 12_300, endMs: 12_640 },
      { text: 'finally', startMs: 12_660, endMs: 12_940 },
      { text: 'comes', startMs: 12_960, endMs: 13_220 },
    ]);

    expect(refined.lyrics.lines[0].tokens[0]).toMatchObject({
      startMs: 5_000,
      endMs: 5_200,
    });
    expect(refined.lyrics.lines[0].tokens[4]).toMatchObject({
      startMs: 5_960,
      endMs: 6_220,
    });
    expect(refined.lyrics.lines[1].tokens[0].startMs).toBeCloseTo(12_030);
  });

  it('lets a canonical single pass remove stale automatic line timing', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 30_000;
    project.analysis.whisperPasses = 1;
    project.lyrics.lines = makerLinesFromPlainText(
      'Old unsupported line\nCurrent supported line',
    );
    project.lyrics.lines
      .flatMap((line) => line.tokens)
      .forEach((token, index) => {
        token.startMs = 2_000 + index * 300;
        token.endMs = 2_250 + index * 300;
        token.confidence = 0.9;
        token.source = 'whisper';
      });
    const currentPass = [
      { text: 'Current', startMs: 12_000, endMs: 12_300 },
      { text: 'supported', startMs: 12_320, endMs: 12_700 },
      { text: 'line', startMs: 12_720, endMs: 13_000 },
    ];
    const transcript = Object.assign(
      currentPass.map((word) => ({ ...word })),
      { passes: [currentPass] },
    );

    const aligned = applyWhisperTranscript(project, transcript);

    expect(
      aligned.lyrics.lines[0].tokens.every(
        (token) => token.startMs === undefined && token.endMs === undefined,
      ),
    ).toBe(true);
    expect(aligned.lyrics.lines[1].tokens[0]).toMatchObject({
      startMs: 12_000,
      endMs: 12_300,
    });
  });

  it('rejects a melody repair that would move a doubtful word behind its previous anchor', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 20_000;
    project.lyrics.lines = makerLinesFromPlainText('She leads a lonely life');
    const words = project.lyrics.lines[0].tokens;
    Object.assign(words[0], {
      startMs: 11_000,
      endMs: 11_500,
      confidence: 0.82,
      source: 'whisper',
    });
    Object.assign(words[1], {
      startMs: 11_500,
      endMs: 12_000,
      confidence: 0.48,
      source: 'whisper',
    });
    Object.assign(words[2], {
      startMs: 12_000,
      endMs: 12_100,
      confidence: 0.82,
      source: 'whisper',
    });
    Object.assign(words[3], {
      startMs: 12_100,
      endMs: 12_800,
      confidence: 0.82,
      source: 'manual',
      timingLocked: true,
    });
    Object.assign(words[4], {
      startMs: 12_800,
      endMs: 14_000,
      confidence: 0.82,
      source: 'whisper',
    });

    const repaired = applyBasicPitchMelody(
      project,
      [{ startMs: 500, endMs: 1_500, targetMidi: 74, confidence: 0.99 }],
      true,
    );

    expect(repaired.lyrics.lines[0].tokens[1]).toMatchObject({
      startMs: 11_500,
      endMs: 12_000,
      source: 'whisper',
    });
  });

  it('never overlaps Whisper words and rejects timestamps with no remaining duration', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText('I a x we go');
    const aligned = applyWhisperTranscript(project, [
      { text: 'I', startMs: 1_000, endMs: 1_120 },
      { text: 'a', startMs: 1_050, endMs: 1_130 },
      { text: 'x', startMs: 1_060, endMs: 1_140 },
      { text: 'we', startMs: 1_070, endMs: 1_150 },
      { text: 'go', startMs: 1_080, endMs: 1_160 },
    ]);
    const words = aligned.lyrics.lines.flatMap((line) => line.tokens);

    const timed = words.filter(
      (word) => word.startMs !== undefined && word.endMs !== undefined,
    );
    timed.forEach((word) => {
      expect(word.endMs).toBeGreaterThan(word.startMs as number);
    });
    timed.slice(1).forEach((word, index) => {
      expect(word.startMs).toBeGreaterThanOrEqual(timed[index].endMs as number);
    });
    expect(timed.length).toBeLessThan(words.length);
  });

  it('rejects automatic words that cannot fit between locked timing anchors', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText('Before I a x we go After');
    const words = project.lyrics.lines[0].tokens;
    Object.assign(words[0], {
      startMs: 900,
      endMs: 1_000,
      timingLocked: true,
      source: 'manual',
    });
    Object.assign(words[6], {
      startMs: 1_001,
      endMs: 1_200,
      timingLocked: true,
      source: 'manual',
    });
    const aligned = applyWhisperTranscript(project, [
      { text: 'Before', startMs: 900, endMs: 1_000 },
      { text: 'I', startMs: 1_000, endMs: 1_030 },
      { text: 'a', startMs: 1_000, endMs: 1_030 },
      { text: 'x', startMs: 1_000, endMs: 1_030 },
      { text: 'we', startMs: 1_000, endMs: 1_030 },
      { text: 'go', startMs: 1_000, endMs: 1_030 },
      { text: 'After', startMs: 1_001, endMs: 1_200 },
    ]);
    const packed = aligned.lyrics.lines[0].tokens;

    expect(packed[0]).toMatchObject({ startMs: 900, endMs: 1_000 });
    expect(
      packed
        .slice(1, 6)
        .every(
          (word) => word.startMs === undefined && word.endMs === undefined,
        ),
    ).toBe(true);
    expect(packed[6]).toMatchObject({ startMs: 1_001, endMs: 1_200 });
  });

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

describe('Karaoke Maker transcript-authored lyrics', () => {
  const authoringProject = () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = [];
    return project;
  };
  const authoredTokens = (project: IKaraokeMakerProject) =>
    project.lyrics.lines.flatMap((line) => line.tokens);

  it('writes a clean transcript through as lyrics with its timing intact', () => {
    const authored = applyTranscriptAsLyrics(authoringProject(), [
      { text: 'Storm', startMs: 14_000, endMs: 14_480 },
      { text: 'over', startMs: 14_500, endMs: 15_280 },
      { text: 'water.', startMs: 15_300, endMs: 15_900 },
      { text: 'Rowing', startMs: 22_000, endMs: 22_400 },
      { text: 'home', startMs: 22_420, endMs: 23_000 },
    ]);
    const tokens = authoredTokens(authored);

    expect(tokens.map((token) => token.text)).toEqual([
      'Storm',
      'over',
      'water.',
      'Rowing',
      'home',
    ]);
    expect(tokens.every((token) => token.startMs !== undefined)).toBe(true);
    expect(tokens[0]).toMatchObject({ startMs: 14_000 });
    expect(tokens[4]).toMatchObject({ endMs: 23_000 });
    expect(authored.lyrics.lines).toHaveLength(2);
  });

  it('does not park a runaway word span on the previous phrase', () => {
    // Measured: Whisper reported this word starting 15.88 s, where the last
    // phrase had just ended, and running past 22 s. Trimming that span to a
    // plausible length kept its start, leaving the word alone in the
    // instrumental gap while the phrase it opens begins at 22 s.
    const authored = applyTranscriptAsLyrics(authoringProject(), [
      { text: 'Storm', startMs: 14_000, endMs: 14_480 },
      { text: 'water.', startMs: 14_500, endMs: 15_280 },
      { text: 'Rowing', startMs: 15_880, endMs: 21_800 },
      { text: 'over', startMs: 22_000, endMs: 22_400 },
      { text: 'home', startMs: 22_420, endMs: 23_000 },
    ]);
    const runaway = authoredTokens(authored).find(
      (token) => token.text === 'Rowing',
    );

    expect(runaway).toBeDefined();
    expect(runaway?.startMs).toBeUndefined();
    expect(runaway?.endMs).toBeUndefined();
  });

  it('leaves words untimed when Whisper stacks them on one timestamp', () => {
    // Measured: 27 of 158 words came back on their chunk's terminal
    // timestamp — 29.98 s past a chunk start — and were written out as 1 ms
    // words covering the song's whole last third.
    const authored = applyTranscriptAsLyrics(authoringProject(), [
      { text: 'Storm', startMs: 141_000, endMs: 141_400 },
      { text: 'over', startMs: 169_980, endMs: 169_980 },
      { text: 'open', startMs: 169_980, endMs: 169_980 },
      { text: 'water', startMs: 169_980, endMs: 169_980 },
      { text: 'again', startMs: 189_980, endMs: 189_980 },
    ]);
    const tokens = authoredTokens(authored);

    expect(tokens.map((token) => token.text)).toEqual([
      'Storm',
      'over',
      'open',
      'water',
      'again',
    ]);
    expect(tokens[0]).toMatchObject({ startMs: 141_000, endMs: 141_400 });
    expect(
      tokens
        .slice(1)
        .every(
          (token) => token.startMs === undefined && token.endMs === undefined,
        ),
    ).toBe(true);
  });

  it('never places a word past the end of the audio', () => {
    // Measured: one word landed at 266.08 s in a song 253.05 s long.
    const authored = applyTranscriptAsLyrics(authoringProject(), [
      { text: 'Storm', startMs: 141_000, endMs: 141_400 },
      { text: 'over', startMs: 266_080, endMs: 266_480 },
    ]);
    const late = authoredTokens(authored).find(
      (token) => token.text === 'over',
    );

    expect(late?.startMs).toBeUndefined();
  });
});

describe('Karaoke Maker transcript line breaks', () => {
  const authoringProject = () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = [];
    return project;
  };

  it('breaks a line where the singer stops and not on a word count', () => {
    // Eleven words sung straight through with no rest and no sentence end.
    // A fixed nine-word cut used to end the line inside the phrase, carrying
    // the next sentence's opening words into the same preview line.
    const sung = [
      'we',
      'gotta',
      'leave',
      'some',
      'of',
      'it',
      'behind',
      'and',
      'carry',
      'the',
      'rest',
    ];
    const authored = applyTranscriptAsLyrics(
      authoringProject(),
      sung.map((text, index) => ({
        text,
        startMs: 20_000 + index * 400,
        endMs: 20_300 + index * 400,
      })),
    );

    expect(authored.lyrics.lines).toHaveLength(1);
    expect(authored.lyrics.lines[0].tokens.map((token) => token.text)).toEqual(
      sung,
    );
  });

  it('starts a new line at a breath and at a finished sentence', () => {
    const authored = applyTranscriptAsLyrics(authoringProject(), [
      { text: 'we', startMs: 20_000, endMs: 20_300 },
      { text: 'carry', startMs: 20_320, endMs: 20_700 },
      // A breath: 1.4 s of rest.
      { text: 'the', startMs: 22_100, endMs: 22_400 },
      { text: 'rest.', startMs: 22_420, endMs: 22_800 },
      // No rest at all, but the sentence finished on the word before.
      { text: 'why', startMs: 22_820, endMs: 23_100 },
    ]);

    expect(
      authored.lyrics.lines.map((line) =>
        line.tokens.map((token) => token.text).join(' '),
      ),
    ).toEqual(['we carry', 'the rest.', 'why']);
  });
});

describe('Karaoke Maker line breaks across unusable timing', () => {
  it('reads a breath from what Whisper heard, not from what it placed', () => {
    // Measured on one song: 50 of 150 words had unusable spans, and reading
    // rests only from the placed words merged the lot into a single line of
    // forty. A word can be too vague to place and still show where the
    // singer stopped.
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = [];
    const authored = applyTranscriptAsLyrics(project, [
      { text: 'we', startMs: 20_000, endMs: 20_300 },
      // Unplaceable: the span is far longer than the word can be.
      { text: 'carry', startMs: 20_320, endMs: 26_000 },
      // A 1.5 s rest after that word, which only the raw timing knows about.
      { text: 'the', startMs: 27_500, endMs: 27_800 },
      { text: 'rest', startMs: 27_820, endMs: 28_200 },
    ]);
    const carried = authored.lyrics.lines
      .flatMap((line) => line.tokens)
      .find((token) => token.text === 'carry');

    expect(
      authored.lyrics.lines.map((line) =>
        line.tokens.map((token) => token.text).join(' '),
      ),
    ).toEqual(['we carry', 'the rest']);
    expect(carried?.startMs).toBeUndefined();
  });
});

describe('Karaoke Maker melody repair of unplaced words', () => {
  it('places a word Whisper could not, and leaves the ones it could', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 60_000;
    project.lyrics.lines = [];
    const authored = applyTranscriptAsLyrics(project, [
      { text: 'we', startMs: 20_000, endMs: 20_300 },
      // Unplaceable: the span is far longer than the word can be.
      { text: 'carry', startMs: 20_320, endMs: 26_000 },
      { text: 'on', startMs: 27_500, endMs: 27_800 },
    ]);
    const before = authored.lyrics.lines.flatMap((line) => line.tokens);
    expect(
      before.find((token) => token.text === 'carry')?.startMs,
    ).toBeUndefined();

    const repaired = applyBasicPitchMelody(
      authored,
      [
        { startMs: 20_000, endMs: 20_300, targetMidi: 60, confidence: 0.9 },
        { startMs: 21_000, endMs: 21_700, targetMidi: 62, confidence: 0.9 },
        { startMs: 27_500, endMs: 27_800, targetMidi: 64, confidence: 0.9 },
      ],
      true,
    );
    const tokens = repaired.lyrics.lines.flatMap((line) => line.tokens);
    const carried = tokens.find((token) => token.text === 'carry');

    // The word Whisper placed keeps the timestamp Whisper gave it.
    expect(tokens.find((token) => token.text === 'we')).toMatchObject({
      startMs: 20_000,
      endMs: 20_300,
    });
    expect(tokens.find((token) => token.text === 'on')).toMatchObject({
      startMs: 27_500,
      endMs: 27_800,
    });
    // The one it could not is now on the pitch that was actually sung, and
    // stays between the two words that bound it.
    expect(carried?.startMs).toBeGreaterThanOrEqual(20_300);
    expect(carried?.endMs).toBeLessThanOrEqual(27_500);
    expect(carried?.source).toBe('auto-align');
  });
});

describe('Karaoke Maker detection with supplied lyrics', () => {
  it('leaves lyric words untimed when Whisper stacks its timestamps', () => {
    // The same failure that hit the transcript-authored path reaches this one
    // through the same transcript: a chunk's terminal timestamp carrying every
    // remaining word. Those words used to become 1 ms lyric timings here too.
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = makerLinesFromPlainText(
      'we carry on\nthrough the quiet water',
    );
    const aligned = applyWhisperTranscript(project, [
      { text: 'we', startMs: 20_000, endMs: 20_300 },
      { text: 'carry', startMs: 20_320, endMs: 20_700 },
      { text: 'on', startMs: 20_720, endMs: 21_100 },
      { text: 'through', startMs: 169_980, endMs: 169_980 },
      { text: 'the', startMs: 169_980, endMs: 169_980 },
      { text: 'quiet', startMs: 169_980, endMs: 169_980 },
      { text: 'water', startMs: 169_980, endMs: 169_980 },
    ]);
    const [first, second] = aligned.lyrics.lines;

    expect(first.tokens.every((token) => token.startMs !== undefined)).toBe(
      true,
    );
    expect(
      second.tokens.every(
        (token) => token.startMs === undefined && token.endMs === undefined,
      ),
    ).toBe(true);
  });

  it('fills a word Whisper missed inside a confirmed sentence', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    // Whisper misses the third word entirely; the words around it are placed.
    project.lyrics.lines = makerLinesFromPlainText('we carry now on');
    const aligned = applyWhisperTranscript(project, [
      { text: 'we', startMs: 20_000, endMs: 20_300 },
      { text: 'carry', startMs: 20_320, endMs: 20_700 },
      { text: 'on', startMs: 22_000, endMs: 22_400 },
    ]);
    // This path has its own answer for a word missed between two confirmed
    // ones, and it does not need the melody: the word is placed inside the
    // same continuous vocal phrase, between the words that bound it.
    const filled = aligned.lyrics.lines[0].tokens[2];
    expect(filled.startMs).toBeGreaterThanOrEqual(20_700);
    expect(filled.endMs).toBeLessThanOrEqual(22_000);

    // That fill is an interpolation between two anchors, and it says so with
    // a low confidence. The melody then refines it onto the note actually
    // sung there — evidence replacing arithmetic.
    const repaired = applyBasicPitchMelody(
      aligned,
      [
        { startMs: 20_000, endMs: 20_300, targetMidi: 60, confidence: 0.9 },
        { startMs: 21_000, endMs: 21_500, targetMidi: 62, confidence: 0.9 },
        { startMs: 22_000, endMs: 22_400, targetMidi: 64, confidence: 0.9 },
      ],
      true,
    );
    const now = repaired.lyrics.lines[0].tokens[2];

    expect(now.startMs).toBe(21_000);
    expect(now.endMs).toBe(21_500);
    expect(now.source).toBe('auto-align');
    // The words Whisper did place keep exactly what Whisper measured.
    expect(repaired.lyrics.lines[0].tokens[0]).toMatchObject({
      startMs: 20_000,
      endMs: 20_300,
    });
  });
});

describe('Karaoke Maker melody repair boundaries', () => {
  it('still refuses to paint an unmatched verse over instrumental music', () => {
    // The repair places untimed words from detected notes. That must not
    // become a way for a verse the aligner deliberately refused to time to
    // land on whatever notes happen to exist elsewhere in the song.
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 90_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'she sings here\nmissing verse words\nvoices return now',
    );
    const aligned = applyWhisperTranscript(project, [
      { text: 'she', startMs: 10_000, endMs: 10_200 },
      { text: 'sings', startMs: 10_220, endMs: 10_500 },
      { text: 'here', startMs: 10_520, endMs: 10_800 },
      { text: 'voices', startMs: 45_000, endMs: 45_300 },
      { text: 'return', startMs: 45_320, endMs: 45_620 },
      { text: 'now', startMs: 45_640, endMs: 45_900 },
    ]);
    const repaired = applyBasicPitchMelody(
      aligned,
      [
        { startMs: 25_000, endMs: 25_600, targetMidi: 60, confidence: 0.9 },
        { startMs: 26_000, endMs: 26_600, targetMidi: 62, confidence: 0.9 },
        { startMs: 27_000, endMs: 27_600, targetMidi: 64, confidence: 0.9 },
      ],
      true,
    );

    expect(
      repaired.lyrics.lines[1].tokens.every(
        (token) => token.startMs === undefined && token.endMs === undefined,
      ),
    ).toBe(true);
  });
});

describe('Karaoke Maker analysis windows over missing timing', () => {
  it('asks the detector about the stretch where words have no timing', () => {
    // Measured: 50 words with no timing, the repair reached 1 of them, and the
    // 81-second hole they sat in had never been handed to the detector — notes
    // only existed where words were already timed.
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 120_000;
    project.lyrics.lines = makerLinesFromPlainText(
      'she sings here\nnobody timed this verse\nvoices return now',
    );
    const [first, , last] = project.lyrics.lines;
    first.tokens.forEach((token, index) => {
      Object.assign(token, {
        startMs: 10_000 + index * 400,
        endMs: 10_300 + index * 400,
      });
    });
    last.tokens.forEach((token, index) => {
      Object.assign(token, {
        startMs: 90_000 + index * 400,
        endMs: 90_300 + index * 400,
      });
    });

    const windows = karaokeMakerVocalAnalysisWindows(project);
    const coversTheHole = windows.some(
      (window) => window.startMs <= 11_500 && window.endMs >= 89_500,
    );

    expect(coversTheHole).toBe(true);
  });

  it('still asks about the whole song when nothing is timed at all', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 120_000;
    project.lyrics.lines = makerLinesFromPlainText('nothing here is timed');

    expect(karaokeMakerVocalAnalysisWindows(project)).toEqual([
      { startMs: 0, endMs: 120_000 },
    ]);
  });
});

describe('Karaoke Maker vocal rests', () => {
  const tone = (
    samples: Float32Array,
    sampleRate: number,
    fromMs: number,
    toMs: number,
  ) => {
    const from = Math.round((fromMs / 1_000) * sampleRate);
    const to = Math.round((toMs / 1_000) * sampleRate);
    for (let index = from; index < to && index < samples.length; index += 1) {
      samples[index] = Math.sin((2 * Math.PI * 220 * index) / sampleRate) * 0.5;
    }
  };

  it('finds where the voice stops and ignores syllable gaps', () => {
    const sampleRate = 16_000;
    const samples = new Float32Array(sampleRate * 6);
    // Two sung phrases with a 1 s rest, and a 120 ms consonant gap inside the
    // first one that must not read as a breath.
    tone(samples, sampleRate, 0, 1_400);
    tone(samples, sampleRate, 1_520, 2_500);
    tone(samples, sampleRate, 3_500, 6_000);

    const rests = karaokeMakerVocalRests(samples, sampleRate);

    expect(rests).toHaveLength(1);
    expect(rests[0].startMs).toBeGreaterThanOrEqual(2_400);
    expect(rests[0].endMs).toBeLessThanOrEqual(3_600);
  });

  it('reports nothing for silence and nothing for continuous singing', () => {
    const sampleRate = 16_000;
    const continuous = new Float32Array(sampleRate * 3);
    tone(continuous, sampleRate, 0, 3_000);

    expect(karaokeMakerVocalRests(continuous, sampleRate)).toEqual([]);
    expect(
      karaokeMakerVocalRests(new Float32Array(sampleRate), sampleRate),
    ).toEqual([]);
  });

  it('breaks a line where the stem rested and Whisper reported no gap', () => {
    // The measured failure: 39 words with every gap at zero, which the breath
    // rule cannot see. The stem can.
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = [];
    const words = Array.from({ length: 6 }, (_, index) => ({
      text: `word${index}`,
      startMs: 15_000 + index * 400,
      endMs: 15_400 + index * 400,
    }));
    // Boundaries sit at 15 400, 15 800, 16 200, 16 600, 17 000. This rest is
    // centred on 16 300, so the third boundary owns it.
    const authored = applyTranscriptAsLyrics(project, words, [
      { startMs: 16_150, endMs: 16_450 },
    ]);

    expect(authored.lyrics.lines.map((line) => line.tokens.length)).toEqual([
      3, 3,
    ]);
  });
});

describe('Karaoke Maker lyric repetition', () => {
  const at = (text: string, seconds: number) => ({
    text,
    startMs: seconds * 1_000,
    endMs: seconds * 1_000 + 300,
  });

  it('finds a chorus that returns, and where its edges are', () => {
    // A hook sung at 20 s and again at 80 s, with a unique verse between.
    const hook = ['break', 'the', 'silence', 'of', 'the', 'evening'];
    const verse = [
      'nobody',
      'told',
      'her',
      'about',
      'winter',
      'harbours',
      'closing',
      'early',
      'when',
      'the',
      'ferries',
      'stopped',
      'running',
      'north',
      'across',
      'grey',
      'water',
      'toward',
      'islands',
      'nobody',
      'names',
      'anymore',
      'except',
      'sailors',
      'counting',
      'lights',
      'ashore',
    ];
    const words = [
      ...hook.map((text, index) => at(text, 20 + index * 0.4)),
      ...verse.map((text, index) => at(text, 40 + index * 0.4)),
      ...hook.map((text, index) => at(text, 80 + index * 0.4)),
    ];

    const repeats = karaokeMakerRepeatedRuns(words);

    expect(repeats).toHaveLength(1);
    expect(repeats[0]).toMatchObject({ firstIndex: 0 });
    expect(repeats[0].length).toBe(hook.length);

    const breaks = karaokeMakerRepeatEdgeBreaks(repeats, words.length);
    // The hook's end, the second performance's start, and nothing invented.
    expect([...breaks].sort((a, b) => a - b)).toEqual(
      [
        6,
        repeats[0].secondIndex,
        repeats[0].secondIndex + repeats[0].length,
      ].filter((index) => index < words.length),
    );
  });

  it('does not call a run of filler words a chorus', () => {
    // Six "oh"s repeated say nothing in a song that is mostly "oh".
    const filler = ['oh', 'oh', 'oh', 'oh', 'oh', 'oh'];
    const words = [
      ...filler.map((text, index) => at(text, 20 + index * 0.4)),
      ...filler.map((text, index) => at(text, 40 + index * 0.4)),
      ...filler.map((text, index) => at(text, 80 + index * 0.4)),
    ];

    expect(karaokeMakerRepeatedRuns(words)).toEqual([]);
  });

  it('ignores a phrase repeated immediately, which is a stutter', () => {
    const hook = ['break', 'the', 'silence', 'of', 'the', 'evening'];
    const words = [
      ...hook.map((text, index) => at(text, 20 + index * 0.4)),
      ...hook.map((text, index) => at(text, 23 + index * 0.4)),
    ];

    expect(karaokeMakerRepeatedRuns(words)).toEqual([]);
  });

  it('reports a song with no repetition at all as having none', () => {
    // Two of the fourteen saved projects genuinely never repeat a line.
    const words = [
      'she',
      'walked',
      'past',
      'the',
      'harbour',
      'wall',
      'counting',
      'every',
      'window',
      'lit',
      'against',
      'the',
      'weather',
    ].map((text, index) => at(text, 20 + index * 0.4));

    expect(karaokeMakerRepeatedRuns(words)).toEqual([]);
  });
});

describe('Karaoke Maker detector hardening', () => {
  const authoringProject = () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = [];
    return project;
  };

  it('keeps two fast words that honestly tie on one timestamp bin', () => {
    // Whisper quantises to 20 ms, so a tie is real singing when the spans
    // differ and are plausible. Three or more on one instant is the collapse.
    const authored = applyTranscriptAsLyrics(authoringProject(), [
      { text: 'gotta', startMs: 24_500, endMs: 24_560 },
      { text: 'go', startMs: 24_500, endMs: 24_650 },
      { text: 'now', startMs: 24_700, endMs: 25_000 },
    ]);
    const tokens = authored.lyrics.lines.flatMap((line) => line.tokens);

    expect(tokens).toHaveLength(3);
    expect(tokens.every((token) => token.startMs !== undefined)).toBe(true);
  });

  it('still drops three or more words stacked on one instant', () => {
    const authored = applyTranscriptAsLyrics(authoringProject(), [
      { text: 'first', startMs: 20_000, endMs: 20_300 },
      { text: 'one', startMs: 169_980, endMs: 170_100 },
      { text: 'two', startMs: 169_980, endMs: 170_200 },
      { text: 'three', startMs: 169_980, endMs: 170_300 },
    ]);
    const tokens = authored.lyrics.lines.flatMap((line) => line.tokens);

    expect(tokens).toHaveLength(4);
    expect(tokens[0].startMs).toBe(20_000);
    expect(tokens.slice(1).every((token) => token.startMs === undefined)).toBe(
      true,
    );
  });

  it('never lets one transcript entry become two lyric tokens', () => {
    // A chunk can come back as "thank you". Walking tokens against transcript
    // entries then shifts by one for the rest of the song.
    const authored = applyTranscriptAsLyrics(authoringProject(), [
      { text: 'thank you', startMs: 1_000, endMs: 1_500 },
      { text: 'friend', startMs: 1_600, endMs: 2_000 },
    ]);
    const tokens = authored.lyrics.lines.flatMap((line) => line.tokens);

    expect(tokens.map((token) => token.text)).toEqual([
      'thank',
      'you',
      'friend',
    ]);
    expect(tokens[2]).toMatchObject({ startMs: 1_600, endMs: 2_000 });
    expect(tokens[0].startMs).toBe(1_000);
    expect(tokens[1].endMs).toBe(1_500);
  });
});

describe('Karaoke Maker hairline timings', () => {
  it('does not place a word left holding a millisecond after packing', () => {
    // Two words may honestly share a 20 ms timestamp bin, but packing them in
    // order can leave the first with a span no syllable could occupy.
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = [];
    const authored = applyTranscriptAsLyrics(project, [
      { text: 'before', startMs: 20_000, endMs: 20_400 },
      { text: 'gotta', startMs: 24_500, endMs: 24_505 },
      { text: 'go', startMs: 24_500, endMs: 24_900 },
      { text: 'after', startMs: 25_000, endMs: 25_400 },
    ]);
    const tokens = authored.lyrics.lines.flatMap((line) => line.tokens);
    const hairline = tokens.filter(
      (token) =>
        token.startMs !== undefined &&
        token.endMs !== undefined &&
        token.endMs - token.startMs <= 2,
    );

    expect(tokens).toHaveLength(4);
    expect(hairline).toHaveLength(0);
    expect(tokens[0]).toMatchObject({ startMs: 20_000 });
    expect(tokens[3]).toMatchObject({ startMs: 25_000 });
  });
});

describe('Karaoke Maker line breaks from Whisper segments', () => {
  it('ends a line where the model ended its own utterance', () => {
    // The only line signal that does not have to be placed through the word
    // timings: the model divided this audio itself. Silence finds 2-9 breaks
    // a minute against the 18-21 human karaoke uses, and note gaps land
    // wherever the timings put them.
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = [];
    const words = Array.from({ length: 6 }, (_, index) => ({
      text: `word${index}`,
      startMs: 15_000 + index * 400,
      endMs: 15_400 + index * 400,
    }));

    const authored = applyTranscriptAsLyrics(
      project,
      words,
      [],
      [
        { startMs: 15_000, endMs: 16_200 },
        { startMs: 16_200, endMs: 17_400 },
      ],
    );

    expect(authored.lyrics.lines.map((line) => line.tokens.length)).toEqual([
      3, 3,
    ]);
  });

  it('groups by what the words show when no segments arrive', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = [];
    const authored = applyTranscriptAsLyrics(project, [
      { text: 'we', startMs: 20_000, endMs: 20_300 },
      { text: 'carry', startMs: 20_320, endMs: 20_700 },
      { text: 'the', startMs: 22_100, endMs: 22_400 },
    ]);

    expect(authored.lyrics.lines.map((line) => line.tokens.length)).toEqual([
      2, 1,
    ]);
  });
});

describe('Karaoke Maker structure-aware line breaks', () => {
  const blind = () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = [];
    return project;
  };

  it('breaks at a repeated phrase edge when nothing else can', () => {
    // The case that defeated silence and note gaps: continuous delivery, no
    // punctuation, no rests, no segments. A phrase performed twice still has
    // edges, because the singer started and finished it twice.
    const hook = ['break', 'the', 'silence', 'of', 'the', 'evening'];
    const verse = [
      'nobody',
      'told',
      'her',
      'about',
      'winter',
      'harbours',
      'closing',
      'early',
      'when',
      'the',
      'ferries',
      'stopped',
      'running',
      'north',
      'across',
      'grey',
      'water',
      'toward',
      'islands',
      'nobody',
      'names',
      'anymore',
      'except',
      'sailors',
      'counting',
      'lights',
      'ashore',
    ];
    const words = [...hook, ...verse, ...hook].map((text, index) => ({
      text,
      // 300 ms apart with no gap anywhere: no breath rule can fire.
      startMs: 20_000 + index * 300,
      endMs: 20_280 + index * 300,
    }));

    const authored = applyTranscriptAsLyrics(blind(), words);
    const lengths = authored.lyrics.lines.map((line) => line.tokens.length);

    // Positive control: the repetition must actually produce breaks, or a
    // detector returning nothing would pass the null test below unnoticed.
    expect(authored.lyrics.lines.length).toBeGreaterThan(1);
    expect(Math.max(...lengths)).toBeLessThan(words.length);
    expect(lengths.reduce((total, length) => total + length, 0)).toBe(
      words.length,
    );
  });

  it('adds nothing when the song never repeats a phrase', () => {
    const words = [
      'she',
      'walked',
      'past',
      'the',
      'harbour',
      'wall',
      'counting',
      'every',
      'window',
      'lit',
      'against',
      'the',
      'weather',
    ].map((text, index) => ({
      text,
      startMs: 20_000 + index * 300,
      endMs: 20_280 + index * 300,
    }));

    const authored = applyTranscriptAsLyrics(blind(), words);

    expect(authored.lyrics.lines).toHaveLength(1);
  });
});

describe('Karaoke Maker anchors that normalise to nothing', () => {
  it('times a line that opens with a dialogue dash', () => {
    // The dash normalises to empty. Aborting the anchor search there left
    // every such line with no candidates and no timing at all.
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 90_000;
    project.lyrics.lines = makerLinesFromPlainText('— I never told you');
    const aligned = applyWhisperTranscript(project, [
      { text: 'I', startMs: 20_000, endMs: 20_200 },
      { text: 'never', startMs: 20_220, endMs: 20_600 },
      { text: 'told', startMs: 20_620, endMs: 20_900 },
      { text: 'you', startMs: 20_920, endMs: 21_200 },
    ]);
    const timed = aligned.lyrics.lines[0].tokens.filter(
      (token) => token.startMs !== undefined,
    );

    expect(timed.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Karaoke Maker section labels in any language', () => {
  const labels = [
    '[Intro]',
    '[Verse 2]',
    '[Pre-Chorus]',
    '[Estribillo]',
    '[Verso 1]',
    '[Puente]',
    '[Refrão]',
    '[Refrain]',
    '[Strophe]',
    '[Ritornello]',
    '[Припев]',
    '[Куплет 2]',
    '【サビ】',
    '（間奏）',
    '[副歌]',
    '[मुखड़ा]',
  ];

  it('recognises a structure label in every locale the app ships', () => {
    // The old list was thirteen English words, so nine of the ten shipped
    // locales failed it: a Spanish sheet's "[Estribillo]" became a one-token
    // lyric line that no singer ever sings and nothing could ever time. The
    // last two of these need the bracket to be fullwidth or CJK, which is how
    // a Japanese or Chinese sheet writes the same heading.
    labels.forEach((label) => {
      expect(isKaraokeSectionText(label)).toBe(true);
    });
  });

  it('still recognises everything the English list used to', () => {
    // Regression oracle: the retired vocabulary, kept here and nowhere else.
    const retired = [
      'intro',
      'verse 1',
      'pre-chorus',
      'post-chorus',
      'chorus 2',
      'bridge',
      'break',
      'instrumental',
      'interlude',
      'solo',
      'outro',
      'hook',
      'refrain',
      'ending',
    ];
    retired.forEach((name) => {
      expect(isKaraokeSectionText(`[${name}]`)).toBe(true);
    });
  });

  it('does not mistake a sung line for a label', () => {
    [
      'Break the silence of the evening',
      '(I know, I know)',
      '[I never said that I would stay forever]',
      'Verse two of the story',
      '',
      '[]',
      'and (then) she left',
    ].forEach((line) => {
      expect(isKaraokeSectionText(line)).toBe(false);
    });
  });
});

describe('Karaoke Maker lyrics in unspaced scripts', () => {
  it('cuts a Japanese line into the units a karaoke highlights', () => {
    // Splitting on whitespace made the whole line one token, and one sung
    // character against a ten-character token is an edit ratio of 0.9 — far
    // past the 0.34 that counts as a match, so nothing could ever be timed.
    const lines = makerLinesFromPlainText('きみのことがすきだから');

    expect(lines).toHaveLength(1);
    expect(lines[0].tokens.length).toBeGreaterThan(5);
    expect(lines[0].tokens.map((token) => token.text).join('')).toBe(
      'きみのことがすきだから',
    );
  });

  it('keeps spacing for a line that uses it', () => {
    const lines = makerLinesFromPlainText('she walked past the harbour');

    expect(lines[0].tokens.map((token) => token.text)).toEqual([
      'she',
      'walked',
      'past',
      'the',
      'harbour',
    ]);
  });

  it('writes an unspaced line back without inventing spaces', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText('きみのことがすきだから');

    expect(plainLyrics(project)).toBe('きみのことがすきだから');
  });

  it('still spaces a line that mixes scripts', () => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText('hello きみ world');

    expect(plainLyrics(project)).toBe('hello きみ world');
  });
});

describe('Karaoke Maker alignment on a heavily repeated song', () => {
  it('solves a hundred and forty performances of one line without hanging', () => {
    // Measured shape of the hang: every candidate rescanned every node
    // accumulated so far, so a song repeating one short line reached tens of
    // thousands of nodes and quadratic work — synchronously, on the renderer
    // thread, after the progress bar had already said complete.
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 600_000;
    project.lyrics.lines = makerLinesFromPlainText(
      Array.from({ length: 144 }, () => 'around the world').join('\n'),
    );
    const transcript = Array.from({ length: 576 }, (_, index) => {
      const words = ['around', 'the', 'world'];
      return {
        text: words[index % 3],
        startMs: 1_000 + index * 600,
        endMs: 1_400 + index * 600,
      };
    });

    const startedAt = Date.now();
    const aligned = applyWhisperTranscript(project, transcript);
    const elapsedMs = Date.now() - startedAt;

    // Positive control first, and it has to be the whole song: a route that
    // covered a sixth of the lines is also fast, and so is one that returns
    // nothing at all. Every line takes its own performance, in order.
    const lyricLines = aligned.lyrics.lines.filter(
      (line) => line.kind !== 'section',
    );
    expect(lyricLines).toHaveLength(144);
    const starts = lyricLines.map((line) => line.tokens[0].startMs);
    expect(starts.every((startMs) => startMs !== undefined)).toBe(true);
    expect(
      starts.every(
        (startMs, index) =>
          index === 0 || Number(startMs) > Number(starts[index - 1]),
      ),
    ).toBe(true);
    expect(elapsedMs).toBeLessThan(20_000);
  });
});

describe('Karaoke Maker hallucinations over instrumental audio', () => {
  it('drops a word the model reported where the voice is silent', () => {
    // Over an intro or a break, Whisper is handed the separation residue and
    // answers with its idle-loop phrases. On this path they become real lyric
    // lines with real timings, and nothing downstream can tell them apart.
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = [];
    const authored = applyTranscriptAsLyrics(
      project,
      [
        { text: 'Thank', startMs: 3_000, endMs: 3_400 },
        { text: 'you.', startMs: 3_420, endMs: 3_800 },
        { text: 'Storm', startMs: 20_000, endMs: 20_400 },
        { text: 'over', startMs: 20_420, endMs: 20_800 },
      ],
      // The stem is silent for the whole intro and sings from 19 s.
      [{ startMs: 0, endMs: 19_000 }],
    );
    const texts = authored.lyrics.lines.flatMap((line) =>
      line.tokens.map((token) => token.text),
    );

    expect(texts).toEqual(['Storm', 'over']);
  });

  it('keeps every word when the stem was never measured', () => {
    // Positive control: with no rests the filter must change nothing, or a
    // filter that dropped everything would pass the test above.
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = [];
    const authored = applyTranscriptAsLyrics(project, [
      { text: 'Thank', startMs: 3_000, endMs: 3_400 },
      { text: 'you.', startMs: 3_420, endMs: 3_800 },
      { text: 'Storm', startMs: 20_000, endMs: 20_400 },
    ]);

    expect(authored.lyrics.lines.flatMap((line) => line.tokens).length).toBe(3);
  });

  it('keeps a word that only touches the edge of a rest', () => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = [];
    const authored = applyTranscriptAsLyrics(
      project,
      [
        { text: 'Storm', startMs: 18_500, endMs: 19_400 },
        { text: 'over', startMs: 19_420, endMs: 19_800 },
      ],
      [{ startMs: 0, endMs: 19_000 }],
    );

    expect(authored.lyrics.lines.flatMap((line) => line.tokens).length).toBe(2);
  });
});

describe('Karaoke Maker hallucinations when the lyrics are supplied', () => {
  /** Words the singer performs from 20 s, over a stem silent until 19 s. */
  const sung = [
    { text: 'thank', startMs: 20_000, endMs: 20_400 },
    { text: 'you', startMs: 20_420, endMs: 20_800 },
    { text: 'for', startMs: 20_820, endMs: 21_100 },
    { text: 'the', startMs: 21_120, endMs: 21_300 },
    { text: 'storm', startMs: 21_320, endMs: 21_900 },
  ];
  /**
   * What Whisper answers the silent intro with, over separation residue: not
   * a stray word — an isolated fragment is already rejected for being one —
   * but a whole plausible line, which is what the idle loop actually emits
   * once it has the song's own words in its context.
   */
  const invented = [
    { text: 'thank', startMs: 3_000, endMs: 3_400 },
    { text: 'you', startMs: 3_420, endMs: 3_800 },
    { text: 'for', startMs: 3_820, endMs: 4_100 },
    { text: 'the', startMs: 4_120, endMs: 4_300 },
    { text: 'storm', startMs: 4_320, endMs: 4_900 },
  ];
  const supplied = (): IKaraokeMakerProject => {
    const project = createKaraokeMakerProject(song());
    project.audio.durationMs = 253_051;
    project.lyrics.lines = makerLinesFromPlainText('thank you for the storm');
    return project;
  };
  const firstWordStartMs = (project: IKaraokeMakerProject) =>
    project.lyrics.lines[0].tokens[0].startMs;

  it('refuses a transcript word heard where the voice is silent', () => {
    // The authoring path filtered these and this one did not, which is
    // backwards: there an invented word becomes a visible line the user can
    // delete, while here the supplied lyrics guarantee it is matched to
    // whatever it resembles — so "Thank you." in the intro took the timing of
    // the song's real "thank you" and dragged the line 17 seconds early.
    const aligned = applyWhisperTranscript(
      supplied(),
      [...invented, ...sung],
      [{ startMs: 0, endMs: 19_000 }],
    );

    expect(firstWordStartMs(aligned)).toBe(20_000);
  });

  it('times the song from the transcript when the stem was never measured', () => {
    // Positive control: with no rests the filter must change nothing, or
    // "everything was dropped" would pass the assertion above just as well.
    const aligned = applyWhisperTranscript(supplied(), sung);

    expect(firstWordStartMs(aligned)).toBe(20_000);
  });

  it('proves the intro word is what the rests removed', () => {
    // Second control: the same transcript without the filter really does put
    // the line in the intro, so the test above is measuring the fix and not a
    // heuristic that was already rejecting those words for its own reasons.
    const aligned = applyWhisperTranscript(supplied(), [...invented, ...sung]);

    expect(firstWordStartMs(aligned)).toBe(3_000);
  });
});

describe('Karaoke Maker headings written next to each other', () => {
  /** Two sung lines with two headings between them, all four timed. */
  const withHeadings = (headings: string) => {
    const project = createKaraokeMakerProject(song());
    project.lyrics.lines = makerLinesFromPlainText(
      `first line here\n${headings}\nsecond line here`,
    );
    const timeLine = (index: number, fromMs: number) => {
      project.lyrics.lines[index].tokens = project.lyrics.lines[
        index
      ].tokens.map((token, tokenIndex) => ({
        ...token,
        startMs: fromMs + tokenIndex * 400,
        endMs: fromMs + tokenIndex * 400 + 300,
      }));
    };
    timeLine(0, 10_000);
    timeLine(project.lyrics.lines.length - 1, 30_000);
    return synchronizeKaraokeMakerSections(project);
  };

  it('gives each of two headings its own slice of the gap', () => {
    // Each heading looks past its neighbouring headings for the sung lines
    // either side, so two written together found the same previous line and
    // the same next line and were handed identical ranges — drawn on top of
    // one another, reading as one heading with the wrong name.
    const sections = withHeadings('[Bridge]\n[Chorus]').lyrics.lines.filter(
      karaokeMakerLineIsSection,
    );

    expect(sections.length).toBe(2);
    expect(sections[0].startMs).toBeLessThan(sections[1].startMs as number);
    expect(sections[0].endMs).toBeLessThanOrEqual(
      sections[1].startMs as number,
    );
  });

  it('leaves a heading standing on its own exactly where it was', () => {
    // Positive control: the run logic must not move the ordinary case, which
    // is every heading in almost every song.
    const sections = withHeadings('[Chorus]').lyrics.lines.filter(
      karaokeMakerLineIsSection,
    );

    expect(sections.length).toBe(1);
    // Two seconds ahead of the line it introduces, as it always was.
    expect(sections[0].startMs).toBe(28_000);
  });

  it('keeps three headings in the order they were written', () => {
    const sections = withHeadings(
      '[Bridge]\n[Chorus]\n[Outro]',
    ).lyrics.lines.filter(karaokeMakerLineIsSection);
    const starts = sections.map((section) => section.startMs as number);

    expect(starts).toEqual([...starts].sort((left, right) => left - right));
    expect(new Set(starts).size).toBe(3);
  });
});

describe('Karaoke Maker held notes against the stem', () => {
  const held = [
    { text: 'Ohhh', startMs: 20_000, endMs: 26_000 },
    { text: 'yeah', startMs: 26_100, endMs: 26_500 },
  ];

  it('keeps a six-second note the voice never stopped during', () => {
    // The syllable ceiling holds a one-syllable word to 2 500 ms and drops
    // anything longer, so this note lost its timing entirely. That was called
    // a knowingly paid cost, and it was only unavoidable without the stem.
    const placed = placeTranscriptWords(held, 253_051, [
      { startMs: 0, endMs: 19_000 },
      { startMs: 27_000, endMs: 40_000 },
    ]);

    expect(placed[0].startMs).toBe(20_000);
    expect(placed[0].endMs).toBe(26_000);
  });

  it('still drops the same span when the voice stopped inside it', () => {
    // The failure the ceiling exists for: a timestamp that ran past the end of
    // the phrase and out over the instrumental. Identical span, identical
    // word — only the stem tells them apart.
    const placed = placeTranscriptWords(held, 253_051, [
      { startMs: 21_000, endMs: 25_000 },
    ]);

    expect(placed[0].startMs).toBeUndefined();
  });

  it('still refuses a chunk-sized timestamp over continuous voice', () => {
    // Continuous voicing is not a reason to accept twenty seconds. Without
    // this the fix above would have traded one silent failure for a louder one.
    const placed = placeTranscriptWords(
      [{ text: 'Ohhh', startMs: 20_000, endMs: 45_000 }],
      253_051,
      [{ startMs: 0, endMs: 19_000 }],
    );

    expect(placed[0].startMs).toBeUndefined();
  });

  it('leaves the ceiling alone when the stem was never measured', () => {
    // Positive control: with no rests nothing may change, or "everything is
    // held" would pass the first assertion just as well.
    expect(placeTranscriptWords(held, 253_051)[0].startMs).toBeUndefined();
  });
});

describe('Karaoke Maker repeated performances check each other', () => {
  const HOOK = ['storm', 'over', 'water', 'tonight', 'again', 'falling'];
  /** 28 distinct filler words, so the hook is surprising enough to count. */
  const filler = Array.from({ length: 28 }, (_unused, index) =>
    [
      String.fromCharCode(97 + Math.floor(index / 5)),
      String.fromCharCode(97 + (index % 5)),
    ].join(''),
  );
  /** The hook performed evenly, six words half a second apart. */
  const performance = (fromMs: number) =>
    HOOK.map((text, index) => ({
      text,
      startMs: fromMs + index * 500,
      endMs: fromMs + index * 500 + 400,
    }));
  const between = filler.map((text, index) => ({
    text,
    startMs: 3_000 + index * 1_200,
    endMs: 3_000 + index * 1_200 + 400,
  }));
  const songOf = (
    second: { text: string; startMs: number; endMs: number }[],
  ) => [...performance(0), ...between, ...second];
  const suspects = (
    words: { text: string; startMs: number; endMs: number }[],
  ) =>
    karaokeMakerInconsistentRepeatWords(words, karaokeMakerRepeatedRuns(words));

  it('leaves two performances that agree with each other alone', () => {
    // Positive control, and the one that matters most: this runs on every
    // song, and a check that flags an honest chorus would delete good timing
    // from the songs it is meant to help.
    expect(suspects(songOf(performance(40_000))).size).toBe(0);
  });

  it('distrusts the performance whose words collapsed onto one instant', () => {
    // The measured failure: Whisper's timestamp head stops reporting and the
    // whole window's words share a start, with the last one carrying the end.
    // Each of those timings is individually plausible — inside voiced audio,
    // no over-long span, correctly ordered — so nothing else here can see it.
    // Put beside the other performance of the same six words, it is obvious.
    const collapsed = HOOK.map((text, index) => ({
      text,
      startMs: index === HOOK.length - 1 ? 40_200 : 40_000,
      endMs: index === HOOK.length - 1 ? 40_250 : 40_050,
    }));
    const flagged = suspects(songOf(collapsed));

    // The second performance is words 34-39; the first is 0-5 and is sound.
    expect([...flagged].sort((left, right) => left - right)).toEqual([
      34, 35, 36, 37, 38, 39,
    ]);
  });

  it('blames neither when the two are equally plausible', () => {
    // A disagreement proves one of them is wrong, not which. Both keep what
    // they had rather than having a coin flipped over them — 11 of the 76
    // disagreements in the saved library land here.
    const reshuffled = HOOK.map((text, index) => ({
      text,
      // Same span and same pace, a different distribution inside it.
      startMs: 40_000 + (index < 5 ? index * 60 : 2_500),
      endMs: 40_000 + (index < 5 ? index * 60 + 400 : 2_900),
    }));

    expect(suspects(songOf(reshuffled)).size).toBe(0);
  });
});

describe('Karaoke Maker held notes', () => {
  it('lets a singer hold one syllable without truncating it', () => {
    expect(karaokeMakerMaximumAutomaticWordDurationMs('I')).toBeGreaterThan(
      2_000,
    );
    expect(karaokeMakerMaximumAutomaticWordDurationMs('Ohhh')).toBeGreaterThan(
      2_000,
    );
    // One Han character is one word, and was capped at 1.2 s.
    expect(karaokeMakerMaximumAutomaticWordDurationMs('愛')).toBeGreaterThan(
      2_000,
    );
    // A long word still gets room for its syllables.
    expect(
      karaokeMakerMaximumAutomaticWordDurationMs('hallelujah'),
    ).toBeGreaterThan(4_000);
    // And a chunk-sized timestamp is still refused.
    expect(
      karaokeMakerMaximumAutomaticWordDurationMs('hallelujah'),
    ).toBeLessThan(20_000);
  });
});

describe('Karaoke Maker line break corroboration', () => {
  it('treats adjacent claims as one boundary, not several', () => {
    // A segment end, a stem rest and a repeat edge land within a word of each
    // other. Counting each as its own break is what produced 31 one- and
    // two-word lines out of 54 against the 6-8 human karaoke uses.
    const words = Array.from({ length: 12 }, (_, index) => ({
      startMs: 20_000 + index * 400,
      endMs: 20_300 + index * 400,
    }));

    const breaks = karaokeMakerLineBreaks(
      words,
      // A rest whose centre sits on the boundary before word 6.
      [{ startMs: 22_300, endMs: 22_500 }],
      // A segment ending a word later.
      [22_760],
      // And a repeated run claiming the word after that.
      new Set([8]),
      new Set(),
    );

    // The rest and the segment are one word apart and collapse; the repeat
    // edge two words later stands, because a two-word line is something the
    // human-authored files do and a one-word line is not.
    expect([...breaks].sort((a, b) => a - b)).toEqual([6, 8]);
  });

  it('keeps boundaries that are genuinely apart', () => {
    // Positive control: corroboration must not swallow real separate phrases,
    // or a function returning a single break would pass the test above.
    const words = Array.from({ length: 12 }, (_, index) => ({
      startMs: 20_000 + index * 400,
      endMs: 20_300 + index * 400,
    }));

    const breaks = karaokeMakerLineBreaks(
      words,
      [],
      [],
      new Set([3, 7, 10]),
      new Set(),
    );

    expect([...breaks].sort((a, b) => a - b)).toEqual([3, 7, 10]);
  });
});

describe('Karaoke Maker voice onsets', () => {
  const sampleRate = 16_000;
  const burst = (
    samples: Float32Array,
    fromMs: number,
    toMs: number,
    gain = 0.5,
  ) => {
    const from = Math.round((fromMs / 1_000) * sampleRate);
    const to = Math.round((toMs / 1_000) * sampleRate);
    for (let i = from; i < to && i < samples.length; i += 1) {
      samples[i] = Math.sin((2 * Math.PI * 220 * i) / sampleRate) * gain;
    }
  };

  it('finds where each sound starts, pitched or not', () => {
    const samples = new Float32Array(sampleRate * 4);
    burst(samples, 500, 800);
    burst(samples, 1_200, 1_500);
    burst(samples, 2_400, 2_900);

    const onsets = karaokeMakerVoiceOnsets(samples, sampleRate);

    expect(onsets.length).toBeGreaterThanOrEqual(3);
    [500, 1_200, 2_400].forEach((expected) => {
      expect(onsets.some((onset) => Math.abs(onset - expected) <= 60)).toBe(
        true,
      );
    });
  });

  it('reports nothing for silence', () => {
    expect(
      karaokeMakerVoiceOnsets(new Float32Array(sampleRate), sampleRate),
    ).toEqual([]);
  });

  it('moves a word onto the sound and keeps the order', () => {
    const words = [
      { startMs: 520, endMs: 800 },
      { startMs: 1_150, endMs: 1_400 },
      { startMs: 2_500, endMs: 2_900 },
    ];

    const snapped = karaokeMakerSnapWordsToOnsets(words, [500, 1_200, 2_400]);

    expect(snapped.map((word) => word.startMs)).toEqual([500, 1_200, 2_400]);
    // Each word keeps the length it was measured to have.
    expect(snapped[0].endMs - snapped[0].startMs).toBe(280);
  });

  it('leaves a word alone when no onset is near it', () => {
    const words = [{ startMs: 9_000, endMs: 9_300 }];

    expect(karaokeMakerSnapWordsToOnsets(words, [500, 1_200])[0].startMs).toBe(
      9_000,
    );
  });

  it('never lets a snapped word overtake the one before it', () => {
    const words = [
      { startMs: 1_150, endMs: 1_400 },
      { startMs: 1_210, endMs: 1_500 },
    ];

    const snapped = karaokeMakerSnapWordsToOnsets(words, [1_200]);

    expect(snapped[0].startMs).toBe(1_200);
    expect(snapped[1].startMs).toBeGreaterThan(snapped[0].startMs);
  });
});

describe('Karaoke Maker onset snapping keeps the song in order', () => {
  it('finds an exact onset inside a dense cluster', () => {
    // Attacks 80 ms apart, which the detector's own minimum gap allows.
    // Advancing the cursor to the furthest onset still in reach put the exact
    // match four places behind the search window and snapped 240 ms away.
    const onsets = [1_000, 1_080, 1_160, 1_240, 1_320, 1_400, 1_480];

    const snapped = karaokeMakerSnapWordsToOnsets(
      [{ startMs: 1_000, endMs: 1_300 }],
      onsets,
    );

    expect(snapped[0].startMs).toBe(1_000);
  });

  it('never reorders the words it was given', () => {
    // The word before is pulled forward onto a late onset; the word after has
    // its own onset behind that. Snapping must not leave them crossed.
    const words = [
      { startMs: 19_900, endMs: 20_000 },
      { startMs: 20_050, endMs: 20_150 },
    ];

    const snapped = karaokeMakerSnapWordsToOnsets(words, [20_100, 20_300]);
    const starts = snapped.map((word) => word.startMs as number);

    expect(starts[1]).toBeGreaterThan(starts[0]);
  });

  it('still snaps a whole phrase forward when the order allows it', () => {
    // Positive control: the guard must not become "never snap anything".
    const words = [
      { startMs: 1_020, endMs: 1_200 },
      { startMs: 2_020, endMs: 2_200 },
      { startMs: 3_020, endMs: 3_200 },
    ];

    const snapped = karaokeMakerSnapWordsToOnsets(words, [1_000, 2_000, 3_000]);

    expect(snapped.map((word) => word.startMs)).toEqual([1_000, 2_000, 3_000]);
  });
});

describe('Karaoke Maker word matching across scripts', () => {
  it('cuts a Japanese line that holds a long-vowel mark', () => {
    // U+30FC is Script=Common, so `\p{Script=Katakana}` read false for it and
    // any line containing one — ubiquitous in J-pop — fell back to whitespace
    // splitting and became a single token again.
    const lines = makerLinesFromPlainText('コーヒーをのむ');

    expect(lines[0].tokens.length).toBeGreaterThan(1);
    expect(lines[0].tokens.map((token) => token.text).join('')).toBe(
      'コーヒーをのむ',
    );
  });

  it('reads katakana and hiragana as the same word', () => {
    expect(normalizedWord('アイ')).toBe(normalizedWord('あい'));
    // Control: folding the scripts together must not fold sounds together.
    expect(normalizedWord('アイ')).not.toBe(normalizedWord('アオ'));
  });

  it('stops two different Hangul syllables matching each other', () => {
    // NFKD split a syllable into jamo, so one insertion out of three scored
    // 0.333 — inside the 0.34 that counts as a match.
    expect(
      normalizedWordDistance(normalizedWord('하'), normalizedWord('한')),
    ).toBe(4);
    // Positive control: recomposition must not break real equality.
    expect(
      normalizedWordDistance(normalizedWord('한'), normalizedWord('한')),
    ).toBe(0);
  });

  it('leaves a spaced language exactly as it was', () => {
    // Positive control for all of the above: none of this may be visible to a
    // language that already worked.
    expect(normalizedWord('Harbour')).toBe('harbour');
    expect(
      makerLinesFromPlainText('she walked past')[0].tokens.map((t) => t.text),
    ).toEqual(['she', 'walked', 'past']);
  });
});

describe('Karaoke Maker monotonic route', () => {
  const candidate = (startMs: number, endMs: number, score: number) => ({
    endMs,
    score,
    startMs,
  });

  it('chains onto a line that finished and refuses one still sounding', () => {
    const route = solveMonotonicRoute([
      [candidate(0, 1_000, 10)],
      [candidate(1_030, 2_000, 10)],
      [candidate(1_500, 3_000, 10)],
    ]);

    // 1 030 begins 30 ms before the first line ends, which is a shared
    // consonant; 1 500 begins half a second inside it and is a second voice.
    expect(route.map(({ startMs }) => startMs)).toEqual([1_030, 0]);
  });

  it('covers more lines rather than scoring higher on fewer', () => {
    const route = solveMonotonicRoute([
      [candidate(0, 100, 1)],
      [candidate(200, 300, 1)],
      [candidate(0, 5_000, 900)],
    ]);

    expect(route.map(({ startMs }) => startMs)).toEqual([200, 0]);
  });

  it('settles a dead-level tie by the order the lines offered it', () => {
    // Two predecessors level on covered lines, score and start; the one
    // offered first ends later, so insertion order and end order disagree.
    // Deciding by end time instead re-routed 225 of 4,000 random songs away
    // from the answer the rest of this suite was written for.
    const route = solveMonotonicRoute([
      [candidate(0, 200, 10), candidate(0, 100, 10)],
      [candidate(300, 400, 5)],
    ]);

    expect(route.map(({ endMs }) => endMs)).toEqual([400, 200]);
  });

  it('routes a song of nothing but repeats without hanging', () => {
    const size = 400;
    const lines = Array.from({ length: size }, () =>
      Array.from({ length: size }, (_unused, index) =>
        candidate(index * 1_000, index * 1_000 + 800, 1_000),
      ),
    );

    const startedAt = Date.now();
    const route = solveMonotonicRoute(lines);
    const elapsedMs = Date.now() - startedAt;

    // Positive control: covering nothing is also fast. Every line has to take
    // its own performance, running backwards through the song.
    expect(route).toHaveLength(size);
    expect(route.map(({ startMs }) => startMs)).toEqual(
      Array.from(
        { length: size },
        (_unused, index) => (size - 1 - index) * 1_000,
      ),
    );
    expect(elapsedMs).toBeLessThan(2_000);
  });

  it('returns nothing when there is nothing to route', () => {
    expect(solveMonotonicRoute([])).toEqual([]);
    expect(solveMonotonicRoute([[], [], []])).toEqual([]);
  });

  it('thins a line by time so every part of the song keeps one', () => {
    // A top-K by score is the obvious thinning and is backwards here: on a
    // song of identical lines every performance scores the same, so it keeps
    // K from one stretch and leaves the rest with none.
    const candidates = Array.from({ length: 12 }, (_unused, index) =>
      candidate(index * 1_000, index * 1_000 + 500, index % 3),
    );

    expect(
      limitRouteCandidates(candidates, 4).map(({ startMs }) => startMs),
    ).toEqual([2_000, 5_000, 8_000, 11_000]);
    expect(limitRouteCandidates(candidates, 12)).toBe(candidates);
  });
});

describe('Karaoke Maker sung asides are not section labels', () => {
  it('keeps a parenthesised backing vocal as a lyric line', () => {
    // Providers mark structure with square brackets and sing what is in round
    // ones. A bracket-shape test with no vocabulary was tried and rejected for
    // exactly this: it called "(Oh yeah)" a label and dropped the line from the
    // karaoke entirely. Widening the brackets is only safe because the
    // vocabulary still gates them.
    ['(Oh yeah)', '(hey)', '(Ooh ooh ooh)', '(I love you)'].forEach((line) => {
      expect(isKaraokeSectionText(line)).toBe(false);
    });
  });

  it('still recognises a bracketed structure label', () => {
    // Positive control: the fix must not become "nothing is ever a label".
    ['[Chorus]', '[Verse 2]', '[Estribillo]', '【サビ】'].forEach((line) => {
      expect(isKaraokeSectionText(line)).toBe(true);
    });
  });

  it('caps a held one-syllable note, knowingly, to keep the gap guard', () => {
    // Raising this floor to 6 s so a phrase-final "Ohhh" is not truncated was
    // tried and reverted: the same number decides whether a span is a held
    // note or a fabricated one, and at 6 s a word can be parked anywhere in an
    // instrumental gap. The truncation is a known, visible cost.
    expect(karaokeMakerMaximumAutomaticWordDurationMs('Ohhh')).toBe(2_500);
    expect(karaokeMakerMaximumAutomaticWordDurationMs('you')).toBe(2_500);
    // Positive control: the chunk-sized timestamp it exists to reject.
    expect(karaokeMakerWordDurationIsPlausible('Ohhh', 24_000, 'whisper')).toBe(
      false,
    );
  });
});
