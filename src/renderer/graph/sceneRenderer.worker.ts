import type { IScenePack } from 'common/scenePacks';
import { SCENE_TIME_WRAP_S } from 'common/sceneUniformContract';
import { decodeSceneArtwork } from './sceneArtwork';
import { createFlashGuard, type IFlashGuard } from './sceneFlashGuard';
import { linksSettled } from './sceneCompile';
import {
  compileScene,
  createSceneContext,
  type ISceneFrame,
  type ISceneProgram,
} from './sceneGl';
import {
  createSceneGpuClock,
  SCENE_FRAMES_IN_FLIGHT,
  type ISceneGpuClock,
} from './sceneGpuClock';
import { BLAMED_FRAME_MS } from './sceneDrawWatch';
import { createScenePost, needsPresent, type IScenePost } from './scenePost';
import { sameSceneProgramInputs } from './sceneProgramInputs';
import type {
  TSceneBuildResult,
  TSceneWorkerReply,
  TSceneWorkerRequest,
} from './sceneWorkerMessages';

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<TSceneWorkerRequest>) => void;
  postMessage(reply: TSceneWorkerReply, transfer?: Transferable[]): void;
  requestAnimationFrame(callback: (now: number) => void): number;
  cancelAnimationFrame(handle: number): void;
};

type TDrawRequest = Extract<TSceneWorkerRequest, { kind: 'draw' }>;

/**
 * How much of a display frame must pass, with nothing drawn, before the
 * worker draws one itself from what the page last sent.
 *
 * Nine tenths, so every frame the display offers gets a picture. The page's
 * loop shares a thread with the whole interface, and measured in the running
 * window it was feeding the Studio's stage 65 to 72 frames a second on a
 * 100 Hz display while the scene cost 0.9 ms of GPU: one refresh in three
 * showed the frame before it again, which on anything moving fast is seen as
 * a ghost of where it was. It was a multiple of whole missed frames, which
 * never fired at that rate — a page steadily a third behind is never late by
 * a whole frame.
 */
const FILL_AFTER_TICKS = 0.9;

/**
 * A page frame arriving this soon after one the worker drew is the same
 * display frame twice, and only the second would ever be seen. Narrow, so
 * the page's own frame — the one carrying the newest sound — is what gets
 * drawn whenever the two are not on top of each other.
 */
const SAME_FRAME_TICKS = 0.25;

/**
 * The most the scene's clock advances on one frame. A stall longer than this
 * is not motion to catch up on: the page used to clamp its own clock here for
 * the same reason, and the worker filling the stall in makes it moot.
 */
const MAX_TIME_STEP_MS = 100;

/** Faster than 250 Hz or slower than 10 Hz is a measurement error, not a display. */
const SHORTEST_TICK_MS = 4;
const LONGEST_TICK_MS = 100;

// Driver compilation, texture uploads and first-use shader specialization can
// all stall. None may share the event loop that handles Studio's controls.
//
// The canvas is the page's own, handed over by `attach` before anything else.
// Drawn here, a frame goes to the compositor when the task that drew it ends,
// without waiting for the page: rendered to a bitmap and posted back instead,
// it waited for the page to take the message and then for the page's next
// frame — 7 ms at the median on a quiet graph, 15 ms beside Studio, and every
// stall of the page on top — before any of it was on screen.
//
// Nothing here waits for the GPU either. Each frame is timed by the GPU's own
// clock and fenced (`sceneGpuClock.ts`), and the next is submitted while the
// last is still being drawn — two in flight, never three. Reading a pixel back
// after every frame, which is what this did, made the GPU and this thread
// take turns, and at a display's own rate the turn-taking alone was most of
// the interval.
let canvas: OffscreenCanvas | undefined;
let gl: WebGL2RenderingContext | null = null;
let program: ISceneProgram | undefined;
let guard: IFlashGuard | null = null;
let clock: ISceneGpuClock | undefined;
/**
 * The finishing chain (`scenePost.ts`), made the first time a frame needs
 * finishing; `null` once the GPU has refused it, and the picture is then
 * drawn straight onto a canvas of its own size, which the compositor
 * stretches as every version before this did.
 */
let post: IScenePost | null | undefined;
let pack: IScenePack | null = null;
let guarded = false;
let generation = 0;
let losses = 0;
let compilation: AbortController | undefined;
/** Loads still running: ending the worker waits for every one of them. */
const running = new Set<Promise<TSceneBuildResult>>();
/** How long the last finished frame took the GPU, by its own clock. */
let lastCostMs = 0;
/**
 * The source of a scene a lost context was blamed on (`BLAMED_FRAME_MS`).
 * By source, because the canvas is handed the next scene when the look
 * changes, and a loss blamed on one must not follow the next.
 */
