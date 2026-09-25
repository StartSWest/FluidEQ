/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Material, WebGLRenderer, WebGLRenderTarget } from 'three';

/**
 * What a world asks of three's renderer beyond drawing: a framebuffer it
 * did not make, the state of its programs' links, and the pictures it makes
 * for itself and never frees.
 */

interface IExternalTargets {
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
