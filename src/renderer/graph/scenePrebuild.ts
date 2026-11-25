/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from 'common/scenePacks';
import { warmSceneProgram } from './sceneWorkerClient';
import {
  getUsableMemberScenes,
  loadMemberScene,
  subscribeMemberScenes,
} from '../utils/memberScenes';
import {
  getUsableScenes,
  loadScenePack,
  subscribeScenePacks,
} from '../utils/scenePacks';

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
 * FluidEQ's own scenes as well as the members' the listener has added. They
 * were left to compile on the first pick, and the compile is nearly the
 * whole of a slow scene's load: on software GL, Alpine's link was 12 s and
 * Hanami's 8 s of a pick that took 12.3 s and 8.3 s (harness, 2026-11-25),
 * paid again for every new version of either. Theirs come first, being the
 * ones every listener has. What makes the build last past a restart is the
 * GPU process's room for programs (`SCENE_PROGRAM_CACHE_KB` in main), which
 * at Chromium's 6 MB held a handful of scenes.
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
 * Compile one pack in a scene worker of its own, on a canvas nobody sees, and
 * let the worker go (`warmSceneProgram`).
 *
 * The scene worker builds exactly what the graph will draw — a world's three
 * programs as well as its sky, a shader with the graph's own context — and it
 * takes the program's turn (`sceneLinkTurns.ts`). A shader used to be linked
 * here on a page canvas of its own, outside the turns: once FluidEQ's scenes
 * joined the list, the look the graph opens on at launch was one of them, and
 * the two links of the same program then ran side by side, each from nothing,
 * which is the doubled compile the turns exist to prevent.
 */
const buildOnce = async (pack: IScenePack, signal: AbortSignal) => {
  // The warm-up takes no signal, so a stop that came while the pack was
  // loading is honoured here, before a worker is started for it.
  if (!signal.aborted) {
    await warmSceneProgram(pack, false);
  }
};

/** Resolves on the next frame the page actually paints. */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

/** A scene to build: what the memory knows it by, and how to load it. */
interface IWantedScene {
  key: string;
  load: () => Promise<IScenePack | undefined>;
}

/**
 * Every scene this listener can play, FluidEQ's own first. Theirs are kept
 * apart in the memory by a prefix: a member's scene may share an id with one
 * of FluidEQ's, and a member's key is what it was before theirs joined.
 */
const playableScenes = (): IWantedScene[] => [
  ...getUsableScenes().map((scene) => ({
    key: keyOf(`official/${scene.id}`, scene.version, scene.revision),
    load: () => loadScenePack(scene.id),
  })),
  ...getUsableMemberScenes().map((scene) => ({
    key: keyOf(scene.packId, scene.version, scene.revision),
    load: () => loadMemberScene(scene.lookId),
  })),
];

/**
 * Starts watching the scenes this listener has — FluidEQ's own and the
 * members' — building each new one, and each new version, once. Returns the
 * stop function; safe to start more than once, as the queue and the
 * "already built" memory are shared.
 */
export const startScenePrebuild = (): (() => void) => {
  const built = readBuilt();
  const controller = new AbortController();
  let running = false;

  /** The next scene with no build behind it, or nothing left to do. */
  const nextWanted = () =>
    playableScenes().find((scene) => !built.has(scene.key));

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
        built.add(scene.key);
        writeBuilt(built);
        // eslint-disable-next-line no-await-in-loop -- one at a time is the
        // point: two builds at once take the frames a playing scene needs.
        await nextFrame();
        // eslint-disable-next-line no-await-in-loop -- as above.
        const pack = await scene.load();
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
  const unsubscribeOwn = subscribeScenePacks(run);
  const unsubscribeMembers = subscribeMemberScenes(run);
  // Whatever is already installed, once the page is showing.
  document.addEventListener('visibilitychange', run);
  run();

  return () => {
    controller.abort();
    unsubscribeOwn();
    unsubscribeMembers();
    document.removeEventListener('visibilitychange', run);
  };
};
