/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import compileWorld from './worldProgram';

/**
 * The 3D engine's own bundle (`scene-world.js`), loaded by a scene worker
 * the first time a pack with a world arrives (`sceneWorldLoader.ts`).
 *
 * Its own file because three.js is most of a megabyte, and a worker is made
 * fresh for every scene that mounts: parsed into every worker, it would be
 * paid on every visualizer, 3D or not, and on every desktop the wallpaper
 * runs on. Loaded on demand, a shader scene costs what it always cost.
 */
(globalThis as { fluidEqSceneWorld?: unknown }).fluidEqSceneWorld = {
  compileWorld,
};
