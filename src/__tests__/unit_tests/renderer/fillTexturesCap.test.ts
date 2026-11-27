/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A look's texture is made once and painted every frame: a picture decoded
 * once and redrawn once at each size it lies at, a pattern built once —
 * never per frame, which is what a picture look used to pay (a new pattern
 * from the picture at every frame, resampled by the canvas). And not every
 * picture ever drawn is kept: past a handful, the one drawn longest ago
 * goes.
 */

import {
  fillTexturePattern,
  lookTexturePaint,
  printTexture,
  resetFillTextures,
  texturePlacement,
  type ITexturePaint,
} from 'renderer/graph/fillTextures';
import {
  pictureGeometry,
  resetTexturePictures,
} from 'renderer/graph/texturePictures';

/** The six numbers of a 2D transform, as the canvas's own type has them. */
class TestMatrix {
  a: number;

  b: number;

  c: number;

  d: number;

  e: number;

  f: number;

  constructor(values: number[] = [1, 0, 0, 1, 0, 0]) {
    [this.a, this.b, this.c, this.d, this.e, this.f] = values;
  }

  multiply(other: TestMatrix): TestMatrix {
    return new TestMatrix([
      this.a * other.a + this.c * other.b,
      this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d,
      this.b * other.c + this.d * other.d,
      this.a * other.e + this.c * other.f + this.e,
      this.b * other.e + this.d * other.f + this.f,
    ]);
  }

  inverse(): TestMatrix {
    const det = this.a * this.d - this.b * this.c;
    return new TestMatrix([
      this.d / det,
      -this.b / det,
      -this.c / det,
      this.a / det,
      (this.c * this.f - this.d * this.e) / det,
      (this.b * this.e - this.a * this.f) / det,
    ]);
  }
}

interface IFakeBitmap {
  width: number;
  height: number;
  close: jest.Mock;
}

const bitmap = (width: number, height: number): IFakeBitmap => ({
  width,
  height,
  close: jest.fn(),
});

/** Every `createImageBitmap` call: a decode has one argument, a redraw six. */
const bitmaps = jest.fn();
const decodes = () => bitmaps.mock.calls.filter((call) => call.length === 1);
const redraws = () => bitmaps.mock.calls.filter((call) => call.length > 1);

const settle = async () => {
  // Each step is a promise the module chains; a few turns drain them all.
  for (let turn = 0; turn < 6; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask turn at a time, in order, is the point
    await Promise.resolve();
  }
};

const patterns: { setTransform: jest.Mock }[] = [];
const createPattern = jest.fn(() => {
  const pattern = { setTransform: jest.fn() };
  patterns.push(pattern);
  return pattern;
});
let current = new TestMatrix();
const fill = jest.fn();
const context = {
  createPattern,
  getTransform: () => current,
  fill,
  fillStyle: undefined as unknown,
} as unknown as CanvasRenderingContext2D;

const picture = (index: number) =>
  `data:image/png;base64,${String(index).padStart(4, '0')}AAAA`;

const paint = (overrides: Partial<ITexturePaint>): ITexturePaint => ({
  texture: 'image',
  image: picture(1),
  scale: 1,
  fit: 'tile',
  size: 192,
  area: { left: 40, top: 10, right: 1040, bottom: 310 },
  ink: 'white',
  ...overrides,
});

/** A pattern at the size every pattern had before the size slider. */
const patternPaint = (overrides: Partial<ITexturePaint>): ITexturePaint =>
  paint({ size: 16, ...overrides });

