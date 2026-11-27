/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A look's pattern on the white window (2026-11-27). The tile was drawn
 * white and printed in `overlay`, which can only lighten: on a pale fill it
 * vanished, and so did the swatches on the editor's Texture buttons. On a
 * light window it is now drawn black, the exact mirror of white on a dark
 * one, on the page, in the engine and on the buttons — and a dark window is
 * exactly as it was, which is each case's control here.
 *
 * What these cannot see is pixels: the engine's shader against the page's
 * painter was measured in a browser (both identical on the white window,
 * and both byte for byte what they were on a dark one).
 */

import { render, screen } from '@testing-library/react';
import { act } from 'react';
import en from 'common/i18n/en';
import { drawTile } from 'renderer/graph/fillTextureTiles';
import {
  fillTexturePattern,
  lookTexturePaint,
  patternInk,
  resetFillTextures,
  texturePreviewUrl,
} from 'renderer/graph/fillTextures';
import { writeLookTexture } from 'renderer/graph/engineLooks/lookTexture';
import { createLookTextureGl } from 'renderer/graph/engineLooks/lookTextureGl';
import type {
  IEngineLookInput,
  IEngineLookTexture,
} from 'renderer/graph/engineLooks/engineLookInput';
import { setLightWindow } from 'renderer/utils/windowSide';
import LookTextureRow from '../../../renderer/components/LookTextureRow';
import { I18nProvider } from '../../../renderer/utils/I18nContext';

jest.mock('../../../renderer/graph/textureUpload', () => ({
  TextureError: Error,
  tileFromFile: jest.fn(),
}));

/** A 2D context that takes every call and keeps every setting. */
const keeping = () =>
  new Proxy({} as Record<string | symbol, unknown>, {
    get: (target, key) => (key in target ? target[key] : () => undefined),
    set: (target, key, value) => {
      target[key] = value;
      return true;
    },
  });

/** The context each canvas was drawn on, to read the ink it was drawn in. */
const drawnOn = new WeakMap<HTMLCanvasElement, Record<string, unknown>>();
const inkOf = (canvas: HTMLCanvasElement) => drawnOn.get(canvas)?.fillStyle;

const settle = async () => {
  for (let turn = 0; turn < 6; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask turn at a time, in order, is the point
    await Promise.resolve();
  }
};

/** Where a pattern lies; nothing here reads it. */
class TestMatrix {
  values: number[];

  constructor(values: number[] = [1, 0, 0, 1, 0, 0]) {
    this.values = values;
  }
}

const createPattern = jest.fn((canvas: HTMLCanvasElement) => ({
  canvas,
  setTransform: jest.fn(),
}));
const page = { createPattern } as unknown as CanvasRenderingContext2D;

const area = { left: 0, top: 0, right: 400, bottom: 200 };
const tuning = {
  filled: true,
  texture: 'grid',
  textureImage: undefined,
  textureFit: 'tile',
  textureSize: 192,
  patternSize: 16,
} as const;

beforeAll(() => {
  Object.assign(globalThis, { DOMMatrix: TestMatrix });
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(function made(this: HTMLCanvasElement) {
      const context = keeping();
      drawnOn.set(this, context);
      return context as unknown as CanvasRenderingContext2D;
    });
  jest
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockImplementation(function made(this: HTMLCanvasElement) {
      return `data:tile;${String(inkOf(this))}`;
    });
  Object.assign(globalThis, {
    createImageBitmap: (source: HTMLCanvasElement) =>
      Promise.resolve({ width: source.width, height: source.height, source }),
  });
});

beforeEach(() => {
  resetFillTextures();
  createPattern.mockClear();
});

afterEach(() => {
  act(() => setLightWindow(false));
});

describe('the ink a pattern prints in', () => {
  it('is white on a dark window and black on a light one', () => {
    expect(patternInk()).toBe('white');
    expect(lookTexturePaint(tuning, 1, area).ink).toBe('white');
    setLightWindow(true);
    expect(patternInk()).toBe('black');
    expect(lookTexturePaint(tuning, 1, area).ink).toBe('black');
  });

  it.each(['hatch', 'dots', 'static'] as const)(
    'draws a %s tile in that ink, white when none is named',
    (texture) => {
      const white = keeping();
      drawTile(white as unknown as CanvasRenderingContext2D, texture, 16);
      expect(white.strokeStyle).toBe('#ffffff');
      expect(white.fillStyle).toBe('#ffffff');
      const black = keeping();
      drawTile(
        black as unknown as CanvasRenderingContext2D,
        texture,
        16,
        1,
        'black',
      );
      expect(black.strokeStyle).toBe('#000000');
      expect(black.fillStyle).toBe('#000000');
    },
  );
});

