import type { IScenePack } from 'common/scenePacks';
import { decodeSceneArtwork } from './sceneArtwork';
import { compileScene, createSceneContext, type ISceneFrame } from './sceneGl';
import { capturedRun, showcaseRun, type TFrameRun } from './sceneShowcaseRun';
import type {
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

let target: { canvas: OffscreenCanvas; gl: WebGL2RenderingContext } | undefined;

/** The shared context, made again if the GPU took the last one away. */
const context = () => {
  if (target && !target.gl.isContextLost()) {
    return target;
  }
  const canvas = new OffscreenCanvas(RENDER_WIDTH, RENDER_HEIGHT);
  const gl = createSceneContext(canvas);
  target = gl ? { canvas, gl } : undefined;
  return target;
};

/** `pack`'s program on the shared context, or nothing it could not build. */
const build = async (pack: IScenePack) => {
  const drawn = context();
  if (!drawn) {
    return undefined;
  }
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
): Promise<Blob | undefined> => {
  const built = await build(pack);
  if (!built) {
    return undefined;
  }
  const { canvas, program } = built;
  let still: OffscreenCanvas | undefined;
  try {
    let last: ISceneFrame | undefined;
    for (let frame = run(); frame; frame = run()) {
      program.draw(frame, WARMUP_WIDTH, WARMUP_HEIGHT);
      last = frame;
    }
    if (last) {
      program.draw({ ...last, deltaMs: 0 }, RENDER_WIDTH, RENDER_HEIGHT);
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
  return still ? encodeStill(still) : undefined;
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
    let index = 0;
    for (let frame = run(); frame; frame = run()) {
      program.draw(frame, SAMPLE_WIDTH, SAMPLE_HEIGHT);
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

const answer = async (request: TSceneStillRequest) => {
  if (request.kind === 'sample') {
    const pixels = await sampleFrames(request.pack, request.accent).catch(
      () => undefined,
    );
    scope.postMessage(
      { kind: 'sample', id: request.id, pixels },
      pixels ? [pixels.buffer] : [],
    );
    return;
  }
  const run = request.frames
    ? capturedRun(request.frames)
    : showcaseRun(request.pack, request.accent);
  const blob = await renderStill(request.pack, run).catch(() => undefined);
  scope.postMessage({ kind: 'still', id: request.id, blob });
};

// One at a time: the requests share one context, and a picture half drawn
// when a sky measurement starts compiling would come out as the other scene.
let queue: Promise<void> = Promise.resolve();

scope.onmessage = ({ data }) => {
  queue = queue.then(() => answer(data));
};
