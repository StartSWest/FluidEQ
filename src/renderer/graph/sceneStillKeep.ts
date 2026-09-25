import type { ISceneFrame, ISceneProgram } from './sceneGl';
import { BLAMED_FRAME_MS, createDrawWatch } from './sceneDrawWatch';
import type { TFrameRun } from './sceneShowcaseRun';
import { walkBands } from './sceneStillBands';
import type { TSceneStillRefusal } from './sceneStillMessages';

/**
 * How the scene still worker draws the one frame a picture is made of: the
 * run played on a postage stamp under a watch, the kept frame judged worth
 * starting, drawn in bands at full size, timed and brought down to the
 * picture's size. The worker (`sceneStill.worker.ts`) owns the context, the
 * list of scenes it has given up on and the requests; this is only drawing.
 */

/** A scene built on the worker's shared context, ready to draw. */
export interface IBuiltScene {
  canvas: OffscreenCanvas;
  gl: WebGL2RenderingContext;
  program: ISceneProgram;
}

/** The picture's size: what the server keeps, the cards and the scene page show. */
const STILL_WIDTH = 1280;
const STILL_HEIGHT = 720;

/** The kept frame is drawn this much larger than the picture, then filtered down. */
const SUPERSAMPLE = 1.5;
const RENDER_WIDTH = Math.round(STILL_WIDTH * SUPERSAMPLE);
const RENDER_HEIGHT = Math.round(STILL_HEIGHT * SUPERSAMPLE);

/** A picture's size, and the size its kept frame is drawn at before filtering. */
export interface IRenderSize {
  width: number;
  height: number;
  renderWidth: number;
  renderHeight: number;
}

export const renderSize = (width: number, height: number): IRenderSize => ({
  width,
  height,
  renderWidth: Math.round(width * SUPERSAMPLE),
  renderHeight: Math.round(height * SUPERSAMPLE),
});

export const STILL_SIZE = renderSize(STILL_WIDTH, STILL_HEIGHT);

/**
 * The size the scene's clock is run at before the kept frame. Every easing a
 * scene keeps is measured in time, not pixels, so these draws only have to
 * happen, not to be seen.
 */
const WARMUP_WIDTH = 64;
const WARMUP_HEIGHT = 36;

/** A frame estimated past this is not drawn at all: no picture, no reset. */
const HOPELESS_STILL_MS = 30_000;

/**
 * The GPU time a pixel may take before a scene is given up on: the rate at
 * which the kept frame would be hopeless. A postage stamp slower than its
 * pixels at this rate is a scene whose picture would never be drawn anyway.
 */
const HOPELESS_MS_PER_PIXEL =
  HOPELESS_STILL_MS / (RENDER_WIDTH * RENDER_HEIGHT);

const pixel = new Uint8Array(4);

/** The postage stamps' own warm-up is a single tiny draw before the run. */
const STAMP_LADDER = [[16, 9]] as const;

/**
 * A watch over a scene's draws on the shared context (`sceneDrawWatch.ts`),
 * telling `refuse` why when it gives the scene up.
 */
export const watchDraws = (
  gl: WebGL2RenderingContext,
  program: ISceneProgram,
  refuse: (reason: TSceneStillRefusal) => void,
) => {
  const watch = createDrawWatch({
    draw: (frame, width, height) => program.draw(frame, width, height),
    finish: () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel),
    isLost: () => gl.isContextLost(),
    now: () => performance.now(),
    msPerPixel: HOPELESS_MS_PER_PIXEL,
    ladder: STAMP_LADDER,
  });
  return (frame: ISceneFrame, width: number, height: number) => {
    const started = performance.now();
    if (watch(frame, width, height)) {
      return true;
    }
    // Lost while one of its own frames held the GPU: the reset was this
    // scene's. Lost otherwise, somebody else's; and not lost, only slow.
    let reason: TSceneStillRefusal = 'too-heavy';
    if (gl.isContextLost()) {
      reason =
        performance.now() - started > BLAMED_FRAME_MS
          ? 'gpu-reset'
          : 'context-lost';
    }
    refuse(reason);
    return false;
  };
};

