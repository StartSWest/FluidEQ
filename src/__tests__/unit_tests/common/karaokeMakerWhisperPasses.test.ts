import {
  createKaraokeMakerProject,
  makerLinesFromPlainText,
} from '../../../common/karaoke/makerProject';
import { IKaraokeSong } from '../../../common/karaoke/types';
import {
  applyBasicPitchMelody,
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

describe('Karaoke Maker Whisper passes', () => {
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
});
