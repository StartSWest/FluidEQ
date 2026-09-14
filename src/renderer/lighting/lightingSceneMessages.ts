/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from 'common/scenePacks';

/**
 * What the window and the lighting scene worker say to each other, and the
 * names the audio clock and the worker are registered under. Plain values
 * only: the worklet and the worker both import this file, and neither scope
 * has the window's globals.
 */

export const LIGHTING_CLOCK_PROCESSOR = 'fluideq-lighting-clock';

/** Ticks per second of audio. Past thirty, lamps are faster than the devices. */
export const LIGHTING_TICKS_PER_SECOND = 30;

export interface ILightingSceneFrame {
  timeSeconds: number;
  deltaMs: number;
  level: number;
  beat: number;
  bands: [number, number, number];
  accent: [number, number, number];
  fade: number;
  spectrum: Uint8Array;
  waveform: Uint8Array;
  activity?: number;
}

export type TLightingWorkerRequest =
  /** `guarded`: a member's scene, drawn through the flash limiter. */
  | { kind: 'load'; pack: IScenePack; guarded: boolean }
  | { kind: 'frame'; frame: ILightingSceneFrame }
  /** Give up any load, free everything, then answer `retired`. */
  | { kind: 'retire' }
  | { kind: 'unload' };

export type TLightingWorkerReply =
  | { kind: 'loaded'; packId: string }
  /** Nothing is linking and nothing is held: the worker may be ended. */
  | { kind: 'retired' }
  /**
   * The scene cannot be drawn here; the lamps fall back to its swatch.
   * `gpu-reset` (its own frame held the GPU when the context was lost) and
   * `too-heavy` (holding it even at the smallest size) are the GPU refusing
   * it, and it is not loaded again this session.
   */
  | { kind: 'failed'; packId: string; reason: string }
  /**
   * The context was lost for a reason that was not the scene's: nothing is
   * drawn until it comes back, and then the scene is loaded again and
   * `loaded` follows.
   */
  | { kind: 'lost'; packId: string }
  | {
      kind: 'grid';
      rgb: Uint8Array;
      preview: ImageBitmap;
      level: number;
      beat: number;
      bass: number;
      mid: number;
      treble: number;
      deltaMs: number;
      timeSeconds: number;
      activity: number;
    };
