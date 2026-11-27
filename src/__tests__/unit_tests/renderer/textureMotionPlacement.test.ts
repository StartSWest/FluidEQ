/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where a moving texture lies (`movedPlacement`): one rule for the page's
 * pattern and the engine's rectangle, so the two print it in the same place;
 * a picture over the whole plot never shows its edge; and a texture that
 * does not move prints exactly as it did before textures could.
 */

import { getDefaultTuning, type ILookTuning } from 'common/customLooks';
import type { IEngineLookInput } from 'renderer/graph/engineLooks/engineLookInput';
import { writeLookTexture } from 'renderer/graph/engineLooks/lookTexture';
import {
  PICTURE_ALPHA,
  TEXTURE_ALPHA,
  fillTexturePattern,
  lookTexturePaint,
  resetFillTextures,
  textureAlphaOf,
  texturePlacement,
} from 'renderer/graph/fillTextures';
import {
  COVER_SWAY,
  coverAreaOf,
  movedPlacement,
} from 'renderer/graph/movedTexture';
import { resetTexturePictures } from 'renderer/graph/texturePictures';
import type { ITexturePose } from 'renderer/graph/textureMotion';

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
}

const patterns: { setTransform: jest.Mock }[] = [];
const context = {
  createPattern: jest.fn(() => {
    const pattern = { setTransform: jest.fn() };
    patterns.push(pattern);
    return pattern;
  }),
} as unknown as CanvasRenderingContext2D;

/** Where the page's pattern was last laid: its matrix as numbers. */
const laid = () => {
  const { calls } = patterns[0].setTransform.mock;
  const matrix = calls[calls.length - 1][0] as TestMatrix;
  return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
};

const settle = async () => {
  for (let turn = 0; turn < 6; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask turn at a time, in order, is the point
    await Promise.resolve();
  }
};

const AREA = { left: 40, top: 10, right: 1040, bottom: 310 };
const dots: ILookTuning = {
  ...getDefaultTuning('analyzer'),
  filled: true,
  texture: 'dots',
  patternSize: 16,
};
const pose = (x: number, y: number, more: Partial<ITexturePose> = {}) => ({
  x,
  y,
  strength: 1,
  reach: 1,
  ...more,
});

beforeAll(() => {
  Object.assign(globalThis, { DOMMatrix: TestMatrix });
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
      const [source] = args as [{ width?: number; height?: number }];
      // A redraw answers the size asked; a picture decodes at 1280 by 720.
      const asked = args[5] as
        { resizeWidth: number; resizeHeight: number } | undefined;
      if (asked) {
        return Promise.resolve({
          width: asked.resizeWidth,
          height: asked.resizeHeight,
          close: () => undefined,
        });
      }
      return Promise.resolve(
        source instanceof Blob
          ? { width: 1280, height: 720, close: () => undefined }
          : { width: source.width, height: source.height },
      );
    },
  });
});

/** Every `createImageBitmap` call: a redraw has six arguments. */
const bitmaps = jest.fn();
const redraws = () => bitmaps.mock.calls.filter((call) => call.length > 1);

beforeEach(() => {
  resetFillTextures();
  resetTexturePictures();
  bitmaps.mockClear();
  patterns.length = 0;
});

describe('a texture that lies still', () => {
  it('lays its pattern exactly where it always lay, at any display ratio', () => {
    [1, 1.5, 2].forEach((scale) => {
      resetFillTextures();
      patterns.length = 0;
      fillTexturePattern(context, lookTexturePaint(dots, scale, AREA));
      expect(laid()).toEqual([1 / scale, 0, 0, 1 / scale, 0, 0]);
    });
  });

  it('hands the engine the rectangle and the strength it always did', async () => {
    const input = {} as IEngineLookInput;
    writeLookTexture(input, dots, 2, AREA);
    await settle();
    writeLookTexture(input, dots, 2, AREA);
    expect(input.texture).toMatchObject({
      mode: 1,
      strength: TEXTURE_ALPHA,
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      repeat: true,
    });
    // The control: the same look moved is somewhere else.
    writeLookTexture(input, dots, 2, AREA, pose(3, -2));
    expect(input.texture).toMatchObject({ x: 3, y: 14 });
  });

  it('prints at its kind’s own strength', () => {
    expect(textureAlphaOf({ texture: 'dots' })).toBe(TEXTURE_ALPHA);
    expect(textureAlphaOf({ texture: 'image' })).toBe(PICTURE_ALPHA);
    expect(
      textureAlphaOf({ texture: 'dots', pose: pose(0, 0, { strength: 1.3 }) }),
    ).toBeCloseTo(TEXTURE_ALPHA * 1.3);
  });
});

