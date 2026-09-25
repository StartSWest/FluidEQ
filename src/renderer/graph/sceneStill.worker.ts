import type { IScenePack } from 'common/scenePacks';
import { SILENT_RHYTHM } from 'common/sceneRhythm';
import {
  STUDIO_AGENT_SILENCE_S,
  type IStudioAgentMoment,
} from 'common/studioAgent';
import type { ISceneFrame } from './sceneGl';
import { decodeSceneArtwork } from './sceneArtwork';
import { compileScene, createSceneContext } from './sceneGl';
import { sceneProgramKey } from './sceneLinkTurns';
import {
  capturedRun,
  handedRun,
  showcaseRun,
  silenceRun,
  type TFrameRun,
} from './sceneShowcaseRun';
import {
  keptFrame,
  renderSize,
  STILL_SIZE,
  watchDraws,
  type IBuiltScene,
} from './sceneStillKeep';
import type {
  ISceneStillVisibility,
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
  onmessage: (
    event: MessageEvent<TSceneStillRequest | ISceneStillVisibility>,
  ) => void;
  postMessage(reply: TSceneStillReply, transfer?: Transferable[]): void;
};

/**
 * A JPEG, not the PNG the preview file is: the picture travels inside the
 * assistant's own conversation, where a noisy scene's lossless 1280x720 ran to
 * megabytes, and every assistant opens a JPEG. At this quality a model sees
 * what the member would.
 */
const AGENT_JPEG_QUALITY = 0.9;

/**
 * What the member's AI is told a frame costs: the fastest of five draws, after
 * four that warm the driver and the GPU up and are not counted (`keptFrame`).
 */
const AGENT_TIMING = { warmups: 4, timings: 5 };

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
  const canvas = new OffscreenCanvas(
    STILL_SIZE.renderWidth,
    STILL_SIZE.renderHeight,
  );
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

type TBuilt =
  | ({ ok: true } & IBuiltScene)
  /** `log`: the shader did not compile, in the driver's words. */
  | { ok: false; log?: string };

/** What gives `pack` up for the rest of this worker's life, and why. */
const refuserOf = (pack: IScenePack) => (reason: TSceneStillRefusal) => {
  refused.set(sceneKey(pack), reason);
};

/**
 * `pack`'s program on the shared context, or why not: nothing to say when
 * the scene is refused, the artwork will not decode or there is no context,
 * the driver's own words when the shader does not compile.
 */
/**
 * Fired when the page stops being seen: a link the member's AI is waiting on
 * frame by frame is read to its end at once, rather than when the member
 * next looks at FluidEQ (`linkSceneProgram`). Made again when it is seen.
 */
let hidden = new AbortController();

