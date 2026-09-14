/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from 'common/scenePacks';
import { afterLinkTurns, sceneProgramKey } from '../graph/sceneLinkTurns';
import type {
  ILightingSceneFrame,
  TLightingWorkerReply,
  TLightingWorkerRequest,
} from './lightingSceneMessages';

type TGridReply = Extract<TLightingWorkerReply, { kind: 'grid' }>;

/** Why a worker gave a scene up that means the GPU itself refused it. */
const GPU_REFUSALS = new Set(['gpu-reset', 'too-heavy']);

/**
 * Scenes the GPU refused for the lamps this session, by program. A new player
 * is made whenever the lamps start again — a scene chosen, the switch turned
 * on — and each would have tried the same scene and held the GPU again.
 */
const refusedScenes = new Set<string>();

export interface ILightingScene {
  /** `guarded` for a scene nobody watched before it was shared: a member's. */
  load(pack: IScenePack, guarded: boolean): void;
  /**
   * Draw one frame for the lamps. A frame that arrives while the last is
   * still being drawn is dropped, not queued: the next tick is newer, and a
   * queue behind a slow GPU would light the desk a second late.
   */
  draw(frame: ILightingSceneFrame): void;
  close(): void;
}

/** The lighting scene worker, from the window. */
export const createLightingScene = (
  onGrid: (grid: TGridReply) => void,
  onFailed: (packId: string) => void,
  /** The scene is drawn again after `onFailed` for a lost context. */
  onRecovered: () => void = () => undefined,
): ILightingScene => {
  const worker = new Worker(
    new URL(
      process.env.NODE_ENV === 'production'
        ? './lighting-scene.js'
        : '/lighting-scene.dev.js',
      window.location.href,
    ),
  );
  let drawing = false;
  let ready = false;
  let closed = false;
  /** A load was sent and has not been answered: it may be linking. */
  let linking = false;
  /** A lost context's scene is being loaded again. */
  let recovering = false;
  /** The newest load asked for; an older one still waiting is not sent. */
  let wanted = 0;
  /** The program of the scene last sent, for a refusal to be kept by. */
  let sentKey: string | undefined;
  const post = (request: TLightingWorkerRequest) => worker.postMessage(request);

  worker.onmessage = ({ data }: MessageEvent<TLightingWorkerReply>) => {
    if (data.kind === 'retired') {
      worker.terminate();
      return;
    }
    if (closed) {
      return;
    }
    if (data.kind === 'grid') {
      drawing = false;
      onGrid(data);
    } else if (data.kind === 'loaded') {
      linking = false;
      ready = true;
      if (recovering) {
        recovering = false;
        onRecovered();
      }
    } else if (data.kind === 'lost') {
      // Not the scene's doing: the worker loads it again when the context
      // comes back, and until then the lamps take its colours.
      ready = false;
      drawing = false;
      linking = true;
      recovering = true;
      onFailed(data.packId);
    } else {
      linking = false;
      ready = false;
      drawing = false;
      recovering = false;
      if (sentKey && GPU_REFUSALS.has(data.reason)) {
        refusedScenes.add(sentKey);
      }
      onFailed(data.packId);
    }
  };
  worker.onerror = (event) => {
    // The worker script itself failed to load or threw at the top level:
    // there is no scene to draw with, and saying so is all that is left.
    if (closed) {
      worker.terminate();
      return;
    }
    console.error('Dynamic lighting scene worker failed:', event.message);
    ready = false;
    drawing = false;
    onFailed('');
  };

  return {
    load: (pack, guarded) => {
      ready = false;
      drawing = false;
      wanted += 1;
      const mine = wanted;
      const key = sceneProgramKey(pack);
      if (refusedScenes.has(key)) {
        onFailed(pack.id);
        return;
      }
      // After the graph's compile of the same scene, if one is under way: then
      // this one is the GPU process's cached copy rather than a second full
      // compile beside it (`sceneLinkTurns.ts`).
      afterLinkTurns(key)
        .then(() => {
          if (!closed && mine === wanted) {
            linking = true;
            sentKey = key;
            post({ kind: 'load', pack, guarded });
          }
          return undefined;
        })
        .catch(() => undefined);
    },
    draw: (frame) => {
      if (!ready || drawing) {
        return;
      }
      drawing = true;
      post({ kind: 'frame', frame });
    },
    close: () => {
      closed = true;
      // Ended mid-link, the worker's context would take the link down on the
      // GPU process's main thread and freeze the graph's scene with it.
      if (linking) {
        post({ kind: 'retire' });
        return;
      }
      worker.terminate();
    },
  };
};
