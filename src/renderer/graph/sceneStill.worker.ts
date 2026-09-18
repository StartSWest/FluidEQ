import type { IScenePack } from 'common/scenePacks';
import { decodeSceneArtwork } from './sceneArtwork';
import {
  compileScene,
  createSceneContext,
  type ISceneFrame,
  type ISceneProgram,
} from './sceneGl';
import { BLAMED_FRAME_MS, createDrawWatch } from './sceneDrawWatch';
import { walkBands } from './sceneStillBands';
import { sceneProgramKey } from './sceneLinkTurns';
import { capturedRun, showcaseRun, type TFrameRun } from './sceneShowcaseRun';
import type {
  TSceneStillRefusal,
  TSceneStillReply,
  TSceneStillRequest,
} from './sceneStillMessages';

/**
 * The scene still worker: every scene drawn off screen — the gallery's and
 * Publish's pictures, and the frames the window's tint is measured from.
 *
 * Off the page's thread for the same reason the live scene is: decoding a
 * scene's artwork, compiling its shader and reading its pixels back all
 * stall, and each stall was a frozen interface. Opening the Studio held the
 * window still for up to half a second while the sky of the scene on its
 * stage was drawn there.
 *
 * One canvas and one context for everything, kept for the session: a browser
 * keeps only a handful of WebGL contexts alive before it drops the oldest —
 * the graph's among them — so this replaces the page's own picture context
 * and the one a sky measurement used to open and throw away each time. Work
 * runs one request at a time; every draw and every read of a frame happens in
 * one synchronous stretch after the artwork is decoded and the shader built.
 */

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<TSceneStillRequest>) => void;
  postMessage(reply: TSceneStillReply, transfer?: Transferable[]): void;
};

/** The picture's size: what the server keeps, the cards and the scene page show. */
const STILL_WIDTH = 1280;
const STILL_HEIGHT = 720;

/** The kept frame is drawn this much larger than the picture, then filtered down. */
const SUPERSAMPLE = 1.5;
const RENDER_WIDTH = Math.round(STILL_WIDTH * SUPERSAMPLE);
const RENDER_HEIGHT = Math.round(STILL_HEIGHT * SUPERSAMPLE);

/**
 * The size the scene's clock is run at before the kept frame. Every easing a
 * scene keeps is measured in time, not pixels, so these draws only have to
 * happen, not to be seen.
 */
const WARMUP_WIDTH = 64;
const WARMUP_HEIGHT = 36;

/** The server refuses a picture over 512KB; this leaves a margin. */
const MAX_STILL_BYTES = 480 * 1024;
const STILL_QUALITIES = [0.9, 0.82, 0.72, 0.6] as const;

/**
 * The size sky frames are read at: enough pixels to weigh a sky against the
 * skyline in front of it, few enough that nine reads cost nothing.
 */
const SAMPLE_WIDTH = 96;
const SAMPLE_HEIGHT = 54;

/**
 * One frame in ten of the showcase's three seconds, so a flash on a beat is
 * one vote in nine rather than the whole answer.
 */
const SAMPLE_EVERY = 10;

/** A frame estimated past this is not drawn at all: no picture, no reset. */
const HOPELESS_STILL_MS = 30_000;

/**
 * The GPU time a pixel may take before a scene is given up on: the rate at
 * which the kept frame would be hopeless. A postage stamp slower than its
 * pixels at this rate is a scene whose picture would never be drawn anyway.
 */
const HOPELESS_MS_PER_PIXEL =
  HOPELESS_STILL_MS / (RENDER_WIDTH * RENDER_HEIGHT);

let target: { canvas: OffscreenCanvas; gl: WebGL2RenderingContext } | undefined;

/**
 * Scenes given up on while this worker lives: their drawing lost the context,
 * or a frame took far too long. The page keeps its own list as well
 * (`sceneStillClient.ts`), because a worker let go when idle forgets this one.
 */
const refused = new Map<string, TSceneStillRefusal>();
/** The scene whose frames the context last carried. */
let drawing: string | undefined;

const sceneKey = (pack: IScenePack) =>
  `${pack.version}\n${sceneProgramKey(pack)}`;

