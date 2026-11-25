import type { ISceneEditReport } from 'common/sceneEdit';
import type { IScenePack } from 'common/scenePacks';
import textDigest from 'common/textDigest';
import type { ISceneFrame } from './sceneGl';
import type { ISceneCostReading } from './sceneHealth';
import type { TSceneProbeRect } from './sceneInk';
import { sceneProgramKey, takeLinkTurn } from './sceneLinkTurns';
import { createSceneCanvasHold, type ISceneBox } from './sceneCanvasHold';
import { reportError } from '../utils/logger';
import type {
  ISceneDrawSize,
  ISceneFinish,
  ISceneShownFrames,
  TSceneBuildResult,
  TSceneWorkerReply,
  TSceneWorkerRequest,
} from './sceneWorkerMessages';

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
  /** What the worker has put on the canvas (`ISceneShownFrames`). */
  shown?: ISceneShownFrames;
  /** The Studio's Edit mode answered (`common/sceneEdit.ts`). */
  edit?: ISceneEditReport;
}

export interface ISceneWorkerClient {
  load(pack: IScenePack, unwatched: boolean): Promise<TSceneBuildResult>;
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
  /**
   * The picture off the screen until let go, and back only on a frame drawn
   * after that — framed for where the graph has arrived (`graphArrival.ts`).
   */
  holdPicture(held: boolean): void;
  /**
   * Read how bright the picture is inside `rect` every few drawn frames, and
   * hand each reading to `heard` (`sceneProbe.ts`); none stops reading.
   */
  probe(
    rects: readonly TSceneProbeRect[],
    heard: ((luminances: readonly number[]) => void) | undefined,
  ): void;
  /**
   * The canvas moved into `host`, worker, context and program kept: a scene
   * built ahead on a canvas nobody saw (`scenePreload.ts`) taking its place
   * on the page. Unseen until its first frame, as a new canvas is.
   */
  rehost(host: HTMLElement): void;
  /**
   * Settles once the first picture is fully on: its fade-in finished, or at
   * once where it arrives without one. Settles too if the worker goes first,
   * so nothing waiting on it waits for ever.
   */
  whenShown(): Promise<void>;
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
 * of somebody who opened the window to see it. And for a scene with a 3D
 * world wherever one is built ahead (`scenePrebuild.ts`): its programs are
 * three's and the world's own, which only a scene worker builds as they will
 * be drawn. Resolves once the worker is gone, or at once when there is
 * nothing to do.
 */
export const warmSceneProgram = (
  pack: IScenePack,
  unwatched: boolean,
): Promise<void> => {
  const key = sceneProgramKey(pack);
  const warmedKey = textDigest(key);
  if (
    warmed.has(warmedKey) ||
    typeof Worker === 'undefined' ||
    typeof OffscreenCanvas === 'undefined'
  ) {
    return Promise.resolve();
  }
  warmed.add(warmedKey);
  return takeLinkTurn(key)
    .then(
      (release) =>
        new Promise<void>((resolve) => {
          let worker: Worker;
          try {
            worker = startSceneWorker();
          } catch {
            release();
            warmed.delete(warmedKey);
            resolve();
            return;
          }
          // Every way out comes through here, once. The turn is shared by
          // every worker compiling this program — the graph's own included —
          // and one never released left the scene loading for the rest of the
          // session, and every scene queued behind it for a prebuild with it:
          // a reply that could not be decoded, or a send that threw, used to
          // leave by a path that did not release it.
          let ended = false;
          const end = (failed: boolean) => {
            if (ended) {
              return;
            }
            ended = true;
            if (failed) {
              warmed.delete(warmedKey);
            }
            release();
            worker.terminate();
            resolve();
          };
          worker.onerror = () => end(true);
          worker.onmessageerror = () => end(true);
          worker.onmessage = ({ data }: MessageEvent<TSceneWorkerReply>) => {
            if (data.kind === 'loaded') {
              if (data.result.kind !== 'ready') {
                warmed.delete(warmedKey);
              }
              // Retired rather than ended: see `dispose` below.
              worker.postMessage({
                kind: 'retire',
              } satisfies TSceneWorkerRequest);
            } else if (data.kind === 'retired') {
              end(false);
            }
          };
          try {
            const canvas = new OffscreenCanvas(1, 1);
            const attach: TSceneWorkerRequest = { kind: 'attach', canvas };
            worker.postMessage(attach, [canvas]);
            const load: TSceneWorkerRequest = {
              kind: 'load',
              id: 1,
              pack,
              unwatched,
            };
            worker.postMessage(load);
          } catch {
            end(true);
          }
        }),
    )
    .catch(() => {
      warmed.delete(warmedKey);
    });
};

export const createSceneWorkerClient = (
  host: HTMLElement,
  failed: (
    reason: 'unavailable' | 'context-lost' | 'gpu-reset',
    log?: string,
  ) => void,
  recovered: () => void,
  /**
   * How the first picture comes in (`ISceneRunnerOptions.arrival`): faded
   * in, or at full strength for a drawing that takes over a picture already
   * on screen.
   */
  arrival: 'fade' | 'at-once' = 'fade',
): ISceneWorkerClient | undefined => {
  const canvas = document.createElement('canvas');
  if (typeof canvas.transferControlToOffscreen !== 'function') {
    return undefined;
  }
  let offscreen: OffscreenCanvas;
  try {
    offscreen = canvas.transferControlToOffscreen();
  } catch (error) {
    reportError('Handing the scene canvas to its worker', error);
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
  let canvasHost = host;
  let shownFully: () => void = () => undefined;
  const fullyShown = new Promise<void>((resolve) => {
    shownFully = resolve;
  });
  /**
   * The first picture's fade has run its course. Read from the transition
   * itself (`getAnimations`), never from a duration written down here: a
   * runner crossfading over the picture before this one lets that one go on
   * this (`useSceneRunner`). No transition — arriving at once, or styles
   * that turn transitions off — and it is on now.
   */
  const settleWhenFaded = () => {
    const fades =
      typeof canvas.getAnimations === 'function' ? canvas.getAnimations() : [];
    Promise.all(
      fades.map((fade) =>
        fade.finished.then(
          () => undefined,
          () => undefined,
        ),
      ),
    )
      .then(shownFully)
      .catch(shownFully);
  };
  // What the canvas shows while its box moves (`sceneCanvasHold.ts`).
  const holding = createSceneCanvasHold(canvas, arrival, settleWhenFaded);
  const boxOf = (entries: ResizeObserverEntry[]): ISceneBox | undefined => {
    if (entries.length === 0) {
      return undefined;
    }
    const { width, height } = entries[entries.length - 1].contentRect;
    return { width, height };
  };
  const watchBox = new ResizeObserver((entries) =>
    holding.boxChanged(boxOf(entries)),
  );
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
  /**
   * Who hears the readings of the newest ask, and its id: a reading made for
   * an earlier ask names places that may have moved since, and is dropped.
   */
  let probed: ((luminances: readonly number[]) => void) | undefined;
  let probeId = 0;
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
   * and by the second that frame has gone to the screen.
   *
   * A hidden page waits too, for longer: it paints nothing, so the last frame
   * it painted — canvas and all — is the one Windows puts back on the screen
   * the moment the window is restored, before the page has drawn anything.
   * Ended at once there, the worker took that frame's picture with it and
   * every restore opened on a white graph (Ivan, 2026-11-17). So the wait is
   * for the window to be shown again and then the same two frames; the
   * worker has already freed all it holds but its context by then
   * (`dispose` retires it first while hidden), and the context is what keeps
   * the picture on screen.
   */
  const terminateOnceUnseen = () => {
    const afterTwoFrames = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => worker.terminate());
      });
    };
    if (!document.hidden) {
      afterTwoFrames();
      return;
    }
    const whenShown = () => {
      if (document.hidden) {
        return;
      }
      document.removeEventListener('visibilitychange', whenShown);
      afterTwoFrames();
    };
    document.addEventListener('visibilitychange', whenShown);
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
    shownFully();
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
      // The answer says which box the newest frame ON the canvas was drawn
      // for, which is not this frame's: the worker draws it on its own next
      // animation frame (`sceneCanvasHold.ts`).
      holding.onCanvas(data.shown?.turn);
      const notify = shown;
      shown = undefined;
      notify?.({
        accent: data.accent,
        cost: data.cost,
        skipped: data.skipped,
        intervalMs: data.intervalMs,
        shown: data.shown,
        ...(data.edit ? { edit: data.edit } : {}),
      });
    } else if (data.kind === 'lost') {
      lost = true;
      shown = undefined;
      releaseFrame(false);
      if (data.fatal) {
        failed(data.blamed ? 'gpu-reset' : 'context-lost');
      }
    } else if (data.kind === 'probed') {
      if (data.id === probeId) {
        probed?.(data.luminances);
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
    load: (pack, unwatched) => {
      if (disposed) {
        return Promise.resolve({ kind: 'unavailable' });
      }
      // Between a loss and its restore: asked again on `recovered`.
      if (lost) {
        return Promise.resolve({ kind: 'lost' });
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
            send({ kind: 'load', id: next, pack, unwatched });
            return undefined;
          })
          .catch((error) => fail(String(error)));
      });
    },
    // One message in flight: the worker answers as soon as it has the frame
    // (it draws it on its own clock and never waits for the GPU; that clock
    // bounds what the GPU may hold), so the next frame reads the latest
    // controls and nothing queues behind a busy worker.
    canDraw: () =>
      !disposed && !lost && loads.size === 0 && shown === undefined,
    draw: (frame, drawn, output, finish, clip, paceMs, notify) => {
      shown = notify;
      try {
        send({
          kind: 'draw',
          // Which box this frame is for, so the worker can say when a frame
          // for the box that is there now has reached the canvas.
          turn: holding.sending(),
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
    holdPicture: (held) => holding.pin(held),
    probe: (rects, heard) => {
      probeId += 1;
      probed = rects.length > 0 ? heard : undefined;
      if (disposed) {
        return;
      }
      try {
        send({ kind: 'probe', id: probeId, rects });
      } catch (error) {
        fail(String(error));
      }
    },
    rehost: (next) => {
      if (disposed || next === canvasHost) {
        return;
      }
      watchBox.disconnect();
      canvasHost = next;
      next.appendChild(canvas);
      watchBox.observe(next);
      // A new box: off the screen until a frame drawn for it, which for a
      // canvas that has shown nothing yet is its first, faded in.
      holding.moved();
    },
    whenShown: () => fullyShown,
    dispose: () => {
      disposed = true;
      shownFully();
      shown = undefined;
      probed = undefined;
      watchBox.disconnect();
      cancelLoads();
      releaseFrame(true);
      // A load sent and not answered may be linking. Ended now, the worker's
      // context would take that link down on the GPU process's main thread
      // and freeze every scene in the window until the compile finished; so
      // it gives the load up, waits for the link and says when it may go.
      // A hidden window retires it too: the worker then waits for the window
      // to be seen again (`terminateOnceUnseen`), and frees its program and
      // passes meanwhile rather than holding them through the wait.
      if ((heldTurns.size > 0 || document.hidden) && !lost) {
        retiring = true;
        send({ kind: 'retire' });
        return;
      }
      letTurnsGo();
      terminateOnceUnseen();
    },
  };
};
