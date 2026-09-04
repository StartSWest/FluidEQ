/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  BASS_FORGE_PRESET_BY_ID,
  bassForgePresetSettings,
} from '../../src/common/dsp/bassForgePresets';
import {
  BASS_PUNCH_PRESET_BY_ID,
  bassPunchPresetSettings,
} from '../../src/common/dsp/bassPunchPresets';
import { DSP_DEFAULTS, IDspSettings } from '../../src/common/dsp/chain';
import {
  COMPRESSOR_PRESET_BY_ID,
  compressorPresetSettings,
} from '../../src/common/dsp/compressorPresets';
import {
  DENOISE_PRESET_BY_ID,
  denoisePresetSettings,
} from '../../src/common/dsp/denoisePresets';
import {
  DIMENSION_PRESET_BY_ID,
  dimensionPresetSettings,
} from '../../src/common/dsp/dimensionPresets';
import {
  EQ_PRESETS,
  eqSettingsForPreset,
} from '../../src/common/dsp/eqPresets';
import {
  EXCITER_PRESET_BY_ID,
  exciterPresetSettings,
} from '../../src/common/dsp/exciterPresets';
import {
  MASTER_PRESET_BY_ID,
  masterPresetSettings,
} from '../../src/common/dsp/masterPresets';
import {
  MAXIMIZER_PRESET_BY_ID,
  maximizerPresetSettings,
} from '../../src/common/dsp/maximizerPresets';

export interface IFilterPresetCase {
  family: string;
  id: string;
  settings: IDspSettings;
}

/**
 * Every option exposed by every filter picker, materialised in isolation.
 *
 * Full chains catch interactions; these cases catch a profile that is broken
 * even before another stage touches it. Normalizer has modes rather than a
 * preset catalogue, and Crossfade is playback behaviour, so neither belongs
 * in this profile matrix.
 */
const presetIds = <T extends object>(catalogue: T): (keyof T & string)[] =>
  Object.keys(catalogue) as (keyof T & string)[];

export const filterPresetCases = (): readonly IFilterPresetCase[] => [
  ...presetIds(DENOISE_PRESET_BY_ID).map((id) => ({
    family: 'denoise',
    id,
    settings: {
      ...DSP_DEFAULTS,
      denoise: denoisePresetSettings(id, true),
    },
  })),
  ...EQ_PRESETS.map((preset) => ({
    family: 'equaliser',
    id: preset.id,
    settings: {
      ...DSP_DEFAULTS,
      eq: eqSettingsForPreset({ ...DSP_DEFAULTS.eq, enabled: true }, preset),
    },
  })),
  ...presetIds(EXCITER_PRESET_BY_ID).map((id) => ({
    family: 'exciter',
    id,
    settings: {
      ...DSP_DEFAULTS,
      exciter: exciterPresetSettings(id, true),
    },
  })),
  ...presetIds(BASS_FORGE_PRESET_BY_ID).map((id) => ({
    family: 'bass-forge',
    id,
    settings: {
      ...DSP_DEFAULTS,
      bassForge: bassForgePresetSettings(id, true),
    },
  })),
  ...presetIds(BASS_PUNCH_PRESET_BY_ID).map((id) => ({
    family: 'bass-punch',
    id,
    settings: {
      ...DSP_DEFAULTS,
      bassPunch: bassPunchPresetSettings(id, true),
    },
  })),
  ...presetIds(COMPRESSOR_PRESET_BY_ID).map((id) => ({
    family: 'compressor',
    id,
    settings: {
      ...DSP_DEFAULTS,
      compressor: compressorPresetSettings(id, true),
    },
  })),
  ...presetIds(DIMENSION_PRESET_BY_ID).map((id) => ({
    family: 'dimension',
    id,
    settings: {
      ...DSP_DEFAULTS,
      dimension: dimensionPresetSettings(id, true),
    },
  })),
  ...presetIds(MAXIMIZER_PRESET_BY_ID).map((id) => ({
    family: 'maximizer',
    id,
    settings: {
      ...DSP_DEFAULTS,
      maximizer: maximizerPresetSettings(id, true),
    },
  })),
  ...presetIds(MASTER_PRESET_BY_ID).map((id) => ({
    family: 'master',
    id,
    settings: {
      ...DSP_DEFAULTS,
      master: {
        ...masterPresetSettings(id, DSP_DEFAULTS.master),
        enabled: true,
        loudnessMaximize: true,
      },
    },
  })),
];
