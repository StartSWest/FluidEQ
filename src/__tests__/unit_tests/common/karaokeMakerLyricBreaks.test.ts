import {
  createKaraokeMakerProject,
  IKaraokeMakerProject,
  makerLinesFromPlainText,
} from '../../../common/karaoke/makerProject';
import { IKaraokeSong } from '../../../common/karaoke/types';
import {
  applyBasicPitchMelody,
  applyTranscriptAsLyrics,
  applyWhisperTranscript,
  karaokeMakerVocalAnalysisWindows,
  karaokeMakerVocalRests,
  karaokeMakerRepeatedRuns,
  karaokeMakerRepeatEdgeBreaks,
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