beforeAll(() => {
  Object.assign(globalThis, { DOMMatrix: TestMatrix });
  // jsdom draws nothing (`jest-setup.ts`); a tile is drawn on a context
  // that takes every call and keeps every setting.
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      new Proxy({} as Record<string | symbol, unknown>, {
        get: (target, key) => (key in target ? target[key] : () => undefined),
        set: (target, key, value) => {
          target[key] = value;
          return true;
        },
      }) as unknown as CanvasRenderingContext2D,
  );
  Object.assign(globalThis, {
    createImageBitmap: (...args: unknown[]) => {
      bitmaps(...args);
      // A decode answers the picture's own size; a redraw the size asked.
      const options = args[5] as
        { resizeWidth: number; resizeHeight: number } | undefined;
      return Promise.resolve(
        options
          ? bitmap(options.resizeWidth, options.resizeHeight)
          : bitmap(1280, 720),
      );
    },
  });
});

beforeEach(() => {
  resetFillTextures();
  resetTexturePictures();
  bitmaps.mockClear();
  createPattern.mockClear();
  fill.mockClear();
  patterns.length = 0;
  current = new TestMatrix();
});

describe('where a picture lies', () => {
  it('tiles the whole picture at the height asked, at its own shape', () => {
    const tile = pictureGeometry(1280, 720, paint({ size: 90, scale: 2 }));
    expect(tile).toMatchObject({ x: 0, y: 0, height: 90, repeat: true });
    expect(tile?.width).toBeCloseTo(160);
    // Redrawn at the device pixels it covers.
    expect(tile?.pixelsWide).toBe(320);
    expect(tile?.pixelsHigh).toBe(180);
  });

  it('covers the plot once, keeping its shape and cutting what overhangs', () => {
    // A 16:9 picture over a 1000 by 300 plot: it fills the width and its
    // top and bottom are cut evenly.
    const cover = pictureGeometry(1280, 720, paint({ fit: 'cover' }));
    expect(cover).toMatchObject({
      x: 40,
      y: 10,
      width: 1000,
      height: 300,
      repeat: false,
    });
    expect(cover?.crop.width).toBeCloseTo(1280);
    expect(cover?.crop.height).toBeCloseTo(384);
    expect(cover?.crop.y).toBeCloseTo(168);
    // A tall plot cuts the sides instead.
    const tall = pictureGeometry(
      1280,
      720,
      paint({
        fit: 'cover',
        area: { left: 0, top: 0, right: 100, bottom: 400 },
      }),
    );
    expect(tall?.crop.height).toBeCloseTo(720);
    expect(tall?.crop.width).toBeCloseTo(180);
    expect(tall?.crop.x).toBeCloseTo(550);
  });
});

describe('a picture texture', () => {
  it('is decoded once, redrawn once, and made a pattern once over many frames', async () => {
    expect(fillTexturePattern(context, paint({}))).toBeUndefined();
    await settle();
    // The redraw is asked for by the first frame after the decode.
    expect(fillTexturePattern(context, paint({}))).toBeUndefined();
    await settle();
    for (let frame = 0; frame < 120; frame += 1) {
      expect(fillTexturePattern(context, paint({}))).toBeDefined();
    }
    expect(decodes()).toHaveLength(1);
    expect(redraws()).toHaveLength(1);
    expect(createPattern).toHaveBeenCalledTimes(1);
  });

  it('is redrawn for a new size, standing in with the old one meanwhile', async () => {
    fillTexturePattern(context, paint({}));
    await settle();
    fillTexturePattern(context, paint({}));
    await settle();
    expect(redraws()).toHaveLength(1);
    // The control for the test above: a new tile size is a new redraw.
    expect(fillTexturePattern(context, paint({ size: 96 }))).toBeDefined();
    expect(redraws()).toHaveLength(2);
    await settle();
    fillTexturePattern(context, paint({ size: 96 }));
    expect(redraws()).toHaveLength(2);
    expect(createPattern).toHaveBeenCalledTimes(2);
  });

  it('decodes a picture again only once it has gone unused behind many others', async () => {
    for (let index = 0; index <= 8; index += 1) {
      fillTexturePattern(context, paint({ image: picture(index) }));
    }
    await settle();
    expect(decodes()).toHaveLength(9);
    // The control: a picture drawn a moment ago is still held.
    fillTexturePattern(context, paint({ image: picture(8) }));
    fillTexturePattern(context, paint({ image: picture(2) }));
    expect(decodes()).toHaveLength(9);
    // The first, drawn longest ago, was let go.
    fillTexturePattern(context, paint({ image: picture(0) }));
    expect(decodes()).toHaveLength(10);
  });
});

