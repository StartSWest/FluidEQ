/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SMOOTH_FRAME_MS } from 'common/smoothing';

/**
 * A scene at rest: thirty frames a second once nothing has played for a
 * while.
 *
 * A visualizer left open on a laptop with the music stopped kept drawing at
 * the display's rate — a 4K scene at a hundred and forty-four frames a second
 * for an ambient drift nobody was watching, and the GPU's whole budget with
 * it. Ambient motion at thirty reads the same; what it costs is halved or
 * better. The first frame with sound in it ends the rest at once, so the
 * beat that starts a song is drawn at full rate, and the ten seconds before
 * resting are so a gap between tracks is not a visible change of pace.
 *
 * Nothing here has a timer: silence is judged on the frames as they are
 * drawn, from their own timestamps, and a loop that has stopped drawing has
 * nothing left to rest.
 */

/** Silence this long before the rate is eased: a gap between tracks is shorter. */
export const SCENE_REST_AFTER_MS = 10000;

/** The rate a resting scene is held to. */
export const SCENE_REST_PACE_MS = SMOOTH_FRAME_MS;

/**
 * The waveform's peak below which a frame is silent: −50 dBFS, under any
 * hum or dither a sound card leaves on an idle output, and forty decibels
 * under the quietest passage of a mastered track.
 */
export const SCENE_SILENCE_PEAK = 0.003;

/** Whether a frame's waveform — per-bucket peaks, 0..1 — carries no sound. */
export const isSilentWaveform = (waveform: readonly number[]): boolean =>
  waveform.every((peak) => Math.abs(peak) < SCENE_SILENCE_PEAK);

export interface IRestWatch {
  /**
   * One drawn frame, at `nowMs`, with or without sound in it. Returns
   * whether the scene is resting after it.
   */
  frame(nowMs: number, silent: boolean): boolean;
  resting(): boolean;
  reset(): void;
}

export const createRestWatch = (): IRestWatch => {
  let silentSinceMs: number | undefined;
  let resting = false;
  return {
    frame: (nowMs, silent) => {
      if (!silent) {
        silentSinceMs = undefined;
        resting = false;
      } else {
        silentSinceMs ??= nowMs;
        resting = nowMs - silentSinceMs >= SCENE_REST_AFTER_MS;
      }
      return resting;
    },
    resting: () => resting,
    reset: () => {
      silentSinceMs = undefined;
      resting = false;
    },
  };
};