describe("the page's pattern", () => {
  const made = (index: number) =>
    createPattern.mock.calls[index][0] as HTMLCanvasElement;

  it('is drawn black on a light window, and white on a dark one as before', () => {
    fillTexturePattern(page, lookTexturePaint(tuning, 1, area));
    expect(inkOf(made(0))).toBe('#ffffff');
    setLightWindow(true);
    fillTexturePattern(page, lookTexturePaint(tuning, 1, area));
    expect(createPattern).toHaveBeenCalledTimes(2);
    expect(inkOf(made(1))).toBe('#000000');
    // Each ink's tile is kept: back on the dark window, nothing is redrawn.
    setLightWindow(false);
    fillTexturePattern(page, lookTexturePaint(tuning, 1, area));
    expect(createPattern).toHaveBeenCalledTimes(2);
  });
});

describe("the engine's pattern", () => {
  const input = (): IEngineLookInput => ({}) as IEngineLookInput;

  it('is told the ink, and keeps the one white tile whatever the side', async () => {
    const dark = input();
    writeLookTexture(dark, tuning, 1, area);
    await settle();
    writeLookTexture(dark, tuning, 1, area);
    expect(dark.texture?.ink).toBe('white');
    expect(dark.texture?.mode).toBe(1);
    setLightWindow(true);
    const light = input();
    writeLookTexture(light, tuning, 1, area);
    expect(light.texture?.ink).toBe('black');
    // The same pixels under the same key: a change of side sends no bitmap.
    expect(light.texture?.key).toBe(dark.texture?.key);
    expect(light.texture?.bitmap).toBe(dark.texture?.bitmap);
    expect(
      inkOf(
        (light.texture?.bitmap as unknown as { source: HTMLCanvasElement })
          .source,
      ),
    ).toBe('#ffffff');
  });

  it("carries the ink in the shader's fourth texturing value, 0 for white", () => {
    const uniform4f = jest.fn();
    const gl = {
      TEXTURE0: 0,
      TEXTURE_2D: 1,
      REPEAT: 2,
      CLAMP_TO_EDGE: 3,
      getUniformLocation: (_program: unknown, name: string) => name,
      activeTexture: jest.fn(),
      createTexture: jest.fn(() => ({})),
      bindTexture: jest.fn(),
      texImage2D: jest.fn(),
      texParameteri: jest.fn(),
      generateMipmap: jest.fn(),
      uniform1i: jest.fn(),
      uniform4f,
      deleteTexture: jest.fn(),
    } as unknown as WebGL2RenderingContext;
    const textureGl = createLookTextureGl(gl, {} as WebGLProgram);
    const texture = (ink: IEngineLookTexture['ink']): IEngineLookTexture => ({
      key: 'tile|grid',
      bitmap: {} as ImageBitmap,
      mode: 1,
      ink,
      strength: 0.32,
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      repeat: true,
    });
    const texturing = () => {
      const sent = uniform4f.mock.calls.filter(
        ([at]) => at === 'uLookTexturing',
      );
      return sent[sent.length - 1];
    };
    textureGl.upload(texture('white'));
    expect(texturing()).toEqual(['uLookTexturing', 1, 0.32, 1, 0]);
    textureGl.upload(texture('black'));
    expect(texturing()).toEqual(['uLookTexturing', 1, 0.32, 1, 1]);
    textureGl.upload(undefined);
    expect(texturing()).toEqual(['uLookTexturing', 0, 0, 0, 0]);
  });
});

describe("the editor's Texture buttons", () => {
  const swatch = (name: string) =>
    (
      screen
        .getByRole('button', { name })
        .querySelector('.look-designer__tile') as HTMLElement
    ).style.backgroundImage;

  it("show each pattern in the window's ink, and follow a change of side", () => {
    expect(texturePreviewUrl('hatch', 'white')).toBe('data:tile;#ffffff');
    expect(texturePreviewUrl('hatch', 'black')).toBe('data:tile;#000000');
    render(
      <I18nProvider>
        <LookTextureRow
          texture="grid"
          image={undefined}
          fit="tile"
          pictureSize={192}
          patternSize={16}
          moves={false}
          onChange={jest.fn()}
        />
      </I18nProvider>,
    );
    const hatch = en['look.texture.hatch'];
    expect(swatch(hatch)).toContain('#ffffff');
    act(() => setLightWindow(true));
    expect(swatch(hatch)).toContain('#000000');
    act(() => setLightWindow(false));
    expect(swatch(hatch)).toContain('#ffffff');
  });
});
