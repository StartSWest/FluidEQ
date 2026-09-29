import {
  createKaraokeMakerProject,
  makerLinesFromPlainText,
  shiftKaraokeMakerTimeline,
} from '../../../common/karaoke/makerProject';
import { IKaraokeSong } from '../../../common/karaoke/types';
import { autoAlignKaraokeMakerProject } from '../../../renderer/karaoke/makerAlignment';
import {
  applyBasicPitchMelody,
  applyDetectedPitchMelody,
  applyWhisperTranscript,
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

describe('Karaoke Maker Whisper alignment', () => {
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
});