describe('a pattern texture', () => {
  it('is built once, however many frames print it', () => {
    for (let frame = 0; frame < 120; frame += 1) {
      fillTexturePattern(context, patternPaint({ texture: 'hatch' }));
    }
    expect(createPattern).toHaveBeenCalledTimes(1);
    // The control: another pattern is another build.
    fillTexturePattern(context, patternPaint({ texture: 'dots' }));
    expect(createPattern).toHaveBeenCalledTimes(2);
  });

  it('reaches the engine as one bitmap of its tile', async () => {
    expect(
      texturePlacement(patternPaint({ texture: 'hatch' })),
    ).toBeUndefined();
    await settle();
    const placed = texturePlacement(
      patternPaint({ texture: 'hatch', scale: 2 }),
    );
    // A different scale is a different tile, still being made.
    expect(placed).toBeUndefined();
    const ready = texturePlacement(patternPaint({ texture: 'hatch' }));
    expect(ready).toMatchObject({ x: 0, y: 0, width: 16, height: 16 });
    expect(ready?.repeat).toBe(true);
    texturePlacement(patternPaint({ texture: 'hatch' }));
    expect(
      bitmaps.mock.calls.filter((call) => call[0] instanceof HTMLCanvasElement),
    ).toHaveLength(2);
  });
});

describe('printing a texture in a figure', () => {
  it('fills the figure alone, with the pattern laid in the window, and puts it back', () => {
    const pattern = fillTexturePattern(
      context,
      patternPaint({ texture: 'hatch' }),
    );
    expect(pattern).toBeDefined();
    const [made] = patterns;
    const placed = made.setTransform.mock.calls[0][0] as TestMatrix;
    // The figure drawn under a height slider: squashed to half its height.
    current = new TestMatrix([1, 0, 0, 0.5, 0, 20]);
    const figure = {} as Path2D;
    printTexture(
      context,
      figure,
      pattern as CanvasPattern,
      new DOMMatrix([1, 0, 0, 1, 0, 0]),
    );
    expect(fill).toHaveBeenCalledWith(figure);
    // For the fill, the pattern is mapped back through the squash, so in
    // the window it is the square tile it was.
    const during = made.setTransform.mock.calls[1][0] as TestMatrix;
    const onScreen = current.multiply(during);
    expect(onScreen.a).toBeCloseTo(placed.a);
    expect(onScreen.d).toBeCloseTo(placed.d);
    expect(onScreen.f).toBeCloseTo(placed.f);
    // And put back after it, for the next frame and the next figure.
    expect(made.setTransform.mock.calls[2][0]).toBe(placed);
  });

  it('prints nothing in a figure squashed flat', () => {
    const pattern = fillTexturePattern(
      context,
      patternPaint({ texture: 'hatch' }),
    );
    current = new TestMatrix([1, 0, 0, 0, 0, 0]);
    printTexture(
      context,
      {} as Path2D,
      pattern as CanvasPattern,
      new DOMMatrix([1, 0, 0, 1, 0, 0]),
    );
    expect(fill).not.toHaveBeenCalled();
  });
});

/** The canvas the page's `n`th pattern was made from, and where it lies. */
const madePattern = (index: number) => {
  const [canvas] = createPattern.mock.calls[index] as unknown as [
    HTMLCanvasElement,
  ];
  const place = patterns[index].setTransform.mock.calls[0][0] as TestMatrix;
  return { canvas, place };
};

