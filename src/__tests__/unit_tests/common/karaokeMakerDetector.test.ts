import {
  createKaraokeMakerProject,
  IKaraokeMakerProject,
  karaokeMakerLineIsSection,
  synchronizeKaraokeMakerSections,
  makerLinesFromPlainText,
} from '../../../common/karaoke/makerProject';
import { isKaraokeSectionText } from '../../../common/karaoke/sections';
import { plainLyrics } from '../../../renderer/karaoke/useKaraokeMakerLyricsDraft';
import { IKaraokeSong } from '../../../common/karaoke/types';
import {
  applyTranscriptAsLyrics,
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
