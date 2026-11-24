import {
  createKaraokeMakerProject,
  IKaraokeMakerLine,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerCloseGivenWordEnds,
  karaokeMakerGivenWindows,
  karaokeMakerInferGivenWindows,
  karaokeMakerKeepGivenLyrics,
  karaokeMakerLineStartMs,
  karaokeMakerLineSync,
  karaokeMakerLockGivenTiming,
  karaokeMakerLyricSyncKind,
  karaokeMakerLyricSyncPlan,
  karaokeMakerTokenTimingIsGiven,
  karaokeMakerWordsOfUntimedToken,
} from '../../../common/karaoke/makerProject';
import { IKaraokeSong } from '../../../common/karaoke/types';

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
  timingPrecision: 'word',
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

const given = (id: string, text: string, startMs: number, endMs?: number) =>
  word(id, text, { startMs, endMs });

const projectWith = (lines: IKaraokeMakerLine[]): IKaraokeMakerProject => {
  const project = createKaraokeMakerProject(song());
  project.audio.durationMs = 20_000;
  project.lyrics.lines = lines;
  return project;
};

/** A line whose file timed every word. */
const wordLine = (): IKaraokeMakerLine => ({
  id: 'word-line',
  startMs: 1_000,
  endMs: 3_000,
  tokens: [given('w1', 'one', 1_000, 1_500), given('w2', 'two', 1_500, 2_200)],
});

/** A line whose file said when it is sung and not when its words are. */
const windowLine = (): IKaraokeMakerLine => ({
  id: 'window-line',
  startMs: 5_000,
  given: { startMs: 5_000 },
  tokens: [word('l1', 'three'), word('l2', 'four'), word('l3', 'five')],
});

const openLine = (): IKaraokeMakerLine => ({
  id: 'open-line',
  tokens: [word('o1', 'six', { source: 'manual' }), word('o2', 'seven')],
});

describe('what timing a song arrived with', () => {
  it('calls a word time given only when a file or the user set it', () => {
    expect(karaokeMakerTokenTimingIsGiven(given('a', 'a', 100))).toBe(true);
    expect(
      karaokeMakerTokenTimingIsGiven(
        word('a', 'a', { startMs: 100, source: 'manual' }),
      ),
    ).toBe(true);
    expect(
      karaokeMakerTokenTimingIsGiven(
        word('a', 'a', { startMs: 100, source: 'auto-align' }),
      ),
    ).toBe(false);
    expect(
      karaokeMakerTokenTimingIsGiven(
        word('a', 'a', {
          startMs: 100,
          source: 'auto-align',
          timingLocked: true,
        }),
      ),
    ).toBe(true);
    // The file's word with no time yet is still to be timed.
    expect(karaokeMakerTokenTimingIsGiven(word('a', 'a'))).toBe(false);
  });

  it('reads each line as word, line or open', () => {
    expect(karaokeMakerLineSync(wordLine())).toBe('word');
    expect(karaokeMakerLineSync(windowLine())).toBe('line');
    expect(karaokeMakerLineSync(openLine())).toBe('open');
  });

  it('counts the sung lines of each kind', () => {
    expect(
      karaokeMakerLyricSyncPlan(
        projectWith([wordLine(), windowLine(), openLine()]),
      ),
    ).toEqual({ word: 1, line: 1, open: 1 });
  });

  it('says in one word what a run is for', () => {
    expect(karaokeMakerLyricSyncKind({ word: 3, line: 0, open: 0 })).toBe(
      'word',
    );
    expect(karaokeMakerLyricSyncKind({ word: 3, line: 1, open: 2 })).toBe(
      'line',
    );
    // One line still to place and the run is no longer notes only.
    expect(karaokeMakerLyricSyncKind({ word: 3, line: 0, open: 1 })).toBe(
      'open',
    );
    expect(karaokeMakerLyricSyncKind({ word: 0, line: 0, open: 0 })).toBe(
      'open',
    );
  });
});

