/* FluidEQ Karaoke Maker tests. GPL-3.0-or-later. */

import {
  createKaraokeMakerProject,
  importLyricsIntoKaraokeMakerProject,
  karaokeMakerProjectToSong,
  karaokeMakerLineCaptureIntent,
  karaokeMakerInheritedLineStart,
  karaokeMakerLinePlaybackTarget,
  karaokeMakerRecordedLineContainsTime,
  karaokeMakerTokenWasUserTouched,
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
import {
  exportKaraokeMakerLrc,
  exportKaraokeMakerUltraStar,
  karaokeMakerExportFileName,
} from '../../../common/karaoke/makerExport';
import { parseKaraokeText } from '../../../common/karaoke/files';
import { IKaraokeSong } from '../../../common/karaoke/types';
import { splitKaraokeWordSyllables } from '../../../common/karaoke/syllables';
import {
  autoAlignKaraokeMakerProject,
  autoAlignNewKaraokeMakerLyrics,
  karaokeMakerAnalysisNotesFromMelody,
} from '../../../renderer/karaoke/makerAnalysis';
import {
  accumulateKaraokeMakerDownloadProgress,
  applyBasicPitchMelody,
  applyDetectedPitchMelody,
  applyWhisperTranscript,
  formatKaraokeMakerWhisperLog,
  karaokeMakerMelodyNotesForLyrics,
  karaokeMakerVocalAnalysisWindows,
  karaokeMakerAbortableTask,
  karaokeMakerWhisperErrorDetail,
  karaokeMakerWhisperPipelineProgress,
  karaokeMakerWhisperTranscriptWords,
  mergeKaraokeMakerWhisperPasses,
} from '../../../renderer/karaoke/makerAi';
import {
  karaokeMakerResizedViewport,
  karaokeMakerViewportStart,
} from '../../../renderer/karaoke/KaraokeMakerNavigator';
import {
  groupKaraokeMakerWordSyllables,
  karaokeMakerLyricLane,
  karaokeMakerFittedLyricViewport,
  karaokeMakerLyricFocus,
  karaokeMakerNoteIsActive,
  karaokeMakerNoteProgress,
  karaokeMakerPannedViewportStart,
  karaokeMakerSectionGroups,
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

  it('merges independent Whisper passes without duplicating recognised words', () => {
    const merged = mergeKaraokeMakerWhisperPasses([
      [
        { text: 'She', startMs: 11_000, endMs: 11_260 },
        { text: 'life', startMs: 12_100, endMs: 12_460 },
      ],
      [
        { text: 'She', startMs: 11_020, endMs: 11_280 },
        { text: 'leads', startMs: 11_300, endMs: 11_660 },
        { text: 'life', startMs: 12_120, endMs: 12_480 },
      ],
    ]);

    expect(merged).toEqual([
      { text: 'She', startMs: 11_010, endMs: 11_270 },
      { text: 'leads', startMs: 11_300, endMs: 11_660 },
      { text: 'life', startMs: 12_110, endMs: 12_470 },
    ]);
  });

  it('keeps a repeated phrase recovered by another Whisper pass', () => {
    const merged = mergeKaraokeMakerWhisperPasses([
      [
        { text: 'She', startMs: 11_000, endMs: 11_260 },
        { text: 'lives', startMs: 11_280, endMs: 11_620 },
      ],
      [
        { text: 'She', startMs: 15_000, endMs: 15_260 },
        { text: 'lives', startMs: 15_280, endMs: 15_620 },
      ],
    ]);

    expect(merged.map((word) => [word.text, word.startMs])).toEqual([
      ['She', 11_000],
      ['lives', 11_280],
      ['She', 15_000],
      ['lives', 15_280],
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

  it('limits pitch analysis to merged timed vocal phrases', () => {
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

    expect(karaokeMakerVocalAnalysisWindows(project)).toEqual([
      { startMs: 780, endMs: 3_190 },
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
    expect(ultrastar).toContain('#BPM:120');
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

  it('uses Enter inside a manually recorded line to repair its end', () => {
    const [line] = makerLinesFromPlainText('She leads a lonely life');
    line.tokens.forEach((token, index) => {
      Object.assign(token, {
        startMs: 10_000 + index * 500,
        endMs: 10_450 + index * 500,
        source: 'manual',
        timingLocked: true,
      });
    });

    expect(karaokeMakerLineCaptureIntent(line, 11_700)).toBe('end');
  });

  it('uses Enter before a recorded line to replace its start', () => {
    const [line] = makerLinesFromPlainText('She leads a lonely life');
    line.tokens.forEach((token, index) => {
      Object.assign(token, {
        startMs: 10_000 + index * 500,
        endMs: 10_450 + index * 500,
        source: 'manual',
        timingLocked: true,
      });
    });

    expect(karaokeMakerLineCaptureIntent(line, 9_500)).toBe('start');
  });

  it('does not infer end capture from automatic timing', () => {
    const [line] = makerLinesFromPlainText('She leads a lonely life');
    line.tokens.forEach((token, index) => {
      Object.assign(token, {
        startMs: 10_000 + index * 500,
        endMs: 10_450 + index * 500,
        source: 'whisper',
      });
    });

    expect(karaokeMakerLineCaptureIntent(line, 11_700)).toBe('start');
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

  it('follows the recorded lyric whose range contains playback', () => {
    const lines = makerLinesFromPlainText('First line\nSecond line');
    lines.forEach((line, lineIndex) => {
      line.tokens.forEach((token, tokenIndex) => {
        Object.assign(token, {
          startMs: 1_000 + lineIndex * 2_000 + tokenIndex * 400,
          endMs: 1_350 + lineIndex * 2_000 + tokenIndex * 400,
          source: 'manual',
          timingLocked: true,
        });
      });
    });

    expect(karaokeMakerLinePlaybackTarget(lines, 0, 2_900, 3_100)).toBe(1);
  });

  it('reveals exactly the next untimed lyric after crossing a recorded end', () => {
    const lines = makerLinesFromPlainText(
      'Recorded line\nCatch this start\nDo not skip here',
    );
    lines[0].tokens.forEach((token, tokenIndex) => {
      Object.assign(token, {
        startMs: 1_000 + tokenIndex * 400,
        endMs: 1_350 + tokenIndex * 400,
        source: 'manual',
        timingLocked: true,
      });
    });
    const recordedEndMs = Math.max(
      ...lines[0].tokens.map((token) => token.endMs as number),
    );

    expect(
      karaokeMakerLinePlaybackTarget(
        lines,
        0,
        recordedEndMs - 10,
        recordedEndMs + 10,
      ),
    ).toBe(1);
    expect(
      karaokeMakerLinePlaybackTarget(
        lines,
        1,
        recordedEndMs + 10,
        recordedEndMs + 2_000,
      ),
    ).toBeUndefined();
    expect(karaokeMakerInheritedLineStart(lines, 1)).toBe(recordedEndMs + 40);
    expect(karaokeMakerInheritedLineStart(lines, 2)).toBeUndefined();
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
    expect(
      (article.endMs as number) - (article.startMs as number),
    ).toBeLessThanOrEqual(1_200);
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
