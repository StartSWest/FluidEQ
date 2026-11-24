import {
  FORCED_ALIGNMENT_WINDOW_TOKENS,
  forcedAlignmentCost,
  forcedAlignmentLineResult,
  forcedAlignmentStarts,
  forcedAlignmentWindows,
  IForcedAlignmentLine,
} from '../../../renderer/karaoke/makerAi/forcedAlignment';

const line = (
  id: string,
  startMs: number,
  endMs: number,
  words = 3,
): IForcedAlignmentLine => ({
  id,
  startMs,
  endMs,
  words: Array.from({ length: words }, (_unused, index) => ({
    text: `w${index}`,
    spaceBefore: true,
  })),
});

const idsOf = (windows: ReturnType<typeof forcedAlignmentWindows>) =>
  windows.map((window) => window.lines.map((entry) => entry.id));

describe('grouping lines into the windows the model hears', () => {
  it('shares one window among lines that fit in it', () => {
    const windows = forcedAlignmentWindows(
      [
        line('a', 0, 5_000),
        line('b', 5_000, 12_000),
        line('c', 12_000, 20_000),
      ],
      () => 10,
    );
    expect(idsOf(windows)).toEqual([['a', 'b', 'c']]);
    expect(windows[0]).toMatchObject({ startMs: 0, endMs: 20_000 });
  });

  it('starts a new window when the next line would not fit the model', () => {
    expect(
      idsOf(
        forcedAlignmentWindows(
          [line('a', 0, 15_000), line('b', 15_000, 31_000)],
          () => 10,
        ),
      ),
    ).toEqual([['a'], ['b']]);
  });

  it('starts a new window when the words would not fit the decoder', () => {
    expect(
      idsOf(
        forcedAlignmentWindows(
          [line('a', 0, 5_000), line('b', 5_000, 10_000)],
          () => FORCED_ALIGNMENT_WINDOW_TOKENS - 1,
        ),
      ),
    ).toEqual([['a'], ['b']]);
  });

  it('never solves two lines given the same stretch in one window', () => {
    expect(
      idsOf(
        forcedAlignmentWindows(
          [line('a', 0, 8_000), line('b', 4_000, 9_000)],
          () => 10,
        ),
      ),
    ).toEqual([['a'], ['b']]);
  });

  it('leaves out a line with no words or no room, and sorts the rest', () => {
    expect(
      idsOf(
        forcedAlignmentWindows(
          [
            line('late', 6_000, 9_000),
            line('empty', 1_000, 3_000, 0),
            line('instant', 3_000, 3_100),
            line('early', 0, 1_000),
          ],
          () => 10,
        ),
      ),
    ).toEqual([['early', 'late']]);
  });

  it('cuts a line longer than the model hears to what it hears', () => {
    const [window] = forcedAlignmentWindows([line('a', 0, 90_000)], () => 10);
    expect(window.endMs).toBe(29_000);
  });
});

/** Three tokens, each attended over its own ten frames of thirty. */
const ROWS = 3;
const FRAMES = 30;
const blockHead = (): Float32Array => {
  const head = new Float32Array(ROWS * FRAMES).fill(0.01);
  for (let row = 0; row < ROWS; row += 1) {
    for (let frame = row * 10; frame < row * 10 + 10; frame += 1) {
      head[row * FRAMES + frame] = 1;
    }
  }
  return head;
};

