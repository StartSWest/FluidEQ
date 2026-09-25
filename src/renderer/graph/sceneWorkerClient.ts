import type { IScenePack } from 'common/scenePacks';
import textDigest from 'common/textDigest';
import type { ISceneFrame } from './sceneGl';
import type { ISceneCostReading } from './sceneHealth';
import { sceneProgramKey, takeLinkTurn } from './sceneLinkTurns';
import type {
  ISceneDrawSize,
  ISceneFinish,
  TSceneBuildResult,
  TSceneWorkerReply,
  TSceneWorkerRequest,
} from './sceneWorkerMessages';

/**
 * How long a scene takes to come back once everything has stopped moving.
 *
 * A quarter of a second. It was tried at a full second, Ivan's own number,
 * and that was wrong: the ramp is not the whole wait, so on top of the box
 * settling it left the strip at less than full strength for a second and a
 * half.
 */
const SETTLE_FADE_MS = 250;

/** What the worker says of a frame it was sent (`TSceneWorkerReply`). */
export interface ISceneDrawn {
  accent: number;
  cost: ISceneCostReading;
  /** The GPU already held two frames; nothing was drawn this time. */
  skipped: boolean;
  /**
   * The interval the worker is drawing frames at, on the display's beat at
   * the listener's pace: what a frame's cost is judged against. Absent until
   * it has drawn two.
   */
  intervalMs?: number;
}

