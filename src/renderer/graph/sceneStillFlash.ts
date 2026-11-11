/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createFlashMeter,
  createFlashTally,
  type IFlashSummary,
} from './sceneFlashMeter';
import { createFilmstripKeeper, flipRows } from './sceneFlashStrip';
import { watchDraws, type IBuiltScene } from './sceneStillKeep';
import type {
  TSceneStillRefusal,
  TSceneStillRequest,
} from './sceneStillMessages';
import { createSceneTuner } from './sceneTuner';

/**
 * The review's flash measurement as the scene still worker runs it
 * (`sceneStill.worker.ts`): the demo song's frames played through the
 * scene's own response and at its controls' values, as the graph would draw
 * them and as the showcase pictures are drawn (`sceneShowcaseRun.ts`), each
 * drawn under the same watch as a picture's frames, read back in the task
 * that drew it and handed to the meter.
 */

/** Progress is told every this many frames: a second of music. */
const PROGRESS_EVERY = 30;
/** The filmstrip's pictures are this wide, their height in proportion. */
const STRIP_WIDTH = 320;
const FALLBACK_STEP_MS = 1000 / 30;

/** One kept frame as a small PNG, the right way up. */
const encodeStripFrame = async (
  pixels: Uint8Array,
  width: number,
  height: number,
): Promise<Blob | undefined> => {
  const full = new OffscreenCanvas(width, height);
  const fullContext = full.getContext('2d');
  const small = new OffscreenCanvas(
    STRIP_WIDTH,
    Math.max(1, Math.round((STRIP_WIDTH * height) / width)),
  );
  const smallContext = small.getContext('2d');
  if (!fullContext || !smallContext) {
    return undefined;
  }
  fullContext.putImageData(
    new ImageData(flipRows(pixels, width, height), width, height),
    0,
    0,
  );
  smallContext.drawImage(full, 0, 0, small.width, small.height);
  return small.convertToBlob({ type: 'image/png' });
};

export interface IStillFlashResult {
  summary?: IFlashSummary;
  filmstrip?: Blob[];
  worst?: number;
}

export const measureBuiltFlashing = async (
  built: IBuiltScene,
  request: Extract<TSceneStillRequest, { kind: 'flash' }>,
  refuse: (reason: TSceneStillRefusal) => void,
  progress: (framesDone: number, framesTotal: number) => void,
): Promise<IStillFlashResult> => {
  const { gl, program } = built;
  const { pack, frames, width, height, daylight } = request;
  const watch = watchDraws(gl, program, refuse);
  const meter = createFlashMeter(width, height);
  const tally = createFlashTally();
  const pixels = new Uint8Array(width * height * 4);
  const keeper = createFilmstripKeeper(pixels.length);
  const tuner = createSceneTuner();
  const base = Object.fromEntries(
    pack.params.map((param) => [param.id, param.value]),
  );
  try {
    for (let index = 0; index < frames.length; index += 1) {
      const heard = frames[index];
      const stepMs = heard.deltaMs ?? FALLBACK_STEP_MS;
      const frame = tuner.apply(heard, stepMs, pack, base, undefined, daylight);
      if (!watch(frame, width, height)) {
        return {};
      }
      // Read in the task that drew it: without a preserved buffer the frame
      // is only guaranteed to be there until this task ends.
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const reading = meter.frame(pixels, stepMs);
      tally.add(reading, heard.musicSeconds ?? heard.timeSeconds);
      keeper.push(pixels, reading.area);
      if ((index + 1) % PROGRESS_EVERY === 0 || index === frames.length - 1) {
        progress(index + 1, frames.length);
      }
    }
  } finally {
    program.dispose();
  }
  const strip = keeper.strip();
  const encoded = await Promise.all(
    strip.frames.map((kept) => encodeStripFrame(kept, width, height)),
  );
  const filmstrip = encoded.filter((blob): blob is Blob => blob !== undefined);
  return {
    summary: tally.summary(),
    ...(filmstrip.length === encoded.length
      ? { filmstrip, worst: strip.worst }
      : {}),
  };
};
