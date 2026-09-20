/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  IDspSettings,
  IEqSettings,
  IRoomSettings,
  clampDspSettings,
} from './chain';
import { bassForgePresetSettings } from './bassForgePresets';
import { bassPunchPresetSettings } from './bassPunchPresets';
import { compressorPresetSettings } from './compressorPresets';
import { denoisePresetSettings } from './denoisePresets';
import { dimensionPresetSettings } from './dimensionPresets';
import { EQ_PRESETS, eqSettingsForPreset } from './eqPresets';
import { exciterPresetSettings } from './exciterPresets';
import { TMasterPresetId, masterPresetSettings } from './masterPresets';
import {
  TMaximizerPresetId,
  maximizerPresetSettings,
} from './maximizerPresets';
import {
  DSP_PRESET_GROUPS,
  DSP_PRESET_RECIPES,
  IDspPresetRecipe,
  TDspPresetGroup,
} from './presetRecipes';
import { roomPresetSettings } from './roomPresets';
import { withRoomTone } from './roomTone';
import { VOICING_PROFILES } from '../voicing';
import orderRelatedStyles from './presetOrder';

export { DSP_PRESET_GROUPS } from './presetRecipes';
export type { TDspPresetGroup } from './presetRecipes';

export interface IDspPreset {
  id: string;
  labelKey: string;
  group: TDspPresetGroup;
  settings: IDspSettings;
  /**
   * Set on a copy of another chain with the Room switched on: what follows
   * that chain's name in the copy's. The Room's own title ("Gaming · Room")
   * or, for a chain's second copy, the room it stands in ("Gaming ·
   * Competitive") — never a label of its own, so the copies read as that
   * chain's in every language.
   */
  copyLabelKey: string | undefined;
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

const maximizerProfile = (id: TMaximizerPresetId, driveDb?: number) => {
  const settings = maximizerPresetSettings(id, true);
  if (driveDb === undefined || driveDb === settings.driveDb) {
    return settings;
  }
  // A calibrated rack still owns its named preset, but this individual stage
  // must not claim to match a catalogue profile whose drive it no longer uses.
  return { ...settings, driveDb, presetId: '' };
};

/**
 * A whole-rack pick owns every stage, including the bypassed ones.
 *
 * Starting from the defaults prevents a profile from inheriting one processor
 * from the previous profile and sounding different on its second use.
 */
const voicingEq = (id: string) => {
  const profile = VOICING_PROFILES.find((one) => one.id === id);
  if (!profile) {
    throw new Error(`DSP preset references unknown voicing ${id}`);
  }
  return {
    ...DSP_DEFAULTS.eq,
    enabled: true,
    presetId: '',
    bands: profile.filters.map((filter) => ({
      enabled: true,
      type: filter.type,
      frequency: filter.frequency,
      gainDb: filter.gain,
      quality: filter.quality,
      dynamic: false,
      thresholdDb: -24,
    })),
  };
};

const recipeEq = (recipe: IDspPresetRecipe): IEqSettings => {
  if (recipe.voicing) {
    return voicingEq(recipe.voicing);
  }
  return recipe.eq ? eqProfile(recipe.eq) : DSP_DEFAULTS.eq;
};

const materialize = (recipe: IDspPresetRecipe): IDspSettings =>
  clampDspSettings({
    ...DSP_DEFAULTS,
    enabled: true,
    presetId: recipe.id,
    normalizer: recipe.normalizer
      ? { ...DSP_DEFAULTS.normalizer, mode: recipe.normalizer }
      : DSP_DEFAULTS.normalizer,
    denoise: recipe.denoise
      ? denoisePresetSettings(recipe.denoise, true)
      : DSP_DEFAULTS.denoise,
    // A Room copy keeps its chain's tone: see `roomTone.ts`.
    eq: recipe.room
      ? withRoomTone(recipeEq(recipe), recipe.room)
      : recipeEq(recipe),
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
      ? maximizerProfile(recipe.maximizer, recipe.maximizerDriveDb)
      : DSP_DEFAULTS.maximizer,
    master: recipe.master
      ? masterProfile(
          recipe.master,
          recipe.masterGainMatch,
          recipe.masterOutputTrimDb,
        )
      : DSP_DEFAULTS.master,
    room: recipe.room
      ? { ...roomPresetSettings(DSP_DEFAULTS.room, recipe.room), enabled: true }
      : DSP_DEFAULTS.room,
    gameMode: recipe.gameMode === true,
  });

/**
 * The Room as a chain leaves it: the chain's own switch, and the room it
 * stands in where it has one.
 *
 * The Room is a stage of the rack like any other, so a chain that does not
 * use it switches it off — it used to be carried over from whatever was on
 * before, the one stage a chain did not own, so "Rock" sounded one way after
 * "Gaming" and another after "Reference". And a chain that does use it sets
 * ALL of it, as it sets every other stage: the room, every speaker, bass
 * management and its crossover, the front stage or the filled room and its
 * amount. Kept for a moment, "fill the room" left on from before made
 * "Gaming · Room" one sound on Monday and another on Tuesday.
 *
 * One thing is nobody's to set but the listener's, and no chain touches it:
 * the head, which is their own anatomy — Fit is a listening test, and a chain
 * made on somebody else's head cannot know it. And a chain without the Room
 * only switches it off: the room that was shaped stays as it was for the next
 * time it is switched on.
 */
export const chainRoom = (
  current: IRoomSettings | undefined,
  chain: IRoomSettings,
): IRoomSettings => {
  const listener = current ?? chain;
  if (!chain.enabled) {
    return { ...listener, enabled: false };
  }
  return {
    ...chain,
    angles: [...chain.angles],
    levels: [...chain.levels],
    distances: [...chain.distances],
    mutes: [...chain.mutes],
    head: listener.head,
    compareOriginal: listener.compareOriginal,
    sourceAlreadySpatial: listener.sourceAlreadySpatial,
    enabled: true,
  };
};

// Every EQ genre is also a complete DSP chain. Detailed recipes above win;
// the remaining genres use their own EQ with gentle dynamics and final safety.
const recipes: readonly IDspPresetRecipe[] = [
  ...DSP_PRESET_RECIPES,
  ...EQ_PRESETS.filter(
    (eq) =>
      eq.group === 'genre' &&
      !DSP_PRESET_RECIPES.some(
        (recipe) => recipe.group === 'genre' && recipe.eq === eq.id,
      ),
  ).map((eq): IDspPresetRecipe => ({
    id: eq.id,
    labelKey: eq.labelKey,
    group: 'genre',
    eq: eq.id,
    compressor: 'gentle',
  })),
];

/** Complete chains in the order the picker shows them. */
export const DSP_PRESETS: readonly IDspPreset[] = orderRelatedStyles(
  DSP_PRESET_GROUPS.flatMap((group) =>
    recipes
      .filter((recipe) => recipe.group === group)
      .map((recipe) => ({
        id: recipe.id,
        labelKey: recipe.labelKey,
        group: recipe.group,
        settings: materialize(recipe),
        copyLabelKey:
          recipe.room === undefined
            ? undefined
            : (recipe.copyLabelKey ?? 'dsp.room.title'),
      })),
  ),
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
    // Selecting a sound restores its Game mode preference. The independent
    // switch can then override it without changing the selected sound.
    gameMode: preset.settings.gameMode,
    // Crossfade is playback behaviour, not a colour in the DSP rack. A chain
    // choice must never silently start, stop or reshape the next transition.
    crossfade: current?.crossfade ?? preset.settings.crossfade,
    // And the surround switch is the machine, not the sound: it says which
    // channels of THIS output the rack runs on. Every recipe is built from
    // the defaults, so without this a listener who had chosen the front pair
    // had all six channels back the moment they auditioned a preset — with
    // nothing on the page saying so.
    surround: current?.surround ?? preset.settings.surround,
    // The Room's switch and shape are the chain's, the head and the rest of
    // the listener's own are not: see `chainRoom`. (For a day the whole Room
    // was carried over instead, after presets built from the defaults were
    // found switching it off unasked. Ivan's call, 2026-09-18: it is a stage
    // of the rack, a chain that does not use it switches it off, and the
    // chains that do are offered as copies — "Gaming · Room".)
    room: chainRoom(current?.room, preset.settings.room),
  });
};
