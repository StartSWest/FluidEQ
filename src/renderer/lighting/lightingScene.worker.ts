/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from 'common/scenePacks';
import {
  LIGHTING_GRID_HEIGHT,
  LIGHTING_GRID_WIDTH,
} from 'common/lighting/lightingModel';
import { decodeSceneArtwork } from '../graph/sceneArtwork';
import { BLAMED_FRAME_MS } from '../graph/sceneDrawWatch';
import { createFlashGuard, type IFlashGuard } from '../graph/sceneFlashGuard';
import { linksSettled } from '../graph/sceneCompile';
import {
  compileScene,
  type ISceneFrame,
  type ISceneProgram,
} from '../graph/sceneGl';
import { SCENE_CONTEXT_ATTRIBUTES } from '../graph/sceneHealth';
import { createSceneTuner } from '../graph/sceneTuner';
import { downsampleToGrid } from './gridDownsample';
import { createLampPacing, LAMP_SIZES, type ILampPacing } from './lampPacing';
import type {
  TLightingWorkerReply,
  TLightingWorkerRequest,
} from './lightingSceneMessages';

/**
 * The scene on the graph, drawn a second time, small, for the lamps.
 *
 * Its own context in its own thread rather than a read of the graph's pixels,
 * because the lamps have to keep going when the graph is not being drawn: on
 * another tab, behind a game, minimised. It draws when a frame arrives —
 * which is when the audio clock ticked — and answers with the grid, at the
 * size the GPU keeps in time (`lampPacing.ts`).
 *
 * A scene that will not compile here is reported and nothing more. The graph
 * has its own judgement of whether a scene works; the lighting falling back to
 * the scene's colours must never stop a scene the member can see.
 */

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<TLightingWorkerRequest>) => void) | null;
  postMessage(value: TLightingWorkerReply, transfer?: Transferable[]): void;
};

const [LARGEST_WIDTH, LARGEST_HEIGHT] = LAMP_SIZES[0];
const canvas = new OffscreenCanvas(LARGEST_WIDTH, LARGEST_HEIGHT);
const gl = canvas.getContext('webgl2', SCENE_CONTEXT_ATTRIBUTES);
const pixels = new Uint8Array(LARGEST_WIDTH * LARGEST_HEIGHT * 4);
const pixel = new Uint8Array(4);
const tuner = createSceneTuner();

let program: ISceneProgram | null = null;
let pack: IScenePack | null = null;
let params: Record<string, number> = {};
let generation = 0;
let lost = false;
/**
 * The scene the window last asked for, to load again when a lost context
 * comes back; null once its own frame is blamed for the loss.
 */
let wanted: { pack: IScenePack; guarded: boolean } | null = null;
/** How long the last frame held the GPU, for a loss right after it. */
let lastCostMs = 0;
/**
 * The flash limiter a member's scene is drawn through on the graph, drawn
 * through here too. Without it the lamps showed what the window never did: a
 * scene strobing at ten flashes a second, at arm's length, across a desk.
 */
let guard: IFlashGuard | null = null;
let pacing: ILampPacing = createLampPacing();
let compilation: AbortController | undefined;
/** Loads still running: the worker is ended only once none are. */
const running = new Set<Promise<void>>();

const fail = (packId: string, reason: string) =>
  scope.postMessage({ kind: 'failed', packId, reason });

const load = async (next: IScenePack, guarded: boolean) => {
  generation += 1;
  const mine = generation;
  wanted = { pack: next, guarded };
  compilation?.abort();
  const controller = new AbortController();
  compilation = controller;
  program?.dispose();
  program = null;
  pack = null;
  guard?.dispose();
  guard = null;
  pacing = createLampPacing();
  tuner.reset();
  if (!gl || lost) {
    // A lost context loads the scene when it comes back.
    if (!gl) {
      fail(next.id, 'no-context');
    }
    return;
  }
  if (guarded) {
    guard = createFlashGuard(gl);
    if (!guard) {
      // No limiter, no member's scene on the lamps: the swatch instead.
      fail(next.id, 'no-guard');
      return;
    }
  }
  let artwork: ImageBitmap | undefined;
  try {
    artwork = await decodeSceneArtwork(next);
    if (mine !== generation) {
      return;
    }
    // Awaited whether the compile answers at once or later: the scene
    // renderer is moving to linking its program without blocking the thread
    // it runs on, and a result read before it arrives is a promise, not a
    // program.
    const result = await Promise.resolve(
      compileScene(gl, next, artwork, controller.signal),
    );
    if (mine !== generation) {
      // Another scene was asked for while this one linked.
      if (result.ok) {
        result.program.dispose();
      }
      return;
    }
    if (!result.ok) {
      fail(next.id, 'compile');
      return;
    }
    program = result.program;
    pack = next;
    params = Object.fromEntries(
      next.params.map((param) => [param.id, param.value]),
    );
    scope.postMessage({ kind: 'loaded', packId: next.id });
  } catch {
    if (mine === generation) {
      fail(next.id, 'artwork');
    }
  } finally {
    artwork?.close();
  }
};

