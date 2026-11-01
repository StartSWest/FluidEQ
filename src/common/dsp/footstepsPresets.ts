/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IFootstepsSettings } from './footsteps';

export const FOOTSTEPS_PRESET_GROUPS = ['games'] as const;

export type TFootstepsPresetGroup = (typeof FOOTSTEPS_PRESET_GROUPS)[number];

/**
 * A profile owns how much the stage lifts and calms, never whether it runs:
 * a chain decides that, as it does for every other stage. Isolate is a way
 * of listening, not a sound, so no profile carries it either.
 */
export type IFootstepsPresetSettings = Omit<
  IFootstepsSettings,
  'enabled' | 'isolate' | 'presetId'
>;

export interface IFootstepsPreset {
  id: string;
  labelKey: string;
  /** The games it is for, as the picker names them under the profile. */
  gamesKey: string;
  group: TFootstepsPresetGroup;
  settings: IFootstepsPresetSettings;
}

/**
 * One profile per kind of game rather than per title: nothing here has been
 * measured on a particular game's mix, and a profile named after one would
 * claim it had.
 *
 * - Competitive: a round is short and every step matters, and the blasts are
 *   few — steps forward, rumble calmed by half.
 * - Battle royale: the map is large, an enemy's steps are far away, and the
 *   explosions never stop — the most lift and the most calm.
 * - Tactical survival: a world kept as it sounds, quieter lift, the blasts
 *   still calmed.
 * - Story and horror: the quiet moments a little closer, explosions left with
 *   most of their weight.
 */
export const FOOTSTEPS_PRESET_BY_ID = {
  competitive: {
    id: 'competitive',
    labelKey: 'dsp.footstepsPreset.competitive',
    gamesKey: 'dsp.footstepsPreset.competitiveGames',
    group: 'games',
    settings: { lift: 0.85, calm: 0.5 },
  },
  battleRoyale: {
    id: 'battleRoyale',
    labelKey: 'dsp.footstepsPreset.battleRoyale',
    gamesKey: 'dsp.footstepsPreset.battleRoyaleGames',
    group: 'games',
    settings: { lift: 1, calm: 0.8 },
  },
  tactical: {
    id: 'tactical',
    labelKey: 'dsp.footstepsPreset.tactical',
    gamesKey: 'dsp.footstepsPreset.tacticalGames',
    group: 'games',
    settings: { lift: 0.65, calm: 0.6 },
  },
  story: {
    id: 'story',
    labelKey: 'dsp.footstepsPreset.story',
    gamesKey: 'dsp.footstepsPreset.storyGames',
    group: 'games',
    settings: { lift: 0.4, calm: 0.2 },
  },
} satisfies Record<string, IFootstepsPreset>;

export type TFootstepsPresetId = keyof typeof FOOTSTEPS_PRESET_BY_ID;

export const FOOTSTEPS_PRESETS: readonly IFootstepsPreset[] = Object.values(
  FOOTSTEPS_PRESET_BY_ID,
);

/** A fresh stage from a profile; whether it runs is the caller's. */
export const footstepsSettingsOf = (
  preset: IFootstepsPreset,
  on: boolean,
): IFootstepsSettings => ({
  enabled: on,
  isolate: false,
  presetId: preset.id,
  ...preset.settings,
});

export const footstepsPresetSettings = (
  id: TFootstepsPresetId,
  on: boolean,
): IFootstepsSettings => footstepsSettingsOf(FOOTSTEPS_PRESET_BY_ID[id], on);
