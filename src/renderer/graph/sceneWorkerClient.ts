import type { IScenePack } from 'common/scenePacks';
import type { ISceneFrame } from './sceneGl';
import { sceneProgramKey, takeLinkTurn } from './sceneLinkTurns';
import type {
  TSceneBuildResult,
  TSceneWorkerReply,
  TSceneWorkerRequest,
} from './sceneWorkerMessages';

export interface ISceneWorkerClient {
  load(pack: IScenePack, guarded: boolean): Promise<TSceneBuildResult>;
  canDraw(): boolean;
  draw(
    frame: ISceneFrame,
    width: number,
    height: number,
    clip: readonly [number, number, number, number],
    /** The frame is on the canvas: its musical accent, and its GPU cost. */
    shown: (accent: number, costMs: number) => void,
  ): void;
  dispose(): void;
}

/**
 * A worker drawing a scene straight onto a canvas of its own inside `host`.
 *
 * Its own canvas, created here, because a canvas hands its drawing over once
 * and for good (`transferControlToOffscreen`), while a scene gets a fresh
 * worker for every mount and every project — React's development remount
 * included. The canvas leaves with the worker, so what shows through in
 * between is the host's loading backdrop.
 */
const startSceneWorker = () =>
  new Worker(
    new URL(
      process.env.NODE_ENV === 'production'
        ? './scene-renderer.js'
        : '/scene-renderer.dev.js',
      window.location.href,
    ),
  );

/** Programs compiled ahead of being seen this session, by `sceneProgramKey`. */
const warmed = new Set<string>();

/**
 * Compiles `pack`'s program in a worker of its own, on a canvas nobody sees,
 * and lets the worker go once it has: the GPU process keeps the linked program
 * for as long as the window runs, so the scene's own worker gets it in
 * milliseconds when the scene is first shown.
 *
 * For the graph's look while the graph is out of sight — a window started in
 * the tray, another tab open. It used to compile only once it was looked at,
 * which for a scene like Alpine is nine seconds of the loading ring in front
 * of somebody who opened the window to see it.
 */
export const warmSceneProgram = (pack: IScenePack, guarded: boolean): void => {
  const key = sceneProgramKey(pack);
  if (
    warmed.has(key) ||
    typeof Worker === 'undefined' ||
    typeof OffscreenCanvas === 'undefined'
  ) {
    return;
  }
  warmed.add(key);
  takeLinkTurn(key)
    .then((release) => {
      let worker: Worker;
      try {
        worker = startSceneWorker();
      } catch {
        release();
        warmed.delete(key);
        return undefined;
      }
      const end = () => {
        release();
        worker.terminate();
      };
      worker.onerror = end;
      worker.onmessage = ({ data }: MessageEvent<TSceneWorkerReply>) => {
        if (data.kind === 'loaded') {
          if (data.result.kind !== 'ready') {
            warmed.delete(key);
          }
          // Retired rather than ended: see `dispose` below.
          worker.postMessage({ kind: 'retire' } satisfies TSceneWorkerRequest);
        } else if (data.kind === 'retired') {
          end();
        }
      };
      const canvas = new OffscreenCanvas(1, 1);
      const attach: TSceneWorkerRequest = { kind: 'attach', canvas };
      worker.postMessage(attach, [canvas]);
      const load: TSceneWorkerRequest = { kind: 'load', id: 1, pack, guarded };
      worker.postMessage(load);
      return undefined;
    })
    .catch(() => warmed.delete(key));
};

