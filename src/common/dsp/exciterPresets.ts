/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  IExciterBandSettings,
  IExciterSettings,
  IOrganicSettings,
  IPhaseAlignSettings,
  constrainExciterBandPosition,
} from './chain';

export const EXCITER_PRESET_GROUPS = [
  'basic',
  'genre',
  'voice',
  'scene',
  'character',
  'repair',
] as const;

export type TExciterPresetGroup = (typeof EXCITER_PRESET_GROUPS)[number];

/**
 * A processor profile owns the Exciter's sound, not its place in the chain.
 *
 * Bypass and Isolate are deliberately absent. A future chain preset decides
 * whether this processor participates at all, while Isolate remains a
 * temporary monitoring action. Keeping those fields out is what lets Rock
 * reference EQ Rock and Exciter Rock independently or omit either one.
 */
export type IExciterPresetSettings = Pick<
  IExciterSettings,
  'stereo' | 'bands' | 'organic' | 'align'
>;

export interface IExciterPreset {
  id: string;
  labelKey: string;
  group: TExciterPresetGroup;
  settings: IExciterPresetSettings;
}

type TBandPatches = readonly [
  Partial<IExciterBandSettings>,
  Partial<IExciterBandSettings>,
  Partial<IExciterBandSettings>,
];

const NO_BAND_PATCHES: TBandPatches = [{}, {}, {}];

const settings = (
  bands: TBandPatches = NO_BAND_PATCHES,
  organic: Partial<IOrganicSettings> = {},
  align: Partial<IPhaseAlignSettings> = {},
  stereo: IExciterSettings['stereo'] = DSP_DEFAULTS.exciter.stereo,
): IExciterPresetSettings => ({
  stereo,
  bands: DSP_DEFAULTS.exciter.bands.map((band, index) => {
    const next = { ...band, ...bands[index] };
    return {
      ...next,
      ...constrainExciterBandPosition(index, next.freqHz, next.range),
    };
  }),
  organic: { ...DSP_DEFAULTS.exciter.organic, ...organic },
  align: { ...DSP_DEFAULTS.exciter.align, ...align },
});

/**
 * Processor-local profiles, keyed by the stable id a chain preset references.
 *
 * Matching an EQ id is intentional: `rock` means the same musical target in
 * both catalogs without coupling their parameters. Amounts stay moderate
 * because these are designed to be combined with EQ, compression and a limiter;
 * no profile relies on being the only processor producing the final sound.
 *
 * Every Amount here was re-measured when the harmonic generator landed, and
 * they all moved up. They used to scale a return that was a whole copy of its
 * own filtered band, so what separated one profile from another was mostly how
 * much LEVEL each added — and the amounts had to stay small or the stage became
 * an equaliser. A return is harmonics over an 18% carrier now, so the old
 * numbers all collapsed toward the same thing: measured across the catalogue,
 * every profile sat within five decibels of every other, from `classical` to
 * `loud`.
 *
 * The figures below are chosen against the measured harmonic level at each
 * band's own centre, which is what a listener actually hears these differ by:
 * roughly -33 dB under the note for the transparent profiles, -26 for the
 * moderate ones and -21 for the forward ones. Nothing in the catalogue moves
 * the programme's level by more than 1.2 dB, and that one is `broadcast`, where
 * a presence lift is the point.
 */
