/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IFootstepsSettings } from './footsteps';

/**
 * The Game filter's presets: five by kind of game, then one per title,
 * grouped as the picker shows them.
 */
export const FOOTSTEPS_PRESET_GROUPS = [
  'kinds',
  'competitive',
  'battle',
  'tactical',
  'moba',
  'rpg',
  'story',
] as const;

export type TFootstepsPresetGroup = (typeof FOOTSTEPS_PRESET_GROUPS)[number];

/**
 * The Room's featured rooms a game is offered, by what each does for one:
 * the surrounds where a game mixes them, nothing but the speakers and the
 * head, what is behind you louder, a wide stage, a stereo game spread round
 * the ring, a film's front. Rooms that exist and measure apart
 * (`room_profiles_test.cpp`) — never a new room that would measure as one of
 * these, which is how three were taken back on 2026-09-19.
 */
export const GAME_ROOMS = [
  'gameWorldV2',
  'competitiveV2',
  'rearGuardV2',
  'wideStageV2',
  'allAroundV2',
  'cinemaV2',
] as const;

export type TGameRoom = (typeof GAME_ROOMS)[number];

export const isGameRoom = (id: string): id is TGameRoom =>
  (GAME_ROOMS as readonly string[]).includes(id);

/**
 * A preset owns how the filter sounds, never whether it runs: a chain
 * decides that, as it does for every other stage. Isolate is a way of
 * listening, and the Room for games is about the listener's headphones,
 * not the game: no preset carries those.
 */
export type IFootstepsPresetSettings = Omit<
  IFootstepsSettings,
  'enabled' | 'isolate' | 'presetId' | 'useRoom'
>;

export interface IFootstepsPreset {
  id: string;
  /** A kind of game's name, translated; empty for a title. */
  labelKey: string;
  /** A kind's games, translated, as the picker names them under it. */
  hintKey?: string;
  /** A game's own title: a brand, the same in every language. */
  title?: string;
  group: TFootstepsPresetGroup;
  room: TGamePresetRoom;
  settings: IFootstepsPresetSettings;
}

/**
 * What a preset does to the Room: `own3d` where the game places its sounds
 * around the head itself — the Room would put a second head around the first,
 * and a step would come from two places — `none` where the game is best as
 * it was mixed (Alien: Isolation, Ivan's ears), `keep` for a kind of game,
 * which leaves the Room as the chain set it, or the room the game is best in
 * on headphones.
 */
export type TGamePresetRoom = TGameRoom | 'own3d' | 'none' | 'keep';

/** The presets that switch the Room off, by either reason. */
export const keepsRoomOff = (room: TGamePresetRoom): room is 'own3d' | 'none' =>
  room === 'own3d' || room === 'none';

type TPresetTable = Record<string, Omit<IFootstepsPreset, 'id'>>;

/** Its name and what it is for written out whole: the dead-keys guard reads
 * keys, not templates. */
const kind = (
  labelKey: string,
  hintKey: string,
  room: IFootstepsPreset['room'],
  settings: IFootstepsPresetSettings,
): Omit<IFootstepsPreset, 'id'> => ({
  labelKey,
  hintKey,
  group: 'kinds',
  room,
  settings,
});

const title = (
  name: string,
  group: TFootstepsPresetGroup,
  room: IFootstepsPreset['room'],
  settings: IFootstepsPresetSettings,
): Omit<IFootstepsPreset, 'id'> => ({
  labelKey: '',
  title: name,
  group,
  room,
  settings,
});

/**
 * Start with the original mix and add detected cues. The former presets
 * combined that lift with moving ambience gain, Calm and dialogue ducking;
 * those moved the score whenever their detectors changed their minds.
 * These remain deliberate controls, and stored settings keep their values;
 * only a fresh factory pick opts into these neutral defaults.
 * Lift and Heavy retain the title's tuning, as does its Room recommendation.
 */
