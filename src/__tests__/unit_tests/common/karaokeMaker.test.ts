import {
  createKaraokeMakerProject,
  makerLinesFromPlainText,
  validateKaraokeMakerProject,
} from '../../../common/karaoke/makerProject';
import { IKaraokeSong } from '../../../common/karaoke/types';
import { splitKaraokeWordSyllables } from '../../../common/karaoke/syllables';
import { autoAlignKaraokeMakerProject } from '../../../renderer/karaoke/makerAlignment';
import {
  accumulateKaraokeMakerDownloadProgress,
  applyWhisperTranscript,
  formatKaraokeMakerWhisperLog,
  karaokeMakerMelodyNotesForLyrics,
  karaokeMakerVocalAnalysisWindows,
  karaokeMakerAbortableTask,
  karaokeMakerWhisperErrorDetail,
  karaokeMakerWhisperPipelineProgress,
  karaokeMakerWhisperTranscriptWords,
} from '../../../renderer/karaoke/makerAi';

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