describe('a pattern that moves', () => {
  const tile = { x: 0, y: 0, width: 16, height: 16, repeat: true };

  it('is carried by the pose and put back by whole tiles', () => {
    expect(movedPlacement(tile, pose(37.5, -3), 0.5)).toEqual({
      ...tile,
      x: 5.5,
      y: 13,
    });
    // An hour's drift lands on the same place a tile's remainder would,
    // with numbers a float uniform still holds exactly.
    const far = movedPlacement(tile, pose(16 * 4000 + 5.5, -16 * 300 - 3), 0.5);
    expect(far.x).toBeCloseTo(5.5, 6);
    expect(far.y).toBeCloseTo(13, 6);
  });

  it('steps in whole device pixels, at any display ratio', () => {
    [1, 1.25, 1.5, 2].forEach((scale) => {
      for (let step = 0; step < 50; step += 1) {
        const at = movedPlacement(
          tile,
          pose(step * 0.37, step * 0.21),
          1 / scale,
        );
        expect(Math.abs(at.x * scale - Math.round(at.x * scale))).toBeLessThan(
          1e-9,
        );
        expect(Math.abs(at.y * scale - Math.round(at.y * scale))).toBeLessThan(
          1e-9,
        );
      }
    });
    // The control: the travel itself falls between device pixels.
    expect((0.37 * 2) % 1).toBeGreaterThan(0.1);
  });

  it('lies where the engine prints it, on the page', async () => {
    const moving = pose(23.25, -41.5, { strength: 1.2 });
    const input = {} as IEngineLookInput;
    writeLookTexture(input, dots, 2, AREA, moving);
    await settle();
    writeLookTexture(input, dots, 2, AREA, moving);
    fillTexturePattern(context, lookTexturePaint(dots, 2, AREA, moving));
    const [a, , , d, e, f] = laid();
    const tileSide = 32;
    expect(input.texture?.x).toBeCloseTo(e, 9);
    expect(input.texture?.y).toBeCloseTo(f, 9);
    expect(input.texture?.width).toBeCloseTo(a * tileSide, 9);
    expect(input.texture?.height).toBeCloseTo(d * tileSide, 9);
    expect(input.texture?.strength).toBeCloseTo(TEXTURE_ALPHA * 1.2, 9);
  });

  it('goes back to its still place for a drawing that does not move', () => {
    fillTexturePattern(context, lookTexturePaint(dots, 1, AREA, pose(5, 7)));
    expect(laid()).toEqual([1, 0, 0, 1, 5, 7]);
    // The same tile, printed for the editor's still preview in the same frame.
    fillTexturePattern(context, lookTexturePaint(dots, 1, AREA));
    expect(laid()).toEqual([1, 0, 0, 1, 0, 0]);
    expect(patterns).toHaveLength(1);
  });
});

