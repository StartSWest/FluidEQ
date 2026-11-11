/**
 * @jest-environment node
 */
import type { ILookRequest } from '../../../main/studioAgent/lookRequest';
import {
  cutTo,
  describeSteps,
  stepBetween,
  watchFrames,
  WHOLE_PICTURE,
  type IPixels,
} from '../../../main/studioAgent/watchFrames';
import {
  createWatchTool,
  readWatchRequest,
  watchMoments,
} from '../../../main/studioAgent/watchTool';

/** A dark picture with a bright square whose top-left corner is at x, y. */
const withSquare = (
  x: number,
  y: number,
  light = 240,
  width = 96,
  height = 48,
): IPixels => {
  const data = new Uint8Array(width * height * 4).fill(20);
  for (let row = y; row < y + 12; row += 1) {
    for (let column = x; column < x + 12; column += 1) {
      data.fill(
        light,
        (row * width + column) * 4,
        (row * width + column) * 4 + 4,
      );
    }
  }
  return { data, width, height };
};

describe('what moved between two frames', () => {
  it('says which way a thing went, right and up being positive', () => {
    const right = stepBetween(withSquare(20, 18), withSquare(26, 18));
    expect(right.shift?.x).toBeCloseTo(6 / 96, 5);
    expect(right.shift?.y).toBeCloseTo(0, 5);
    const left = stepBetween(withSquare(26, 18), withSquare(20, 18));
    expect(left.shift?.x).toBeCloseTo(-6 / 96, 5);
    // Rows count down the picture; up is positive, as uv is.
    const up = stepBetween(withSquare(20, 24), withSquare(20, 18));
    expect(up.shift?.y).toBeCloseTo(6 / 48, 5);
    expect(up.shift?.x).toBeCloseTo(0, 5);
  });

  it('calls a change in place a change, and no move', () => {
    const pulse = stepBetween(withSquare(20, 18, 120), withSquare(20, 18, 240));
    expect(pulse.change).toBeGreaterThan(0.002);
    expect(pulse.shift).toBeUndefined();
  });

  it('finds nothing between two pictures that are the same', () => {
    expect(stepBetween(withSquare(20, 18), withSquare(20, 18))).toEqual({
      change: 0,
    });
  });
});

describe('the part of the picture watched', () => {
  it('is cut in uv, counted from the bottom-left', () => {
    // Each row holds its own number, from 0 at the top to 9 at the bottom.
    const data = new Uint8Array(10 * 10 * 4);
    for (let row = 0; row < 10; row += 1) {
      data.fill(row, row * 40, (row + 1) * 40);
    }
    const lower = cutTo(
      { data, width: 10, height: 10 },
      { x: 0.5, y: 0, width: 0.5, height: 0.3 },
    );
    expect([lower.width, lower.height]).toEqual([5, 3]);
    // The bottom three rows: 7, 8 and 9.
    expect([lower.data[0], lower.data[20], lower.data[40]]).toEqual([7, 8, 9]);
    // The control: the same share from the top is rows 0, 1 and 2.
    const upper = cutTo(
      { data, width: 10, height: 10 },
      { x: 0, y: 0.7, width: 0.5, height: 0.3 },
    );
    expect([upper.data[0], upper.data[20], upper.data[40]]).toEqual([0, 1, 2]);
  });

  it('is shown enlarged by whole pixels when it is small', () => {
    const frames = [withSquare(20, 18), withSquare(26, 18), withSquare(32, 18)];
    const watched = watchFrames(frames, [1, 1.1, 1.2], {
      x: 0.125,
      y: 0.25,
      width: 0.5,
      height: 0.5,
    });
    expect(watched.cut).toEqual({ width: 48, height: 24 });
    // Eight times, the most: 384 by 192, every pixel of the part a square.
    expect(watched.cell).toEqual({ width: 384, height: 192 });
    expect(watched.steps).toHaveLength(2);
    // The square is a larger share of the part than of the whole picture.
    expect(watched.steps[0].shift?.x).toBeCloseTo(6 / 48, 5);
  });

  it('lays past five frames on two rows, and keeps the strip readable', () => {
    const one = withSquare(20, 18, 240, 1280, 720);
    const five = watchFrames(
      Array(5).fill(one),
      [1, 2, 3, 4, 5],
      WHOLE_PICTURE,
    );
    const eight = watchFrames(
      Array(8).fill(one),
      [1, 2, 3, 4, 5, 6, 7, 8],
      WHOLE_PICTURE,
    );
    expect(five.strip.width).toBeLessThanOrEqual(1960);
    expect(eight.strip.width).toBeLessThanOrEqual(1960);
    // Four to a row: each frame larger than five in a row would leave it.
    expect(eight.cell.width).toBeGreaterThan(five.cell.width);
    expect(eight.strip.height).toBeGreaterThan(2 * eight.cell.height);
    expect(five.strip.height).toBeLessThan(2 * five.cell.height);
  });
});