export const createSceneWorkerClient = (
  host: HTMLElement,
  failed: (
    reason: 'unavailable' | 'context-lost' | 'gpu-reset',
    log?: string,
  ) => void,
  recovered: () => void,
): ISceneWorkerClient | undefined => {
  const canvas = document.createElement('canvas');
  if (typeof canvas.transferControlToOffscreen !== 'function') {
    return undefined;
  }
  let offscreen: OffscreenCanvas;
  try {
    offscreen = canvas.transferControlToOffscreen();
  } catch (error) {
    console.error('Scene canvas could not be handed to its worker:', error);
    return undefined;
  }
  const worker = startSceneWorker();
  // Before any load, which the worker answers with this canvas's context.
  const attach: TSceneWorkerRequest = { kind: 'attach', canvas: offscreen };
  worker.postMessage(attach, [offscreen]);
  // Sized by its host; the worker sets the pixels behind it.
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  host.appendChild(canvas);
  let id = 0;
  let disposed = false;
  let lost = false;
  /** Given up on while a load was running: ended once it says `retired`. */
  let retiring = false;
  /**
   * The compile turn each sent load holds (`sceneLinkTurns.ts`), let go when
   * that load is answered — or, for a worker given up on mid-link, when it
   * has retired, since its link is still running until then.
   */
  const heldTurns = new Map<number, () => void>();
  const letTurnsGo = () => {
    heldTurns.forEach((release) => release());
    heldTurns.clear();
  };
  let shown: ((accent: number, costMs: number) => void) | undefined;
  const loads = new Map<number, (result: TSceneBuildResult) => void>();
  const send = (request: TSceneWorkerRequest) => worker.postMessage(request);
  const cancelLoads = () => {
    loads.forEach((resolve) => resolve({ kind: 'cancelled' }));
    loads.clear();
  };
  /**
   * Takes the last frame off the screen before the worker's GPU context goes.
   *
   * The picture on the canvas lives in the worker's context. Terminating the
   * worker, or losing its context, frees it, and Chromium painted the dead
   * picture as solid white — for a whole compile when one scene replaced
   * another on the graph. Hidden, or gone with the worker, the canvas shows
   * the scene's loading backdrop underneath instead.
   */
  const releaseFrame = (forGood: boolean) => {
    if (forGood) {
      canvas.remove();
    } else {
      canvas.style.visibility = 'hidden';
    }
  };
  const fail = (log: string) => {
    if (disposed) {
      return;
    }
    lost = true;
    shown = undefined;
    cancelLoads();
    letTurnsGo();
    releaseFrame(true);
    worker.terminate();
    failed('unavailable', log);
  };
  worker.onerror = (event) => {
    if (retiring) {
      letTurnsGo();
      worker.terminate();
      return;
    }
    fail(event.message);
  };
  worker.onmessageerror = () =>
    fail('Scene worker reply could not be decoded.');
  worker.onmessage = ({ data }: MessageEvent<TSceneWorkerReply>) => {
    if (data.kind === 'retired') {
      letTurnsGo();
      worker.terminate();
      return;
    }
    if (disposed) {
      return;
    }
    if (data.kind === 'loaded') {
      heldTurns.get(data.id)?.();
      heldTurns.delete(data.id);
      loads.get(data.id)?.(data.result);
      loads.delete(data.id);
    } else if (data.kind === 'drawn') {
      const notify = shown;
      shown = undefined;
      notify?.(data.accent, data.costMs);
    } else if (data.kind === 'lost') {
      lost = true;
      shown = undefined;
      releaseFrame(false);
      if (data.fatal) {
        failed(data.blamed ? 'gpu-reset' : 'context-lost');
      }
    } else if (data.kind === 'restored') {
      lost = false;
      // A restored context has live resources again; until its first frame
      // the canvas is empty, which shows the backdrop, never white.
      canvas.style.visibility = '';
      recovered();
    } else {
      fail(data.log);
    }
  };
  return {
    load: (pack, guarded) => {
      if (disposed || lost) {
        return Promise.resolve({ kind: 'unavailable' });
      }
      id += 1;
      const next = id;
      const turn = takeLinkTurn(sceneProgramKey(pack));
      return new Promise((resolve) => {
        loads.set(next, resolve);
        turn
          .then((release) => {
            // Given up while waiting for another context's compile: nothing
            // was sent, so there is nothing to wait for.
            if (disposed || lost || !loads.has(next)) {
              release();
              return undefined;
            }
            heldTurns.set(next, release);
            send({ kind: 'load', id: next, pack, guarded });
            return undefined;
          })
          .catch((error) => fail(String(error)));
      });
    },
    // One frame in flight bounds memory and keeps old slider values from
    // queuing behind a busy GPU. The next frame reads the latest controls.
    canDraw: () =>
      !disposed && !lost && loads.size === 0 && shown === undefined,
    draw: (frame, width, height, clip, notify) => {
      shown = notify;
      try {
        send({ kind: 'draw', frame, width, height, clip });
      } catch (error) {
        fail(String(error));
      }
    },
    dispose: () => {
      disposed = true;
      shown = undefined;
      cancelLoads();
      releaseFrame(true);
      // A load sent and not answered may be linking. Ended now, the worker's
      // context would take that link down on the GPU process's main thread
      // and freeze every scene in the window until the compile finished; so
      // it gives the load up, waits for the link and says when it may go.
      if (heldTurns.size > 0 && !lost) {
        retiring = true;
        send({ kind: 'retire' });
        return;
      }
      letTurnsGo();
      worker.terminate();
    },
  };
};
