/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IBandSettings, ICompressorSettings } from './chain';

export interface ICompressorPreset {
  id: string;
  labelKey: string;
  settings: Omit<ICompressorSettings, 'enabled'>;
}

const band = (
  thresholdDb: number,
  ratio: number,
  attackMs: number,
  releaseMs: number,
  makeupDb: number,
): IBandSettings => ({ thresholdDb, ratio, attackMs, releaseMs, makeupDb });

const profile = (
  crossoverHz: readonly [number, number],
  bands: readonly [IBandSettings, IBandSettings, IBandSettings],
): Omit<ICompressorSettings, 'enabled'> => ({ crossoverHz, bands });

/**
 * Conservative multiband profiles for whole-rack presets.
 *
 * Makeup never exceeds 2 dB in this catalogue. The Maximizer or Master owns
 * final loudness; letting this stage compete with it is how a useful glue
 * compressor becomes three always-on gain boosts before the limiter.
 */
export const COMPRESSOR_PRESET_BY_ID = {
  gentle: {
    id: 'gentle',
    labelKey: 'dsp.denoisePreset.gentle',
    settings: profile(
      [180, 3_500],
      [
        band(-18, 1.5, 30, 220, 0.5),
        band(-16, 1.5, 20, 160, 0.5),
        band(-14, 1.5, 10, 110, 0.5),
      ],
    ),
  },
  glue: {
    id: 'glue',
    labelKey: 'dsp.eqPreset.default',
    settings: profile(
      [180, 3_200],
      [
        band(-20, 2, 25, 180, 1),
        band(-18, 2, 12, 130, 1),
        band(-16, 2, 6, 90, 1),
      ],
    ),
  },
  punch: {
    id: 'punch',
    labelKey: 'dsp.maximizerPreset.punch',
    settings: profile(
      [140, 2_800],
      [
        band(-22, 2.5, 35, 160, 1.5),
        band(-20, 2, 15, 110, 1),
        band(-18, 2, 5, 70, 0.5),
      ],
    ),
  },
  dense: {
    id: 'dense',
    labelKey: 'dsp.preset.loud',
    settings: profile(
      [160, 2_600],
      [
        band(-24, 3, 18, 140, 2),
        band(-22, 3, 8, 100, 2),
        band(-20, 2.5, 3, 70, 1.5),
      ],
    ),
  },
  rock: {
    id: 'rock',
    labelKey: 'dsp.eqPreset.rock',
    settings: profile(
      [160, 3_000],
      [
        band(-22, 2.5, 30, 170, 1.5),
        band(-20, 2.4, 12, 110, 1),
        band(-18, 2.2, 4, 75, 0.75),
      ],
    ),
  },
  electronic: {
    id: 'electronic',
    labelKey: 'dsp.eqPreset.electronic',
    settings: profile(
      [120, 2_800],
      [
        band(-23, 2.7, 16, 130, 1.5),
        band(-21, 2.5, 8, 95, 1.25),
        band(-20, 2.3, 3, 65, 1),
      ],
    ),
  },
  voice: {
    id: 'voice',
    labelKey: 'dsp.eqPreset.vocal',
    settings: profile(
      [120, 4_500],
      [
        band(-18, 2, 15, 150, 0.5),
        band(-24, 3, 6, 100, 1.5),
        band(-20, 2.5, 2, 70, 0.5),
      ],
    ),
  },
  lateNight: {
    id: 'lateNight',
    labelKey: 'dsp.eqPreset.lateNight',
    settings: profile(
      [140, 3_500],
      [
        band(-28, 3, 12, 180, 1),
        band(-30, 3.5, 6, 120, 1.5),
        band(-26, 3, 2, 90, 0.75),
      ],
    ),
  },
  movie: {
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    settings: profile(
      [100, 4_000],
      [
        band(-20, 1.7, 40, 260, 0.5),
        band(-22, 2.2, 12, 160, 1),
        band(-18, 1.8, 5, 110, 0.5),
      ],
    ),
  },
} satisfies Record<string, ICompressorPreset>;

export type TCompressorPresetId = keyof typeof COMPRESSOR_PRESET_BY_ID;

export const COMPRESSOR_PRESETS: readonly ICompressorPreset[] = Object.values(
  COMPRESSOR_PRESET_BY_ID,
);

export const isCompressorPresetId = (id: string): id is TCompressorPresetId =>
  Object.prototype.hasOwnProperty.call(COMPRESSOR_PRESET_BY_ID, id);

export const compressorPresetSettings = (
  id: TCompressorPresetId,
  enabled: boolean,
): ICompressorSettings => {
  const preset = COMPRESSOR_PRESET_BY_ID[id];
  return {
    enabled,
    crossoverHz: [...preset.settings.crossoverHz],
    bands: preset.settings.bands.map((one) => ({ ...one })),
  };
};
