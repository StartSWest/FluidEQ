/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useSyncExternalStore } from 'react';
import type { IScenePack } from 'common/scenePacks';
import {
  drawableSceneOf,
  getGraphLookId,
  peekGraphLookUnattended,
  subscribeGraphLook,
} from '../utils/graphStyle';
import {
  isGraphAutoCycleHeld,
  isGraphAutoCycleRunning,
  subscribeGraphAutoCycle,
} from '../utils/graphAutoCycle';
import { readLookRefusal, subscribeLookRefusal } from './lookRefusal';
import {
  loadDrawableScene,
  sceneIdentityOf,
  sceneMakerOfDrawable,
  sceneVersionOf,
} from './sceneIdentity';
import { sceneRulesFor } from './sceneRules';
import type {
  IPreparedScene,
  ISceneRendererHandlers,
} from './sceneRunnerTypes';
import {
  createSceneWorkerClient,
  type ISceneWorkerClient,
} from './sceneWorkerClient';
import type { TSceneBuildResult } from './sceneWorkerMessages';

/**
 * The next Plus scene, built before Auto puts it on (Ivan, 2026-11-24: "On
 * the auto, can we preload the next plus visualizer before showing it? So
 * the transition is smooth and the user doesn't have to wait on the loading
 * screen between them").
 *
 * Once the look on screen has drawn and nobody is choosing, the look Auto
 * will put on next (`peekGraphLookUnattended`, the very walk the step takes)
 * is built in a scene worker of its own, on a canvas nobody sees: the pack
 * loaded, its artwork decoded and uploaded, its program — or its 3D world —
 * compiled and linked. Nothing is drawn: the worker draws only what a page
 * frame asks of it, and no frame is sent until the scene is the one shown,
 * so the scene playing keeps every frame of the GPU it had. When the step
 * comes, the graph's canvas takes the worker as it stands (`useSceneRunner`'s
 * `adopt`), its first frame goes up on the next animation frame, faded in
 * over the picture it replaces, and the plot's loading ring never shows.
 *
 * At most one ahead. It is let go the moment it stops being next — a look
 * picked by hand, the list changing, Auto switched off — and when the graph's
 * scene host goes. Not started while the window is hidden, nor once this
 * session has set a scene aside as too heavy for the machine: a second
 * context compiling beside one the GPU already cannot keep up with is the
 * last thing that machine needs.
 *
 * FluidEQ's own scenes only — what its rules let be compiled while nobody
 * has looked at it yet (`sceneRules.ts`, `warmWhenUnseen`). A scene a member
 * made reaches the GPU's compiler when somebody looks at it, as it always
 * has, and is built when Auto puts it on.
 *
 * What one costs, measured on software GL (WARP, headless Chrome) with
 * eight shader scenes built this way at once: 11 to 15 MB of private memory
 * each, mostly the worker's own heap in the page's process and 3 to 5 MB in
 * the GPU process; one alone does not stand out of the 20 MB a run wanders.
 * A 3D world also holds its models and textures, which were not measured.
 * The switch itself, measured on the same harness: no frame of the loading
 * ring and none without a picture, the new picture over the old from the
 * second frame after the step and alone after its 250 ms fade, where the
 * same switch built the ordinary way showed the ring for 2.5 s.
 *
 * No timer anywhere. Every change it follows is an event — the selection,
 * the lists, a hold, Auto, a refusal, the window shown — and each is weighed
 * on the next animation frame, after the change has been committed: the
 * commit that puts the prepared look on is where the canvas takes it, and
 * weighing before it would let it go first.
 */

interface IPreparation {
  lookId: string;
  identity: string;
  version: string;
  /** Let go: anything still arriving for it is dropped. */
  cancelled: boolean;
  client?: ISceneWorkerClient;
  ready?: {
    pack: IScenePack;
    result: Extract<TSceneBuildResult, { kind: 'ready' }>;
  };
  /** The runner's, once one has taken it. */
  handlers?: ISceneRendererHandlers;
}

let preparation: IPreparation | undefined;
/** Taken by the canvas and not drawn yet: still shown without the ring. */
let adoptedIdentity: string | undefined;
/**
 * Versions whose preparation failed — a compile error, a lost context, no
 * worker — not tried ahead again this session. The step builds them the
 * ordinary way, which is where a failure is said and handled.
 */
const failed = new Set<string>();
let heavyMachine = false;
let active = false;
let pending: number | undefined;

const listeners = new Set<() => void>();
const tell = () => listeners.forEach((listener) => listener());

const keyOf = (lookId: string, version: string) => `${lookId}@${version}`;

const letGo = (target: IPreparation | undefined) => {
  if (!target || preparation !== target) {
    return;
  }
  preparation = undefined;
  target.cancelled = true;
  // A load still linking is retired, not ended (`sceneWorkerClient.ts`).
  target.client?.dispose();
  tell();
};

const failedAhead = (target: IPreparation) => {
  failed.add(keyOf(target.lookId, target.version));
  letGo(target);
};