describe('a picture over the whole plot that moves', () => {
  const plot = { x: 40, y: 10, width: 1000, height: 300 };
  const grownArea = coverAreaOf(AREA, pose(0, 0));
  const grown = {
    x: grownArea.left,
    y: grownArea.top,
    width: grownArea.right - grownArea.left,
    height: grownArea.bottom - grownArea.top,
    repeat: false,
  };
  const covers = (place: typeof plot) =>
    place.x <= plot.x + 1e-9 &&
    place.y <= plot.y + 1e-9 &&
    place.x + place.width >= plot.x + plot.width - 1e-9 &&
    place.y + place.height >= plot.y + plot.height - 1e-9;

  it('never shows an edge, wherever the travel has carried it', () => {
    [1, 1.5, 2].forEach((scale) => {
      for (let step = 0; step < 400; step += 1) {
        const travel = pose(step * 7.3, -step * 4.1, {
          reach: (step % 11) / 10,
        });
        expect(covers(movedPlacement(grown, travel, 1 / scale))).toBe(true);
      }
    });
    // The control: a picture moved a pixel without growing shows the
    // plot's floor at one side, and the check above sees it.
    expect(covers({ ...plot, x: plot.x + 1 })).toBe(false);
  });

  it('never shows an edge on a plot whose edges fall between device pixels', () => {
    // A window at 150 % with a plot laid at fractions of a pixel: rounding
    // the sway to whole device pixels must not open a sliver at an edge.
    const offGrid = { left: 40.3, top: 10.7, right: 1040.9, bottom: 310.2 };
    const area = coverAreaOf(offGrid, pose(0, 0));
    const copy = {
      x: area.left,
      y: area.top,
      width: area.right - area.left,
      height: area.bottom - area.top,
      repeat: false,
    };
    const inside = (place: typeof plot) =>
      place.x <= offGrid.left + 1e-9 &&
      place.y <= offGrid.top + 1e-9 &&
      place.x + place.width >= offGrid.right - 1e-9 &&
      place.y + place.height >= offGrid.bottom - 1e-9;
    for (let step = 0; step < 400; step += 1) {
      const travel = pose(step * 3.7, step * -2.9, { reach: (step % 6) / 5 });
      expect(inside(movedPlacement(copy, travel, 1 / 1.5))).toBe(true);
    }
  });

  it('covers the plot exactly until the motion has eased in', () => {
    const atRest = movedPlacement(grown, pose(123, -45, { reach: 0 }), 0.5);
    expect(atRest.x).toBeCloseTo(plot.x, 9);
    expect(atRest.y).toBeCloseTo(plot.y, 9);
    expect(atRest.width).toBeCloseTo(plot.width, 9);
    expect(atRest.height).toBeCloseTo(plot.height, 9);
  });

  it('sways no further than the margin it was grown into', () => {
    let widest = 0;
    for (let step = 0; step < 400; step += 1) {
      const place = movedPlacement(grown, pose(step * 3.1, step * 1.7), 0.5);
      widest = Math.max(widest, plot.x - place.x);
    }
    expect(widest).toBeLessThanOrEqual(1000 * 2 * COVER_SWAY + 0.5);
    expect(widest).toBeGreaterThan(1000 * 2 * COVER_SWAY * 0.9);
  });

  it('is redrawn once at its grown size and printed one to one, never resampled', async () => {
    const photo = 'data:image/png;base64,0001AAAA';
    const paintAt = (moving?: ReturnType<typeof pose>) =>
      lookTexturePaint(
        { ...dots, texture: 'image', textureImage: photo, textureFit: 'cover' },
        2,
        AREA,
        moving,
      );
    // Decoded, then redrawn at the size it lies at.
    for (let round = 0; round < 3; round += 1) {
      texturePlacement(paintAt(pose(0, 0)));
      // eslint-disable-next-line no-await-in-loop -- each round waits for the last one's decode or redraw
      await settle();
    }
    for (let frame = 0; frame < 30; frame += 1) {
      const placed = texturePlacement(paintAt(pose(frame * 2.3, frame * -1.1)));
      expect(placed?.bitmap.width).toBe(
        Math.round(1000 * (1 + 2 * COVER_SWAY) * 2),
      );
      expect((placed?.width ?? 0) * 2).toBeCloseTo(
        placed?.bitmap.width ?? 0,
        6,
      );
    }
    expect(redraws()).toHaveLength(1);
    // The control: lying still, it is redrawn for the plot itself.
    texturePlacement(paintAt());
    await settle();
    expect(texturePlacement(paintAt())?.bitmap.width).toBe(2000);
  });
});
