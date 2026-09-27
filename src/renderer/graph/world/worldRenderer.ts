/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  BufferGeometry,
  Material,
  Mesh,
  Object3D,
  Texture,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

/**
 * What a world asks of three's renderer beyond drawing: a framebuffer it
 * did not make, the state of its programs' links, and the pictures it makes
 * for itself and never frees.
 */

export interface IExternalTargets {
  point(target: WebGLRenderTarget, framebuffer: WebGLFramebuffer | null): void;
}

/**
 * three.js's way of rendering into a framebuffer it did not make — how its
 * own XR support draws into the headset's. Pinned with the version of three
 * this is built against; a build without it cannot composite, and the scene
 * falls back to its shader.
 */
export const externalTargets = (
  renderer: WebGLRenderer,
): IExternalTargets | null => {
  const method: unknown = Reflect.get(renderer, 'setRenderTargetFramebuffer');
  if (typeof method !== 'function') {
    return null;
  }
  return {
    point: (target, framebuffer) => {
      method.call(renderer, target, framebuffer);
    },
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Whether three has finished linking `material`'s program. */
export const programReady = (renderer: WebGLRenderer, material: Material) => {
  const entry = renderer.properties.get(material);
  const program = isRecord(entry) ? entry.currentProgram : undefined;
  const isReady = isRecord(program) ? program.isReady : undefined;
  return typeof isReady !== 'function' || Boolean(isReady.call(program));
};

/**
 * Resolves once every program is linked, checked on animation frames like
 * the shader-only path's link (`sceneCompile.ts`): the driver compiles on its
 * own threads and this thread is never held waiting for it. `hurry` is that
 * link's too: fired, no frame is coming to check on, and the first draw
 * reads the links to their end.
 */
export const waitForPrograms = (
  renderer: WebGLRenderer,
  materials: Material[],
  signal: AbortSignal | undefined,
  hurry: AbortSignal | undefined,
) =>
  new Promise<void>((resolve) => {
    let animation: number | undefined;
    const done = () => {
      if (animation !== undefined) {
        cancelAnimationFrame(animation);
      }
      signal?.removeEventListener('abort', done);
      hurry?.removeEventListener('abort', done);
      resolve();
    };
    const check = () => {
      if (
        signal?.aborted ||
        hurry?.aborted ||
        materials.every((material) => programReady(renderer, material))
      ) {
        done();
      } else {
        animation = requestAnimationFrame(check);
      }
    };
    signal?.addEventListener('abort', done, { once: true });
    hurry?.addEventListener('abort', done, { once: true });
    check();
  });

/**
 * Every picture the renderer is asked to draw into, kept so `free` can let
 * go of the ones nothing else frees. Three makes one of its own for glass
 * (a material with transmission): per camera, the size of the frame, four
 * times multisampled, in half floats, with mipmaps — and never disposes it,
 * not even with the renderer. A world with glass left one behind on every
 * Studio save and every change of scene, on a context that lives as long as
 * the worker. A target disposed here is made again by three the next time
 * it is drawn into, at the size it kept.
 */
export const trackDrawnTargets = (renderer: WebGLRenderer) => {
  const drawnInto = new Set<WebGLRenderTarget>();
  const setRenderTarget = renderer.setRenderTarget.bind(renderer);
  Object.assign(renderer, {
    setRenderTarget: (
      target: WebGLRenderTarget | null,
      activeCubeFace?: number,
      activeMipmapLevel?: number,
    ) => {
      if (target) {
        drawnInto.add(target);
      }
      setRenderTarget(target, activeCubeFace, activeMipmapLevel);
    },
  });
  return {
    /**
     * Disposes every target drawn into but those in `keep`: the worker's
     * own, and any drawn once whose picture is still wanted (the lighting
     * a studio environment is made of).
     */
    free: (keep: readonly WebGLRenderTarget[]) => {
      drawnInto.forEach((target) => {
        if (!keep.includes(target)) {
          target.dispose();
        }
      });
    },
  };
};

/**
 * Frees what three put on the GPU for everything under `roots`: the models,
 * whose geometries, materials and textures come out of the glTF loader with
 * no owner. A renderer's own `dispose` forgets its maps and deletes nothing,
 * and the worker's context outlives every world, so each Studio save of a
 * scene with a model left its buffers, its textures — a decoded bitmap each —
 * and its programs on the GPU for as long as the worker lived.
 */
export const releaseModelResources = (roots: readonly Object3D[]): void => {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  roots.forEach((root) =>
    root.traverse((object) => {
      const { geometry, material } = object as Partial<Mesh>;
      if (geometry) {
        geometries.add(geometry);
      }
      (Array.isArray(material) ? material : [material]).forEach((each) => {
        if (each) {
          materials.add(each);
        }
      });
    }),
  );
  // Recognised by three's own mark rather than its class, so this module
  // loads without the engine and is tested without a GPU.
  const isTexture = (value: unknown): value is Texture =>
    isRecord(value) && value.isTexture === true;
  const textures = new Set<Texture>();
  materials.forEach((material) =>
    Object.values(material).forEach((value: unknown) => {
      if (isTexture(value)) {
        textures.add(value);
      }
    }),
  );
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => {
    texture.dispose();
    const { image } = texture;
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) {
      image.close();
    }
  });
};

/**
 * Deletes every program the renderer still holds, once everything that used
 * them is disposed. Three's shadow maps draw with depth materials of their
 * own that nothing outside can reach, and every renderer a world made left
 * their programs linked on the worker's context.
 */
export const deletePrograms = (renderer: WebGLRenderer): void => {
  const { programs } = renderer.info;
  if (!Array.isArray(programs)) {
    return;
  }
  [...programs].forEach((program: unknown) => {
    const destroy = isRecord(program) ? program.destroy : undefined;
    if (typeof destroy === 'function') {
      destroy.call(program);
    }
  });
};