const prepare = (lookId: string) => {
  const scene = drawableSceneOf(lookId);
  if (!scene) {
    return;
  }
  const version = sceneVersionOf(scene);
  const rules = sceneRulesFor(sceneMakerOfDrawable(scene));
  if (!rules.warmWhenUnseen || failed.has(keyOf(lookId, version))) {
    return;
  }
  const target: IPreparation = {
    lookId,
    identity: sceneIdentityOf(scene),
    version,
    cancelled: false,
  };
  preparation = target;
  loadDrawableScene(scene)
    .then((pack) => {
      if (target.cancelled) {
        return undefined;
      }
      if (!pack) {
        failedAhead(target);
        return undefined;
      }
      // A canvas in no page: nothing of it can be seen until the runner
      // moves it into its own host.
      const client = createSceneWorkerClient(
        document.createElement('div'),
        (reason, log) => {
          if (target.handlers) {
            target.handlers.failed(reason, log);
          } else {
            failedAhead(target);
          }
        },
        () => target.handlers?.recovered(),
      );
      if (!client) {
        failedAhead(target);
        return undefined;
      }
      target.client = client;
      return client.load(pack, rules.unwatched).then((result) => {
        if (target.cancelled) {
          return undefined;
        }
        if (result.kind !== 'ready') {
          failedAhead(target);
          return undefined;
        }
        target.ready = { pack, result };
        tell();
        return undefined;
      });
    })
    .catch(() => {
      if (!target.cancelled) {
        failedAhead(target);
      }
    });
};

/** Weighs what should be prepared now, after the change that asked it. */
const weigh = () => {
  // Prepared, then chosen, and not taken in the commit that chose it: the
  // graph is not drawing it (another player stands in for it, or nothing
  // shows the graph). Its program stays in the GPU process's cache, which
  // is what makes that other player's own build quick.
  if (preparation && preparation.lookId === getGraphLookId()) {
    letGo(preparation);
  }
  const next =
    active && isGraphAutoCycleRunning() && !heavyMachine
      ? peekGraphLookUnattended()
      : undefined;
  const scene = next === undefined ? undefined : drawableSceneOf(next);
  if (
    preparation &&
    (preparation.lookId !== next ||
      !scene ||
      preparation.version !== sceneVersionOf(scene))
  ) {
    letGo(preparation);
  }
  // Only while the look on screen has drawn and nobody is choosing, only in
  // a window somebody can see, and never the look already on - a walk with
  // nothing else it may put on comes back round to it.
  if (
    preparation ||
    next === undefined ||
    next === getGraphLookId() ||
    document.hidden ||
    isGraphAutoCycleHeld()
  ) {
    return;
  }
  prepare(next);
};

const weighSoon = () => {
  if (!active || pending !== undefined) {
    return;
  }
  pending = window.requestAnimationFrame(() => {
    pending = undefined;
    weigh();
  });
};

const followRefusals = () => {
  if (readLookRefusal()?.reason === 'heavy') {
    heavyMachine = true;
  }
  weighSoon();
};

/**
 * Starts preparing Auto's next scene for as long as the graph's scene host
 * is mounted (`GraphScene`); the function returned stops and lets go of
 * whatever is held.
 */
export const startScenePreload = (): (() => void) => {
  active = true;
  const stops = [
    subscribeGraphLook(weighSoon),
    subscribeGraphAutoCycle(weighSoon),
    subscribeLookRefusal(followRefusals),
  ];
  document.addEventListener('visibilitychange', weighSoon);
  followRefusals();
  return () => {
    active = false;
    if (pending !== undefined) {
      window.cancelAnimationFrame(pending);
      pending = undefined;
    }
    stops.forEach((stop) => stop());
    document.removeEventListener('visibilitychange', weighSoon);
    letGo(preparation);
  };
};

/** The graph's scene host prepares Auto's next scene while it is mounted. */
export const useScenePreload = () => {
  useEffect(() => startScenePreload(), []);
};

/**
 * The prepared scene, handed to the runner that is about to draw it, if it
 * is this scene at this version and fully built. One still building is let
 * go here: the runner's own build then waits on the same program's link and
 * finds it in the GPU process's cache.
 */
export const takePreparedScene = (
  identity: string,
  version: string,
): IPreparedScene | undefined => {
  const target = preparation;
  if (!target || target.identity !== identity) {
    return undefined;
  }
  const { client, ready } = target;
  if (!client || !ready || target.version !== version) {
    letGo(target);
    return undefined;
  }
  preparation = undefined;
  adoptedIdentity = identity;
  tell();
  return {
    client,
    pack: ready.pack,
    result: ready.result,
    bind: (handlers) => {
      target.handlers = handlers;
    },
  };
};

/** The scene taken has drawn, or was put away first: the ring is its own again. */
export const settlePreparedScene = (identity: string) => {
  if (adoptedIdentity === identity) {
    adoptedIdentity = undefined;
    tell();
  }
};

const preparedIdentity = (): string | undefined =>
  adoptedIdentity ?? (preparation?.ready ? preparation.identity : undefined);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The scene that can go on without the loading ring: built ahead and ready,
 * or taken and about to draw its first frame (`ScenePlot`).
 */
export const usePreparedSceneIdentity = () =>
  useSyncExternalStore(subscribe, preparedIdentity, () => undefined);

/** For tests: what is held, and a clean slate. */
export const preparedSceneForTests = () =>
  preparation
    ? {
        lookId: preparation.lookId,
        ready: preparation.ready !== undefined,
      }
    : undefined;

export const resetScenePreloadForTests = () => {
  letGo(preparation);
  adoptedIdentity = undefined;
  failed.clear();
  heavyMachine = false;
};
