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
import {
  compileScene,
  type ISceneFrame,
  type ISceneProgram,
} from '../graph/sceneGl';
import { SCENE_CONTEXT_ATTRIBUTES } from '../graph/sceneHealth';
import { createSceneTuner } from '../graph/sceneTuner';
import { downsampleToGrid } from './gridDownsample';
import {
  LIGHTING_RENDER_HEIGHT,
  LIGHTING_RENDER_WIDTH,
  type TLightingWorkerReply,
  type TLightingWorkerRequest,
} from './lightingSceneMessages';

/**
 * The scene on the graph, drawn a second time, small, for the lamps.
 *
 * Its own context in its own thread rather than a read of the graph's pixels,
 * because the lamps have to keep going when the graph is not being drawn: on
 * another tab, behind a game, minimised. It draws when a frame arrives —
 * which is when the audio clock ticked — and answers with the grid.
 *
 * A scene that will not compile here is reported and nothing more. The graph
 * has its own judgement of whether a scene works; the lighting falling back to
 * the scene's colours must never quarantine a scene the member can see.
 */

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<TLightingWorkerRequest>) => void) | null;
  postMessage(value: TLightingWorkerReply): void;
};

const canvas = new OffscreenCanvas(
  LIGHTING_RENDER_WIDTH,
  LIGHTING_RENDER_HEIGHT,
);
const gl = canvas.getContext('webgl2', SCENE_CONTEXT_ATTRIBUTES);
const pixels = new Uint8Array(
  LIGHTING_RENDER_WIDTH * LIGHTING_RENDER_HEIGHT * 4,
);
const tuner = createSceneTuner();

let program: ISceneProgram | null = null;
let pack: IScenePack | null = null;
let params: Record<string, number> = {};
let generation = 0;
let lost = false;

const fail = (packId: string, reason: string) =>
  scope.postMessage({ kind: 'failed', packId, reason });

canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  lost = true;
  program = null;
  if (pack) {
    fail(pack.id, 'context-lost');
  }
});

const load = async (next: IScenePack) => {
  generation += 1;
  const mine = generation;
  program?.dispose();
  program = null;
  pack = null;
  tuner.reset();
  if (!gl || lost) {
    fail(next.id, 'no-context');
    return;
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
    const result = await Promise.resolve(compileScene(gl, next, artwork));
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
  program.draw(frame, LIGHTING_RENDER_WIDTH, LIGHTING_RENDER_HEIGHT);
  // Synchronous, and on purpose: this thread has nothing else to do, the
  // buffer is a sixth of a megabyte, and the next draw would clear it.
  gl.readPixels(
    0,
    0,
    LIGHTING_RENDER_WIDTH,
    LIGHTING_RENDER_HEIGHT,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixels,
  );
  const rgb = downsampleToGrid(
    pixels,
    LIGHTING_RENDER_WIDTH,
    LIGHTING_RENDER_HEIGHT,
    LIGHTING_GRID_WIDTH,
    LIGHTING_GRID_HEIGHT,
    new Uint8Array(LIGHTING_GRID_WIDTH * LIGHTING_GRID_HEIGHT * 3),
  );
  scope.postMessage({
    kind: 'grid',
    rgb,
    // What the scene answered to, after its own response — the lamps move
    // with the music the picture moved with.
    level: frame.level,
    beat: frame.beat,
    bass: frame.bands[0],
    mid: frame.bands[1],
    treble: frame.bands[2],
    deltaMs: request.frame.deltaMs,
  });
};

scope.onmessage = ({ data }) => {
  if (data.kind === 'load') {
    load(data.pack).catch(() => undefined);
  } else if (data.kind === 'frame') {
    draw(data);
  } else {
    generation += 1;
    program?.dispose();
    program = null;
    pack = null;
  }
};
