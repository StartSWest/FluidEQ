import type { IScenePack } from 'common/scenePacks';
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
 * How far out of shape a picture may be before it is taken off the screen
 * rather than stretched, as a ratio of its aspect to its box's.
 *
 * A quarter is about where a circle reads as an oval. Below it are the
 * changes nothing should interrupt for — a pane divider dragged, a window
 * edge pulled, which move the box by a percent or two a frame. Above it are
 * the ones worth hiding: the graph's strip into full screen, measured at
 * 4.8 times out of shape, is the case this exists for.
 */
const SETTLE_STRETCH = 1.25;

/**
 * How long the scene takes to come back once it fits again.
 *
 * A second, which is Ivan's own number: "0 to 100 in a sec", 2026-09-18. It
 * was a quarter of that first and he asked for the longer ramp.
 *
 * The same going in and coming out: full screen and back to the strip are one
 * gesture, and a reveal that took longer in one direction than the other
 * would read as the slower one having gone wrong.
 *
 * This is a ramp, not a wait. The scene is on screen and climbing from the
 * moment its picture fits — 161ms after the double click, measured in the
 * window — so the second is how long it takes to reach full strength, not how
 * long there is nothing to look at. That distinction is what keeps it inside
 * the other limit he set, which was never to see an empty panel for a second.
 */
const SETTLE_FADE_MS = 1000;

/**
 * Whether the picture on a scene's canvas still fits the box it is drawn
 * into, or is being stretched to fill it.
 *
 * The canvas is pulled to its host's size by CSS while the pixels behind it
 * belong to the worker, so between a box changing shape and the worker's next
 * frame the browser scales the old picture over the new box. Going from the
 * graph's strip into full screen, measured in the window on 2026-09-18: the
 * box went from 2016x214 to 2560x1316 while the picture behind it stayed
 * 2016x214 for 88ms — a scene nine times wider than tall pulled over a box
 * not quite two. Five frames, and unmistakable on anything with straight
 * lines in it; Crystal is where it shows worst.
 *
 * Only a mismatch big enough to SEE counts. A pane divider being dragged
 * moves the box by a percent a frame, and taking the scene away for each of
 * those would be far worse than the stretch.
 *
 * The picture's own RESOLUTION is deliberately not part of this. The cost
 * ladder draws small on purpose and the worker brings the result back up to
 * the panel's pixels, so the canvas matches its box at every rung; a blurrier
 * picture is not a stretched one, and hiding the scene each time the ladder
 * moved would be a fault of its own.
 */
export const sceneFitsItsBox = (
  pictureWidth: number,
  pictureHeight: number,
  boxWidth: number,
  boxHeight: number,
): boolean => {
  if (
    !(pictureWidth >= 1) ||
    !(pictureHeight >= 1) ||
    !(boxWidth >= 1) ||
    !(boxHeight >= 1)
  ) {
    // Nothing drawn yet, or a box with no size: there is no picture being
    // stretched, and a scene must never be left hidden by a reading that
    // means "not measurable".
    return true;
  }
  const stretch = (pictureWidth / pictureHeight) * (boxHeight / boxWidth);
  return Math.max(stretch, 1 / stretch) < SETTLE_STRETCH;
};

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
  // Held back while the picture does not fit its box — see `fits` below. The
  // fade is on the way IN only; going out has to be instantaneous or the
  // stretched frame is what the fade shows.
  canvas.style.transition = `opacity ${SETTLE_FADE_MS}ms ease-out`;
  host.appendChild(canvas);

  const fits = () => {
    const box = host.getBoundingClientRect();
    return sceneFitsItsBox(canvas.width, canvas.height, box.width, box.height);
  };

  /**
   * Takes the scene off the screen the moment its box stops fitting, and
   * fades it back when a frame drawn for the new box has been submitted.
   *
   * In the ResizeObserver rather than in the frame loop on purpose: this runs
   * before the browser paints the frame the box changed in, so the stretched
   * picture is never shown at all. Noticing it a frame later would still let
   * one through.
   *
   * There is no timer anywhere in this: it hides on a box changing and shows
   * on a frame arriving. A scene that stops drawing altogether therefore
   * stays hidden — which is the same place a dropped renderer leaves it, and
   * the frame loop is kicked on every resize, so the frame always comes.
   *
   * What shows through in the meantime is the chart's own dark ground, NOT
   * the scene's colour: `SceneLoading.tsx` fades its backdrop away once the
   * scene has first drawn and does not bring it back for a resize. Measured
   * at 161ms to the first full-screen frame and 440ms to full strength, so
   * it is a few frames of the panel behind a scene that is already there.
   */
  let settled = true;
  const hold = () => {
    if (settled && !fits()) {
      settled = false;
      canvas.style.transition = 'none';
      canvas.style.opacity = '0';
    }
  };
  const release = () => {
    if (!settled && fits()) {
      settled = true;
      canvas.style.transition = `opacity ${SETTLE_FADE_MS}ms ease-out`;
      canvas.style.opacity = '1';
    }
  };
  const watchBox = new ResizeObserver(hold);
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
      worker.terminate();
    },
  };
};
