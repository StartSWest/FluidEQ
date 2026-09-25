/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from 'common/scenePacks';
import type { ISceneRhythm } from 'common/sceneRhythm';

/**
 * What the window and the lighting scene worker say to each other. Plain
 * values only: the worker imports this file, and has none of the window's
 * globals.
 */

/** Ticks per second of audio. Past thirty, lamps are faster than the devices. */
export const LIGHTING_TICKS_PER_SECOND = 30;

export interface ILightingSceneFrame {
  timeSeconds: number;
  deltaMs: number;
  level: number;
  beat: number;
  bands: [number, number, number];
  /** The big moment and its number, as the listener heard them. */
  musicAccent: [number, number];
  /** The flywheel the music winds: turns, and turns a second. */
  musicRun: [number, number];
  /** The music's time, drums and shape (`sceneRhythm.ts`). */
  rhythm: ISceneRhythm;
  /** The singing voice: how open, the note, how sure (`voiceReading.ts`). */
  voice?: [number, number, number];
  accent: [number, number, number];
  fade: number;
  spectrum: Uint8Array;
  waveform: Uint8Array;
  activity?: number;
}

export type TLightingWorkerRequest =
  /**
   * `guarded`: a member's scene, drawn through the flash limiter. `id`
   * numbers the load, so its answer is told apart from one about the
   * program still being drawn — a new version of a scene has its pack id.
   */
  | { kind: 'load'; pack: IScenePack; guarded: boolean; id: number }
  | { kind: 'frame'; frame: ILightingSceneFrame }
  /** Give up any load, free everything, then answer `retired`. */
  | { kind: 'retire' }
  | { kind: 'unload' };

export type TLightingWorkerReply =
  | { kind: 'loaded'; packId: string; id: number }
  /** Nothing is linking and nothing is held: the worker may be ended. */
  | { kind: 'retired' }
  /**
   * The scene cannot be drawn here; the lamps fall back to its swatch.
   * `gpu-reset` (its own frame held the GPU when the context was lost) and
   * `too-heavy` (holding it even at the smallest size) are the GPU refusing
   * it, and it is not loaded again this session. With `id`, the load of
   * that number failed; without, the program that was being drawn did.
   * Either way nothing is drawn any more.
   */
  | { kind: 'failed'; packId: string; reason: string; id?: number }
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