describe('what the run of steps says', () => {
  const step = (change: number, x?: number) => ({
    change,
    ...(x === undefined ? {} : { shift: { x, y: 0 } }),
  });

  it('tells even motion from uneven, and by how much', () => {
    expect(
      describeSteps([step(0.02, 0.05), step(0.022, 0.05)]).join('\n'),
    ).toContain('even motion');
    const uneven = describeSteps([step(0.01, 0.02), step(0.04, 0.08)]);
    expect(uneven.join('\n')).toContain('4.0 times');
    expect(uneven.join('\n')).not.toContain('even motion');
  });

  it('says so when nothing moves, when it stops, and when it turns back', () => {
    expect(describeSteps([step(0), step(0)]).join('\n')).toContain(
      'Nothing moves in this part',
    );
    expect(describeSteps([step(0.03, 0.05), step(0)]).join('\n')).toContain(
      'stands still in others',
    );
    expect(
      describeSteps([step(0.03, 0.05), step(0.03, -0.05)]).join('\n'),
    ).toContain('direction reverses');
    // The control: the same way twice does not.
    expect(
      describeSteps([step(0.03, 0.05), step(0.03, 0.05)]).join('\n'),
    ).not.toContain('direction reverses');
  });
});

describe('watch_scene', () => {
  type TOutcome = { ok: true; frame: number } | { ok: false };

  const setUp = (failAt?: number) => {
    const asked: ILookRequest[] = [];
    const tool = createWatchTool<TOutcome>({
      look: async (request) => {
        asked.push(request);
        return asked.length === failAt
          ? { ok: false }
          : { ok: true, frame: asked.length - 1 };
      },
      pictures: {
        // The picture's one byte says which frame it is.
        decode: (bytes) => withSquare(20 + bytes[0] * 4, 18),
        encodePng: (picture) => new Uint8Array([picture.width % 251]),
      },
      pictureOf: (outcome) =>
        outcome.ok ? new Uint8Array([outcome.frame]) : undefined,
      explain: () => ({
        content: [{ type: 'text', text: 'the shader does not compile' }],
        isError: true,
      }),
      titleOf: () => 'Reef (id reef, version 3)',
    });
    return { tool, asked };
  };

  const wordsOf = (result: { content: { type: string; text?: string }[] }) =>
    result.content.find((part) => part.type === 'text')?.text ?? '';

  it('looks once a frame, each a step later, and answers one picture', async () => {
    const { tool, asked } = setUp();
    const result = await tool.call({
      seconds: 2,
      every: 0.25,
      frames: 4,
      shape: 'graph',
    });
    expect(asked.map((request) => request.seconds)).toEqual([
      2, 2.25, 2.5, 2.75,
    ]);
    expect(asked.every((request) => request.shape === 'graph')).toBe(true);
    expect(result.isError).toBeUndefined();
    expect(result.content.filter((part) => part.type === 'image')).toHaveLength(
      1,
    );
    const words = wordsOf(result);
    expect(words).toContain('Reef (id reef, version 3): 4 frames 0.25 s apart');
    expect(words).toContain('Frame 1 to 2');
    expect(words).toContain('Frame 3 to 4');
    // Each frame's square is four pixels further right than the last.
    expect(words).toContain('right');
    expect(words).toContain('even motion');
  });

  it('answers the first frame that cannot be drawn as a look would', async () => {
    const { tool, asked } = setUp(3);
    const result = await tool.call({ frames: 5 });
    expect(result.isError).toBe(true);
    expect(wordsOf(result)).toBe('the shader does not compile');
    // Nothing is drawn after it.
    expect(asked).toHaveLength(3);
  });

  it('starts where a look does and refuses to run past the music', () => {
    const request = readWatchRequest({ frames: 3 }, 'graph');
    // The first kick after the warm-up, beat 4 of the test music at 118
    // beats a minute, and a tenth of a second between frames.
    const moments =
      typeof request === 'object' ? watchMoments(request) : request;
    expect(moments).toEqual([2.0339, 2.1339, 2.2339]);
    const late = readWatchRequest({ seconds: 15.5, every: 0.5, frames: 3 });
    expect(typeof late === 'object' && typeof watchMoments(late)).toBe(
      'string',
    );
  });

  it('refuses what it cannot make sense of, in words', () => {
    expect(readWatchRequest({ frames: 9 })).toContain('frames must be');
    expect(readWatchRequest({ every: 5 })).toContain('every must be');
    expect(
      readWatchRequest({ region: { x: 0.8, y: 0, width: 0.5, height: 0.5 } }),
    ).toContain('region must be');
    // What a look refuses, a watch refuses in the same words.
    expect(readWatchRequest({ shape: 'square' })).toContain('shape must be');
  });
});
