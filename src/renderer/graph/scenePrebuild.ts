/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { assembleFragmentSource } from 'common/sceneUniformContract';
import type { IScenePack } from 'common/scenePacks';
import { linkSceneProgram } from './sceneCompile';
import {
  getUsableMemberScenes,
  loadMemberScene,
  subscribeMemberScenes,
} from '../utils/memberScenes';

/**
 * Building a scene the moment it arrives, so nobody waits for it later.
 *
 * A shader has to be compiled on the machine that will run it: a compiled
 * program belongs to one graphics card and one driver version, there is no
 * portable form of it, and WebGL does not hand the binary to the page at all.
 * So it cannot be built at publish time and shipped — but it need not be
 * built while somebody waits to watch it either. Chromium keeps what the
 * driver compiled in a cache on disk, so the cost is paid once per machine
 * per version of a scene and every launch after that is instant.
 *
 * This pays it at the moment a scene is added or updated, in the background,
 * against a context of its own, and throws the program away: what is wanted
 * is the entry in the driver's cache, not the program. Measured on Alpine
 * before its call sites were fixed, that was eleven seconds a listener no
 * longer spends staring at a still picture the first time they play it.
 *
 * Rules it keeps, because it is running while somebody is listening:
 * - ONE at a time, never in parallel with another build.
 * - Only while the page is visible and idle-ish; it yields to the animation
 *   frame, so a scene that is playing keeps every frame it would have had.
 * - It remembers what it has built, per scene and version, so a relaunch
 *   rebuilds nothing. The memory is only an optimisation: the driver's own
 *   cache is the thing that makes the second build fast, and a forgotten
 *   entry costs one rebuild, not a wrong picture.
 * - It never reports a failure anywhere. A scene that cannot compile is a
 *   thing the listener finds out about when they play it, with the words and
 *   the fallback the runner already has; a warning about a scene nobody has
 *   opened would be noise.
 */

/** What has been built on this machine, by scene and version. */
const BUILT_KEY = 'fluideq.scene.prebuilt';

const readBuilt = (): Set<string> => {
  try {
    const raw = window.localStorage.getItem(BUILT_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter(isText) : []);
  } catch {
    // A blocked or full store only means it builds again next time.
    return new Set<string>();
  }
};

const isText = (value: unknown): value is string => typeof value === 'string';

const writeBuilt = (built: Set<string>) => {
  try {
    // Bounded: the newest two hundred, which is more scenes than anyone
    // keeps, so a long-lived machine cannot grow this without end.
    const list = [...built].slice(-200);
    window.localStorage.setItem(BUILT_KEY, JSON.stringify(list));
  } catch {
    // Nothing to do; the driver's cache still holds what was built.
  }
};

/** A scene and the exact version of it that was built. */
const keyOf = (packId: string, version: number, revision?: string) =>
  `${packId}@${version}${revision ? `#${revision}` : ''}`;

/**
 * Compile one pack against a context of its own and throw it away.
 *
 * A separate context, not the graph's: the graph's is drawing, and a link
 * left in flight on it can hold its next frame. Lost afterwards on purpose —
 * `loseContext` releases the driver's objects at once rather than when the
 * collector gets round to it.
 */
const buildOnce = async (pack: IScenePack, signal: AbortSignal) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    failIfMajorPerformanceCaveat: false,
    powerPreference: 'low-power',
    stencil: false,
  });
  if (!gl) {
    return;
  }
  try {
    const { source, sourceLineOffset } = assembleFragmentSource(pack);
    const built = await linkSceneProgram(gl, source, sourceLineOffset, signal);
    if (built.ok) {
      gl.deleteProgram(built.program);
    }
  } catch {
    // Every failure here is the listener's problem only when they play it.
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
};

/** Resolves on the next frame the page actually paints. */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

/**
 * Starts watching the member scenes this listener has, building each new one
 * once. Returns the stop function; safe to start more than once, as the queue
 * and the "already built" memory are shared.
 */
export const startScenePrebuild = (): (() => void) => {
  const built = readBuilt();
  const controller = new AbortController();
  let running = false;

  /** The next scene with no build behind it, or nothing left to do. */
  const nextWanted = () =>
    getUsableMemberScenes().find(
      (scene) => !built.has(keyOf(scene.packId, scene.version, scene.revision)),
    );

  const sweep = async (): Promise<void> => {
    if (running || controller.signal.aborted || document.hidden) {
      return;
    }
    running = true;
    try {
      let scene = nextWanted();
      while (scene && !controller.signal.aborted && !document.hidden) {
        // Marked before the attempt, not after: a scene that throws every
        // time must not be retried on every change of the list.
        built.add(keyOf(scene.packId, scene.version, scene.revision));
        writeBuilt(built);
        // eslint-disable-next-line no-await-in-loop -- one at a time is the
        // point: two builds at once take the frames a playing scene needs.
        await nextFrame();
        // eslint-disable-next-line no-await-in-loop -- as above.
        const pack = await loadMemberScene(scene.lookId);
        if (pack) {
          // eslint-disable-next-line no-await-in-loop -- as above.
          await buildOnce(pack, controller.signal);
        }
        scene = nextWanted();
      }
    } finally {
      running = false;
    }
  };

  const run = () => {
    sweep().catch(() => undefined);
  };
  const unsubscribe = subscribeMemberScenes(run);
  // Whatever is already installed, once the page is showing.
  document.addEventListener('visibilitychange', run);
  run();

  return () => {
    controller.abort();
    unsubscribe();
    document.removeEventListener('visibilitychange', run);
  };
};
