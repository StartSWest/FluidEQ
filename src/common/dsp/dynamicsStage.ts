/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Dynamics: the rack's upward and downward compressor, in three bands
 * (`compander.h` in the engine, where the reasons are written out). Named
 * `dynamicsStage` because `dynamics` is already the EQ's per-band logic.
 *
 * Every range here is the engine's own clamp and decoder bound, so a value
 * the app writes is one the engine reads as written.
 */

export const DYNAMICS_BANDS = 3;

/** Under 150 Hz, 150 Hz to 4 kHz, over 4 kHz: the engine's fixed splits. */
export const DYNAMICS_SPLITS_HZ = [150, 4000] as const;

export interface IDynamicsBand {
  /** dBFS: under it the band is lifted. */
  upThresholdDb: number;
  /** 1 to 4; 1 lifts nothing. */
  upRatio: number;
  /** The most the band is ever lifted, dB. */
  upMaxDb: number;
  /** dBFS: over it the band is held down. */
  downThresholdDb: number;
  /** 1 to 20; 1 holds nothing. */
  downRatio: number;
}

export interface IDynamicsSettings {
  enabled: boolean;
  /** The profile it came from, or empty once edited. */
  presetId: string;
  bands: [IDynamicsBand, IDynamicsBand, IDynamicsBand];
  attackMs: number;
  releaseMs: number;
  /** 0 to 1: how much of the processed sound replaces the input. */
  mix: number;
  /**
   * dB on the processed sound, so a profile that holds more than it lifts is
   * not simply quieter (or louder) than the sound it was given.
   */
  makeupDb: number;
}

export const DYNAMICS_RANGES = {
  upThresholdDb: { min: -80, max: -10 },
  upRatio: { min: 1, max: 4 },
  upMaxDb: { min: 0, max: 18 },
  downThresholdDb: { min: -60, max: 0 },
  downRatio: { min: 1, max: 20 },
  attackMs: { min: 1, max: 100 },
  releaseMs: { min: 20, max: 1000 },
  mix: { min: 0, max: 1 },
  makeupDb: { min: -12, max: 12 },
} as const;

const NEUTRAL_BAND: IDynamicsBand = {
  upThresholdDb: -40,
  upRatio: 1,
  upMaxDb: 0,
  downThresholdDb: -20,
  downRatio: 1,
};

/** Off, every ratio at one: the input exactly, as the engine's defaults. */
export const DYNAMICS_DEFAULTS: IDynamicsSettings = {
  enabled: false,
  presetId: '',
  bands: [{ ...NEUTRAL_BAND }, { ...NEUTRAL_BAND }, { ...NEUTRAL_BAND }],
  attackMs: 10,
  releaseMs: 200,
  mix: 1,
  makeupDb: 0,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const clampNumber = (
  value: unknown,
  range: { min: number; max: number },
  fallback: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, range.min), range.max)
    : fallback;

const clampBand = (value: unknown): IDynamicsBand => {
  const stored = isRecord(value) ? value : {};
  const r = DYNAMICS_RANGES;
  return {
    upThresholdDb: clampNumber(
      stored.upThresholdDb,
      r.upThresholdDb,
      NEUTRAL_BAND.upThresholdDb,
    ),
    upRatio: clampNumber(stored.upRatio, r.upRatio, NEUTRAL_BAND.upRatio),
    upMaxDb: clampNumber(stored.upMaxDb, r.upMaxDb, NEUTRAL_BAND.upMaxDb),
    downThresholdDb: clampNumber(
      stored.downThresholdDb,
      r.downThresholdDb,
      NEUTRAL_BAND.downThresholdDb,
    ),
    downRatio: clampNumber(
      stored.downRatio,
      r.downRatio,
      NEUTRAL_BAND.downRatio,
    ),
  };
};

/**
 * Anything stored, held to the engine's ranges. A rack saved before the stage
 * existed reads as one with it off and every band neutral.
 */
export const clampDynamicsSettings = (value: unknown): IDynamicsSettings => {
  const stored = isRecord(value) ? value : {};
  const bands = Array.isArray(stored.bands) ? stored.bands : [];
  const r = DYNAMICS_RANGES;
  return {
    enabled: stored.enabled === true,
    presetId: typeof stored.presetId === 'string' ? stored.presetId : '',
    bands: [clampBand(bands[0]), clampBand(bands[1]), clampBand(bands[2])],
    attackMs: clampNumber(
      stored.attackMs,
      r.attackMs,
      DYNAMICS_DEFAULTS.attackMs,
    ),
    releaseMs: clampNumber(
      stored.releaseMs,
      r.releaseMs,
      DYNAMICS_DEFAULTS.releaseMs,
    ),
    mix: clampNumber(stored.mix, r.mix, DYNAMICS_DEFAULTS.mix),
    makeupDb: clampNumber(
      stored.makeupDb,
      r.makeupDb,
      DYNAMICS_DEFAULTS.makeupDb,
    ),
  };
};
