/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IDspSettings, clampDspSettings } from './chain';
import {
  TBassForgePresetId,
  bassForgePresetSettings,
} from './bassForgePresets';
import {
  TBassPunchPresetId,
  bassPunchPresetSettings,
} from './bassPunchPresets';
import {
  TCompressorPresetId,
  compressorPresetSettings,
} from './compressorPresets';
import { TDenoisePresetId, denoisePresetSettings } from './denoisePresets';
import {
  TDimensionPresetId,
  dimensionPresetSettings,
} from './dimensionPresets';
import { EQ_PRESETS, eqSettingsForPreset } from './eqPresets';
import { TExciterPresetId, exciterPresetSettings } from './exciterPresets';
import { TMasterPresetId, masterPresetSettings } from './masterPresets';
import {
  TMaximizerPresetId,
  maximizerPresetSettings,
} from './maximizerPresets';

export const DSP_PRESET_GROUPS = ['basic', 'genre', 'scene', 'repair'] as const;
export type TDspPresetGroup = (typeof DSP_PRESET_GROUPS)[number];

export interface IDspPreset {
  id: string;
  labelKey: string;
  group: TDspPresetGroup;
  settings: IDspSettings;
}

interface IDspPresetRecipe {
  id: string;
  labelKey: string;
  group: TDspPresetGroup;
  denoise?: TDenoisePresetId;
  eq?: string;
  exciter?: TExciterPresetId;
  bassForge?: TBassForgePresetId;
  bassPunch?: TBassPunchPresetId;
  compressor?: TCompressorPresetId;
  dimension?: TDimensionPresetId;
  maximizer?: TMaximizerPresetId;
  master?: TMasterPresetId;
  /** Compare the processed chain at its incoming level, without LUFS makeup. */
  masterGainMatch?: boolean;
  /** Final calibration for a complete chain that uses Master. */
  masterOutputTrimDb?: number;
}

/** Fail at startup rather than silently ship a recipe with a misspelled EQ. */
const eqProfile = (id: string) => {
  const preset = EQ_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) {
    throw new Error(`DSP preset references unknown EQ profile: ${id}`);
  }
  return eqSettingsForPreset({ ...DSP_DEFAULTS.eq, enabled: true }, preset);
};

const masterProfile = (
  id: TMasterPresetId,
  gainMatch = false,
  outputTrimDb = 0,
) => ({
  ...masterPresetSettings(id, DSP_DEFAULTS.master),
  enabled: true,
  loudnessMaximize: true,
  outputTrimDb,
  matchedBypass: gainMatch,
});

/**
 * A whole-rack pick owns every stage, including the bypassed ones.
 *
 * Starting from the defaults prevents a profile from inheriting one processor
 * from the previous profile and sounding different on its second use.
 */
const materialize = (recipe: IDspPresetRecipe): IDspSettings =>
  clampDspSettings({
    ...DSP_DEFAULTS,
    enabled: true,
    presetId: recipe.id,
    denoise: recipe.denoise
      ? denoisePresetSettings(recipe.denoise, true)
      : DSP_DEFAULTS.denoise,
    eq: recipe.eq ? eqProfile(recipe.eq) : DSP_DEFAULTS.eq,
    exciter: recipe.exciter
      ? exciterPresetSettings(recipe.exciter, true)
      : DSP_DEFAULTS.exciter,
    bassForge: recipe.bassForge
      ? bassForgePresetSettings(recipe.bassForge, true)
      : DSP_DEFAULTS.bassForge,
    bassPunch: recipe.bassPunch
      ? bassPunchPresetSettings(recipe.bassPunch, true)
      : DSP_DEFAULTS.bassPunch,
    compressor: recipe.compressor
      ? compressorPresetSettings(recipe.compressor, true)
      : DSP_DEFAULTS.compressor,
    dimension: recipe.dimension
      ? dimensionPresetSettings(recipe.dimension, true)
      : DSP_DEFAULTS.dimension,
    maximizer: recipe.maximizer
      ? maximizerPresetSettings(recipe.maximizer, true)
      : DSP_DEFAULTS.maximizer,
    master: recipe.master
      ? masterProfile(
          recipe.master,
          recipe.masterGainMatch,
          recipe.masterOutputTrimDb,
        )
      : DSP_DEFAULTS.master,
  });

/**
 * Twenty-eight complete chains. No recipe stacks Maximizer with Master, and
 * Denoise appears only for a named source problem — cleanup on already-clean
 * music is damage rather than polish.
 */
