import {
  animationFindings,
  feetLineOf,
  measureAnimation,
  type ISheetPixels,
} from '../../../common/animationFrames';
import {
  frameAtTime,
  frameCell,
  readStudioAnimation,
} from '../../../common/studioAnimation';
import {
  composeLook,
  describeAnimation,
} from '../../../main/studioChat/animationLook';

/**
 * An animation in a Studio project: a sheet of poses, how it is cut and
 * played (`studioAnimation.ts`), and what its frames are, measured from
 * their own pixels so the member's AI can see which frame breaks a cycle
 * without photographing the whole scene (`animationFrames.ts`).
 */

describe('an animation file', () => {
  it('is read with its defaults: one row, eight a second, looping', () => {
    expect(
      readStudioAnimation('wolf-walk', {
        sheet: 'art/wolf-walk.png',
        count: 8,
      }),
    ).toEqual({
      name: 'wolf-walk',
      sheet: 'art/wolf-walk.png',
      count: 8,
      columns: 8,
      fps: 8,
      loop: true,
      ground: 'none',
    });
  });

  it('keeps what it is given inside its bounds', () => {
    expect(
      readStudioAnimation('fox', {
        sheet: 'fox.webp',
        count: 9000,
        columns: 9000,
        fps: 900,
        loop: false,
        ground: 'water',
      }),
    ).toMatchObject({
      count: 256,
      columns: 256,
      fps: 60,
      loop: false,
      ground: 'water',
    });
    expect(
      readStudioAnimation('fox', {
        sheet: 'fox.jpg',
        count: 0,
        ground: 'lava',
      }),
    ).toMatchObject({ count: 1, columns: 1, ground: 'none' });
  });

  it.each([
    '../outside.png',
    'art/../../outside.png',
    '/etc/sheet.png',
    'C:/Users/sheet.png',
    '.hidden.png',
    'a/b/c/d/deep.png',
    'art/wolf.gif',
    'art\\wolf.png',
  ])('refuses %s as its sheet', (sheet) => {
    expect(readStudioAnimation('wolf', { sheet, count: 4 })).toBeUndefined();
  });

  it('refuses a name that is not a plain one', () => {
    expect(readStudioAnimation('../wolf', { sheet: 'w.png' })).toBeUndefined();
    expect(readStudioAnimation('Wolf', { sheet: 'w.png' })).toBeUndefined();
  });
});

describe('a frame on its sheet', () => {
  const wolf = { count: 6, columns: 4, loop: true };

  it('is cut left to right and then top to bottom', () => {
    expect(frameCell(wolf, 1024, 512, 0)).toEqual({
      x: 0,
      y: 0,
      width: 256,
      height: 256,
    });
    expect(frameCell(wolf, 1024, 512, 5)).toEqual({
      x: 256,
      y: 256,
      width: 256,
      height: 256,
    });
    // Wrapped both ways.
    expect(frameCell(wolf, 1024, 512, -1)).toEqual(
      frameCell(wolf, 1024, 512, 5),
    );
  });

  it('is chosen by the time played, looping or held at the end', () => {
    expect(frameAtTime(wolf, 6, 0)).toBe(0);
    expect(frameAtTime(wolf, 6, 999)).toBe(5);
    expect(frameAtTime(wolf, 6, 1000)).toBe(0);
    expect(frameAtTime({ ...wolf, loop: false }, 6, 5000)).toBe(5);
  });
});

/**
 * A sheet of `frames` cells 20 x 20 in one row, each with a block drawn at
 * (left, top), `size` wide and tall, on a transparent or a flat background.
 */
const sheetOf = (
  frames: { left: number; top: number; size: number }[],
  flat = false,
): ISheetPixels => {
  const width = frames.length * 20;
  const height = 20;
  const data = new Uint8Array(width * height * 4);
  for (let at = 0; at < data.length; at += 4) {
    data[at] = flat ? 250 : 0;
    data[at + 1] = flat ? 250 : 0;
    data[at + 2] = flat ? 250 : 0;
    data[at + 3] = flat ? 255 : 0;
  }
  frames.forEach(({ left, top, size }, index) => {
    for (let y = top; y < top + size; y += 1) {
      for (let x = left; x < left + size; x += 1) {
        const at = (y * width + index * 20 + x) * 4;
        data[at] = 120;
        data[at + 1] = 60;
        data[at + 2] = 30;
        data[at + 3] = 255;
      }
    }
  });
  return { data, width, height };
};

