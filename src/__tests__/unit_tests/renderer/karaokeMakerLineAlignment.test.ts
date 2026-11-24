import {
  createKaraokeMakerProject,
  IKaraokeMakerLine,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
} from '../../../common/karaoke/makerProject';
import { IKaraokeSong } from '../../../common/karaoke/types';
import { IForcedAlignmentLineResult } from '../../../renderer/karaoke/makerAi/forcedAlignment';
import {
  applyKaraokeMakerLineAlignment,
  karaokeMakerLinesForAlignment,
} from '../../../renderer/karaoke/makerAi/lineAlignment';

const audioFile = new File(['audio'], 'Artist - Song.mp3', {
  type: 'audio/mpeg',
  lastModified: 42,
});

const song = (): IKaraokeSong => ({
  id: 'song-1',
  title: 'Song',
  artist: 'Artist',
  durationMs: 20_000,
  assets: [{ id: 'audio', role: 'audio', extension: 'mp3', file: audioFile }],
  timingPrecision: 'line',
  lines: [],
  pitch: {
    kind: 'notes',
    source: 'fixture',
    coordinateSystem: 'midi-semitones',
    octavePolicy: 'absolute',
    notes: [],
  },
  meta: { sourceFormat: 'ultrastar', gapMs: 0, bpm: 120 },
});

const word = (
  id: string,
  text: string,
  rest: Partial<IKaraokeMakerToken> = {},
): IKaraokeMakerToken => ({
  id,
  text,
  startsWord: true,
  source: 'imported',
  ...rest,
});

/** Sung from 1 s; the next line starts at 5 s. */
const windowLine = (): IKaraokeMakerLine => ({
  id: 'window-line',
  startMs: 1_000,
  given: { startMs: 1_000 },
  tokens: [word('a', 'three'), word('b', 'four'), word('c', 'five')],
});

const nextLine = (): IKaraokeMakerLine => ({
  id: 'next-line',
  startMs: 5_000,
  given: { startMs: 5_000 },
  tokens: [word('n', 'six')],
});

const projectWith = (lines: IKaraokeMakerLine[]): IKaraokeMakerProject => {
  const project = createKaraokeMakerProject(song());
  project.audio.durationMs = 20_000;
  project.lyrics.language = 'en';
  project.lyrics.lines = lines;
  return project;
};

const heard = (
  rest: Partial<IForcedAlignmentLineResult> = {},
): IForcedAlignmentLineResult => ({
  id: 'window-line',
  confidence: 0.8,
  stacked: 0,
  astray: 0,
  words: [
    { startMs: 1_200, probability: 0.9 },
    { startMs: 2_000, probability: 0.8 },
    { startMs: 3_000, probability: 0.7 },
  ],
  ...rest,
});

const starts = (line: IKaraokeMakerLine) =>
  line.tokens.map((token) => token.startMs);

describe('the lines asked about', () => {
  it('are the given lines whose words have no time, each with its window', () => {
    const wordTimed: IKaraokeMakerLine = {
      id: 'word-timed',
      startMs: 8_000,
      tokens: [word('w', 'seven', { startMs: 8_000, endMs: 8_400 })],
    };
    const open: IKaraokeMakerLine = {
      id: 'open',
      tokens: [word('o', 'eight')],
    };
    expect(
      karaokeMakerLinesForAlignment(
        projectWith([windowLine(), nextLine(), wordTimed, open]),
      ),
    ).toEqual([
      {
        id: 'window-line',
        startMs: 1_000,
        endMs: 5_000,
        words: [
          { text: 'three', spaceBefore: true },
          { text: 'four', spaceBefore: true },
          { text: 'five', spaceBefore: true },
        ],
      },
      {
        id: 'next-line',
        startMs: 5_000,
        endMs: 20_000,
        words: [{ text: 'six', spaceBefore: true }],
      },
    ]);
  });

  it('ask about a word once, however many syllables it was cut into', () => {
    const syllables: IKaraokeMakerLine = {
      ...windowLine(),
      tokens: [
        word('a', 'Hel'),
        word('b', 'lo', { startsWord: false }),
        word('c', 'there'),
      ],
    };
    const [line] = karaokeMakerLinesForAlignment(
      projectWith([syllables, nextLine()]),
    );
    expect(line.words.map((entry) => entry.text)).toEqual(['Hello', 'there']);
  });
});

