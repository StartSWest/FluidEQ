/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * What the DSP chain is, as data.
 *
 * Declarative because two very different things build from it: the live
 * `AudioContext` graph the player hears, and the `OfflineAudioContext` that
 * renders a file. A single shape both of them read is the only thing that
 * keeps those two from drifting apart, and a drift there is silent — the
 * exported file simply does not sound like what was auditioned.
 *
 * None of this reaches Equalizer APO, and it cannot. Every APO command is
 * linear, and neither compression nor a generated harmonic is. That is the
 * reason this module exists rather than another layer in `apoRender.ts`.
 *
 * Everything defaults to bypassed. A DSP tab that colours the sound the
 * moment it is opened is one the user did not ask for.
 */

export interface IExciterSettings {
  enabled: boolean;
  /** Corner above which harmonics are generated, Hz. */
  crossoverHz: number;
  /** Shaper drive. 1 is nearly linear, 10 is obvious. */
  drive: number;
  /** How much of the shaped band is mixed back, 0-1. */
  mix: number;
}

export interface IBandSettings {
  thresholdDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  makeupDb: number;
}

export interface ICompressorSettings {
  enabled: boolean;
  /** The two crossover corners that make three bands, Hz, ascending. */
  crossoverHz: readonly [number, number];
  /** Per band, low to high. Always three. */
  bands: readonly IBandSettings[];
}

export interface IMaximizerSettings {
  enabled: boolean;
  /** Output ceiling in dBFS. Never above 0. */
  ceilingDb: number;
  /**
   * Look-ahead in milliseconds.
   *
   * Not cosmetic: it is the entire difference between a limiter that has
   * already turned down when the transient arrives and one that clips it.
   */
  lookAheadMs: number;
  releaseMs: number;
}

/**
 * One EQ band.
 *
 * `type` is `FilterTypeEnum`'s string, not the enum itself — this shape is
 * JSON in `localStorage` and crosses a worklet port, and a stored string that
 * no longer names a member has to survive being read by a later build.
 * `clampEqBand` is what turns it back into something trusted.
 */
export interface IEqBandSettings {
  enabled: boolean;
  type: string;
  frequency: number;
  gainDb: number;
  quality: number;
}

export interface IEqSettings {
  enabled: boolean;
  /** Always `EQ_BAND_COUNT` of them, whatever was stored. */
  bands: readonly IEqBandSettings[];
  /**
   * The factory preset last applied, or empty for a hand-made curve.
   *
   * Stored rather than derived so it survives a reload: the bands alone cannot
   * say whether a curve came from "Rock" or was dialled in by hand, and coming
   * back to a session with the picker blank makes the app look like it forgot.
   * Cleared the moment a band is touched, because at that point it did.
   */
  presetId: string;
}

/**
 * Fifteen, fixed.
 *
 * Not a list the user can grow: a fixed rack is what every hardware EQ worth
 * copying does, it keeps the page a predictable size, and the stored shape
 * never has to describe how many there were.
 *
 * Fifteen cascaded biquads is well within budget — 15 × 2 channels × 5
 * multiply-adds is about 7 million operations a second at 48 kHz, against a
 * render quantum's budget of far more — and each one keeps its state in a
 * JavaScript number, which is float64. Precision does not degrade down the
 * chain the way it would in a 32-bit fixed-point cascade.
 */
export const EQ_BAND_COUNT = 15;

export interface IDspSettings {
  eq: IEqSettings;
  exciter: IExciterSettings;
  compressor: ICompressorSettings;
  maximizer: IMaximizerSettings;
}

interface IRange {
  min: number;
  max: number;
}

const RANGES = {
  exciterCrossoverHz: { min: 1_000, max: 12_000 },
  exciterDrive: { min: 1, max: 10 },
  exciterMix: { min: 0, max: 1 },
  compressorLowHz: { min: 60, max: 600 },
  compressorHighHz: { min: 1_000, max: 10_000 },
  thresholdDb: { min: -60, max: 0 },
  ratio: { min: 1, max: 20 },
  attackMs: { min: 0.1, max: 200 },
  releaseMs: { min: 5, max: 2_000 },
  makeupDb: { min: 0, max: 24 },
  ceilingDb: { min: -12, max: 0 },
  lookAheadMs: { min: 0, max: 20 },
  maximizerReleaseMs: { min: 5, max: 1_000 },
  eqFrequency: { min: 20, max: 20_000 },
  eqGainDb: { min: -24, max: 24 },
  eqQuality: { min: 0.1, max: 18 },
} as const satisfies Record<string, IRange>;