export interface ISceneWorkerClient {
  load(pack: IScenePack, guarded: boolean): Promise<TSceneBuildResult>;
  canDraw(): boolean;
  draw(
    frame: ISceneFrame,
    /** The pixels the scene is drawn at. */
    drawn: ISceneDrawSize,
    /** The panel's pixels; the scene is scaled to them when they differ. */
    output: ISceneDrawSize,
    /** How the picture is finished on its way to the canvas. */
    finish: ISceneFinish,
    clip: readonly [number, number, number, number],
    /** The least time the page leaves between frames; 0 for every frame. */
    paceMs: number,
    /** The frame is submitted, or skipped: its accent and what it cost. */
    shown: (drawn: ISceneDrawn) => void,
  ): void;
  /**
   * The page's frame loop has stopped. Until the next `draw` the worker
   * draws nothing on its own either — see the worker's own pacing.
   */
  idle(): void;
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

/**
 * Programs compiled ahead of being seen this session, by a digest of their
 * `sceneProgramKey`: that key carries the whole shader source, up to 256 KB
 * for a member scene, and nothing leaves this set — every Studio save warmed
 * kept a copy of its source for the rest of the session.
 */
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
  const warmedKey = textDigest(key);
  if (
    warmed.has(warmedKey) ||
    typeof Worker === 'undefined' ||
    typeof OffscreenCanvas === 'undefined'
  ) {
    return;
  }
  warmed.add(warmedKey);
  takeLinkTurn(key)
    .then((release) => {
      let worker: Worker;
      try {
        worker = startSceneWorker();
      } catch {
        release();
        warmed.delete(warmedKey);
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
            warmed.delete(warmedKey);
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
    .catch(() => warmed.delete(warmedKey));
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
  canvas.style.transition = `opacity ${SETTLE_FADE_MS}ms ease-out`;
  host.appendChild(canvas);

  /**
   * One rule: while the box is moving the scene is off, and it comes back on
   * the first frame drawn since the box stopped.
   *
   * The canvas is pulled to its host's size by CSS while the pixels behind it
   * belong to the worker, so every box change leaves the old picture stretched
   * over the new box until the worker catches up. Going into full screen,
   * measured in the window, that was 88ms of a strip 214 rows tall pulled over
   * a box of 1316 — unmistakable on anything with straight lines in it.
   *
   * Hiding in a ResizeObserver is what makes it invisible rather than shorter:
   * resize observers run after the frame callbacks and before the paint, so
   * the hide lands in the same frame the box changed in and the stretched
   * picture is never painted. Noticing it from the draw loop would let one
   * frame through.
   *
   * Coming back waits for the box to STOP. A box does not change once — the
   * graph's plot arrived at its height in three steps — and showing the scene
   * on the first frame that happened to arrive put it back at a size the panel
   * had already left, only to take it away again. Every box change takes a
   * turn, a draw records the turn it went out on, and a frame is only allowed
   * to bring the scene back if its turn is still the current one.
   *
   * No timer anywhere: it hides on a box changing and shows on a frame
   * arriving. A scene drawing nothing stays hidden, which is where a dropped
   * renderer leaves it too, and the frame loop is kicked on every resize.
   */
  let settled = true;
  let boxTurn = 0;
  let drawnForTurn = 0;
  const hold = () => {
    boxTurn += 1;
    if (settled) {
      settled = false;
      // Instant: a fade out is a slower way of showing the stretched picture.
      canvas.style.transition = 'none';
      canvas.style.opacity = '0';
    }
  };
  const release = () => {
    if (settled || drawnForTurn !== boxTurn) {
      return;
    }
    settled = true;
    canvas.style.transition = `opacity ${SETTLE_FADE_MS}ms ease-out`;
    canvas.style.opacity = '1';
  };
  const watchBox = new ResizeObserver(hold);
  watchBox.observe(host);
  watchBox.observe(host);
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
  let shown: ((drawn: ISceneDrawn) => void) | undefined;
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
  /**
   * Ends the worker once a frame without its canvas is on the screen.
   *
   * Taking the canvas out is not enough on its own, because the two happen at
   * different times: the removal is only painted with the next frame, and
   * `terminate()` frees the worker's picture there and then. For the frame in
   * between, the screen still showed the canvas and its picture was gone —
   * solid white over the whole stage. Recorded from outside the app, on
   * Ivan's monitor, 52ms after leaving a scene's page; the page's own frame
   * capture never saw it, because the canvas reaches the screen past it.
   *
   * Two animation frames: the first is the frame the removal is painted in,
   * and by the second that frame has gone to the screen. A hidden page paints
   * nothing, so there is nothing to wait for there — and rAF does not run in
   * one, which would have kept an unseen scene's worker, and its GPU memory,
   * alive until somebody looked again.
   */
  const terminateOnceUnseen = () => {
    if (document.hidden) {
      worker.terminate();
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => worker.terminate());
    });
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
      // A link that finished inside a frame of the canvas going would free
      // the picture before its removal was painted, like `dispose` below.
      terminateOnceUnseen();
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
      // The worker has submitted this frame, so the canvas now carries the
      // size it was drawn for: the one moment it is worth asking whether the
      // picture fits its box again.
      release();
      const notify = shown;
      shown = undefined;
      notify?.({
        accent: data.accent,
        cost: data.cost,
        skipped: data.skipped,
        intervalMs: data.intervalMs,
      });
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
    // One message in flight: the worker answers as soon as it has submitted
    // the frame (it never waits for the GPU; the worker's own clock bounds
    // what the GPU may hold), so the next frame reads the latest controls
    // and nothing queues behind a busy worker.
    canDraw: () =>
      !disposed && !lost && loads.size === 0 && shown === undefined,
    draw: (frame, drawn, output, finish, clip, paceMs, notify) => {
      shown = notify;
      // Which box this frame is for, so the answer can be checked against the
      // box that is there when it arrives.
      drawnForTurn = boxTurn;
      try {
        send({
          kind: 'draw',
          frame,
          width: drawn.width,
          height: drawn.height,
          output,
          finish,
          clip,
          paceMs,
        });
      } catch (error) {
        fail(String(error));
      }
    },
    idle: () => {
      if (disposed || lost) {
        return;
      }
      try {
        send({ kind: 'idle' });
      } catch (error) {
        fail(String(error));
      }
    },
    dispose: () => {
      disposed = true;
      shown = undefined;
      watchBox.disconnect();
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
      terminateOnceUnseen();
    },
  };
};