describe('timing words inside a given line', () => {
  it('puts each word where it was heard and keeps the line where it was', () => {
    const outcome = applyKaraokeMakerLineAlignment(
      projectWith([windowLine(), nextLine()]),
      [heard()],
      [],
    );
    const [line] = outcome.project.lyrics.lines;
    expect(outcome.aligned).toBe(1);
    expect(starts(line)).toEqual([1_200, 2_000, 3_000]);
    expect(line.tokens.map((token) => token.endMs)).toEqual([
      2_000,
      3_000,
      expect.any(Number),
    ]);
    expect(line.tokens[2].endMs).toBeLessThanOrEqual(5_000);
    expect(line.tokens.map((token) => token.text)).toEqual([
      'three',
      'four',
      'five',
    ]);
    expect(line.tokens.every((token) => token.source === 'auto-align')).toBe(
      true,
    );
    expect(line.startMs).toBe(1_000);
    expect(line.given).toEqual({ startMs: 1_000 });
  });

  it.each([
    ['the model did not recognise the words', { confidence: 0.2 }],
    ['the words were put on one frame', { stacked: 0.9 }],
    ['the words are heard outside the line', { astray: 0.9 }],
    ['a word is missing from the reading', { words: heard().words.slice(1) }],
  ])('spreads the words evenly when %s', (_why, flaw) => {
    const outcome = applyKaraokeMakerLineAlignment(
      projectWith([windowLine(), nextLine()]),
      [heard(flaw)],
      [],
    );
    const [line] = outcome.project.lyrics.lines;
    expect(outcome.aligned).toBe(0);
    // Two lines spread: this one, and the next that nothing was heard for.
    expect(outcome.spread).toBe(2);
    // Not the reading's times: the first word starts with the line.
    expect(starts(line)[0]).toBe(1_000);
    const times = line.tokens.flatMap((token) => [
      token.startMs ?? -1,
      token.endMs ?? -1,
    ]);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(times[0]).toBeGreaterThanOrEqual(1_000);
    expect(times[times.length - 1]).toBeLessThanOrEqual(5_000);
    expect(line.startMs).toBe(1_000);
  });

  it('holds heard words in order and inside the line', () => {
    // A reading that runs backwards and past the wall.
    const outcome = applyKaraokeMakerLineAlignment(
      projectWith([windowLine(), nextLine()]),
      [
        heard({
          words: [
            { startMs: 3_000, probability: 0.9 },
            { startMs: 2_000, probability: 0.9 },
            { startMs: 9_000, probability: 0.9 },
          ],
        }),
      ],
      [],
    );
    const [line] = outcome.project.lyrics.lines;
    const [first, second, third] = starts(line).map((start) => start ?? -1);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    expect(line.tokens[2].endMs).toBeLessThanOrEqual(5_000);
  });

  it('ends a word where the voice stops', () => {
    const outcome = applyKaraokeMakerLineAlignment(
      projectWith([windowLine(), nextLine()]),
      [heard()],
      [{ startMs: 2_500, endMs: 2_900 }],
    );
    const [line] = outcome.project.lyrics.lines;
    // Without the breath the second word ran to the third, at 3 s.
    expect(line.tokens[1].endMs).toBe(2_500);
  });

  it('spreads words only over where the voice is heard', () => {
    const outcome = applyKaraokeMakerLineAlignment(
      projectWith([windowLine(), nextLine()]),
      [],
      [{ startMs: 1_600, endMs: 4_400 }],
    );
    const [line] = outcome.project.lyrics.lines;
    starts(line).forEach((start) => {
      const insideRest = (start ?? 0) >= 1_600 && (start ?? 0) < 4_400;
      expect(insideRest).toBe(false);
    });
    // The control: the rest really does split the words either side of it.
    expect(starts(line)[0]).toBeLessThan(1_600);
    expect(starts(line)[2]).toBeGreaterThanOrEqual(4_400);
  });

  it('shares a word time among its syllables', () => {
    const syllables: IKaraokeMakerLine = {
      ...windowLine(),
      tokens: [
        word('a', 'Hel'),
        word('b', 'lo', { startsWord: false }),
        word('c', 'there'),
      ],
    };
    const outcome = applyKaraokeMakerLineAlignment(
      projectWith([syllables, nextLine()]),
      [
        heard({
          words: [
            { startMs: 1_000, probability: 0.9 },
            { startMs: 2_000, probability: 0.9 },
          ],
        }),
      ],
      [],
    );
    const [line] = outcome.project.lyrics.lines;
    expect(outcome.aligned).toBe(1);
    expect(starts(line)).toEqual([1_000, 1_600, 2_000]);
    expect(line.tokens[1].endMs).toBe(2_000);
  });

  it('fills an untimed word between its given neighbours and moves neither', () => {
    const first = word('a', 'three', { startMs: 1_000, endMs: 1_400 });
    const last = word('c', 'five', { startMs: 3_000, endMs: 3_400 });
    const lacking: IKaraokeMakerLine = {
      ...windowLine(),
      tokens: [first, word('b', 'four'), last],
    };
    const outcome = applyKaraokeMakerLineAlignment(
      projectWith([lacking, nextLine()]),
      [],
      [],
    );
    const [line] = outcome.project.lyrics.lines;
    expect(line.tokens[0]).toEqual(first);
    expect(line.tokens[2]).toEqual(last);
    expect(line.tokens[1].startMs).toBeGreaterThanOrEqual(1_400);
    expect(line.tokens[1].endMs).toBeLessThanOrEqual(3_000);
    expect(line.tokens[1].source).toBe('auto-align');
  });

  it('leaves word-timed and untimed lines alone', () => {
    const wordTimed: IKaraokeMakerLine = {
      id: 'word-timed',
      startMs: 8_000,
      tokens: [word('w', 'seven', { startMs: 8_000, endMs: 8_400 })],
    };
    const open: IKaraokeMakerLine = {
      id: 'open',
      tokens: [word('o', 'eight')],
    };
    const outcome = applyKaraokeMakerLineAlignment(
      projectWith([wordTimed, open]),
      [],
      [],
    );
    expect(outcome.project.lyrics.lines).toEqual([wordTimed, open]);
    expect(outcome).toMatchObject({ aligned: 0, spread: 0 });
  });
});
