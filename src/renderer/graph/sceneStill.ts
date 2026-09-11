import type { IScenePack } from 'common/scenePacks';
import {
  createStudioSignalBuffers,
  shapeStudioFrame,
} from '../studio/studioSignals';
import { decodeSceneArtwork } from './sceneArtwork';
import { compileScene, createSceneContext, type ISceneFrame } from './sceneGl';
import { createSceneTuner } from './sceneTuner';
import { parseAccent } from './sceneUniforms';

/**
 * A scene's picture: a real frame of it, drawn off screen from its own pack,
 * so the gallery shows the scene doing what it does, never a drawing standing
 * in for it. Either the first big moment of the showcase signal — a loud, busy
 * chorus over moving noise — or a moment the member caught while it played.
 *
 * It is the picture people decide on, so it is made for quality rather than
 * copied off whatever canvas the scene happens to be playing on: a stage may
 * be drawing at a quarter of its size on a slow machine, and a card cropped
 * from that looked like the scene run through a sieve. Here the scene's clock
 * runs on a postage stamp up to the moment worth keeping, and that one frame
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
 * Past this the scene is pictured as it is. The first kick after the warm-up
 * arrives at 2.03 s at the showcase's 118 BPM; three seconds leaves room.
 */
const MAX_STILL_FRAMES = 30 * 3;

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

/**
 * Plays `frames` to a fresh copy of `pack` on the postage stamp and draws the
 * last of them at full quality: the picture, or nothing when this machine
 * cannot draw the scene.
 *
 * The last frame is drawn a second time, at full size, with no time passing
 * in between. The scene keeps state of its own between frames — a slow copy
 * of the spectrum, the musical accent's envelope — and all of it advances by
 * the frame's elapsed time, so drawing the same instant again at zero elapsed
 * shows exactly what the postage stamp just reached instead of moving on.
 *
 * A run may reuse one set of buffers from frame to frame: each frame is drawn
 * before the next is asked for, and a run that is over hands out nothing
 * rather than touching them again.
 */
type TFrameRun = () => ISceneFrame | undefined;

const renderStill = async (
  pack: IScenePack,
  run: TFrameRun,
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
  let still: HTMLCanvasElement | undefined;
  try {
    let last: ISceneFrame | undefined;
    for (let frame = run(); frame; frame = run()) {
      program.draw(frame, WARMUP_WIDTH, WARMUP_HEIGHT);
      last = frame;
    }
    if (last) {
      program.draw({ ...last, deltaMs: 0 }, RENDER_WIDTH, RENDER_HEIGHT);
      still = downscale(canvas);
    }
  } finally {
    program.dispose();
  }
  return still ? encodeStill(still) : undefined;
};

/**
 * The showcase from its first frame to the first kick after the warm-up —
 * the frame a kick crosses the threshold on, where a scene reacts most — or
 * to the end of the run for a scene that never gets there.
 */
const showcaseRun = (pack: IScenePack): TFrameRun => {
  const buffers = createStudioSignalBuffers();
  const accent = parseAccent(
    getComputedStyle(document.documentElement).getPropertyValue('--accent'),
  );
  // Through the scene's own response and at its controls' values, as the
  // graph would draw it: a scene tuned to rest through quiet parts should
  // not be pictured doing otherwise.
  const tuner = createSceneTuner();
  const base = Object.fromEntries(
    pack.params.map((param) => [param.id, param.value]),
  );
  let index = 0;
  let wasKicking = false;
  let over = false;
  return () => {
    if (over || index >= MAX_STILL_FRAMES) {
      return undefined;
    }
    const seconds = (index * STILL_FRAME_MS) / 1000;
    index += 1;
    const heard = shapeStudioFrame(
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
    // The moment is chosen on what was played, so every scene is pictured
    // at the same kick whatever its response makes of it.
    const kicking = heard.beat >= KICK_THRESHOLD;
    over = kicking && !wasKicking && seconds >= SHOWCASE_WARMUP_S;
    wasKicking = kicking;
    return tuner.apply(heard, STILL_FRAME_MS, pack, base, undefined);
  };
};

/**
 * `pack`'s picture under the showcase signal, its clock run from the start
 * as it would be on the graph: the gallery's picture for a scene nobody has
 * chosen a moment of, and the cover a Publish starts with.
 */
export const renderSceneStill = (pack: IScenePack) =>
  renderStill(pack, showcaseRun(pack));

/**
 * `pack`'s picture at the moment a member caught on screen: `frames` are what
 * the scene heard over the last few seconds before it, oldest first, replayed
 * so everything the scene eases is where it was, and the last one is the
 * moment. At full presence whatever the stage's own entrance was doing — its
 * fade is how a stage appears, not part of the scene.
 */
export const renderCapturedStill = (
  pack: IScenePack,
  frames: readonly ISceneFrame[],
) => {
  let index = 0;
  return renderStill(pack, () => {
    if (index >= frames.length) {
      return undefined;
    }
    const frame = frames[index];
    index += 1;
    return { ...frame, fade: 1 };
  });
};