const build = async (
  pack: IScenePack,
  hurry?: AbortSignal,
): Promise<TBuilt> => {
  if (refused.has(sceneKey(pack))) {
    return { ok: false };
  }
  const drawn = context();
  if (!drawn) {
    return { ok: false };
  }
  drawing = sceneKey(pack);
  let artwork: ImageBitmap | undefined;
  try {
    artwork = await decodeSceneArtwork(pack);
  } catch {
    return { ok: false };
  }
  // Started from a promise, so a compile that throws, and one that answers
  // straight away or later, all settle the same way. On this thread a
  // compile that holds it up holds up nothing on screen.
  const compiled = await Promise.resolve()
    .then(() => compileScene(drawn.gl, pack, artwork, undefined, hurry))
    .catch(() => undefined)
    .finally(() => artwork?.close());
  if (!compiled) {
    return { ok: false };
  }
  return compiled.ok
    ? { ok: true, ...drawn, program: compiled.program }
    : { ok: false, log: compiled.log };
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

const renderStill = async (
  pack: IScenePack,
  run: TFrameRun,
  format?: 'png',
): Promise<Blob | undefined> => {
  const built = await build(pack);
  if (!built.ok) {
    return undefined;
  }
  const kept = keptFrame(built, run, STILL_SIZE, refuserOf(pack));
  if (!kept) {
    return undefined;
  }
  return format === 'png' ? encodePreview(kept.still) : encodeStill(kept.still);
};

type TAgentReply = Omit<Extract<TSceneStillReply, { kind: 'agent' }>, 'id'>;

/** What the music was doing at `frame`, as the scene heard it. */
const momentOf = (frame: ISceneFrame): IStudioAgentMoment => {
  const rhythm = frame.rhythm ?? SILENT_RHYTHM;
  return {
    beatPhase: rhythm.beatPhase,
    barPhase: rhythm.barPhase,
    tempo: rhythm.tempo,
    confidence: rhythm.confidence,
    kick: rhythm.kick,
    snare: rhythm.snare,
    hat: rhythm.hat,
    intensity: rhythm.intensity,
    build: rhythm.build,
    drop: rhythm.drop,
    drops: rhythm.dropSerial,
    balance: frame.stereo?.[0] ?? 0,
    width: frame.stereo?.[1] ?? 0,
    level: frame.level,
    beat: frame.beat,
    accent: frame.musicAccent[0],
    voiceOpen: frame.voice?.[0] ?? 0,
    voicePitch: frame.voice?.[1] ?? 0,
    voiceSure: frame.voice?.[2] ?? 0,
  };
};

/** One attempt at the member's AI's picture. */
const drawAgentPicture = async (
  request: Extract<TSceneStillRequest, { kind: 'agent' }>,
): Promise<TAgentReply> => {
  const { pack, accent, sound, seconds } = request;
  const built = await build(
    pack,
    request.unseen ? AbortSignal.abort() : hidden.signal,
  );
  if (!built.ok) {
    return { kind: 'agent', ...(built.log ? { log: built.log } : {}) };
  }
  const size = renderSize(request.width, request.height);
  // The wave's band, which the gallery's pictures leave to the default (an
  // AI placing its subject in the band needs to see it move), and the
  // viewer's hands as the AI placed them.
  const run = handedRun(
    () =>
      sound === 'silence'
        ? silenceRun(pack, accent, seconds ?? STUDIO_AGENT_SILENCE_S)
        : showcaseRun(pack, accent, seconds, request.tempo),
    request,
  );
  const kept = keptFrame(built, run, size, refuserOf(pack), AGENT_TIMING);
  if (!kept) {
    // A frame that held the GPU is also recorded in `refused`, which the
    // reply carries and which says more; this is what is left.
    return { kind: 'agent', hopeless: true };
  }
  return {
    kind: 'agent',
    image: await kept.still.convertToBlob({
      type: 'image/jpeg',
      quality: AGENT_JPEG_QUALITY,
    }),
    drawMs: kept.drawMs,
    renderWidth: size.renderWidth,
    renderHeight: size.renderHeight,
    moment: momentOf(kept.frame),
  };
};

/**
 * The member's AI's picture, in the shape and at the moment it asked for.
 *
 * "Too heavy" is a judgement of the GPU at one moment, and this worker keeps
 * it for the scene until its context is made again. For the gallery that is
 * a missing picture; for the member's AI it is an instruction — "make it much
 * cheaper" — and a scene that is fine gets gutted for it. It happened on the
 * first real run: FluidEQ's own desktop backgrounds were drawing scenes on
 * the same GPU, two frames of a 64x36 stamp ran past their allowance, and the
 * cat that drew its 1080x1920 frame in 11 ms a minute later was refused, and
 * refused again at every shape after it. So a timing verdict is set aside
 * before the AI's picture is drawn, and a picture refused on timing alone is
 * drawn once more before the AI is told. A GPU reset or a lost context is
 * about the scene and stands.
 */
const renderForAgent = async (
  request: Extract<TSceneStillRequest, { kind: 'agent' }>,
): Promise<TAgentReply> => {
  const key = sceneKey(request.pack);
  const timingOnly = () => {
    const reason = refused.get(key);
    return reason === undefined || reason === 'too-heavy';
  };
  if (refused.get(key) === 'too-heavy') {
    refused.delete(key);
  }
  const first = await drawAgentPicture(request);
  if (!first.hopeless || !timingOnly()) {
    return first;
  }
  refused.delete(key);
  return drawAgentPicture(request);
};

/** The showcase's frames drawn small and read back, as premultiplied RGBA. */
const sampleFrames = async (
  pack: IScenePack,
  accent: readonly [number, number, number],
): Promise<Uint8Array | undefined> => {
  const built = await build(pack);
  if (!built.ok) {
    return undefined;
  }
  const { gl, program } = built;
  try {
    const frameBytes = SAMPLE_WIDTH * SAMPLE_HEIGHT * 4;
    const frames: Uint8Array[] = [];
    const run = showcaseRun(pack, accent);
    const watch = watchDraws(gl, program, refuserOf(pack));
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
  if (request.kind === 'agent') {
    const drawn = await renderForAgent(request).catch(
      (): Omit<Extract<TSceneStillReply, { kind: 'agent' }>, 'id'> => ({
        kind: 'agent',
      }),
    );
    scope.postMessage({ ...drawn, id: request.id, ...refusalOf(key) });
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
  if (data.kind === 'visibility') {
    if (data.hidden) {
      hidden.abort();
    } else if (hidden.signal.aborted) {
      hidden = new AbortController();
    }
    return;
  }
  queue = queue.then(() => answer(data));
};