let blamedSource: string | undefined;

// The worker's own pacing. The page hands over one frame per animation
// frame of its own, and drew nothing at all while its thread was busy: a
// menu opening, a panel re-rendering, a Library scan, each froze the scene
// for exactly as long. Measured in a test page stalling its thread for 60 ms
// every quarter second, the page-driven loop showed eleven hitches in three
// seconds and a worker pacing itself none. So the worker keeps its own
// animation frames going, and on each one asks whether the page has fallen
// behind its declared pace; only then does it draw a frame itself, from the
// last thing the page sent, with the clock moved on. The page's frame is
// still drawn the moment it arrives, so nothing is a frame later than it was.
/** The page's last frame: what a frame the worker draws itself is made of. */
let latest: TDrawRequest | undefined;
/** When the page's last frame was drawn. */
let pageDrawnAt: number | undefined;
/** When the last frame, the page's or the worker's own, was drawn. */
let drawnAt: number | undefined;
/** When the worker last drew a frame of its own. */
let filledAt: number | undefined;
/** The clock the scene is drawn on, in seconds, wrapped like the page's was. */
let sceneTimeS = 0;
/** The worker's animation frames, running between a `draw` and an `idle`. */
let pacingFrame: number | undefined;
/** The last two of the worker's own animation frames: the display's beat. */
let lastTickAt: number | undefined;
let tickMs = 1000 / 60;

const load = async (
  next: IScenePack,
  withGuard: boolean,
): Promise<TSceneBuildResult> => {
  generation += 1;
  compilation?.abort();
  const controller = new AbortController();
  compilation = controller;
  const mine = generation;
  const startedWithLosses = losses;
  if (!gl || gl.isContextLost() || losses >= 2) {
    return { kind: 'unavailable' };
  }
  if (program && withGuard === guarded && sameSceneProgramInputs(pack, next)) {
    pack = next;
    return { kind: 'ready', rebuilt: false };
  }
  // The last scene's slowest frame is not this one's to answer for.
  lastCostMs = 0;
  let artwork: ImageBitmap | undefined;
  try {
    artwork = await decodeSceneArtwork(next);
    if (gl.isContextLost() || losses !== startedWithLosses) {
      return { kind: 'unavailable' };
    }
    if (mine !== generation) {
      return { kind: 'cancelled' };
    }
    if (withGuard && !guard) {
      guard = createFlashGuard(gl);
      if (!guard) {
        return { kind: 'unavailable' };
      }
    }
    const result = await compileScene(gl, next, artwork, controller.signal);
    if (
      mine !== generation ||
      gl.isContextLost() ||
      losses !== startedWithLosses
    ) {
      if (result.ok) {
        result.program.dispose();
      }
      return {
        kind:
          gl.isContextLost() || losses !== startedWithLosses
            ? 'unavailable'
            : 'cancelled',
      };
    }
    if (!result.ok) {
      return { kind: 'compile', log: result.log };
    }
    program?.dispose();
    program = result.program;
    // A different scene starts from the beginning of its clock, as the page's
    // own bookkeeping does; a new version of the same one carries on.
    if (pack?.id !== next.id) {
      sceneTimeS = 0;
      drawnAt = undefined;
    }
    pack = next;
    guarded = withGuard;
    if (!withGuard) {
      guard?.dispose();
      guard = null;
    }
    return { kind: 'ready', rebuilt: true };
  } catch (error) {
    // A lost first compile has no last-good pack to restore. Report it so
    // Studio leaves loading and the next save can start a fresh worker.
    if (gl.isContextLost() || losses !== startedWithLosses) {
      return { kind: 'unavailable' };
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { kind: 'cancelled' };
    }
    if (error instanceof DOMException && error.name === 'NotSupportedError') {
      return { kind: 'unavailable' };
    }
    return { kind: 'compile', log: String(error) };
  } finally {
    artwork?.close();
  }
};

const track = (build: Promise<TSceneBuildResult>) => {
  running.add(build);
  build.finally(() => running.delete(build)).catch(() => undefined);
  return build;
};

const freeFrameResources = () => {
  clock?.dispose();
  clock = undefined;
  post?.dispose();
  post = undefined;
};

/** The worker draws nothing of its own until the page's next frame. */
const stopPacing = () => {
  if (pacingFrame !== undefined) {
    scope.cancelAnimationFrame(pacingFrame);
    pacingFrame = undefined;
  }
  lastTickAt = undefined;
  latest = undefined;
  pageDrawnAt = undefined;
  filledAt = undefined;
};