const steady = (shift: number) => ({ left: 4 + shift, top: 6, size: 10 });
const cycle = (count: number) => ({ count, columns: count }) as const;

describe('the frames of a cycle, measured', () => {
  it('finds nothing wrong in a cycle that stands on one line', () => {
    const sheet = sheetOf([steady(0), steady(1), steady(2), steady(1)]);
    const measure = measureAnimation(sheet, cycle(4));
    expect(measure.shapes.map((shape) => shape.bottom)).toEqual([
      15, 15, 15, 15,
    ]);
    expect(animationFindings(measure)).toEqual([]);
    // The feet stand on the row below the drawing's last.
    expect(feetLineOf(measure)).toBeCloseTo(16 / 20);
  });

  it('names a frame whose feet leave the line', () => {
    const lifted = sheetOf([
      steady(0),
      steady(1),
      { left: 6, top: 2, size: 10 },
      steady(1),
    ]);
    expect(
      animationFindings(measureAnimation(lifted, cycle(4))),
    ).toContainEqual({
      frame: 3,
      kind: 'feet',
      amount: -4,
    });
  });

  it('names a frame drawn bigger than the rest', () => {
    const bigger = sheetOf([
      steady(0),
      steady(1),
      { left: 2, top: 2, size: 14 },
      steady(1),
    ]);
    expect(
      animationFindings(measureAnimation(bigger, cycle(4))).map(
        ({ frame, kind }) => [frame, kind],
      ),
    ).toContainEqual([3, 'size']);
  });

  it('names a frame that jumps, into it and out of it again', () => {
    // Frame 5 is drawn far to the left of where the cycle goes: the step
    // into it and the step back out are both jumps; the rest are not.
    const jumps = sheetOf([
      steady(0),
      steady(1),
      steady(0),
      steady(1),
      { left: 0, top: 6, size: 10 },
      steady(1),
    ]);
    expect(
      animationFindings(measureAnimation(jumps, cycle(6)))
        .filter(({ kind }) => kind === 'jump')
        .map(({ frame }) => frame),
    ).toEqual([5, 6]);
  });

  it('names an empty cell', () => {
    const missing = sheetOf([
      steady(0),
      { left: 0, top: 0, size: 0 },
      steady(0),
    ]);
    expect(
      animationFindings(measureAnimation(missing, cycle(3))),
    ).toContainEqual({
      frame: 2,
      kind: 'empty',
      amount: 0,
    });
  });

  it('reads a drawing on a flat background as well as on a transparent one', () => {
    const frames = [
      steady(0),
      steady(1),
      { left: 6, top: 2, size: 10 },
      steady(1),
    ];
    const flat = measureAnimation(sheetOf(frames, true), cycle(4));
    const clear = measureAnimation(sheetOf(frames), cycle(4));
    expect(flat.shapes).toEqual(clear.shapes);
  });
});

describe('what the AI is shown of an animation', () => {
  const animation = readStudioAnimation('wolf', {
    sheet: 'art/wolf.png',
    count: 4,
    fps: 8,
    ground: 'ground',
  });
  if (!animation) {
    throw new Error('the animation did not read');
  }

  it('is one picture of two rows: the frames, and each over the one before', () => {
    const sheet = sheetOf([steady(0), steady(1), steady(2), steady(1)]);
    const cells = measureAnimation(sheet, cycle(4)).cells.map((cell) => {
      const data = new Uint8Array(cell.width * cell.height * 4);
      for (let y = 0; y < cell.height; y += 1) {
        for (let x = 0; x < cell.width; x += 1) {
          const from = (y * sheet.width + cell.x + x) * 4;
          data.set(
            Array.from(
              { length: 4 },
              (_, channel) => sheet.data[from + channel],
            ),
            (y * cell.width + x) * 4,
          );
        }
      }
      return { data, width: cell.width, height: cell.height };
    });
    const look = composeLook(cells, 0.8);
    expect([look.width, look.height]).toEqual([4 * 20 + 5 * 8, 2 * 20 + 3 * 8]);
    // In the bottom row, frame 2's cell shows frame 1's drawing faded where
    // only frame 1 is drawn: at x 4 (frame 2 starts at 5).
    const pixel = (x: number, y: number) => look.data[(y * look.width + x) * 4];
    const secondCell = 8 + 20 + 8;
    const ground = pixel(2, 2);
    expect(pixel(secondCell + 4, 8 + 20 + 8 + 8)).not.toBe(ground);
    // And the top row shows frame 2 alone: nothing at x 4.
    expect(pixel(secondCell + 4, 8 + 8)).toBe(ground);
  });

  it('says the numbers and names the frame that breaks the cycle', () => {
    const lifted = measureAnimation(
      sheetOf([steady(0), steady(1), { left: 6, top: 2, size: 10 }, steady(1)]),
      cycle(4),
    );
    const words = describeAnimation(animation, lifted);
    expect(words).toContain('4 frames');
    expect(words).toContain('Feet (lowest drawn row');
    expect(words).toContain("Frame 3's feet are 4 px above the line");
  });

  it('says so when nothing breaks the cycle', () => {
    const fine = measureAnimation(
      sheetOf([steady(0), steady(1), steady(2), steady(1)]),
      cycle(4),
    );
    expect(describeAnimation(animation, fine)).toContain(
      'Nothing breaks the cycle',
    );
  });
});