describe('reading where each word was heard', () => {
  it('makes the frames a token was read on the cheap ones', () => {
    const cost = forcedAlignmentCost([blockHead()], ROWS, FRAMES);
    for (let row = 0; row < ROWS; row += 1) {
      const inside = cost[row * FRAMES + row * 10 + 5];
      const outside = cost[row * FRAMES + ((row + 1) % ROWS) * 10 + 5];
      expect(inside).toBeLessThan(outside);
    }
  });

  it('has nothing to say with no attention to read', () => {
    expect(Array.from(forcedAlignmentCost([], ROWS, FRAMES))).toEqual(
      new Array(ROWS * FRAMES).fill(0),
    );
  });

  it('starts each token where its attention begins', () => {
    const cost = forcedAlignmentCost([blockHead(), blockHead()], ROWS, FRAMES);
    expect(forcedAlignmentStarts(cost, ROWS, FRAMES, [])).toEqual([0, 10, 20]);
  });

  it('holds a token inside the frames its line allows', () => {
    const cost = forcedAlignmentCost([blockHead()], ROWS, FRAMES);
    // The control above put the second token on frame 10. Its line is said to
    // begin at frame 15, and the token may not be heard before that.
    const starts = forcedAlignmentStarts(cost, ROWS, FRAMES, [
      undefined,
      { from: 15, to: FRAMES },
      undefined,
    ]);
    expect(starts[1]).toBe(15);
    expect(starts[2]).toBe(20);
  });

  it('makes a token begin by a frame and lets it run on', () => {
    const cost = forcedAlignmentCost([blockHead()], ROWS, FRAMES);
    const starts = forcedAlignmentStarts(cost, ROWS, FRAMES, [
      undefined,
      undefined,
      { from: 0, to: FRAMES, startBy: 12 },
    ]);
    // Unconfined it began on frame 20.
    expect(starts[2]).toBeLessThanOrEqual(12);
    expect(starts[2]).toBeGreaterThanOrEqual(starts[1]);
  });

  it('answers nothing when no path fits the limits', () => {
    const cost = forcedAlignmentCost([blockHead()], ROWS, FRAMES);
    expect(
      forcedAlignmentStarts(cost, ROWS, FRAMES, [
        { from: 20, to: FRAMES },
        { from: 0, to: 5 },
        undefined,
      ]),
    ).toEqual([]);
  });
});

describe('one line out of its tokens', () => {
  const sung = line('sung', 1_000, 3_000, 2);

  it('times each word from its first token and scores it', () => {
    const result = forcedAlignmentLineResult(
      sung,
      1_000,
      [1, 2],
      [0, 50, 60],
      [Math.log(0.9), Math.log(0.5), Math.log(0.5)],
      [0, 50, 60],
    );
    expect(result.words.map((word) => word.startMs)).toEqual([1_000, 2_000]);
    expect(result.words[0].probability).toBeCloseTo(0.9, 5);
    expect(result.words[1].probability).toBeCloseTo(0.5, 5);
    expect(result.confidence).toBeCloseTo(0.7, 5);
    expect(result.stacked).toBe(0);
    expect(result.astray).toBe(0);
  });

  it('says when the words were all put on one frame', () => {
    const result = forcedAlignmentLineResult(
      sung,
      1_000,
      [1, 1],
      [40, 40],
      [0, 0],
      [40, 40],
    );
    expect(result.stacked).toBe(1);
  });

  it('says when the words are heard outside the line', () => {
    // Confined, both sit inside the line. Left alone the model hears them
    // ten seconds later: the file's line time is not this recording's.
    const result = forcedAlignmentLineResult(
      sung,
      1_000,
      [1, 1],
      [10, 60],
      [0, 0],
      [510, 560],
    );
    expect(result.astray).toBe(1);
    expect(result.words.map((word) => word.startMs)).toEqual([1_200, 2_200]);
  });

  it('forgives a word heard a little before its line', () => {
    const early = line('early', 1_000, 3_000, 1);
    // 200 ms ahead of the line: inside what the reading wanders by.
    expect(
      forcedAlignmentLineResult(early, 0, [1], [50], [0], [40]).astray,
    ).toBe(0);
    // 600 ms ahead: not this line's time.
    expect(
      forcedAlignmentLineResult(early, 0, [1], [50], [0], [20]).astray,
    ).toBe(1);
  });

  it('never times a word outside its line', () => {
    const result = forcedAlignmentLineResult(
      sung,
      1_000,
      [1, 1],
      [0, 400],
      [0, 0],
      [0, 400],
    );
    expect(result.words[1].startMs).toBe(3_000);
  });
});
