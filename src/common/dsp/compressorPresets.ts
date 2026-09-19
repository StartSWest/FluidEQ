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
 * Makeup gives a band back what this stage took out of it, and never more:
 * the Maximizer or the Master still owns final loudness, and a compressor
 * competing with one is how a useful glue stage becomes three always-on gain
 * boosts before the limiter.
 *
 * Which is not the same as leaving it at zero, and three of these did until
 * 2026-09-19. A stage that takes six decibels out and hands none back is not
 * gentler — it is a chain 6 dB quiet with an EQ above it pushed up to make
 * that back, which is two stages fighting. Late night measured -6.0 dB, Voice
 * -2.3, and both curves above them had grown a mid hump to match. The deeper
 * a profile compresses, the more of it comes back here.
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
        band(-18, 2, 15, 150, 2.5),
        band(-24, 3, 6, 100, 3),
        band(-20, 2.5, 2, 70, 2.5),
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
        band(-30, 3.5, 6, 120, 4),
        band(-26, 3, 2, 90, 3),
      ],
    ),
  },
  movie: {
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    settings: profile(
      [100, 4_000],
      [
        band(-20, 1.7, 40, 260, 1.5),
        band(-22, 2.2, 12, 160, 2),
        band(-18, 1.8, 5, 110, 1.5),
      ],
    ),
  },
  /**
   * Footsteps over explosions, and three bands doing three different jobs.
   *
   * The low band holds the blasts and the engine rumble down hard and fast,
   * so they stop swallowing everything above them; the mids and highs —
   * steps, reloads, cloth, the clicks a direction is heard by — are brought
   * up from underneath. It works without a look-ahead, which is why the
   * Gaming chain uses it instead of a limiter: game mode is the chain giving
   * up every millisecond it can.
   *
   * The upper corner moved from 4 kHz to 2 kHz so the top band IS the cue
   * band — footsteps, reloads, shell casings — and can be lifted as a whole
   * rather than half of it sitting in the mid. The low band holds blasts (3.5
   * to 1 above -26 dB, fast in, slow out); the mid is nearly transparent so
   * voices keep their body; the top is barely compressed and mostly makeup.
   *
   * Measured against the old settings at matched loudness: the same crest,
   * 4 dB less of the 120-500 Hz an explosion fills, and 3 dB more of the
   * 2-8 kHz a footstep lives in.
   */
  gaming: {
    id: 'gaming',
    labelKey: 'dsp.eqPreset.gaming',
    settings: profile(
      [180, 2_000],
      [
        band(-26, 3.5, 5, 160, 0),
        band(-20, 1.8, 15, 150, 2),
        band(-26, 1.6, 4, 120, 2.5),
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