/** The shared context, made again if the GPU took the last one away. */
const context = () => {
  if (target && !target.gl.isContextLost()) {
    return target;
  }
  // A fresh context can be a different GPU. Windows moves a window between
  // them — Remote Desktop puts this app on the integrated chip and hands it
  // back on disconnect — and the context is lost and remade across that move.
  //
  // So "too heavy" is dropped here. It is a judgement about the GPU that was
  // answering at the time, not about the scene: Crystal cannot be pictured on
  // an Intel UHD and is 63ms a frame on the card in the same machine. Kept,
  // it meant one spell of Remote Desktop refused a scene its own maker could
  // not picture or publish for the rest of the session, on a machine that was
  // never too slow for it.
  //
  // A scene that LOST the context or reset the GPU keeps its refusal across
  // this, because that is the quarantine and it is about the scene.
  refused.forEach((reason, key) => {
    if (reason === 'too-heavy') {
      refused.delete(key);
    }
  });
  const canvas = new OffscreenCanvas(RENDER_WIDTH, RENDER_HEIGHT);
  canvas.addEventListener('webglcontextlost', () => {
    // Blamed already, when a frame of it held the GPU (`watchDraws`).
    if (drawing && !refused.has(drawing)) {
      refused.set(drawing, 'context-lost');
    }
  });
  const gl = createSceneContext(canvas);
  target = gl ? { canvas, gl } : undefined;
  return target;
};

/** `pack`'s program on the shared context, or nothing it could not build. */
const build = async (pack: IScenePack) => {
  if (refused.has(sceneKey(pack))) {
    return undefined;
  }
  const drawn = context();
  if (!drawn) {
    return undefined;
  }
  drawing = sceneKey(pack);
  let artwork: ImageBitmap | undefined;
  try {
    artwork = await decodeSceneArtwork(pack);
  } catch {
    return undefined;
  }
  // Started from a promise, so a compile that throws, and one that answers
  // straight away or later, all settle the same way. On this thread a
  // compile that holds it up holds up nothing on screen.
  const compiled = await Promise.resolve()
    .then(() => compileScene(drawn.gl, pack, artwork))
    .catch(() => undefined)
    .finally(() => artwork?.close());
  return compiled?.ok ? { ...drawn, program: compiled.program } : undefined;
};

/** The first quality whose WebP fits, each tried only if the last was too big. */
const encodeStill = async (
  still: OffscreenCanvas,
  qualities: readonly number[] = STILL_QUALITIES,
): Promise<Blob | undefined> => {
  const [quality, ...rest] = qualities;
  if (quality === undefined) {
    return undefined;
  }
  const blob = await still.convertToBlob({ type: 'image/webp', quality });
  return blob.type === 'image/webp' && blob.size <= MAX_STILL_BYTES
    ? blob
    : encodeStill(still, rest);
};

/**
 * A PNG, at whatever size it comes to: no ladder and no cap, because this one
 * is written next to the project on the member's own disk rather than sent
 * anywhere, and a quality ladder would be trading away the detail the picture
 * exists to show.
 */
const encodePreview = (still: OffscreenCanvas) =>
  still.convertToBlob({ type: 'image/png' });

const pixel = new Uint8Array(4);

/** The postage stamps' own warm-up is a single tiny draw before the run. */
const STAMP_LADDER = [[16, 9]] as const;

