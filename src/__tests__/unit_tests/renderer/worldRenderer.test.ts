/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Object3D, WebGLRenderer } from 'three';
import {
  deletePrograms,
  releaseModelResources,
} from '../../../renderer/graph/world/worldRenderer';

/**
 * What a world's models leave on the GPU is freed when the world goes: every
 * buffer, material and texture once, however many meshes shared it, and
 * every program the renderer linked. The worker's context outlives every
 * world, so anything missed here stayed for as long as the worker lived —
 * one more set on every Studio save.
 */

const disposable = <T extends Record<string, unknown>>(fields: T) => ({
  dispose: jest.fn(),
  ...fields,
});

const texture = (image: unknown = {}) => disposable({ isTexture: true, image });

/** A root whose tree is `objects`, walked the way three's `traverse` walks. */
const root = (...objects: Record<string, unknown>[]): Object3D => {
  const self = {
    traverse: (visit: (object: unknown) => void) => {
      visit(self);
      objects.forEach(visit);
    },
  };
  return self as unknown as Object3D;
};

/** Swaps the page's ImageBitmap for `value` while `run` runs. */
const withImageBitmap = (value: unknown, run: () => void) => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'ImageBitmap');
  Object.defineProperty(globalThis, 'ImageBitmap', {
    value,
    configurable: true,
    writable: true,
  });
  try {
    run();
  } finally {
    if (had) {
      Object.defineProperty(globalThis, 'ImageBitmap', had);
    } else {
      Reflect.deleteProperty(globalThis, 'ImageBitmap');
    }
  }
};

describe("a world's models, released", () => {
  it('disposes every geometry, material and texture once, however many meshes and roots share it', () => {
    const skin = texture();
    const bump = texture();
    const hull = disposable({});
    const paint = disposable({
      map: skin,
      normalMap: bump,
      colour: { isColor: true },
    });
    const glow = disposable({ emissiveMap: skin, alphaMap: null });
    // Marked, but not with three's own mark: not a texture.
    const lookalike = disposable({ isTexture: 'yes' });
    const odd = disposable({ note: lookalike });
    releaseModelResources([
      root({ geometry: hull, material: paint }, { name: 'group' }),
      root(
        { geometry: hull, material: [paint, glow] },
        { geometry: hull, material: odd },
      ),
    ]);
    [hull, paint, glow, odd, skin, bump].forEach((each) =>
      expect(each.dispose).toHaveBeenCalledTimes(1),
    );
    expect(lookalike.dispose).not.toHaveBeenCalled();
  });

  it('closes a texture’s decoded bitmap once, and nothing that is not one', () => {
    class Bitmap {
      close = jest.fn();
    }
    withImageBitmap(Bitmap, () => {
      const decoded = new Bitmap();
      const notABitmap = { close: jest.fn() };
      const shared = texture(decoded);
      const plain = texture(notABitmap);
      releaseModelResources([
        root(
          { geometry: disposable({}), material: disposable({ map: shared }) },
          { material: disposable({ emissiveMap: shared, aoMap: plain }) },
        ),
      ]);
      expect(decoded.close).toHaveBeenCalledTimes(1);
      expect(notABitmap.close).not.toHaveBeenCalled();
      expect(shared.dispose).toHaveBeenCalledTimes(1);
      expect(plain.dispose).toHaveBeenCalledTimes(1);
    });
  });

  it('disposes every texture on a page with no ImageBitmap, and throws nothing', () => {
    withImageBitmap(undefined, () => {
      const image = { close: jest.fn() };
      const skin = texture(image);
      expect(() =>
        releaseModelResources([root({ material: disposable({ map: skin }) })]),
      ).not.toThrow();
      expect(skin.dispose).toHaveBeenCalledTimes(1);
      expect(image.close).not.toHaveBeenCalled();
    });
  });
});

describe("a world's programs, deleted", () => {
  const renderer = (programs: unknown) =>
    ({ info: { programs } }) as unknown as WebGLRenderer;

  it('destroys every program the renderer holds, whatever the list does while they go', () => {
    const programs: { destroy: jest.Mock }[] = [];
    const program = () => {
      const made = {
        // Taken off the renderer's list as it goes, as a released one is.
        destroy: jest.fn(() => {
          programs.splice(programs.indexOf(made), 1);
        }),
      };
      return made;
    };
    programs.push(program(), program(), program());
    const all = [...programs];
    deletePrograms(renderer(programs));
    all.forEach((each) => expect(each.destroy).toHaveBeenCalledTimes(1));
  });

  it('passes over what is not a program, and a renderer with no list', () => {
    const real = { destroy: jest.fn() };
    deletePrograms(renderer([null, {}, { destroy: 'no' }, real]));
    expect(real.destroy).toHaveBeenCalledTimes(1);
    expect(() => deletePrograms(renderer(undefined))).not.toThrow();
  });
});
