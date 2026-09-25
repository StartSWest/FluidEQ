/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from 'common/scenePacks';
import { releaseWhenLinked } from './sceneCompile';
import type { TSceneCompileResult } from './sceneGl';
import type compileWorld from './world/worldProgram';

/**
 * The 3D engine, fetched into this worker the first time a world needs it.
 *
 * `importScripts` is synchronous and runs once per worker: the engine's
 * bundle (`world/worldEngine.ts`) sets one global, which is read and kept.
 * Anywhere without `importScripts` — the page's own thread, a test — has no
 * engine, and a world there is drawn as its shader, the same answer an older
 * FluidEQ gives.
 */

type TCompileWorld = typeof compileWorld;

interface IWorkerScope {
  importScripts?: (...urls: string[]) => void;
  location?: { href: string };
  fluidEqSceneWorld?: unknown;
}

let engine: TCompileWorld | null | undefined;
/** Why the engine could not be had, for the scene's author. */
let unavailable = 'the 3D engine is not available here';

const engineUrl = (base: string) =>
  new URL(
    process.env.NODE_ENV === 'production'
      ? './scene-world.js'
      : './scene-world.dev.js',
    base,
  ).href;

const loadWorldEngine = (): TCompileWorld | null => {
  if (engine !== undefined) {
    return engine;
  }
  const scope = globalThis as IWorkerScope;
  if (typeof scope.importScripts !== 'function' || !scope.location) {
    engine = null;
    return engine;
  }
  try {
    scope.importScripts(engineUrl(scope.location.href));
  } catch (error) {
    unavailable = `the 3D engine could not be loaded: ${String(error)}`;
    engine = null;
    return engine;
  }
  const loaded = scope.fluidEqSceneWorld;
  const candidate =
    typeof loaded === 'object' && loaded !== null
      ? (loaded as { compileWorld?: unknown }).compileWorld
      : undefined;
  // The bundle is ours and built from `worldProgram.ts` in the same build;
  // the global is the one seam where its type cannot follow it across.
  engine =
    typeof candidate === 'function' ? (candidate as TCompileWorld) : null;
  return engine;
};

/**
 * `pack`'s world as a scene program, or why not. An abandoned load is
 * rethrown as the worker expects it; anything else becomes a reason the
 * caller falls back to the shader with.
 */
const compileWorldScene = async (
  gl: WebGL2RenderingContext,
  pack: IScenePack,
  artwork: ImageBitmap | undefined,
  signal: AbortSignal | undefined,
  hurry: AbortSignal | undefined,
): Promise<TSceneCompileResult> => {
  const compile = loadWorldEngine();
  if (!compile) {
    return { ok: false, log: unavailable };
  }
  try {
    // The world's bundle has its own copy of any module it imports, so the
    // worker's one list of links in flight is handed to it, not imported.
    return await compile(gl, pack, artwork, signal, hurry, (linked, release) =>
      releaseWhenLinked(gl, linked, release),
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    return { ok: false, log: String(error) };
  }
};

export default compileWorldScene;
