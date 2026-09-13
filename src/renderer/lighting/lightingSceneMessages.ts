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

/**
 * The size a scene is drawn at for the lamps. Small enough to cost nothing
 * beside the graph; large enough that a lit window in a skyline is still a
 * few pixels and not averaged away. Sixteen times the lamp grid also gives the
 * desk's monitor a sharp image instead of enlarging the 48-pixel LED grid.
 */
export const LIGHTING_RENDER_WIDTH = 768;
export const LIGHTING_RENDER_HEIGHT = 432;

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
  | { kind: 'load'; pack: IScenePack }
  | { kind: 'frame'; frame: ILightingSceneFrame }
  | { kind: 'unload' };

export type TLightingWorkerReply =
  | { kind: 'loaded'; packId: string }
  /** The scene cannot be drawn here; the lamps fall back to its swatch. */
  | { kind: 'failed'; packId: string; reason: string }
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