const FOOTSTEPS_PRESET_TABLE = {
  competitive: kind(
    'dsp.footstepsPreset.competitive',
    'dsp.footstepsPreset.competitiveGames',
    'keep',
    {
      lift: 0.85,
      calm: 0,
      heavy: false,
      environment: 0,
      voices: 0,
      duck: false,
    },
  ),
  battleRoyale: kind(
    'dsp.footstepsPreset.battleRoyale',
    'dsp.footstepsPreset.battleRoyaleGames',
    'keep',
    {
      lift: 1,
      calm: 0,
      heavy: false,
      environment: 0,
      voices: 0,
      duck: false,
    },
  ),
  tactical: kind(
    'dsp.footstepsPreset.tactical',
    'dsp.footstepsPreset.tacticalGames',
    'keep',
    {
      lift: 0.8,
      calm: 0,
      heavy: true,
      environment: 0,
      voices: 0,
      duck: false,
    },
  ),
  story: kind(
    'dsp.footstepsPreset.story',
    'dsp.footstepsPreset.storyGames',
    'keep',
    {
      lift: 0.75,
      calm: 0,
      heavy: false,
      environment: 0,
      voices: 0,
      duck: false,
    },
  ),
  immersive: kind(
    'dsp.footstepsPreset.immersive',
    'dsp.footstepsPreset.immersiveGames',
    'gameWorldV2',
    {
      lift: 0.65,
      calm: 0,
      heavy: true,
      environment: 0,
      voices: 0,
      duck: false,
    },
  ),
  // Four kinds by what a game needs heard rather than by genre name (Ivan,
  // 2026-11-03), each the Game filter's half of a gaming chain.
  topDown: kind(
    'dsp.footstepsPreset.topDown',
    'dsp.footstepsPreset.topDownGames',
    'wideStageV2',
    {
      lift: 0.55,
      calm: 0,
      heavy: false,
      environment: 0,
      voices: 0,
      duck: false,
    },
  ),
  worlds: kind(
    'dsp.footstepsPreset.worlds',
    'dsp.footstepsPreset.worldsGames',
    'allAroundV2',
    {
      lift: 0.5,
      calm: 0,
      heavy: true,
      environment: 0,
      voices: 0,
      duck: false,
    },
  ),
  speed: kind(
    'dsp.footstepsPreset.speed',
    'dsp.footstepsPreset.speedGames',
    'gameWorldV2',
    {
      lift: 0.35,
      calm: 0,
      heavy: false,
      environment: 0,
      voices: 0,
      duck: false,
    },
  ),
  impact: kind(
    'dsp.footstepsPreset.impact',
    'dsp.footstepsPreset.impactGames',
    'cinemaV2',
    {
      lift: 0.45,
      calm: 0,
      heavy: true,
      environment: 0,
      voices: 0,
      duck: false,
    },
  ),

  cs2: title('Counter-Strike 2', 'competitive', 'own3d', {
    lift: 0.9,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  valorant: title('Valorant', 'competitive', 'own3d', {
    lift: 0.85,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  r6: title('Rainbow Six Siege', 'competitive', 'competitiveV2', {
    lift: 0.9,
    calm: 0,
    heavy: true,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  ow2: title('Overwatch 2', 'competitive', 'own3d', {
    lift: 0.85,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  marvelRivals: title('Marvel Rivals', 'competitive', 'own3d', {
    lift: 0.85,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),

  cod: title('Call of Duty: Warzone, Black Ops', 'battle', 'own3d', {
    lift: 1,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  apex: title('Apex Legends', 'battle', 'competitiveV2', {
    lift: 1,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  fortnite: title('Fortnite', 'battle', 'own3d', {
    lift: 1,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  pubg: title('PUBG: Battlegrounds', 'battle', 'own3d', {
    lift: 1,
    calm: 0,
    heavy: true,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  bf6: title('Battlefield 6', 'battle', 'own3d', {
    lift: 1,
    calm: 0,
    heavy: true,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  helldivers2: title('Helldivers 2', 'battle', 'gameWorldV2', {
    lift: 0.9,
    calm: 0,
    heavy: true,
    environment: 0,
    voices: 0,
    duck: false,
  }),

  tarkov: title('Escape from Tarkov', 'tactical', 'own3d', {
    lift: 0.85,
    calm: 0,
    heavy: true,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  hunt: title('Hunt: Showdown 1896', 'tactical', 'own3d', {
    lift: 0.9,
    calm: 0,
    heavy: true,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  arma: title('Arma Reforger', 'tactical', 'wideStageV2', {
    lift: 0.95,
    calm: 0,
    heavy: true,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  dayz: title('DayZ', 'tactical', 'gameWorldV2', {
    lift: 0.9,
    calm: 0,
    heavy: true,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  rust: title('Rust', 'tactical', 'competitiveV2', {
    lift: 0.95,
    calm: 0,
    heavy: true,
    environment: 0,
    voices: 0,
    duck: false,
  }),

  lol: title('League of Legends', 'moba', 'wideStageV2', {
    lift: 0.6,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  dota2: title('Dota 2', 'moba', 'wideStageV2', {
    lift: 0.6,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  hots: title('Heroes of the Storm', 'moba', 'wideStageV2', {
    lift: 0.6,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),

  wow: title('World of Warcraft', 'rpg', 'allAroundV2', {
    lift: 0.55,
    calm: 0,
    heavy: true,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  ffxiv: title('Final Fantasy XIV', 'rpg', 'allAroundV2', {
    lift: 0.5,
    calm: 0,
    heavy: true,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  diablo4: title('Diablo IV', 'rpg', 'wideStageV2', {
    lift: 0.6,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  eldenRing: title('Elden Ring', 'rpg', 'allAroundV2', {
    lift: 0.75,
    calm: 0,
    heavy: true,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  bg3: title("Baldur's Gate 3", 'rpg', 'cinemaV2', {
    lift: 0.45,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  cyberpunk: title('Cyberpunk 2077', 'rpg', 'own3d', {
    lift: 0.7,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),

  re23: title('Resident Evil 2, Resident Evil 3', 'story', 'own3d', {
    lift: 0.8,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  re4: title('Resident Evil 4', 'story', 'rearGuardV2', {
    lift: 0.8,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  alien: title('Alien: Isolation', 'story', 'none', {
    lift: 0.75,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  tlou: title('The Last of Us', 'story', 'own3d', {
    lift: 0.8,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  sh2: title('Silent Hill 2', 'story', 'rearGuardV2', {
    lift: 0.75,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  deadspace: title('Dead Space', 'story', 'own3d', {
    lift: 0.75,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  hogwarts: title('Hogwarts Legacy', 'story', 'cinemaV2', {
    lift: 0.6,
    calm: 0,
    heavy: false,
    environment: 0,
    voices: 0,
    duck: false,
  }),
  rdr2: title('Red Dead Redemption 2', 'story', 'allAroundV2', {
    lift: 0.7,
    calm: 0,
    heavy: true,
    environment: 0,
    voices: 0,
    duck: false,
  }),
} satisfies TPresetTable;

export type TFootstepsPresetId = keyof typeof FOOTSTEPS_PRESET_TABLE;

export const FOOTSTEPS_PRESET_BY_ID = Object.fromEntries(
  Object.entries(FOOTSTEPS_PRESET_TABLE).map(([id, preset]) => [
    id,
    { id, ...preset },
  ]),
) as Record<TFootstepsPresetId, IFootstepsPreset>;

export const FOOTSTEPS_PRESETS: readonly IFootstepsPreset[] = Object.values(
  FOOTSTEPS_PRESET_BY_ID,
);

/**
 * A fresh filter from a preset; whether it runs is the caller's, and what
 * is the listener's — the Room for games — stays as it was: off for a
 * filter that never had it.
 */
export const footstepsSettingsOf = (
  preset: IFootstepsPreset,
  on: boolean,
  listener?: Pick<IFootstepsSettings, 'useRoom'>,
): IFootstepsSettings => ({
  enabled: on,
  isolate: false,
  presetId: preset.id,
  ...preset.settings,
  useRoom: listener?.useRoom ?? false,
});

export const footstepsPresetSettings = (
  id: TFootstepsPresetId,
  on: boolean,
  listener?: Pick<IFootstepsSettings, 'useRoom'>,
): IFootstepsSettings =>
  footstepsSettingsOf(FOOTSTEPS_PRESET_BY_ID[id], on, listener);

/** The preset of an id, or nothing for a hand edit or a saved one. */
export const footstepsPresetOf = (id: string): IFootstepsPreset | undefined =>
  Object.prototype.hasOwnProperty.call(FOOTSTEPS_PRESET_BY_ID, id)
    ? FOOTSTEPS_PRESET_BY_ID[id as TFootstepsPresetId]
    : undefined;
