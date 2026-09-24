/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IDspSettings } from '../../src/common/dsp/chain';
import {
  DENOISE_PRESET_BY_ID,
  denoisePresetSettings,
} from '../../src/common/dsp/denoisePresets';
import {
  EQ_PRESETS,
  eqSettingsForPreset,
} from '../../src/common/dsp/eqPresets';
import {
  MASTER_PRESET_BY_ID,
  masterPresetSettings,
} from '../../src/common/dsp/masterPresets';
import {
  BASS_FORGE_CATALOGUE,
  BASS_PUNCH_CATALOGUE,
  DIMENSION_CATALOGUE,
  EXCITER_CATALOGUE,
  IStageCatalogue,
  MAXIMIZER_CATALOGUE,
} from '../../src/common/dsp/stageCatalogues';

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
 * in this profile matrix. A stage's picker lists its own profiles and every
 * genre's (`stageCatalogues.ts`), so the genres' are cases here too.
 */
const presetIds = <T extends object>(catalogue: T): (keyof T & string)[] =>
  Object.keys(catalogue) as (keyof T & string)[];

/** A catalogue's profiles, each as the stage it sets in an otherwise default rack. */
const stageCases = <S>(
  family: string,
  stageCatalogue: IStageCatalogue<{ id: string }, S>,
  place: (stage: S) => Partial<IDspSettings>,
): IFilterPresetCase[] =>
  stageCatalogue.profiles.flatMap(({ id }) => {
    const stage = stageCatalogue.settings(id, true);
    return stage === undefined
      ? []
      : [{ family, id, settings: { ...DSP_DEFAULTS, ...place(stage) } }];
  });

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
  ...stageCases('exciter', EXCITER_CATALOGUE, (exciter) => ({ exciter })),
  ...stageCases('bass-forge', BASS_FORGE_CATALOGUE, (bassForge) => ({
    bassForge,
  })),
  ...stageCases('bass-punch', BASS_PUNCH_CATALOGUE, (bassPunch) => ({
    bassPunch,
  })),
  ...stageCases('dimension', DIMENSION_CATALOGUE, (dimension) => ({
    dimension,
  })),
  ...stageCases('maximizer', MAXIMIZER_CATALOGUE, (maximizer) => ({
    maximizer,
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