/**
 * Whether the kept frame is worth starting at all.
 *
 * Timed on the postage stamp at the same instant, with a pixel read back so
 * the time is the GPU's: the fastest of three, times how many more pixels the
 * kept frame has. A scene this says would take half a minute is one whose
 * picture would never arrive, so nothing is drawn and nobody waits.
 *
 * This answer is ONLY ever trusted to say no. It used to decide how many
 * bands the frame was drawn in as well, and that put the scene in charge of
 * its own limit: every draw here is at the postage stamp's size, and a shader
 * is handed the size it is drawing at, so `if (uResolution.x > 900.0)` made
 * the estimate nothing and the frame went to the driver whole. A scene that
 * lies the other way now buys only that its picture is attempted — and
 * `drawInBands` below measures what it actually costs, at the size that
 * matters, before it commits to more than a thirty-second of the frame.
 */
const keptFrameWorthDrawing = (
  gl: WebGL2RenderingContext,
  program: ISceneProgram,
  last: ISceneFrame,
  size: IRenderSize,
): { worth: boolean; longestMs: number } => {
  const stamp = { ...last, deltaMs: 0 };
  const times = [0, 1, 2].map(() => {
    const started = performance.now();
    program.draw(stamp, WARMUP_WIDTH, WARMUP_HEIGHT);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return performance.now() - started;
  });
  const estimate =
    Math.min(...times) *
    ((size.renderWidth * size.renderHeight) / (WARMUP_WIDTH * WARMUP_HEIGHT));
  return {
    worth: !gl.isContextLost() && estimate <= HOPELESS_STILL_MS,
    longestMs: Math.max(...times),
  };
};

/**
 * The frame drawn a band at a time, each band finished on the GPU before the
 * next is sent. The scissor keeps every band's pixels where the whole frame
 * puts them, and the frame's zero elapsed time draws the same instant each
 * time, so the bands meet without a seam.
 *
 * How tall each band may be is `sceneStillBands.ts`, decided as this goes from
 * the band before it — never from anything the scene had a say in.
 */
