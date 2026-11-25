/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  Texture,
  type Camera,
  type Material,
  type Mesh,
  type Object3D,
  type Scene,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import type { ISceneFrame } from '../sceneGl';
import type { IWorldPass } from './worldPasses';

/**
 * What a world does before its first frame (`worldProgram.ts`): every program
 * it will use handed to the driver at once, then one trial frame that shows
 * whether each linked and puts every texture on the GPU.
 */

/** The trial frame's sound: none at all, at the start of the scene's clock. */
export const silentTrialFrame = (): ISceneFrame => ({
  timeSeconds: 0,
  deltaMs: 0,
  level: 0,
  beat: 0,
  bands: [0, 0, 0],
  musicAccent: [0, 0],
  musicRun: [0, 0],
  accent: [1, 1, 1],
  fade: 1,
  spectrum: new Uint8Array(0),
  waveform: new Uint8Array(0),
  params: {},
});

/**
 * Starts the link of every program the world draws with and answers their
 * materials, for the caller to wait on: the world's own, drawn into `drawn`;
 * then each pass material, the final mix among them, drawn into `shown`.
 *
 * All at once, on the driver's threads. A program left to the first frame is
 * linked on first use, with this thread held until the driver is done, one
 * after another — the glow's two passes were, under Dunes (harness,
 * 2026-11-25, software GL: the trial frame 292 ms cold, 136 ms with every
 * program already linked). `passes` ends on the material the pass is to be
 * left with.
 */
export const compileWorldPrograms = (
  renderer: WebGLRenderer,
  world: { scene: Scene; camera: Camera; drawn: WebGLRenderTarget },
  pass: IWorldPass,
  passes: readonly Material[],
  shown: { target: WebGLRenderTarget; point: () => void },
): Set<Material> => {
  const materials = new Set<Material>();
  renderer.setRenderTarget(world.drawn);
  renderer
    .compile(world.scene, world.camera)
    .forEach((material) => materials.add(material));
  shown.point();
  renderer.setRenderTarget(shown.target);
  passes.forEach((material) => {
    pass.use(material);
    renderer
      .compile(pass.scene, pass.camera)
      .forEach((compiled) => materials.add(compiled));
  });
  return materials;
};

/**
 * Runs `draw` with every object in `scene` shown and every texture it and
 * `extra` hold already on the GPU, then puts each object's visibility back.
 *
 * Every object, whatever its formulas and the camera say at 0 s: one first
 * drawn later linked later, and failed where no note is read, and its
 * textures were uploaded later — from the scene's picture, which the worker
 * closes the moment the build returns, so they came up black.
 */
export const drawWithEverythingShown = (
  renderer: WebGLRenderer,
  scene: Scene,
  extra: readonly (Texture | null)[],
  draw: () => void,
): void => {
  const shownBefore = new Map<Object3D, [boolean, boolean]>();
  scene.traverse((object) => {
    shownBefore.set(object, [object.visible, object.frustumCulled]);
    Object.assign(object, { visible: true, frustumCulled: false });
  });
  scene.traverse((object) => {
    const { material } = object as Partial<Mesh>;
    (Array.isArray(material) ? material : [material]).forEach((each) =>
      Object.values(each ?? {}).forEach((value: unknown) => {
        if (value instanceof Texture) {
          renderer.initTexture(value);
        }
      }),
    );
  });
  extra.forEach((texture) => {
    if (texture) {
      renderer.initTexture(texture);
    }
  });
  draw();
  shownBefore.forEach(([visible, frustumCulled], object) => {
    Object.assign(object, { visible, frustumCulled });
  });
};
