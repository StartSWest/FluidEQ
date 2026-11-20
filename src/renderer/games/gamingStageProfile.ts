/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDspSettings } from '../../common/dsp/chain';
import { DENOISE_PRESETS } from '../../common/dsp/denoisePresets';
import { EQ_PRESETS } from '../../common/dsp/eqPresets';
import {
  BASS_FORGE_CATALOGUE,
  BASS_PUNCH_CATALOGUE,
  DE_ESSER_CATALOGUE,
  DIMENSION_CATALOGUE,
  DYNAMICS_CATALOGUE,
  EXCITER_CATALOGUE,
  MAXIMIZER_CATALOGUE,
} from '../../common/dsp/stageCatalogues';
import type { TranslationKey } from '../../common/i18n/en';
import type { TDspSection } from '../dsp/sections';

type TProfiled = Extract<
  TDspSection,
  | 'denoise'
  | 'deEsser'
  | 'exciter'
  | 'bassForge'
  | 'eq'
  | 'bassPunch'
  | 'dimension'
  | 'dynamics'
  | 'maximizer'
>;

/** Each stage's factory profiles, as its own bar on the DSP page lists them. */
const PROFILES: Record<TProfiled, readonly { id: string; labelKey: string }[]> =
  {
    denoise: DENOISE_PRESETS,
    deEsser: DE_ESSER_CATALOGUE.profiles,
    exciter: EXCITER_CATALOGUE.profiles,
    bassForge: BASS_FORGE_CATALOGUE.profiles,
    eq: EQ_PRESETS,
    bassPunch: BASS_PUNCH_CATALOGUE.profiles,
    dimension: DIMENSION_CATALOGUE.profiles,
    dynamics: DYNAMICS_CATALOGUE.profiles,
    maximizer: MAXIMIZER_CATALOGUE.profiles,
  };

const isProfiled = (stage: TDspSection): stage is TProfiled =>
  stage in PROFILES;

/**
 * The name of the factory profile a stage of `rack` is set to, as the
 * stage's own picker on the DSP page names it, or undefined where it has
 * none: a stage with no profiles (the Normalizer, the Room, the Master), a
 * profile the listener saved, or settings moved off every profile. The
 * Gaming Lab's sheet says it under the stage's name (the mockup's "Maximizer,
 * Clean ceiling"), so a game's rack reads as what each stage does.
 */
const rackStageProfileKey = (
  stage: TDspSection,
  rack: IDspSettings,
): TranslationKey | undefined => {
  if (!isProfiled(stage)) {
    return undefined;
  }
  const { presetId } = rack[stage];
  const profile = PROFILES[stage].find(({ id }) => id === presetId);
  // The profiles' keys are typed as strings where they are declared; every
  // stage bar on the DSP page reads them the same way.
  return profile ? (profile.labelKey as TranslationKey) : undefined;
};

export default rackStageProfileKey;
