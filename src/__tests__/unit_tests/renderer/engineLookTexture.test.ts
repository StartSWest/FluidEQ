/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A texture no longer takes a look off the engine: the measuring views and
 * the scenes print it in their shaders, from pixels that travel to the
 * engine's worker once per change. A look wearing one used to be drawn
 * whole on the page's canvas, which is what made a pattern or a picture
 * cost several times a plain look.
 */

import { isEngineLookStyle } from 'renderer/graph/engineLooks/engineLooks';
import { createTextureOnce } from 'renderer/graph/engineLooks/textureOnce';
import type { ISceneFrame } from 'renderer/graph/sceneGl';

const plain = {
  filled: true,
  texture: 'none',
  accents: false,
  accentBehind: false,
  border: false,
} as const;

describe('which looks the engine draws with a texture', () => {
  it('draws a measuring view and a scene with a pattern or a picture', () => {
    expect(isEngineLookStyle('notes', { ...plain, texture: 'hatch' })).toBe(
      true,
    );
    expect(isEngineLookStyle('analyzer', { ...plain, texture: 'image' })).toBe(
      true,
    );
    expect(isEngineLookStyle('ledbars', { ...plain, texture: 'dots' })).toBe(
      true,
    );
  });

  it('leaves a designed look with a texture on the page', () => {
    // The control: the same designed look plain is the engine's.
    expect(isEngineLookStyle('skyline', plain)).toBe(true);
    expect(isEngineLookStyle('skyline', { ...plain, texture: 'hatch' })).toBe(
      false,
    );
  });
});

describe('a texture travels to the worker once per key', () => {
  const pixels = { width: 4, height: 4 } as ImageBitmap;
  const frameWith = (key: string): ISceneFrame =>
    ({
      look: {
        style: 'notes',
        texture: {
          key,
          bitmap: pixels,
          mode: 2,
          strength: 0.5,
          x: 0,
          y: 0,
          width: 4,
          height: 4,
          repeat: true,
        },
      },
    }) as unknown as ISceneFrame;

  it('sends the pixels with the first frame of a key and the key alone after', () => {
    const once = createTextureOnce();
    const first = frameWith('pic1|tile');
    expect(once(first).look?.texture?.bitmap).toBe(pixels);
    const second = frameWith('pic1|tile');
    const sent = once(second);
    expect(sent.look?.texture?.bitmap).toBeUndefined();
    expect(sent.look?.texture?.key).toBe('pic1|tile');
    // The page's own frame keeps its pixels for the next key.
    expect(second.look?.texture?.bitmap).toBe(pixels);
    // The control: a new key carries its pixels again.
    expect(once(frameWith('pic1|cover')).look?.texture?.bitmap).toBe(pixels);
  });

  it('starts with nothing sent for a new worker', () => {
    createTextureOnce()(frameWith('pic1|tile'));
    expect(
      createTextureOnce()(frameWith('pic1|tile')).look?.texture?.bitmap,
    ).toBe(pixels);
  });
});
