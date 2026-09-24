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
import { denoisePresetSettings } from './denoisePresets';
import { dimensionPresetSettings } from './dimensionPresets';
import { EQ_PRESETS, eqSettingsForPreset } from './eqPresets';
import { exciterPresetSettings } from './exciterPresets';
import { IGenreRack, TGenreStage, inGenreChain } from './genreRack';
import { GENRE_RACKS, genreChainId, genreLabelKey } from './genres';
import { TMasterPresetId, masterPresetSettings } from './masterPresets';
import { maximizerPresetSettings } from './maximizerPresets';
import {
  DSP_PRESET_GROUPS,
  DSP_PRESET_RECIPES,
  IDspPresetRecipe,
  TDspPresetGroup,
} from './presetRecipes';
import { presetCurve, presetSupport } from './presetCurve';
import { roomPresetSettings } from './roomPresets';
import { withRoomTone } from './roomTone';
import {
  BASS_FORGE_CATALOGUE,
  BASS_PUNCH_CATALOGUE,
  DIMENSION_CATALOGUE,
  EXCITER_CATALOGUE,
  IStageCatalogue,
  MAXIMIZER_CATALOGUE,
} from './stageCatalogues';
import { VOICING_PROFILES } from '../voicing';
import orderRelatedStyles from './presetOrder';

export { DSP_PRESET_GROUPS } from './presetRecipes';
export type { TDspPresetGroup } from './presetRecipes';