const drawInBands = (
  gl: WebGL2RenderingContext,
  program: ISceneProgram,
  frame: ISceneFrame,
  { renderWidth, renderHeight }: IRenderSize,
): { spentMs: number; longestMs: number } => {
  let spent = 0;
  let longest = 0;
  gl.enable(gl.SCISSOR_TEST);
  try {
    walkBands(renderHeight, (from, rows) => {
      if (gl.isContextLost()) {
        return undefined;
      }
      gl.scissor(0, from, renderWidth, rows);
      const started = performance.now();
      program.draw(frame, renderWidth, renderHeight);
      gl.readPixels(0, from, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      const took = performance.now() - started;
      spent += took;
      longest = Math.max(longest, took);
      return took;
    });
  } finally {
    gl.disable(gl.SCISSOR_TEST);
  }
  return { spentMs: spent, longestMs: longest };
};

/**
 * Whether the context went while this scene's own frame was being drawn, and
 * if so the scene is refused at once, blamed as `watchDraws` blames it: a
 * draw that held the GPU past BLAMED_FRAME_MS reset it. Refused HERE, in the
 * same task, because the lost-context event arrives only as a later task: the
 * member's AI's retry (`renderForAgent`) asked in between, found nothing
 * recorded, and drew the same scene again on a fresh context - a second
 * driver reset for every program on the machine.
 */
const lostDrawing = (
  gl: WebGL2RenderingContext,
  longestMs: number,
  refuse: (reason: TSceneStillRefusal) => void,
) => {
  if (!gl.isContextLost()) {
    return false;
  }
  refuse(longestMs > BLAMED_FRAME_MS ? 'gpu-reset' : 'context-lost');
  return true;
};

/**
 * Plays `run` to a freshly built scene on the postage stamp and draws the
 * last frame at full quality: the picture, or nothing when this machine
 * cannot draw the scene.
 *
 * The last frame is drawn a second time, at full size, with no time passing
 * in between. The scene keeps state of its own between frames — a slow copy
 * of the spectrum, the musical accent's envelope — and all of it advances by
 * the frame's elapsed time, so drawing the same instant again at zero elapsed
 * shows exactly what the postage stamp just reached instead of moving on.
 *
 * It is brought down to the picture's size at once, in the task that drew
 * it: a WebGL canvas without a preserved buffer is only readable there, and
 * encoding is not.
 */
export const keptFrame = (
  built: IBuiltScene,
  run: TFrameRun,
  size: IRenderSize,
  refuse: (reason: TSceneStillRefusal) => void,
  /**
   * How the kept frame is timed: drawn `warmups` times first, uncounted, and
   * then `timings` times, the fastest taken - what the frame costs a GPU that
   * is drawing it frame after frame, which is how it plays. The gallery needs
   * the picture only; the member's AI is told the cost, and one draw is not a
   * figure: the first at a size carries the driver's warm-up and a GPU still
   * climbing out of idle, and the GPU is shared with every other window. Its
   * first trial read the same shader anywhere from 6.6 to 47 ms and undid a
   * real speed-up on a low reading; the second, taking the median of three
   * straight away, read one picture 26, 23, 18, 13 and 10 ms on five calls in
   * a row, and "make it cheaper" on the first call after every save.
   */
  timing: { warmups: number; timings: number } = { warmups: 0, timings: 1 },
):
  | { still: OffscreenCanvas; drawMs: number; frame: ISceneFrame }
  | undefined => {
  const { canvas, gl, program } = built;
  try {
    let last: ISceneFrame | undefined;
    const watch = watchDraws(gl, program, refuse);
    for (let frame = run(); frame; frame = run()) {
      if (!watch(frame, WARMUP_WIDTH, WARMUP_HEIGHT)) {
        return undefined;
      }
      last = frame;
    }
    if (!last) {
      return undefined;
    }
    const stamp = keptFrameWorthDrawing(gl, program, last, size);
    if (lostDrawing(gl, stamp.longestMs, refuse) || !stamp.worth) {
      return undefined;
    }
    // The canvas is exactly the kept frame, so the whole of it is the
    // picture. The stamps and sky samples draw in its corner at any size.
    if (canvas.width !== size.renderWidth) {
      canvas.width = size.renderWidth;
    }
    if (canvas.height !== size.renderHeight) {
      canvas.height = size.renderHeight;
    }
    const kept = { ...last, deltaMs: 0 };
    const draws = [drawInBands(gl, program, kept, size)];
    // The picture is read after the last of them; every one draws the same
    // instant, so which one it is does not matter.
    const total = Math.max(1, timing.warmups + timing.timings);
    while (draws.length < total && !gl.isContextLost()) {
      draws.push(drawInBands(gl, program, kept, size));
    }
    const longestMs = Math.max(...draws.map((draw) => draw.longestMs));
    if (lostDrawing(gl, longestMs, refuse)) {
      return undefined;
    }
    const drawMs = Math.min(
      ...draws
        .slice(Math.min(timing.warmups, draws.length - 1))
        .map((draw) => draw.spentMs),
    );
    const scaled = new OffscreenCanvas(size.width, size.height);
    const flat = scaled.getContext('2d');
    if (!flat) {
      return undefined;
    }
    flat.imageSmoothingEnabled = true;
    flat.imageSmoothingQuality = 'high';
    flat.drawImage(canvas, 0, 0, size.width, size.height);
    return { still: scaled, drawMs, frame: kept };
  } finally {
    program.dispose();
  }
};