export const EXCITER_PRESET_BY_ID = {
  none: {
    id: 'none',
    labelKey: 'dsp.eqModel.clean',
    group: 'basic',
    // None clears every sound-producing section but leaves the stage's own
    // On/Off state alone. The reset values remain available behind the off
    // section toggles, so the user starts from a known neutral rack.
    settings: settings(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: false },
      { enabled: false },
    ),
  },
  default: {
    id: 'default',
    labelKey: 'dsp.eqPreset.default',
    group: 'basic',
    settings: settings(),
  },
  rock: {
    id: 'rock',
    labelKey: 'dsp.eqPreset.rock',
    group: 'genre',
    settings: settings(
      [
        { freqHz: 90, range: 0.3, drive: 2, mix: 0.25 },
        {
          freqHz: 1_100,
          range: 0.28,
          drive: 2.1,
          mix: 0.28,
          texture: 0.22,
        },
        { freqHz: 6_800, drive: 2.65, mix: 0.45, texture: 0.62 },
      ],
      {},
      { enabled: true, amount: 0.3 },
    ),
  },
  pop: {
    id: 'pop',
    labelKey: 'dsp.eqPreset.pop',
    group: 'genre',
    settings: settings(
      [
        { mix: 0.11 },
        { freqHz: 1_250, mix: 0.19, texture: 0.2 },
        { freqHz: 7_200, drive: 2.65, mix: 0.32, texture: 0.62 },
      ],
      {
        enabled: true,
        amount: 0.13,
        focusHz: 500,
        range: 0.28,
      },
    ),
  },
  jazz: {
    id: 'jazz',
    labelKey: 'dsp.eqPreset.jazz',
    group: 'genre',
    settings: settings(
      [{ mix: 0.07 }, { mix: 0.11 }, { mix: 0.16, texture: 0.5 }],
      { enabled: true, amount: 0.16, focusHz: 450, range: 0.35 },
    ),
  },
  classical: {
    id: 'classical',
    labelKey: 'dsp.eqPreset.classical',
    group: 'genre',
    // The most transparent profile in the catalogue, and the one that has to
    // stay that way: its harmonics sit around 32 dB under the note.
    settings: settings([
      { mix: 0.035 },
      { mix: 0.065 },
      { freqHz: 8_500, drive: 2.25, mix: 0.15, texture: 0.52 },
    ]),
  },
  electronic: {
    id: 'electronic',
    labelKey: 'dsp.eqPreset.electronic',
    group: 'genre',
    settings: settings(
      [
        { freqHz: 72, drive: 2.2, mix: 0.25, texture: 0.04 },
        { mix: 0.17 },
        { drive: 2.8, mix: 0.53, texture: 0.64 },
      ],
      { enabled: true, amount: 0.16, focusHz: 180, range: 0.28 },
      { enabled: true, amount: 0.28 },
    ),
  },
  hiphop: {
    id: 'hiphop',
    labelKey: 'dsp.eqPreset.hiphop',
    group: 'genre',
    settings: settings(
      [
        // The most forward low band in the catalogue: its octave sits 18 dB
        // under the note, which is where a small speaker starts finding a
        // fundamental it cannot reproduce.
        { freqHz: 65, drive: 2.15, mix: 0.26, texture: 0.03 },
        { mix: 0.15 },
        { drive: 2.35, mix: 0.19, texture: 0.5 },
      ],
      {
        enabled: true,
        amount: 0.18,
        focusHz: 150,
        range: 0.25,
      },
      { enabled: true, amount: 0.2 },
    ),
  },
  acoustic: {
    id: 'acoustic',
    labelKey: 'dsp.eqPreset.acoustic',
    group: 'genre',
    settings: settings(
      [
        { mix: 0.08 },
        { freqHz: 800, mix: 0.24, texture: 0.12 },
        { drive: 2.45, mix: 0.38, texture: 0.55 },
      ],
      { enabled: true, amount: 0.16, focusHz: 420, range: 0.32 },
      { enabled: true, amount: 0.12 },
    ),
  },
  vocal: {
    id: 'vocal',
    labelKey: 'dsp.eqPreset.vocal',
    group: 'voice',
    settings: settings(
      [
        { enabled: false },
        { freqHz: 850, range: 0.25, mix: 0.29, texture: 0.12 },
        {
          freqHz: 6_500,
          range: 0.18,
          drive: 2.45,
          mix: 0.42,
          texture: 0.56,
        },
      ],
      {
        enabled: true,
        amount: 0.12,
        focusHz: 260,
        range: 0.22,
      },
      {},
      'mid',
    ),
  },
  gaming: {
    id: 'gaming',
    labelKey: 'dsp.eqPreset.gaming',
    group: 'scene',
    settings: settings(
      [
        { drive: 2.05, mix: 0.18 },
        { freqHz: 1_500, mix: 0.14, texture: 0.25 },
        { freqHz: 5_500, drive: 2.7, mix: 0.46, texture: 0.64 },
      ],
      {},
      { enabled: true, amount: 0.3 },
    ),
  },
  movie: {
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    group: 'scene',
    settings: settings(
      [{ mix: 0.1 }, { mix: 0.19 }, { drive: 2.4, mix: 0.36 }],
      {
        enabled: true,
        amount: 0.14,
        focusHz: 350,
        range: 0.3,
      },
      { enabled: true, amount: 0.15 },
      'mid',
    ),
  },
  warm: {
    id: 'warm',
    labelKey: 'dsp.eqPreset.warm',
    group: 'character',
    settings: settings(
      // Even orders forward on Low and Mid, High deliberately held back: warmth
      // is body without the air that would read as brightness.
      [
        { mix: 0.17, texture: 0.02 },
        { drive: 2.1, mix: 0.33, texture: 0.08 },
        { drive: 2.1, mix: 0.09, texture: 0.35 },
      ],
      { enabled: true, amount: 0.3, focusHz: 420, range: 0.4 },
    ),
  },
  air: {
    id: 'air',
    labelKey: 'dsp.eqPreset.air',
    group: 'character',
    settings: settings([
      { enabled: false },
      { enabled: false },
      {
        freqHz: 7_500,
        range: 0.24,
        drive: 2.5,
        mix: 0.76,
        texture: 0.65,
      },
    ]),
  },
  'lossy-repair': {
    id: 'lossy-repair',
    labelKey: 'dsp.preset.lossyRepair',
    group: 'repair',
    settings: settings([
      { enabled: false },
      { enabled: false },
      {
        enabled: true,
        // Below a lossy encoder's usual top cut, where material still exists
        // to generate the missing upper harmonics from.
        freqHz: 7_000,
        range: 0.22,
        drive: 2.55,
        mix: 0.7,
        texture: 0.6,
      },
    ]),
  },
  loud: {
    id: 'loud',
    labelKey: 'dsp.preset.loud',
    group: 'character',
    settings: settings(
      [
        { enabled: false },
        { enabled: false },
        {
          enabled: true,
          freqHz: 7_500,
          range: 0.24,
          drive: 2.75,
          mix: 0.8,
          texture: 0.62,
        },
      ],
      { enabled: true, amount: 0.22, focusHz: 650, range: 0.36 },
    ),
  },
  broadcast: {
    id: 'broadcast',
    labelKey: 'dsp.preset.broadcast',
    group: 'character',
    /**
     * The presence work moved to Mid, where it fits.
     *
     * It was a High band centred at 3 kHz, which is the very bottom of the High
     * region — so `constrainExciterBandPosition` had almost no room to give it
     * and clamped the authored 0.22 range down to 0.003. What shipped was a
     * 2.5-3.6 kHz sliver rather than the wide presence lift the numbers read
     * like, and nothing said so. Mid reaches 7 kHz, so the same centre gets its
     * full width there, and High goes back to making air.
     */
    settings: settings(
      [
        { enabled: false },
        {
          enabled: true,
          freqHz: 3_000,
          range: 0.2,
          drive: 2.8,
          mix: 0.45,
          texture: 0.55,
        },
        {
          enabled: true,
          freqHz: 7_500,
          range: 0.24,
          drive: 2.6,
          mix: 0.5,
          texture: 0.6,
        },
      ],
      { enabled: true, amount: 0.3, focusHz: 320, range: 0.3 },
      { enabled: true, amount: 0.45 },
    ),
  },
} satisfies Record<string, IExciterPreset>;

export type TExciterPresetId = keyof typeof EXCITER_PRESET_BY_ID;

export const EXCITER_PRESETS: readonly IExciterPreset[] =
  Object.values(EXCITER_PRESET_BY_ID);

export const isExciterPresetId = (id: string): id is TExciterPresetId =>
  Object.prototype.hasOwnProperty.call(EXCITER_PRESET_BY_ID, id);

/** Build a fresh live processor state without sharing a preset's nested data. */
export const exciterPresetSettings = (
  id: TExciterPresetId,
  enabled: boolean,
): IExciterSettings => {
  const preset = EXCITER_PRESET_BY_ID[id];
  return {
    enabled,
    presetId: id,
    stereo: preset.settings.stereo,
    bands: preset.settings.bands.map((band) => ({ ...band })),
    organic: { ...preset.settings.organic },
    align: { ...preset.settings.align },
    isolate: false,
  };
};