export interface IDspPreset {
  id: string;
  labelKey: string;
  group: TDspPresetGroup;
  /**
   * The rack. Its EQ holds only what supports the other stages, never the
   * preset's tone: see `curve` and `presetCurve.ts`.
   */
  settings: IDspSettings;
  /**
   * The preset's tone, played as the Preset layer of the main EQ on either
   * engine — or undefined for a preset that leaves the tone alone.
   */
  curve: IEqSettings | undefined;
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

const masterProfile = (id: TMasterPresetId, gainMatch = false) => ({
  ...masterPresetSettings(id, DSP_DEFAULTS.master),
  enabled: true,
  loudnessMaximize: true,
  outputTrimDb: 0,
  matchedBypass: gainMatch,
});

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
    // Only the EQ's support stays in the rack; its tone is the preset's
    // curve (`presetCurve.ts`). A Room copy adds what keeps its chain's tone
    // through the Room, which belongs in front of the Room: see `roomTone.ts`.
    eq: recipe.room
      ? withRoomTone(presetSupport(recipeEq(recipe)), recipe.room)
      : presetSupport(recipeEq(recipe)),
    exciter: recipe.exciter
      ? exciterPresetSettings(recipe.exciter, true)
      : DSP_DEFAULTS.exciter,
    bassForge: recipe.bassForge
      ? bassForgePresetSettings(recipe.bassForge, true)
      : DSP_DEFAULTS.bassForge,
    bassPunch: recipe.bassPunch
      ? bassPunchPresetSettings(recipe.bassPunch, true)
      : DSP_DEFAULTS.bassPunch,
    dimension: recipe.dimension
      ? dimensionPresetSettings(recipe.dimension, true)
      : DSP_DEFAULTS.dimension,
    // Every chain's Maximizer is a named profile, so no preset opens that
    // stage's picker on Custom (`maximizerPresets.ts`).
    maximizer: recipe.maximizer
      ? maximizerPresetSettings(recipe.maximizer, true)
      : DSP_DEFAULTS.maximizer,
    master: recipe.master
      ? masterProfile(recipe.master, recipe.masterGainMatch)
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

/**
 * A stage of a genre's chain: the genre's own profile when its row switches
 * the stage on, and the stage's defaults — off — when it does not.
 *
 * Looked up in the stage's catalogue rather than built from the row, so the
 * chain holds exactly what the stage's picker applies for the same name.
 */
const genreStage = <S>(
  rack: IGenreRack,
  stage: TGenreStage,
  stageCatalogue: IStageCatalogue<{ id: string }, S>,
  off: S,
): S =>
  inGenreChain(rack, stage)
    ? (stageCatalogue.settings(rack.id, true) ?? off)
    : off;

/**
 * A genre's chain: its curve, played in the main EQ, and every stage its row
 * sets, each at the genre's own profile.
 *
 * The Normalizer is off because the Maximizer ends every one of these chains
 * and holds the ceiling itself. With both on, a record mastered over full
 * scale was limited twice, at the input and again at the end, and measured
 * on twelve records the chain played 0.15-0.25 dB quieter and pumped more for
 * the first pass than it did with only the last (2026-09-23).
 */
const materializeGenre = (rack: IGenreRack): IDspSettings =>
  clampDspSettings({
    ...DSP_DEFAULTS,
    enabled: true,
    presetId: genreChainId(rack),
    normalizer: { ...DSP_DEFAULTS.normalizer, mode: 'off' },
    eq: presetSupport(eqProfile(rack.id)),
    exciter: genreStage(
      rack,
      'exciter',
      EXCITER_CATALOGUE,
      DSP_DEFAULTS.exciter,
    ),
    bassForge: genreStage(
      rack,
      'bassForge',
      BASS_FORGE_CATALOGUE,
      DSP_DEFAULTS.bassForge,
    ),
    bassPunch: genreStage(
      rack,
      'bassPunch',
      BASS_PUNCH_CATALOGUE,
      DSP_DEFAULTS.bassPunch,
    ),
    dimension: genreStage(
      rack,
      'dimension',
      DIMENSION_CATALOGUE,
      DSP_DEFAULTS.dimension,
    ),
    maximizer: genreStage(
      rack,
      'maximizer',
      MAXIMIZER_CATALOGUE,
      DSP_DEFAULTS.maximizer,
    ),
  });

const recipeEntries: readonly IDspPreset[] = DSP_PRESET_RECIPES.map(
  (recipe) => ({
    id: recipe.id,
    labelKey: recipe.labelKey,
    group: recipe.group,
    settings: materialize(recipe),
    curve: presetCurve(recipeEq(recipe)),
    copyLabelKey:
      recipe.room === undefined
        ? undefined
        : (recipe.copyLabelKey ?? 'dsp.room.title'),
  }),
);

// Every EQ genre is also a complete chain, and every one of them is a row of
// the genre racks: a curve with no rack would ship as a chain that borrowed
// nothing and did nothing but tone, which is what these rows replaced.
const genreEntries: readonly IDspPreset[] = GENRE_RACKS.map((rack) => ({
  id: genreChainId(rack),
  labelKey: genreLabelKey(rack),
  group: 'genre',
  settings: materializeGenre(rack),
  curve: presetCurve(eqProfile(rack.id)),
  copyLabelKey: undefined,
}));

/** Complete chains in the order the picker shows them. */
export const DSP_PRESETS: readonly IDspPreset[] = orderRelatedStyles(
  DSP_PRESET_GROUPS.flatMap((group) =>
    [...recipeEntries, ...genreEntries].filter(
      (entry) => entry.group === group,
    ),
  ),
);

export const isDspPresetId = (id: string): boolean =>
  DSP_PRESETS.some((preset) => preset.id === id);

/** The tone a preset plays in the main EQ, or undefined for none. */
export const dspPresetCurve = (id: string): IEqSettings | undefined =>
  DSP_PRESETS.find((candidate) => candidate.id === id)?.curve;

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
    // The EQ's Treble choice is the listener's for the same reason: how every
    // band plays near the top, as the main EQ's Treble row is, and no
    // chain's to take away (`eqSettingsForPreset`).
    eq: {
      ...preset.settings.eq,
      treble: current?.eq.treble ?? preset.settings.eq.treble,
    },
    // The Room's switch and shape are the chain's, the head and the rest of
    // the listener's own are not: see `chainRoom`. (For a day the whole Room
    // was carried over instead, after presets built from the defaults were
    // found switching it off unasked. Ivan's call, 2026-09-18: it is a stage
    // of the rack, a chain that does not use it switches it off, and the
    // chains that do are offered as copies — "Gaming · Room".)
    room: chainRoom(current?.room, preset.settings.room),
  });
};