const RECIPES: readonly IDspPresetRecipe[] = [
  {
    id: 'reference',
    labelKey: 'dsp.masterPreset.reference',
    group: 'basic',
    master: 'reference',
    masterGainMatch: true,
  },
  {
    id: 'balanced',
    labelKey: 'dsp.eqPreset.default',
    group: 'basic',
    // Default must be a clean baseline. Enabling Exciter here added fuzz to
    // every source before the user had chosen any character at all; the
    // standalone Exciter preset remains available when that colour is wanted.
    eq: 'flat',
    compressor: 'gentle',
    dimension: 'default',
    master: 'streaming',
  },
  {
    id: 'warm',
    labelKey: 'dsp.eqPreset.warm',
    group: 'basic',
    // Warmth is the broad low-mid tilt. Exciter and Bass Forge both added
    // harmonics on top of the EQ's own colour, which turned a tonal preset
    // into audible grit. Keep the chain clean and let its curve own the name.
    eq: 'warm',
    compressor: 'gentle',
    dimension: 'intimate',
    maximizer: 'transparent',
  },
  {
    id: 'clarity',
    labelKey: 'dsp.eqPreset.air',
    group: 'basic',
    eq: 'air',
    dimension: 'speakers',
    maximizer: 'default',
  },
  {
    id: 'punch',
    labelKey: 'dsp.maximizerPreset.punch',
    group: 'basic',
    // One source of punch, not five stacked versions of it. The old chain
    // boosted both ends, synthesized a sub octave, exaggerated the bass
    // transient, let another slow compressor accent it, then drove a second
    // fast punch limiter. Each stage was reasonable alone and their sum was
    // exactly the overdone sound reported in listening. Bass Punch now owns
    // the character; the other stages support it without adding another hit.
    eq: 'flat',
    bassPunch: 'punch',
    compressor: 'gentle',
    maximizer: 'transparent',
  },
  {
    id: 'expansive',
    labelKey: 'dsp.dimensionPreset.expansive',
    group: 'basic',
    // Width plus space, without exciting and re-limiting the widened side
    // channel. Those extra stages made the diffuse top sound distorted even
    // while the final sample peaks remained numerically safe.
    eq: 'ambient',
    dimension: 'expansive',
  },
  {
    id: 'late-night',
    labelKey: 'dsp.eqPreset.lateNight',
    group: 'basic',
    eq: 'lateNight',
    bassPunch: 'lateNight',
    maximizer: 'lateNight',
  },

  {
    id: 'pop',
    labelKey: 'dsp.eqPreset.pop',
    group: 'genre',
    eq: 'pop',
    compressor: 'glue',
    dimension: 'default',
    maximizer: 'pop',
  },
  {
    id: 'rock',
    labelKey: 'dsp.eqPreset.rock',
    group: 'genre',
    eq: 'rock',
    compressor: 'rock',
    dimension: 'speakers',
    maximizer: 'rock',
  },
  {
    id: 'hiphop',
    labelKey: 'dsp.eqPreset.hiphop',
    group: 'genre',
    eq: 'hiphop',
    bassForge: 'hiphop',
    compressor: 'punch',
    maximizer: 'hiphop',
  },
  {
    id: 'electronic',
    labelKey: 'dsp.eqPreset.electronic',
    group: 'genre',
    eq: 'electronic',
    exciter: 'electronic',
    compressor: 'electronic',
    dimension: 'expansive',
    maximizer: 'electronic',
  },
  {
    id: 'jazz',
    labelKey: 'dsp.eqPreset.jazz',
    group: 'genre',
    eq: 'jazz',
    dimension: 'speakers',
    maximizer: 'jazz',
  },
  {
    id: 'classical',
    labelKey: 'dsp.eqPreset.classical',
    group: 'genre',
    eq: 'classical',
    dimension: 'speakers',
    maximizer: 'classical',
  },
  {
    id: 'acoustic',
    labelKey: 'dsp.eqPreset.acoustic',
    group: 'genre',
    eq: 'acoustic',
    compressor: 'gentle',
    dimension: 'intimate',
    maximizer: 'acoustic',
  },
  {
    id: 'metal',
    labelKey: 'dsp.eqPreset.metal',
    group: 'genre',
    eq: 'metal',
    compressor: 'rock',
    dimension: 'speakers',
    maximizer: 'metal',
  },
  {
    id: 'reggae',
    labelKey: 'dsp.eqPreset.reggae',
    group: 'genre',
    eq: 'reggae',
    bassForge: 'dub',
    compressor: 'glue',
    maximizer: 'reggae',
  },
  {
    id: 'drum-bass',
    labelKey: 'dsp.eqPreset.drumBass',
    group: 'genre',
    eq: 'drumBass',
    // D&B has its own short-bloom transient profile. The former Electronic
    // Bass Forge substitution ignored it and softened the breaks the preset
    // is named for.
    bassPunch: 'dnb',
    compressor: 'electronic',
    dimension: 'expansive',
    maximizer: 'default',
  },

  {
    id: 'headphones',
    labelKey: 'dsp.dimensionPreset.headphones',
    group: 'scene',
    eq: 'openBack',
    bassForge: 'headphones',
    dimension: 'headphones',
    maximizer: 'default',
  },
  {
    id: 'speakers',
    labelKey: 'dsp.dimensionPreset.speakers',
    group: 'scene',
    eq: 'flat',
    dimension: 'speakers',
    maximizer: 'default',
  },
  {
    id: 'laptop',
    labelKey: 'dsp.eqPreset.laptop',
    group: 'scene',
    eq: 'laptop',
    compressor: 'gentle',
    dimension: 'laptop',
    maximizer: 'default',
  },
  {
    id: 'car',
    labelKey: 'dsp.eqPreset.car',
    group: 'scene',
    eq: 'car',
    bassForge: 'car',
    compressor: 'glue',
    dimension: 'monoSafe',
    maximizer: 'transparent',
  },
  {
    id: 'gaming',
    labelKey: 'dsp.eqPreset.gaming',
    group: 'scene',
    eq: 'gaming',
    bassPunch: 'gaming',
    dimension: 'gaming',
    maximizer: 'gaming',
  },
  {
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    group: 'scene',
    eq: 'movie',
    compressor: 'movie',
    dimension: 'movie',
    maximizer: 'movie',
  },

  {
    id: 'lossy-repair',
    labelKey: 'dsp.preset.lossyRepair',
    group: 'repair',
    eq: 'flat',
    exciter: 'lossy-repair',
    // The repair Exciter can reconstruct a peak above unity. This adds no
    // loudness; it is only the clean final ceiling the repair requires.
    maximizer: 'safety',
  },
  {
    id: 'vinyl-restore',
    labelKey: 'dsp.eqPreset.vinyl',
    group: 'repair',
    denoise: 'vinyl',
    eq: 'vinyl',
    compressor: 'gentle',
    dimension: 'monoSafe',
    master: 'vinyl',
    masterOutputTrimDb: -0.5,
  },
  {
    id: 'tape-restore',
    labelKey: 'dsp.eqPreset.tape',
    group: 'repair',
    denoise: 'tape',
    eq: 'tape',
    master: 'reference',
    // Tape EQ restores lost body and the cached loudness makeup otherwise
    // adds another four decibels. Calibrate the complete result, not the EQ.
    masterOutputTrimDb: -4.5,
  },
  {
    id: 'podcast',
    labelKey: 'dsp.eqPreset.podcast',
    group: 'repair',
    denoise: 'podcast',
    eq: 'podcast',
    compressor: 'voice',
    maximizer: 'podcast',
  },
  {
    id: 'audiobook',
    labelKey: 'dsp.eqPreset.audiobook',
    group: 'repair',
    denoise: 'audiobook',
    eq: 'audiobook',
    compressor: 'voice',
    maximizer: 'audiobook',
  },
];

export const DSP_PRESETS: readonly IDspPreset[] = DSP_PRESET_GROUPS.flatMap(
  (group) =>
    RECIPES.filter((recipe) => recipe.group === group).map((recipe) => ({
      id: recipe.id,
      labelKey: recipe.labelKey,
      group: recipe.group,
      settings: materialize(recipe),
    })),
);

export const isDspPresetId = (id: string): boolean =>
  DSP_PRESETS.some((preset) => preset.id === id);

/** A fresh, fully clamped rack for a picker selection. */
export const dspPresetSettings = (
  id: string,
  current?: IDspSettings,
): IDspSettings | undefined => {
  const preset = DSP_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) {
    return undefined;
  }
  return clampDspSettings({
    ...preset.settings,
    // Crossfade is playback behaviour, not a colour in the DSP rack. A chain
    // choice must never silently start, stop or reshape the next transition.
    crossfade: current?.crossfade ?? preset.settings.crossfade,
  });
};