describe('a pattern grown by the size slider', () => {
  it.each([
    [16, 1],
    [40, 1.5],
    [128, 2],
  ])(
    'prints a %i px tile at %f device pixels a pixel, the same on the page and the engine',
    async (size, scale) => {
      const grown = patternPaint({ texture: 'grid', size, scale });
      fillTexturePattern(context, grown);
      const { canvas, place } = madePattern(0);
      // Drawn at the device pixels it covers, never a small tile magnified.
      expect(canvas.width).toBe(Math.round(size * scale));
      const onPage = canvas.width * place.a;
      expect(onPage).toBeCloseTo(size, 0);
      expect(texturePlacement(grown)).toBeUndefined();
      await settle();
      const engine = texturePlacement(grown);
      expect(engine?.width).toBeCloseTo(onPage);
      expect(engine?.height).toBeCloseTo(onPage);
      expect(engine?.repeat).toBe(true);
      // From the same pixels: the engine's bitmap is the page's own tile.
      const [source] = bitmaps.mock.calls.find(
        (call) => call[0] instanceof HTMLCanvasElement,
      ) as [HTMLCanvasElement];
      expect(source).toBe(canvas);
    },
  );

  it('is a new tile on the page at once for a new size, and the same one for the same size', () => {
    fillTexturePattern(context, patternPaint({ texture: 'hatch' }));
    fillTexturePattern(context, patternPaint({ texture: 'hatch' }));
    expect(createPattern).toHaveBeenCalledTimes(1);
    expect(
      fillTexturePattern(context, patternPaint({ texture: 'hatch', size: 64 })),
    ).toBeDefined();
    expect(createPattern).toHaveBeenCalledTimes(2);
    expect(madePattern(1).canvas.width).toBe(64);
  });

  it('stands in on the engine with the size before while the new one is made', async () => {
    // The control: with no size made yet there is nothing to stand in.
    expect(texturePlacement(patternPaint({ texture: 'dots' }))).toBeUndefined();
    await settle();
    const first = texturePlacement(patternPaint({ texture: 'dots' }));
    expect(first?.bitmap).toBeDefined();
    const dragged = texturePlacement(
      patternPaint({ texture: 'dots', size: 48 }),
    );
    // The 16-pixel tile, stretched to where the 48-pixel one lies.
    expect(dragged?.key).toBe(first?.key);
    expect(dragged?.bitmap).toBe(first?.bitmap);
    expect(dragged?.width).toBe(48);
    await settle();
    const made = texturePlacement(patternPaint({ texture: 'dots', size: 48 }));
    expect(made?.key).not.toBe(first?.key);
    expect(made?.width).toBe(48);
    // Never another pattern's tile: the grain has none of its own yet.
    expect(
      texturePlacement(patternPaint({ texture: 'static', size: 48 })),
    ).toBeUndefined();
  });

  it('lets go of the size printed longest ago, past a few dozen', () => {
    const print = (size: number) =>
      fillTexturePattern(context, patternPaint({ texture: 'rules', size }));
    for (let size = 8; size < 56; size += 1) {
      print(size);
    }
    expect(createPattern).toHaveBeenCalledTimes(48);
    // The control: sizes printed a moment ago are still held.
    print(55);
    print(9);
    expect(createPattern).toHaveBeenCalledTimes(48);
    // One more lets the oldest go, and only that one is drawn again.
    print(56);
    print(8);
    expect(createPattern).toHaveBeenCalledTimes(50);
    print(9);
    expect(createPattern).toHaveBeenCalledTimes(50);
  });
});

describe('which size a look prints its texture at', () => {
  const area = { left: 0, top: 0, right: 400, bottom: 200 };
  const tuning = {
    texture: 'hatch',
    textureImage: undefined,
    textureFit: 'tile',
    textureSize: 320,
    patternSize: 24,
  } as const;

  it("prints a pattern at the pattern's size and a picture at the picture's", () => {
    expect(lookTexturePaint(tuning, 2, area)).toMatchObject({
      texture: 'hatch',
      size: 24,
      scale: 2,
      area,
    });
    expect(
      lookTexturePaint({ ...tuning, texture: 'image' }, 2, area).size,
    ).toBe(320);
  });
});
