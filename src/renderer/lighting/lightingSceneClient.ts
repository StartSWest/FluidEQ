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
  /**
   * Draw this scene, `guarded` for one nobody watched before it was shared: a
   * member's. The scene being drawn carries on until this one is ready.
   */
  load(pack: IScenePack, guarded: boolean): void;
  /** Draw nothing: whatever is loading or drawn is let go. */
  unload(): void;
  /**
   * Draw one frame for the lamps. A frame that arrives while the last is
   * still being drawn is dropped, not queued: the next tick is newer, and a
   * queue behind a slow GPU would light the desk a second late.
   */
  draw(frame: ILightingSceneFrame): void;
  close(): void;
}

interface ILoadSent {
  id: number;
  /** The program, for a refusal to be kept by. */
  key: string;
}

/** The lighting scene worker, from the window. */
export const createLightingScene = (
  onGrid: (grid: TGridReply) => void,
  /** Nothing can be drawn: the scene asked for, or the one being drawn, failed. */
  onFailed: (packId: string) => void,
  /** A scene asked for is the one being drawn now, after a lost context too. */
  onReady: (packId: string) => void = () => undefined,
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
  let closed = false;
  /** The newest load posted, which is the scene the worker is to draw. */
  let sent: ILoadSent | undefined;
  /** The load the worker is drawing: frames go only while there is one. */
  let drawn: ILoadSent | undefined;
  /** The last load posted has not been answered, or a lost context is being given back. */
  let linking = false;
  /** Bumped by every load and unload; a load still waiting for a link turn is not sent once another is asked for. */
  let wanted = 0;
  let loads = 0;
  const post = (request: TLightingWorkerRequest) => worker.postMessage(request);
  const refuse = (load: ILoadSent | undefined, reason: string) => {
    if (load && GPU_REFUSALS.has(reason)) {
      refusedScenes.add(load.key);
    }
  };

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
      if (data.id !== sent?.id) {
        return;
      }
      linking = false;
      drawn = sent;
      onReady(data.packId);
    } else if (data.kind === 'lost') {
      // Not the scene's doing: the worker loads it again when the context
      // comes back, and until then the lamps take its colours.
      drawn = undefined;
      drawing = false;
      linking = true;
      onFailed(data.packId);
    } else {
      drawing = false;
      if (data.id === undefined) {
        // The program being drawn gave up; a load in flight carries on.
        refuse(drawn, data.reason);
      } else if (data.id === sent?.id) {
        linking = false;
        refuse(sent, data.reason);
      } else {
        return;
      }
      drawn = undefined;
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
    drawn = undefined;
    drawing = false;
    onFailed('');
  };

  const unload = () => {
    wanted += 1;
    sent = undefined;
    drawn = undefined;
    // `linking` stays as it was: a link given up on still runs to its end
    // in the worker (`sceneCompile.ts`), and only retiring waits for it.
    post({ kind: 'unload' });
  };

  return {
    load: (pack, guarded) => {
      wanted += 1;
      const mine = wanted;
      const key = sceneProgramKey(pack);
      if (refusedScenes.has(key)) {
        // Nor is the scene before it drawn on: it is not the one asked for.
        unload();
        onFailed(pack.id);
        return;
      }
      // After the graph's compile of the same scene, if one is under way: then
      // this one is the GPU process's cached copy rather than a second full
      // compile beside it (`sceneLinkTurns.ts`).
      afterLinkTurns(key)
        .then(() => {
          if (!closed && mine === wanted) {
            loads += 1;
            sent = { id: loads, key };
            linking = true;
            post({ kind: 'load', pack, guarded, id: loads });
          }
          return undefined;
        })
        .catch(() => undefined);
    },
    unload,
    draw: (frame) => {
      if (!drawn || drawing) {
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
