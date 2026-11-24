/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A microphone's Reverb (engine 1.33, `reverb.h`): a plate after Dynamics
 * and before the Maximizer, wet only, so the dry voice keeps its timing and
 * the rack its delay (Ivan, 2026-11-22: "add a reverb filter with nice
 * plates and more for singing"). Only a mic's rack carries one.
 */

export const REVERB_TYPES = [
  'plate',
  'vocalPlate',
  'room',
  'chamber',
  'hall',
] as const;
export type TReverbType = (typeof REVERB_TYPES)[number];

export interface IReverbSettings {
  enabled: boolean;
  type: TReverbType;
  /** The tail against the dry voice, dB. */
  mixDb: number;
  /** RT60, seconds. */
  decayS: number;
  predelayMs: number;
  /** The tank's damping corner: lower is darker. */
  toneHz: number;
  /** A high-pass on what feeds the tail, so the voice's mud stays out. */
  lowCutHz: number;
  /** 0 to 1: how far apart the tail's sides are on a stereo mic. */
  width: number;
  /** The tail comes down while the voice is heard and blooms in its gaps. */
  duck: boolean;
  duckDb: number;
}

/** The engine's own ranges (`FEQ_REVERB_*`). */
export const REVERB_RANGES = {
  mixDb: { min: -40, max: 0 },
  decayS: { min: 0.2, max: 8 },
  predelayMs: { min: 0, max: 150 },
  toneHz: { min: 2000, max: 16000 },
  lowCutHz: { min: 80, max: 500 },
  width: { min: 0, max: 1 },
  duckDb: { min: 0, max: 24 },
} as const;

/** The engine's defaults (`feq_reverb_settings_defaults`), off. */
export const REVERB_DEFAULTS: IReverbSettings = {
  enabled: false,
  type: 'plate',
  mixDb: -16,
  decayS: 1.8,
  predelayMs: 30,
  toneHz: 8000,
  lowCutHz: 200,
  width: 1,
  duck: false,
  duckDb: 8,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isReverbType = (value: unknown): value is TReverbType =>
  typeof value === 'string' &&
  (REVERB_TYPES as readonly string[]).includes(value);

const within = (
  value: unknown,
  range: { min: number; max: number },
  fallback: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(range.max, Math.max(range.min, value))
    : fallback;

/** A stored or sent Reverb read back inside the ranges the engine takes. */
export const clampReverbSettings = (value: unknown): IReverbSettings => {
  if (!isRecord(value)) {
    return { ...REVERB_DEFAULTS };
  }
  const d = REVERB_DEFAULTS;
  const r = REVERB_RANGES;
  return {
    enabled: value.enabled === true,
    type: isReverbType(value.type) ? value.type : d.type,
    mixDb: within(value.mixDb, r.mixDb, d.mixDb),
    decayS: within(value.decayS, r.decayS, d.decayS),
    predelayMs: within(value.predelayMs, r.predelayMs, d.predelayMs),
    toneHz: within(value.toneHz, r.toneHz, d.toneHz),
    lowCutHz: within(value.lowCutHz, r.lowCutHz, d.lowCutHz),
    width: within(value.width, r.width, d.width),
    duck: value.duck === true,
    duckDb: within(value.duckDb, r.duckDb, d.duckDb),
  };
};