/**
 * Gives up whatever is loading and frees everything, and only then says the
 * worker may be ended. Ended mid-link instead, its context took the link down
 * with it on the GPU process's main thread, which served every other scene
 * in the window, and froze them all until the compile finished
 * (`sceneCompile.ts`).
 */
const retire = async () => {
  stopPacing();
  generation += 1;
  compilation?.abort();
  await Promise.all(running);
  await linksSettled();
  program?.dispose();
  program = undefined;
  guard?.dispose();
  guard = null;
  freeFrameResources();
  scope.postMessage({ kind: 'retired' });
};

const attach = (target: OffscreenCanvas) => {
  canvas = target;
  gl = createSceneContext(target);
  target.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stopPacing();
    generation += 1;
    compilation?.abort();
    program = undefined;
    guard = null;
    // A scene nobody has watched (guarded) that just held the GPU for half a
    // second does not get the restore: reloaded, it drew the same frame and
    // reset the driver a second time, for every program on the machine. Any
    // other loss — sleep, a driver update, another page's crash — is not the
    // scene's, and the scene comes back once.
    //
    // Its frame is the one still on the GPU when the context went, or the
    // last one the clock finished timing: either past the blamed length.
    const inFlightMs = clock?.oldestInFlightMs(performance.now()) ?? 0;
    const blamed = lastCostMs > BLAMED_FRAME_MS || inFlightMs > BLAMED_FRAME_MS;
    // The context's objects went with it; the JavaScript side is let go too.
    clock = undefined;
    post = undefined;
    if (blamed && pack) {
      blamedSource = pack.source;
    }
    losses += guarded && blamed ? 2 : 1;
    scope.postMessage({
      kind: 'lost',
      fatal: losses >= 2,
      // Whether this frame's own scene is why the context was lost, which the
      // client reports as a `gpu-reset` rather than a plain `context-lost`.
      blamed: pack !== null && blamedSource === pack.source,
    });
  });
  target.addEventListener('webglcontextrestored', () => {
    if (!pack || losses >= 2) {
      return;
    }
    track(load(pack, guarded)).then((result) => {
      if (result.kind === 'ready') {
        scope.postMessage({ kind: 'restored' });
      } else if (result.kind !== 'cancelled') {
        scope.postMessage({
          kind: 'error',
          log: 'Scene context recovery failed.',
        });
      }
      return undefined;
    });
  });
};

/** A clip in panel fractions as a scissor box on a `width × height` target. */
const scissorBox = (
  clip: readonly [number, number, number, number],
  width: number,
  height: number,
): [number, number, number, number] => {
  const [left, top, right, bottom] = clip;
  const x = Math.floor(left * width);
  const y = Math.floor(top * height);
  const farX = Math.ceil(right * width);
  const farY = Math.ceil(bottom * height);
  return [x, height - farY, farX - x, farY - y];
};

/**
 * Draws one frame from `request` on the worker's own clock and says what it
 * cost. `now` is when it is drawn: the arrival of the page's frame, or the
 * worker's own animation frame.
 */