const clampNumber = (
  value: unknown,
  range: IRange,
  fallback: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(range.max, Math.max(range.min, value))
    : fallback;

const clampBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const DEFAULT_BAND: IBandSettings = {
  thresholdDb: -18,
  ratio: 2,
  attackMs: 10,
  releaseMs: 120,
  makeupDb: 0,
};

/**
 * The six bands, spread the way a mixing desk lays them out.
 *
 * Shelves at the ends and bells between, spaced roughly two octaves apart so
 * every band starts somewhere useful and none of them start on top of each
 * other. All at 0 dB, so opening the EQ changes nothing until something is
 * moved.
 */
const DEFAULT_EQ_BANDS: readonly IEqBandSettings[] = [
  { enabled: true, type: 'LSC', frequency: 32, gainDb: 0, quality: 0.7 },
  { enabled: true, type: 'PK', frequency: 50, gainDb: 0, quality: 1.4 },
  { enabled: true, type: 'PK', frequency: 80, gainDb: 0, quality: 1.4 },
  { enabled: true, type: 'PK', frequency: 125, gainDb: 0, quality: 1.4 },
  { enabled: true, type: 'PK', frequency: 200, gainDb: 0, quality: 1.4 },
  { enabled: true, type: 'PK', frequency: 315, gainDb: 0, quality: 1.4 },
  { enabled: true, type: 'PK', frequency: 500, gainDb: 0, quality: 1.4 },
  { enabled: true, type: 'PK', frequency: 800, gainDb: 0, quality: 1.4 },
  { enabled: true, type: 'PK', frequency: 1_250, gainDb: 0, quality: 1.4 },
  { enabled: true, type: 'PK', frequency: 2_000, gainDb: 0, quality: 1.4 },
  { enabled: true, type: 'PK', frequency: 3_150, gainDb: 0, quality: 1.4 },
  { enabled: true, type: 'PK', frequency: 5_000, gainDb: 0, quality: 1.4 },
  { enabled: true, type: 'PK', frequency: 8_000, gainDb: 0, quality: 1.4 },
  { enabled: true, type: 'PK', frequency: 12_500, gainDb: 0, quality: 1.4 },
  { enabled: true, type: 'HSC', frequency: 16_000, gainDb: 0, quality: 0.7 },
];

export const DSP_DEFAULTS: IDspSettings = {
  eq: { enabled: false, bands: DEFAULT_EQ_BANDS, presetId: '' },
  exciter: { enabled: false, crossoverHz: 6_000, drive: 3, mix: 0.3 },
  compressor: {
    enabled: false,
    crossoverHz: [200, 3_000],
    bands: [DEFAULT_BAND, DEFAULT_BAND, DEFAULT_BAND],
  },
  maximizer: {
    enabled: false,
    ceilingDb: -1,
    lookAheadMs: 5,
    releaseMs: 100,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const clampBand = (value: unknown, fallback: IBandSettings): IBandSettings => {
  if (!isRecord(value)) {
    return fallback;
  }
  return {
    thresholdDb: clampNumber(
      value.thresholdDb,
      RANGES.thresholdDb,
      fallback.thresholdDb,
    ),
    ratio: clampNumber(value.ratio, RANGES.ratio, fallback.ratio),
    attackMs: clampNumber(value.attackMs, RANGES.attackMs, fallback.attackMs),
    releaseMs: clampNumber(
      value.releaseMs,
      RANGES.releaseMs,
      fallback.releaseMs,
    ),
    makeupDb: clampNumber(value.makeupDb, RANGES.makeupDb, fallback.makeupDb),
  };
};

/**
 * Read a settings blob from anywhere and return something usable.
 *
 * Clamps rather than rejects, and falls back field by field rather than
 * wholesale: a preset saved by a later build carrying one value this build
 * does not understand should cost the user that value, not every other
 * setting sitting beside it.
 */
/** The filter shapes an EQ band may claim to be. */
const EQ_TYPES = ['PK', 'NO', 'LSC', 'HSC', 'LPQ', 'HPQ', 'BP'] as const;

const clampEqBand = (
  value: unknown,
  fallback: IEqBandSettings,
): IEqBandSettings => {
  if (!isRecord(value)) {
    return fallback;
  }
  return {
    enabled: clampBoolean(value.enabled, fallback.enabled),
    // A stored string that no longer names a shape falls back rather than
    // reaching the coefficient maths, where an unknown type would silently
    // become a high shelf.
    type:
      typeof value.type === 'string' &&
      (EQ_TYPES as readonly string[]).includes(value.type)
        ? value.type
        : fallback.type,
    frequency: clampNumber(
      value.frequency,
      RANGES.eqFrequency,
      fallback.frequency,
    ),
    gainDb: clampNumber(value.gainDb, RANGES.eqGainDb, fallback.gainDb),
    quality: clampNumber(value.quality, RANGES.eqQuality, fallback.quality),
  };
};

export const clampDspSettings = (value: unknown): IDspSettings => {
  if (!isRecord(value)) {
    return DSP_DEFAULTS;
  }
  const eq = isRecord(value.eq) ? value.eq : {};
  const storedEqBands = Array.isArray(eq.bands) ? eq.bands : [];
  const exciter = isRecord(value.exciter) ? value.exciter : {};
  const compressor = isRecord(value.compressor) ? value.compressor : {};
  const maximizer = isRecord(value.maximizer) ? value.maximizer : {};
  const storedBands = Array.isArray(compressor.bands) ? compressor.bands : [];
  const storedCorners = Array.isArray(compressor.crossoverHz)
    ? compressor.crossoverHz
    : [];
  return {
    eq: {
      enabled: clampBoolean(eq.enabled, DSP_DEFAULTS.eq.enabled),
      presetId: typeof eq.presetId === 'string' ? eq.presetId : '',
      bands: DSP_DEFAULTS.eq.bands.map((fallback, index) =>
        clampEqBand(storedEqBands[index], fallback),
      ),
    },
    exciter: {
      enabled: clampBoolean(exciter.enabled, DSP_DEFAULTS.exciter.enabled),
      crossoverHz: clampNumber(
        exciter.crossoverHz,
        RANGES.exciterCrossoverHz,
        DSP_DEFAULTS.exciter.crossoverHz,
      ),
      drive: clampNumber(
        exciter.drive,
        RANGES.exciterDrive,
        DSP_DEFAULTS.exciter.drive,
      ),
      mix: clampNumber(
        exciter.mix,
        RANGES.exciterMix,
        DSP_DEFAULTS.exciter.mix,
      ),
    },
    compressor: {
      enabled: clampBoolean(
        compressor.enabled,
        DSP_DEFAULTS.compressor.enabled,
      ),
      crossoverHz: [
        clampNumber(
          storedCorners[0],
          RANGES.compressorLowHz,
          DSP_DEFAULTS.compressor.crossoverHz[0],
        ),
        clampNumber(
          storedCorners[1],
          RANGES.compressorHighHz,
          DSP_DEFAULTS.compressor.crossoverHz[1],
        ),
      ],
      bands: DSP_DEFAULTS.compressor.bands.map((fallback, index) =>
        clampBand(storedBands[index], fallback),
      ),
    },
    maximizer: {
      enabled: clampBoolean(maximizer.enabled, DSP_DEFAULTS.maximizer.enabled),
      ceilingDb: clampNumber(
        maximizer.ceilingDb,
        RANGES.ceilingDb,
        DSP_DEFAULTS.maximizer.ceilingDb,
      ),
      lookAheadMs: clampNumber(
        maximizer.lookAheadMs,
        RANGES.lookAheadMs,
        DSP_DEFAULTS.maximizer.lookAheadMs,
      ),
      releaseMs: clampNumber(
        maximizer.releaseMs,
        RANGES.maximizerReleaseMs,
        DSP_DEFAULTS.maximizer.releaseMs,
      ),
    },
  };
};
