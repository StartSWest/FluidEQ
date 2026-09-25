/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SCENE_TIME_WRAP_S } from 'common/sceneUniformContract';

/**
 * The clock a scene is drawn on, kept by the scene worker: only the worker is
 * still drawing while the page is stalled, so only it can say how much time
 * each picture stands for.
 */

/**
 * The most the scene's clock advances on one frame. A stall longer than this
 * is not motion to catch up on: the page used to clamp its own clock here for
 * the same reason, and the worker filling the stall in makes it moot.
 */
const MAX_TIME_STEP_MS = 100;

export interface ISceneDrawClock {
  /** When the last frame was drawn, by the worker's own animation clock. */
  drawnAt(): number | undefined;
  /** The interval frames are actually being drawn at: what the page is told. */
  intervalMs(): number | undefined;
  /**
   * Moves the clock on for a frame drawn at `now`. `pageDeltaMs` is the
   * page's own step, used only for the first frame after a pause.
   */
  advance(
    now: number,
    pageDeltaMs: number | undefined,
  ): { timeSeconds: number; deltaMs: number };
  /** Nothing drawn until the next frame, which is drawn at once. */
  pause(): void;
  /** A different scene starts from the beginning of its clock. */
  restart(): void;
}

export const createSceneDrawClock = (): ISceneDrawClock => {
  let drawnAt: number | undefined;
  let intervalMs: number | undefined;
  let sceneTimeS = 0;
  return {
    drawnAt: () => drawnAt,
    intervalMs: () => intervalMs,
    advance: (now, pageDeltaMs) => {
      // By what passed since the last frame drawn here, on the worker's own
      // animation clock: one refresh, or the refreshes a skipped or held
      // frame spanned, never the page's stumbles.
      const stepMs =
        drawnAt === undefined
          ? Math.min(MAX_TIME_STEP_MS, pageDeltaMs ?? 0)
          : Math.min(MAX_TIME_STEP_MS, Math.max(0, now - drawnAt));
      sceneTimeS = (sceneTimeS + stepMs / 1000) % SCENE_TIME_WRAP_S;
      if (drawnAt !== undefined) {
        intervalMs = now - drawnAt;
      }
      drawnAt = now;
      return { timeSeconds: sceneTimeS, deltaMs: stepMs };
    },
    pause: () => {
      drawnAt = undefined;
      intervalMs = undefined;
    },
    restart: () => {
      sceneTimeS = 0;
      drawnAt = undefined;
    },
  };
};
