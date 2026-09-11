import type { IScenePack } from 'common/scenePacks';
import {
  createStudioSignalBuffers,
  shapeStudioFrame,
} from '../studio/studioSignals';
import { decodeSceneArtwork } from './sceneArtwork';
import { compileScene, createSceneContext } from './sceneGl';
import { parseAccent } from './sceneUniforms';

/**
 * A scene's picture: a real frame of it, drawn off screen from its own pack
 * while it hears the showcase signal — a loud, busy chorus over moving noise
 * — so the gallery shows the scene doing what it does, never a drawing
 * standing in for it.
 *
 * It is the picture people decide on, so it is made for quality rather than
 * taken from wherever the scene happens to be playing: the Studio's stage may
 * be drawing at a quarter of its size on a slow machine, and a card cropped
 * from that looked like the scene run through a sieve. Here the scene's clock
 * runs on a postage stamp until the moment worth keeping, and that one frame
 * is drawn half as large again as the picture and brought down with a smooth
 * filter, so the thin things scenes are made of — rings, stars, grain — come
 * out clean instead of stepped.
 */

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
 * How long a scene hears the showcase before its picture can be taken: long
 * enough for the slow spectrum to fill and anything that grows with the music
 * to have grown.
 */
const SHOWCASE_WARMUP_S = 1.6;

/** A kick this fresh is the frame where the scene reacts most. */
const KICK_THRESHOLD = 0.35;

/**
 * Steps of the simulated clock. Thirty a second reaches the same eased state
 * as sixty, with half the draws.
 */
const STILL_FRAME_MS = 1000 / 30;

/**
 * Past this the scene is pictured as it is: enough simulated time for the
 * twelfth kick after the warm-up at the showcase's tempo, so "Take another"
 * has a dozen moments to go through before it comes round again.
 */
const MAX_STILL_FRAMES = 30 * 9;

/** How many different moments there are to ask for. */
const STILL_MOMENTS = 12;

const encode = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality);
  });

/** The first quality whose WebP fits, each tried only if the last was too big. */
const encodeStill = async (
  still: HTMLCanvasElement,
  qualities: readonly number[] = STILL_QUALITIES,
): Promise<Blob | undefined> => {
  const [quality, ...rest] = qualities;
  if (quality === undefined) {
    return undefined;
  }
  const blob = await encode(still, quality);
  return blob && blob.type === 'image/webp' && blob.size <= MAX_STILL_BYTES
    ? blob
    : encodeStill(still, rest);
};

export const blobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * The frame on `source` brought down to the picture's size with the best
 * filter the browser has. Copied at once: a WebGL canvas without a preserved
 * buffer is only readable in the task that drew it, and encoding is not.
 */
const downscale = (
  source: HTMLCanvasElement,
): HTMLCanvasElement | undefined => {
  const still = document.createElement('canvas');
  still.width = STILL_WIDTH;
  still.height = STILL_HEIGHT;
  const context = still.getContext('2d');
  if (!context) {
    return undefined;
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, STILL_WIDTH, STILL_HEIGHT);
  return still;
};

/**
 * One canvas and one context for every picture drawn here, reused: a browser
 * keeps only a handful of WebGL contexts alive before it starts dropping the
 * oldest — the graph's among them. Sharing it is safe without a lock: after
 * the artwork is decoded, everything that touches it — compiling, drawing,
 * copying the frame out, disposing — runs in one synchronous stretch.
 */
let shared:
  { canvas: HTMLCanvasElement; gl: WebGL2RenderingContext } | undefined;

const sharedContext = () => {
  if (shared && !shared.gl.isContextLost()) {
    return shared;
  }
  const canvas = document.createElement('canvas');
  canvas.width = RENDER_WIDTH;
  canvas.height = RENDER_HEIGHT;
  const gl = createSceneContext(canvas);
  shared = gl ? { canvas, gl } : undefined;
  return shared;
};

export interface IStillOptions {
  /**
   * Which moment to keep: 0 for the first kick after the warm-up, 1 for the
   * next, and so on — "Take another" asks for the next one each time.
   */
  moment?: number;
}

/**
 * Draws `pack` off screen under the showcase signal and returns its picture,
 * or nothing when this machine cannot draw it. The scene's clock runs from
 * the start, as it would on the graph, until the moment asked for.
 */
export const renderSceneStill = async (
  pack: IScenePack,
  { moment = 0 }: IStillOptions = {},
): Promise<Blob | undefined> => {
  const target = sharedContext();
  if (!target) {
    return undefined;
  }
  const { canvas, gl } = target;
  let artwork: ImageBitmap | undefined;
  try {
    artwork = await decodeSceneArtwork(pack);
  } catch {
    return undefined;
  }
  const compiled = compileScene(gl, pack, artwork);
  artwork?.close();
  if (!compiled.ok) {
    return undefined;
  }
  const { program } = compiled;
  const buffers = createStudioSignalBuffers();
  const accent = parseAccent(
    getComputedStyle(document.documentElement).getPropertyValue('--accent'),
  );
  const wanted = Math.max(0, Math.floor(moment)) % STILL_MOMENTS;
  let kicks = 0;
  let wasKicking = false;
  let still: HTMLCanvasElement | undefined;
  try {
    for (let index = 0; index < MAX_STILL_FRAMES; index += 1) {
      const seconds = (index * STILL_FRAME_MS) / 1000;
      const frame = shapeStudioFrame(
        {
          timeSeconds: seconds,
          deltaMs: STILL_FRAME_MS,
          level: 0,
          beat: 0,
          bands: [0, 0, 0],
          accent,
          fade: 1,
          spectrum: buffers.spectrum,
          waveform: buffers.waveform,
          params: {},
        },
        'showcase',
        buffers,
      );
      // A moment is a kick arriving: the frame it crosses the threshold on.
      const kicking = frame.beat >= KICK_THRESHOLD;
      const arrived = kicking && !wasKicking && seconds >= SHOWCASE_WARMUP_S;
      wasKicking = kicking;
      const kept = arrived && kicks === wanted;
      if (arrived) {
        kicks += 1;
      }
      if (kept || index === MAX_STILL_FRAMES - 1) {
        program.draw(frame, RENDER_WIDTH, RENDER_HEIGHT);
        still = downscale(canvas);
        break;
      }
      program.draw(frame, WARMUP_WIDTH, WARMUP_HEIGHT);
    }
  } finally {
    program.dispose();
  }
  return still ? encodeStill(still) : undefined;
};