const render = (request: TDrawRequest, now: number): TSceneWorkerReply => {
  if (!canvas || !gl || !program || gl.isContextLost()) {
    return { kind: 'drawn', accent: 0, cost: { behind: 0 }, skipped: true };
  }
  const { width, height, clip, output, finish } = request;
  clock ??= createSceneGpuClock(gl);
  const cost = clock.poll(now);
  if (cost.costMs !== undefined) {
    lastCostMs = cost.costMs;
  }
  // The pipeline is full: a third frame would only wait behind the other
  // two, and the picture would lag the music by that much. On a driver with
  // a clock, only while the GPU is in fact slower than the display: fences
  // are seen signalled a frame or two late in the running window, and read
  // on their own they dropped one frame in ten of a scene costing 0.14 ms.
  const slower = cost.costMs === undefined || lastCostMs > tickMs;
  if (cost.behind >= SCENE_FRAMES_IN_FLIGHT && slower) {
    return {
      kind: 'drawn',
      accent: program.musicAccent(),
      cost,
      skipped: true,
    };
  }

  // The scene's time moves on by what passed since the last frame drawn
  // here, the page's or the worker's own, so a stall the worker fills in
  // advances it smoothly and the page's next frame does not set it back.
  const stepMs =
    drawnAt === undefined
      ? Math.min(MAX_TIME_STEP_MS, request.frame.deltaMs ?? 0)
      : Math.min(MAX_TIME_STEP_MS, Math.max(0, now - drawnAt));
  sceneTimeS = (sceneTimeS + stepMs / 1000) % SCENE_TIME_WRAP_S;
  drawnAt = now;
  const frame: ISceneFrame = {
    ...request.frame,
    timeSeconds: sceneTimeS,
    deltaMs: stepMs,
  };

  // What the canvas shows: the panel's own pixels when the picture is
  // brought to them (FSR up, or the supersample average down), or the drawn
  // size when a smaller picture is left to the compositor to stretch — the
  // plain scaler, which costs the GPU nothing. A GPU that refuses the
  // finishing chain draws straight onto a canvas of the drawn size.
  const smaller = width < output.width || height < output.height;
  const wanted = smaller && !finish.fsr ? { width, height } : output;
  const plan = {
    drawnWidth: width,
    drawnHeight: height,
    canvasWidth: wanted.width,
    canvasHeight: wanted.height,
    fsr: finish.fsr,
    fxaa: finish.fxaa,
  };
  if (needsPresent(plan) && post === undefined) {
    post = createScenePost(gl);
  }
  const finishing = needsPresent(plan) && post !== null && post !== undefined;
  const shown = finishing ? wanted : { width, height };
  if (canvas.width !== shown.width || canvas.height !== shown.height) {
    canvas.width = shown.width;
    canvas.height = shown.height;
  }

  clock.begin();
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(...scissorBox(clip, width, height));
  const target = finishing && post ? post.input(width, height) : null;
  if (guard) {
    guard.begin(width, height);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
  }
  program.draw(frame, width, height);
  guard?.end(frame.deltaMs ?? 0, target);
  if (finishing && post) {
    clock.mark();
    post.present({
      ...plan,
      scissor: scissorBox(clip, shown.width, shown.height),
    });
  }
  clock.end();
  // No hand-off: the frame is committed when this task returns.
  return { kind: 'drawn', accent: program.musicAccent(), cost, skipped: false };
};

/**
 * One of the worker's own animation frames: a frame of its own only where
 * the page has fallen behind the pace it declared, and then at that pace.
 */
const tick = (now: number) => {
  pacingFrame = scope.requestAnimationFrame(tick);
  if (lastTickAt !== undefined) {
    tickMs = Math.min(
      LONGEST_TICK_MS,
      Math.max(SHORTEST_TICK_MS, now - lastTickAt),
    );
  }
  lastTickAt = now;
  if (latest === undefined || pageDrawnAt === undefined) {
    return;
  }
  // A display frame has passed with nothing drawn on it, and the listener's
  // own pace allows another.
  const dueMs = Math.max(latest.paceMs, tickMs * FILL_AFTER_TICKS);
  if (drawnAt !== undefined && now - drawnAt < dueMs) {
    return;
  }
  // Nobody is told: the page's next frame reads the clock's newest reading,
  // which is this frame's, exactly as it reads its own.
  filledAt = now;
  render(latest, now);
};

/** The page's frame: drawn at once, and kept as the model for the worker's own. */
const draw = (request: TDrawRequest): TSceneWorkerReply => {
  const now = performance.now();
  latest = request;
  pageDrawnAt = now;
  if (pacingFrame === undefined) {
    pacingFrame = scope.requestAnimationFrame(tick);
  }
  // The page's frame arriving on the display frame the worker just filled
  // in: the fill stands, and this one is not drawn on top of it — two frames
  // on one display frame is a frame of GPU time for nothing, and the second
  // still in hand at the next poll read as the GPU falling behind.
  if (filledAt !== undefined && now - filledAt < tickMs * SAME_FRAME_TICKS) {
    return {
      kind: 'drawn',
      accent: program?.musicAccent() ?? 0,
      cost: clock?.poll(now) ?? { behind: 0 },
      skipped: true,
    };
  }
  return render(request, now);
};

scope.onmessage = ({ data }) => {
  if (data.kind === 'attach') {
    attach(data.canvas);
    return;
  }
  if (data.kind === 'retire') {
    retire().catch(() => scope.postMessage({ kind: 'retired' }));
    return;
  }
  if (data.kind === 'idle') {
    stopPacing();
    return;
  }
  if (data.kind === 'load') {
    track(load(data.pack, data.guarded)).then((result) => {
      scope.postMessage({ kind: 'loaded', id: data.id, result });
      return undefined;
    });
    return;
  }
  try {
    scope.postMessage(draw(data));
  } catch (error) {
    scope.postMessage({ kind: 'error', log: String(error) });
  }
};
