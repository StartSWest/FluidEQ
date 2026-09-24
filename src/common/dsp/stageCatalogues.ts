/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Each stage's whole list of profiles: its own, then every genre's.
 *
 * A genre's profiles belong to its rack (`genreRack.ts`) rather than to the
 * stage's table, so a genre's whole sound is one row; this is where they
 * join the stage's own profiles for the stage's picker and for anything else
 * that looks a profile up by id. Apart from the stage tables because one of
 * them is part of the rack's defaults (`chain.ts` reads Bass Punch's), and
 * the genre rows are built from `chain.ts`'s own defaults — joined in the
 * table, the two would load each other.
 */

import {
  IBassForgeSettings,
  IBassPunchSettings,
  IDimensionSettings,
  IExciterSettings,
  IMaximizerSettings,
} from './chain';
import {
  BASS_FORGE_PRESETS,
  IBassForgePreset,
  bassForgeSettingsOf,
} from './bassForgePresets';
import {
  BASS_PUNCH_PRESETS,
  IBassPunchPreset,
  bassPunchSettingsOf,
} from './bassPunchPresets';
import {
  DIMENSION_PRESETS,
  IDimensionPreset,
  dimensionSettingsOf,
} from './dimensionPresets';
import {
  EXCITER_PRESETS,
  IExciterPreset,
  exciterSettingsOf,
} from './exciterPresets';
import { genreStageProfiles } from './genres';
import {
  IMaximizerPreset,
  MAXIMIZER_PRESETS,
  maximizerSettingsOf,
} from './maximizerPresets';
import orderRelatedStyles from './presetOrder';

/**
 * A stage's list and the two questions asked of it: is this id one of its
 * profiles, and what does that profile set the stage to.
 */
export interface IStageCatalogue<P extends { id: string }, S> {
  profiles: readonly P[];
  has: (id: string) => boolean;
  /** The stage set to a profile, or undefined for an id it does not list. */
  settings: (id: string, enabled: boolean) => S | undefined;
}

const catalogue = <
  P extends { id: string; labelKey: string; group: string },
  S,
>(
  own: readonly P[],
  genres: readonly P[],
  settingsOf: (preset: P, enabled: boolean) => S,
): IStageCatalogue<P, S> => {
  const profiles = [...own, ...orderRelatedStyles(genres)];
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return {
    profiles,
    has: (id) => byId.has(id),
    settings: (id, enabled) => {
      const profile = byId.get(id);
      return profile === undefined ? undefined : settingsOf(profile, enabled);
    },
  };
};

export const EXCITER_CATALOGUE: IStageCatalogue<
  IExciterPreset,
  IExciterSettings
> = catalogue(
  EXCITER_PRESETS,
  genreStageProfiles('exciter'),
  exciterSettingsOf,
);

export const BASS_FORGE_CATALOGUE: IStageCatalogue<
  IBassForgePreset,
  IBassForgeSettings
> = catalogue(
  BASS_FORGE_PRESETS,
  genreStageProfiles('bassForge'),
  bassForgeSettingsOf,
);

export const BASS_PUNCH_CATALOGUE: IStageCatalogue<
  IBassPunchPreset,
  IBassPunchSettings
> = catalogue(
  BASS_PUNCH_PRESETS,
  genreStageProfiles('bassPunch'),
  bassPunchSettingsOf,
);

export const DIMENSION_CATALOGUE: IStageCatalogue<
  IDimensionPreset,
  IDimensionSettings
> = catalogue(
  DIMENSION_PRESETS,
  genreStageProfiles('dimension'),
  dimensionSettingsOf,
);

export const MAXIMIZER_CATALOGUE: IStageCatalogue<
  IMaximizerPreset,
  IMaximizerSettings
> = catalogue(
  MAXIMIZER_PRESETS,
  genreStageProfiles('maximizer'),
  maximizerSettingsOf,
);