/** A watch over `pack`'s draws on the shared context (`sceneDrawWatch.ts`). */
const watchDraws = (
  gl: WebGL2RenderingContext,
  program: ISceneProgram,
  pack: IScenePack,
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
    refused.set(sceneKey(pack), reason);
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
): boolean => {
  const stamp = { ...last, deltaMs: 0 };
  const times = [0, 1, 2].map(() => {
    const started = performance.now();
    program.draw(stamp, WARMUP_WIDTH, WARMUP_HEIGHT);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return performance.now() - started;
  });
  const estimate =
    Math.min(...times) *
    ((RENDER_WIDTH * RENDER_HEIGHT) / (WARMUP_WIDTH * WARMUP_HEIGHT));
  return !gl.isContextLost() && estimate <= HOPELESS_STILL_MS;
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
) => {
  gl.enable(gl.SCISSOR_TEST);
  try {
    walkBands(RENDER_HEIGHT, (from, rows) => {
      if (gl.isContextLost()) {
        return undefined;
      }
      gl.scissor(0, from, RENDER_WIDTH, rows);
      const started = performance.now();
      program.draw(frame, RENDER_WIDTH, RENDER_HEIGHT);
      gl.readPixels(0, from, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return performance.now() - started;
    });
  } finally {
    gl.disable(gl.SCISSOR_TEST);
  }
};

/**
 * Plays `run` to a fresh copy of `pack` on the postage stamp and draws the
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
const renderStill = async (
  pack: IScenePack,
  run: TFrameRun,
  format?: 'png',
): Promise<Blob | undefined> => {
  const built = await build(pack);
  if (!built) {
    return undefined;
  }
  const { canvas, gl, program } = built;
  let still: OffscreenCanvas | undefined;
  try {
    let last: ISceneFrame | undefined;
    const watch = watchDraws(gl, program, pack);
    for (let frame = run(); frame; frame = run()) {
      if (!watch(frame, WARMUP_WIDTH, WARMUP_HEIGHT)) {
        return undefined;
      }
      last = frame;
    }
    if (last && keptFrameWorthDrawing(gl, program, last)) {
      drawInBands(gl, program, { ...last, deltaMs: 0 });
      const scaled = new OffscreenCanvas(STILL_WIDTH, STILL_HEIGHT);
      const flat = scaled.getContext('2d');
      if (flat) {
        flat.imageSmoothingEnabled = true;
        flat.imageSmoothingQuality = 'high';
        flat.drawImage(canvas, 0, 0, STILL_WIDTH, STILL_HEIGHT);
        still = scaled;
      }
    }
  } finally {
    program.dispose();
  }
  if (!still) {
    return undefined;
  }
  return format === 'png' ? encodePreview(still) : encodeStill(still);
};

/** The showcase's frames drawn small and read back, as premultiplied RGBA. */
const sampleFrames = async (
  pack: IScenePack,
  accent: readonly [number, number, number],
): Promise<Uint8Array | undefined> => {
  const built = await build(pack);
  if (!built) {
    return undefined;
  }
  const { gl, program } = built;
  try {
    const frameBytes = SAMPLE_WIDTH * SAMPLE_HEIGHT * 4;
    const frames: Uint8Array[] = [];
    const run = showcaseRun(pack, accent);
    const watch = watchDraws(gl, program, pack);
    let index = 0;
    for (let frame = run(); frame; frame = run()) {
      if (!watch(frame, SAMPLE_WIDTH, SAMPLE_HEIGHT)) {
        return undefined;
      }
      if (index % SAMPLE_EVERY === 0) {
        // Read in the task that drew it: without a preserved buffer the
        // frame is only guaranteed to be there until this task ends.
        const pixels = new Uint8Array(frameBytes);
        gl.readPixels(
          0,
          0,
          SAMPLE_WIDTH,
          SAMPLE_HEIGHT,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        frames.push(pixels);
      }
      index += 1;
    }
    if (frames.length === 0) {
      return undefined;
    }
    const all = new Uint8Array(frames.length * frameBytes);
    frames.forEach((pixels, at) => all.set(pixels, at * frameBytes));
    return all;
  } finally {
    program.dispose();
  }
};

const refusalOf = (key: string) => {
  const reason = refused.get(key);
  return reason ? { refused: reason } : {};
};

const answer = async (request: TSceneStillRequest) => {
  const key = sceneKey(request.pack);
  if (request.kind === 'sample') {
    const pixels = await sampleFrames(request.pack, request.accent).catch(
      () => undefined,
    );
    scope.postMessage(
      {
        kind: 'sample',
        id: request.id,
        pixels,
        ...refusalOf(key),
      },
      pixels ? [pixels.buffer] : [],
    );
    return;
  }
  const run = request.frames
    ? capturedRun(request.frames)
    : showcaseRun(request.pack, request.accent);
  const blob = await renderStill(request.pack, run, request.format).catch(
    () => undefined,
  );
  scope.postMessage({
    kind: 'still',
    id: request.id,
    blob,
    ...refusalOf(key),
  });
};

// One at a time: the requests share one context, and a picture half drawn
// when a sky measurement starts compiling would come out as the other scene.
let queue: Promise<void> = Promise.resolve();

scope.onmessage = ({ data }) => {
  queue = queue.then(() => answer(data));
};