/** A sheet of 20 x 20 cells in one row, each drawing the pixels it lists. */
const drawnSheet = (frames: Array<Array<[number, number]>>): ISheetPixels => {
  const width = frames.length * 20;
  const data = new Uint8Array(width * 20 * 4);
  frames.forEach((pixels, index) => {
    pixels.forEach(([x, y]) => {
      data.set([120, 60, 30, 255], (y * width + index * 20 + x) * 4);
    });
  });
  return { data, width, height: 20 };
};

/** A two-pixel line from (4, 10), level or at 45 degrees down. */
const line = (slant: boolean): Array<[number, number]> =>
  Array.from({ length: 10 }, (_, step): Array<[number, number]> => [
    [4 + step, slant ? 5 + step : 10],
    [4 + step, slant ? 6 + step : 11],
  ]).flat();

describe('the frames of a move, judged as it means to move', () => {
  it('does not call a drawing that only turns a different size, and still names one that grows', () => {
    const turning = measureAnimation(
      drawnSheet([line(false), line(false), line(true), line(false)]),
      cycle(4),
    );
    expect(
      animationFindings(turning, { ground: 'ground' }).filter(
        ({ kind }) => kind === 'size',
      ),
    ).toEqual([]);
    const growing = measureAnimation(
      drawnSheet([
        line(false),
        line(false),
        [...line(false), ...line(true)],
        line(false),
      ]),
      cycle(4),
    );
    expect(
      animationFindings(growing, { ground: 'ground' }).map(
        ({ frame, kind }) => [frame, kind],
      ),
    ).toContainEqual([3, 'size']);
  });

  it('judges the feet and the size only of what stands on the ground', () => {
    const lifted = measureAnimation(
      sheetOf([steady(0), steady(1), { left: 6, top: 2, size: 10 }, steady(1)]),
      cycle(4),
    );
    const feet = (ground: 'ground' | 'water' | 'sky') =>
      animationFindings(lifted, { ground }).filter(
        ({ kind }) => kind === 'feet',
      );
    expect(feet('ground')).toHaveLength(1);
    expect(feet('water')).toEqual([]);
    expect(feet('sky')).toEqual([]);
    // A wing beat: the wings edge-on show less bird than spread.
    const beat = measureAnimation(
      drawnSheet([
        [...line(false), ...line(true)],
        [...line(false), ...line(true)],
        line(false),
        [...line(false), ...line(true)],
      ]),
      cycle(4),
    );
    const sizes = (ground: 'ground' | 'sky') =>
      animationFindings(beat, { ground }).filter(({ kind }) => kind === 'size');
    expect(sizes('sky')).toEqual([]);
    expect(sizes('ground')).toHaveLength(1);
  });

  it("never calls a one-shot's first frame a jump from its last, and still does in a loop", () => {
    // A dive: the last frame is far from the first, every step between small.
    const dive = measureAnimation(
      sheetOf([0, 1, 2, 3, 4, 5, 6].map((shift) => steady(shift))),
      cycle(7),
    );
    const jumps = (loop: boolean) =>
      animationFindings(dive, { loop })
        .filter(({ kind }) => kind === 'jump')
        .map(({ frame }) => frame);
    expect(jumps(false)).toEqual([]);
    expect(jumps(true)).toEqual([1]);
  });
});