describe('where a given line starts and ends', () => {
  it('starts a line where its file put it, even if its first word is later', () => {
    const line: IKaraokeMakerLine = {
      ...windowLine(),
      tokens: [given('l1', 'three', 5_400, 5_800)],
    };
    expect(karaokeMakerLineStartMs(line)).toBe(5_000);
  });

  it('lets a word moved in front of the file start win', () => {
    const line: IKaraokeMakerLine = {
      ...windowLine(),
      tokens: [given('l1', 'three', 4_700, 5_100)],
    };
    expect(karaokeMakerLineStartMs(line)).toBe(4_700);
  });

  it('uses the first word when the line has no given start', () => {
    expect(karaokeMakerLineStartMs(wordLine())).toBe(1_000);
  });

  it('ends a window at the next given line, or at the end of the song', () => {
    const first: IKaraokeMakerLine = { ...windowLine(), id: 'first' };
    const second: IKaraokeMakerLine = {
      ...windowLine(),
      id: 'second',
      given: { startMs: 9_000 },
    };
    const windows = karaokeMakerGivenWindows([first, second], 20_000);
    expect(windows.get('first')).toEqual({ startMs: 5_000, endMs: 9_000 });
    expect(windows.get('second')).toEqual({ startMs: 9_000, endMs: 20_000 });
  });

  it("keeps a window's own end when its file gave one", () => {
    const first: IKaraokeMakerLine = {
      ...windowLine(),
      id: 'first',
      given: { startMs: 5_000, endMs: 7_000 },
    };
    const second: IKaraokeMakerLine = {
      ...windowLine(),
      id: 'second',
      given: { startMs: 9_000 },
    };
    expect(
      karaokeMakerGivenWindows([first, second], 20_000).get('first'),
    ).toEqual({ startMs: 5_000, endMs: 7_000 });
  });

  it('gives no window to a line that has none', () => {
    expect(karaokeMakerGivenWindows([wordLine()], 20_000).size).toBe(0);
  });
});

describe('a line an LRC timed as a whole', () => {
  it('is cut into its words, text and order unchanged', () => {
    const words = karaokeMakerWordsOfUntimedToken(
      word('whole', 'three four five'),
    );
    expect(words.map((token) => token.text)).toEqual(['three', 'four', 'five']);
    expect(words[0].id).toBe('whole');
    expect(new Set(words.map((token) => token.id)).size).toBe(3);
    expect(words.every((token) => token.startMs === undefined)).toBe(true);
  });

  it('leaves a single word as it is', () => {
    const token = word('one', 'three');
    expect(karaokeMakerWordsOfUntimedToken(token)).toEqual([token]);
  });

  it('is found in a draft saved before windows were written', () => {
    const legacy: IKaraokeMakerLine = {
      id: 'legacy',
      startMs: 5_000,
      endMs: 9_000,
      tokens: [
        word('whole', 'three four five', {
          startMs: 5_000,
          endMs: 9_000,
          source: 'auto-align',
        }),
      ],
    };
    const [line] = karaokeMakerInferGivenWindows([legacy]);
    expect(line.given).toEqual({ startMs: 5_000, endMs: 9_000 });
    expect(line.tokens.map((token) => token.text)).toEqual([
      'three',
      'four',
      'five',
    ]);
    // The sentence's time was a detector's, laid across the line: it goes.
    expect(line.tokens.every((token) => token.startMs === undefined)).toBe(
      true,
    );
    expect(karaokeMakerLineSync(line)).toBe('line');
  });

  it('is not read into a draft whose range a detector wrote', () => {
    // The control: the same range, but word by word from a detector. A range
    // alone proves nothing about the file.
    const detected: IKaraokeMakerLine = {
      id: 'detected',
      startMs: 5_000,
      endMs: 9_000,
      tokens: [
        word('d1', 'three', {
          startMs: 5_000,
          endMs: 6_000,
          source: 'auto-align',
        }),
        word('d2', 'four', {
          startMs: 6_000,
          endMs: 9_000,
          source: 'auto-align',
        }),
      ],
    };
    const [line] = karaokeMakerInferGivenWindows([detected]);
    expect(line).toBe(detected);
  });

  it('gives a window to a word-timed line that lacks a word', () => {
    const lacking: IKaraokeMakerLine = {
      id: 'lacking',
      startMs: 1_000,
      endMs: 3_000,
      tokens: [
        given('a', 'one', 1_000, 1_400),
        word('b', 'two'),
        given('c', 'three', 2_400, 3_000),
      ],
    };
    const [line] = karaokeMakerInferGivenWindows([lacking]);
    expect(line.given).toEqual({ startMs: 1_000, endMs: 3_000 });
    expect(line.tokens).toEqual(lacking.tokens);
  });
});

describe('a word the file started and never ended', () => {
  it('ends at the next word, and the last one inside its line', () => {
    const project = projectWith([
      {
        id: 'line',
        startMs: 1_000,
        endMs: 2_600,
        tokens: [given('a', 'one', 1_000), given('b', 'two', 1_500)],
      },
    ]);
    const [line] = karaokeMakerCloseGivenWordEnds(project).lyrics.lines;
    expect(line.tokens[0]).toMatchObject({ startMs: 1_000, endMs: 1_500 });
    expect(line.tokens[1].startMs).toBe(1_500);
    expect(line.tokens[1].endMs).toBeGreaterThan(1_500);
    expect(line.tokens[1].endMs).toBeLessThanOrEqual(2_600);
  });

  it('changes nothing when every word already has its end', () => {
    const project = projectWith([wordLine()]);
    expect(karaokeMakerCloseGivenWordEnds(project)).toBe(project);
  });
});

