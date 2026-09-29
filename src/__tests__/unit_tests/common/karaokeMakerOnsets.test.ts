import {
  createKaraokeMakerProject,
  IKaraokeMakerLyricSheet,
  karaokeMakerSourceIsAutomatic,
  karaokeMakerWordDurationIsPlausible,
  karaokeMakerMaximumAutomaticWordDurationMs,
  makerLinesFromPlainText,
  parseKaraokeMakerProject,
  serializeKaraokeMakerProject,
} from '../../../common/karaoke/makerProject';
import { isKaraokeSectionText } from '../../../common/karaoke/sections';
import { IKaraokeSong } from '../../../common/karaoke/types';
import {
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

describe('translated lyric sheets', () => {
  const sheet: IKaraokeMakerLyricSheet = {
    language: 'es',
    source: 'translation-seed',
    lines: [
      {
        id: 'line-es-1',
        kind: 'lyrics',
        startMs: 1_000,
        endMs: 3_000,
        tokens: [
          {
            id: 'word-es-1',
            text: 'hola',
            startsWord: true,
            source: 'translation-seed',
            startMs: 1_000,
            endMs: 2_000,
          },
        ],
      },
    ],
  };

  it('round-trips translations through serialize and parse', () => {
    const project = createKaraokeMakerProject(song());
    const withSheet = {
      ...project,
      lyrics: { ...project.lyrics, translations: [sheet] },
    };

    const parsed = parseKaraokeMakerProject(
      serializeKaraokeMakerProject(withSheet),
    );

    expect(parsed?.lyrics.translations).toHaveLength(1);
    expect(parsed?.lyrics.translations?.[0].language).toBe('es');
    expect(parsed?.lyrics.translations?.[0].lines[0].tokens[0].text).toBe(
      'hola',
    );
    expect(parsed?.lyrics.translations?.[0].lines[0].tokens[0].startMs).toBe(
      1_000,
    );
  });

  it('loads a version 1 draft with no translations rather than rejecting it', () => {
    const project = createKaraokeMakerProject(song());
    const legacy = JSON.parse(serializeKaraokeMakerProject(project)) as Record<
      string,
      unknown
    >;
    legacy.version = 1;

    const parsed = parseKaraokeMakerProject(JSON.stringify(legacy));

    expect(parsed).not.toBeNull();
    expect(parsed?.lyrics.translations).toBeUndefined();
  });

  it('treats translation-seed timings as automatic, so the aligner may replace them', () => {
    expect(karaokeMakerSourceIsAutomatic('translation-seed')).toBe(true);
  });

  it("carries a translated line's link to the original through a round trip", () => {
    const project = createKaraokeMakerProject(song());
    const linked: IKaraokeMakerLyricSheet = {
      ...sheet,
      lines: [{ ...sheet.lines[0], sourceLineId: 'line-1' }],
    };
    const withSheet = {
      ...project,
      lyrics: { ...project.lyrics, translations: [linked] },
    };

    const parsed = parseKaraokeMakerProject(
      serializeKaraokeMakerProject(withSheet),
    );

    expect(parsed?.lyrics.translations?.[0].lines[0].sourceLineId).toBe(
      'line-1',
    );
    // Positive control: the original's own lines never carry one, so a
    // parser that invented the field everywhere would be caught here.
    expect(parsed?.lyrics.lines[0].sourceLineId).toBeUndefined();
  });

  it("caps a sheet's lines the same way the original's are capped", () => {
    const project = createKaraokeMakerProject(song());
    const oversized = {
      ...JSON.parse(serializeKaraokeMakerProject(project)),
      lyrics: {
        ...project.lyrics,
        translations: [
          {
            language: 'es',
            source: 'translation-seed',
            lines: Array.from({ length: 5_100 }, (_, index) => ({
              id: `line-${index}`,
              kind: 'lyrics',
              tokens: [
                {
                  id: `word-${index}`,
                  text: 'hola',
                  startsWord: true,
                  source: 'translation-seed',
                },
              ],
            })),
          },
        ],
      },
    };

    const parsed = parseKaraokeMakerProject(JSON.stringify(oversized));

    // 5,000 exactly — the cap `lyrics.lines` has had all along, not a number
    // this branch chose, and not the 5,100 the file asked for.
    expect(parsed?.lyrics.translations?.[0].lines).toHaveLength(5_000);
  });
});
