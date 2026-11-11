/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from 'common/scenePacks';
import { readDemoMusic } from '../studio/publishDemoAudio';
import type { IFlashSummary } from './sceneFlashMeter';
import { readDemoFrames, type TDemoFrames } from './sceneFlashMusic';
import { pageAccent, startSceneStillWorker } from './sceneStillClient';
import type {
  TSceneStillReply,
  TSceneStillRequest,
} from './sceneStillMessages';

/**
 * How much of a scene flashes, for the review of a scene before it is
 * published (session 21's review screen, 2026-11-11): no scene's picture is
 * held back on screen any more, so this is where flashing is caught.
 *
 * The scene is played against one pass of the demo song - the drops in it
 * included, a minute at most, a short loop twice - worked out faster than it
 * plays (`sceneFlashMusic.ts`), drawn at a fixed small size so the answer is
 * the same on every machine, in a scene still worker of its own, and every
 * frame read by the flash meter (`sceneFlashMeter.ts`), whose verdict is the
 * one the review shows. Normal play never runs any of this.
 */

/** Drawn this size whatever the panel: the answer is a share of the view. */
export const FLASH_MEASURE_WIDTH = 480;
export const FLASH_MEASURE_HEIGHT = 270;

export interface IFlashMeasureOptions {
  /** Ends the measurement: the answer is then `aborted`. */
  signal?: AbortSignal;
  /** Frames drawn so far, from the first second. */
  onProgress?: (progress: { framesDone: number; framesTotal: number }) => void;
  /** The time of day, 0 night to 100 day; the scene's own when absent. */
  daylight?: number;
}

export type TFlashMeasurement =
  | ({
      ok: true;
      /** PNGs about 320 px wide around the worst moment, oldest first. */
      filmstrip?: Uint8Array[];
      /** The worst moment's PNG, which is also in the filmstrip. */
      worstFrame?: Uint8Array;
      /** Where in the filmstrip the worst moment is. */
      worstInFilmstrip?: number;
    } & IFlashSummary)
  | {
      ok: false;
      reason: 'compile' | 'unavailable' | 'aborted';
      /** For `compile`: the driver's own words. */
      log?: string;
    };

/** What a measurement is made with: the real ones, or a test's. */
export interface IFlashMeasureParts {
  readMusic(): Promise<Uint8Array | undefined>;
  readFrames(
    bytes: Uint8Array,
    accent: readonly [number, number, number],
    signal?: AbortSignal,
  ): Promise<TDemoFrames>;
  accent(): readonly [number, number, number];
  startWorker(): Worker;
}

const UNAVAILABLE: TFlashMeasurement = { ok: false, reason: 'unavailable' };
const ABORTED: TFlashMeasurement = { ok: false, reason: 'aborted' };

export const createFlashMeasurer =
  (parts: IFlashMeasureParts) =>
  async (
    pack: IScenePack,
    { signal, onProgress, daylight }: IFlashMeasureOptions = {},
  ): Promise<TFlashMeasurement> => {
    if (signal?.aborted) {
      return ABORTED;
    }
    const bytes = await parts.readMusic().catch(() => undefined);
    if (signal?.aborted) {
      return ABORTED;
    }
    if (!bytes) {
      return UNAVAILABLE;
    }
    const demo = await parts.readFrames(bytes, parts.accent(), signal);
    if (!demo.ok) {
      return { ok: false, reason: demo.reason };
    }
    if (signal?.aborted) {
      return ABORTED;
    }
    onProgress?.({ framesDone: 0, framesTotal: demo.frames.length });
    let worker: Worker;
    try {
      worker = parts.startWorker();
    } catch {
      return UNAVAILABLE;
    }
    return new Promise((resolve) => {
      let done = false;
      const finish = (answer: TFlashMeasurement) => {
        if (done) {
          return;
        }
        done = true;
        worker.terminate();
        signal?.removeEventListener('abort', onAbort);
        resolve(answer);
      };
      const onAbort = () => finish(ABORTED);
      signal?.addEventListener('abort', onAbort, { once: true });
      worker.onerror = () => finish(UNAVAILABLE);
      worker.onmessageerror = () => finish(UNAVAILABLE);
      worker.onmessage = ({ data }: MessageEvent<TSceneStillReply>) => {
        if (data.kind === 'flash-progress') {
          onProgress?.({
            framesDone: data.framesDone,
            framesTotal: data.framesTotal,
          });
          return;
        }
        if (data.kind !== 'flash') {
          return;
        }
        const { summary, filmstrip, worst, log } = data;
        if (!summary) {
          finish(log ? { ok: false, reason: 'compile', log } : UNAVAILABLE);
          return;
        }
        Promise.all(
          (filmstrip ?? []).map(
            async (blob) => new Uint8Array(await blob.arrayBuffer()),
          ),
        )
          .then((pictures) => {
            const kept = filmstrip && worst !== undefined && pictures[worst];
            finish({
              ok: true,
              ...summary,
              ...(kept
                ? {
                    filmstrip: pictures,
                    worstFrame: kept,
                    worstInFilmstrip: worst,
                  }
                : {}),
            });
            return undefined;
          })
          .catch(() => finish({ ok: true, ...summary }));
      };
      const request: TSceneStillRequest = {
        kind: 'flash',
        id: 1,
        pack,
        ...(daylight !== undefined ? { daylight } : {}),
        frames: demo.frames,
        width: FLASH_MEASURE_WIDTH,
        height: FLASH_MEASURE_HEIGHT,
      };
      try {
        worker.postMessage(request);
      } catch {
        finish(UNAVAILABLE);
      }
    });
  };

/**
 * Measures `pack` against the demo song. Never throws: a scene that will not
 * build is `compile` with the driver's words, a machine or a scene that
 * cannot draw it `unavailable`, and a measurement given up on `aborted`.
 */
export const measureSceneFlashing = createFlashMeasurer({
  readMusic: readDemoMusic,
  readFrames: readDemoFrames,
  accent: pageAccent,
  startWorker: startSceneStillWorker,
});