describe('holding given words through a detector run', () => {
  it('locks given words and words timed inside a given line, nothing else', () => {
    const inWindow: IKaraokeMakerLine = {
      ...windowLine(),
      tokens: [
        word('l1', 'three', {
          startMs: 5_100,
          endMs: 5_500,
          source: 'auto-align',
        }),
        word('l2', 'four'),
      ],
    };
    const free: IKaraokeMakerLine = {
      id: 'free',
      tokens: [
        word('f1', 'six', {
          startMs: 12_000,
          endMs: 12_400,
          source: 'auto-align',
        }),
      ],
    };
    const [first, second, third] = karaokeMakerLockGivenTiming(
      projectWith([wordLine(), inWindow, free]),
    ).lyrics.lines;
    expect(first.tokens.map((token) => token.timingLocked)).toEqual([
      true,
      true,
    ]);
    expect(second.tokens.map((token) => token.timingLocked)).toEqual([
      true,
      undefined,
    ]);
    // The control: a detector's own word outside any given line stays free.
    expect(third.tokens[0].timingLocked).toBeUndefined();
  });

  const afterDetector = (
    before: IKaraokeMakerProject,
    change: (lines: IKaraokeMakerLine[]) => IKaraokeMakerLine[],
  ): IKaraokeMakerProject => ({
    ...before,
    lyrics: {
      ...before.lyrics,
      source: 'whisper',
      lines: change(before.lyrics.lines),
    },
  });

  it('puts back every given word a detector moved or respelt', () => {
    const before = projectWith([wordLine()]);
    const detected = afterDetector(before, (lines) =>
      lines.map((line) => ({
        ...line,
        startMs: 800,
        tokens: line.tokens.map((token) => ({
          ...token,
          text: token.text.toUpperCase(),
          startMs: (token.startMs ?? 0) + 700,
          endMs: (token.endMs ?? 0) + 700,
          source: 'whisper' as const,
        })),
      })),
    );
    // The control: the detector really did change them.
    expect(detected.lyrics.lines[0].tokens).not.toEqual(wordLine().tokens);
    const kept = karaokeMakerKeepGivenLyrics(before, detected);
    expect(kept.lyrics.lines[0].tokens).toEqual(wordLine().tokens);
    expect(kept.lyrics.source).toBe(before.lyrics.source);
  });

  it('keeps a line a detector dropped and refuses one it made up', () => {
    const before = projectWith([wordLine(), windowLine()]);
    const detected = afterDetector(before, (lines) => [
      lines[0],
      {
        id: 'made-up',
        startMs: 15_000,
        tokens: [word('x', 'extra', { startMs: 15_000, endMs: 15_400 })],
      },
    ]);
    const kept = karaokeMakerKeepGivenLyrics(before, detected);
    expect(kept.lyrics.lines.map((line) => line.id)).toEqual([
      'word-line',
      'window-line',
    ]);
  });

  it('keeps a given line window and the words timed inside it', () => {
    const before = projectWith([
      windowLine(),
      { ...windowLine(), id: 'next', given: { startMs: 9_000 }, tokens: [] },
    ]);
    const detected = afterDetector(before, (lines) => [
      {
        ...lines[0],
        startMs: 5_300,
        given: undefined,
        tokens: [
          { ...lines[0].tokens[0], startMs: 5_300, endMs: 5_900 },
          { ...lines[0].tokens[1], text: 'FORE', startMs: 6_000, endMs: 6_500 },
          // Placed in the next line's time: a wrong time, not a late word.
          { ...lines[0].tokens[2], startMs: 9_400, endMs: 9_900 },
        ],
      },
      lines[1],
    ]);
    const [line] = karaokeMakerKeepGivenLyrics(before, detected).lyrics.lines;
    expect(line.given).toEqual({ startMs: 5_000 });
    expect(line.startMs).toBe(5_000);
    expect(line.tokens[0]).toMatchObject({ startMs: 5_300, endMs: 5_900 });
    expect(line.tokens[1]).toMatchObject({
      text: 'four',
      startMs: 6_000,
      endMs: 6_500,
    });
    expect(line.tokens[2].text).toBe('five');
    expect(line.tokens[2].startMs).toBeUndefined();
    expect(line.tokens[2].endMs).toBeUndefined();
  });

  it('lets a transcript through when the song had no lyrics', () => {
    const before = projectWith([]);
    const detected = afterDetector(before, () => [wordLine()]);
    expect(karaokeMakerKeepGivenLyrics(before, detected)).toBe(detected);
  });
});