const track = (build: Promise<void>) => {
  const settled = build.catch(() => undefined);
  running.add(settled);
  settled.finally(() => running.delete(settled)).catch(() => undefined);
};

canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  lost = true;
  generation += 1;
  compilation?.abort();
  program = null;
  guard = null;
  // A loss right after a frame of the scene's own held the GPU was the
  // scene's (reported by that frame, `gpu-reset`); it does not come back.
  // Any other — sleep, a driver update, another program's crash — is not,
  // and the scene is loaded again once the context returns.
  if (lastCostMs > BLAMED_FRAME_MS) {
    wanted = null;
  }
  if (wanted) {
    scope.postMessage({ kind: 'lost', packId: wanted.pack.id });
  }
});

canvas.addEventListener('webglcontextrestored', () => {
  lost = false;
  lastCostMs = 0;
  if (wanted) {
    track(load(wanted.pack, wanted.guarded));
  }
});

const draw = (request: Extract<TLightingWorkerRequest, { kind: 'frame' }>) => {
  if (!gl || !program || lost) {
    // Always answered: the window draws one frame at a time and waits for
    // this reply, so silence here would stop the lamps for good.
    scope.postMessage({
      kind: 'failed',
      packId: pack?.id ?? '',
      reason: 'no-program',
    });
    return;
  }
  const heard: ISceneFrame = {
    ...request.frame,
    params,
  };
  const frame = tuner.apply(
    heard,
    request.frame.deltaMs,
    pack,
    params,
    undefined,
  );
  const [width, height] = pacing.size();
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const started = performance.now();
  guard?.begin(width, height);
  program.draw(frame, width, height);
  guard?.end(request.frame.deltaMs, null);
  // One pixel back waits for the GPU to finish this frame, so the time is
  // the GPU's, and each frame reaches it as its own job.
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  lastCostMs = performance.now() - started;
  if (gl.isContextLost()) {
    if (lastCostMs > BLAMED_FRAME_MS && pack) {
      // Lost while its own frame held the GPU: the reset was the scene's.
      // `lightingSceneClient.ts` keeps this session-only, by program.
      wanted = null;
      fail(pack.id, 'gpu-reset');
    }
    // Otherwise the loss event says so, and the scene comes back with the
    // context.
    return;
  }
  if (pacing.record(lastCostMs) === 'give-up') {
    // Holding the GPU even at the smallest size, frame after frame: the
    // lamps take the scene's colours instead, and the page does not hand
    // this scene back this session.
    const given = pack?.id ?? '';
    program.dispose();
    program = null;
    fail(given, 'too-heavy');
    return;
  }
  // Synchronous, and on purpose: this thread has nothing else to do, the
  // buffer is at most 1.3 MB, and the next draw would clear it.
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const rgb = downsampleToGrid(
    pixels,
    width,
    height,
    LIGHTING_GRID_WIDTH,
    LIGHTING_GRID_HEIGHT,
    new Uint8Array(LIGHTING_GRID_WIDTH * LIGHTING_GRID_HEIGHT * 3),
  );
  const preview = canvas.transferToImageBitmap();
  scope.postMessage(
    {
      kind: 'grid',
      rgb,
      preview,
      // What the scene answered to, after its own response — the lamps move
      // with the music the picture moved with.
      level: frame.level,
      beat: frame.beat,
      bass: frame.bands[0],
      mid: frame.bands[1],
      treble: frame.bands[2],
      deltaMs: request.frame.deltaMs,
      timeSeconds: request.frame.timeSeconds,
      activity: request.frame.activity ?? 1,
    },
    [preview, rgb.buffer],
  );
};

scope.onmessage = ({ data }) => {
  if (data.kind === 'load') {
    track(load(data.pack, data.guarded));
  } else if (data.kind === 'retire') {
    // Ended mid-link, this context would take the link down on the GPU
    // process's main thread and freeze the graph's scene with it
    // (`sceneCompile.ts`): give the load up, wait for its link, then go.
    generation += 1;
    wanted = null;
    compilation?.abort();
    Promise.all(running)
      .then(() => linksSettled())
      .finally(() => {
        program?.dispose();
        program = null;
        guard?.dispose();
        guard = null;
        scope.postMessage({ kind: 'retired' });
      })
      .catch(() => undefined);
  } else if (data.kind === 'frame') {
    draw(data);
  } else {
    generation += 1;
    wanted = null;
    compilation?.abort();
    program?.dispose();
    program = null;
    pack = null;
    guard?.dispose();
    guard = null;
  }
};
