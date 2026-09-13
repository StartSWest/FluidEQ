import type { IScenePack } from 'common/scenePacks';
import type { ISceneFrame } from './sceneGl';
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
export const createSceneWorkerClient = (
  host: HTMLElement,
  failed: (reason: 'unavailable' | 'context-lost', log?: string) => void,
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
  const worker = new Worker(
    new URL(
      process.env.NODE_ENV === 'production'
        ? './scene-renderer.js'
        : '/scene-renderer.dev.js',
      window.location.href,
    ),
  );
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
    releaseFrame(true);
    worker.terminate();
    failed('unavailable', log);
  };
  worker.onerror = (event) => fail(event.message);
  worker.onmessageerror = () =>
    fail('Scene worker reply could not be decoded.');
  worker.onmessage = ({ data }: MessageEvent<TSceneWorkerReply>) => {
    if (disposed) {
      return;
    }
    if (data.kind === 'loaded') {
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
        failed('context-lost');
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
      return new Promise((resolve) => {
        loads.set(next, resolve);
        try {
          send({ kind: 'load', id: next, pack, guarded });
        } catch (error) {
          fail(String(error));
        }
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
      worker.terminate();
    },
  };
};
