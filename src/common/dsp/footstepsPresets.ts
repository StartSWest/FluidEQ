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
 * The shooters, tactical and story games each tuned on a recording of the
 * game's own play (2026-11-01, replayed through the stage): how far its
 * distant steps sat under the mix, how much of its sound is weather and room
 * tone, how often somebody speaks, and whether it has its own 3D sound,
 * checked at each game's own settings. The MOBA and RPG titles and Marvel
 * Rivals, Helldivers 2 and Rust, added the same evening at Ivan's asking,
 * are set from their kind of game and their own audio settings.
 *
 * - Competitive shooters: steps forward and the bed down, voices barely —
 *   a callout is a teammate on the voice chat, not the game.
 * - Battle royale and large battles: the most lift and the most calm, the
 *   explosions never stop and an enemy's steps are far away.
 * - Tactical and survival: a world kept as it sounds, hooves and heavy
 *   boots carried (Hunt's horses, Arma's convoys, DayZ's infected).
 * - MOBA and strategy: seen from above, so no step is behind anybody — a
 *   middling lift for an ability coming out of the fog, the team fights
 *   calmed, a hero's lines forward, and a wide stage on headphones.
 * - MMO and RPG: a world to be in — the bed up, quest dialogue forward with
 *   the score stepping back, hooves for the mounts, the ring around you.
 * - Story and horror: the bed up for the dread, every line of dialogue
 *   forward with the score stepping back for it, and the steps of whatever
 *   hunts you lifted as hard as a shooter's: replayed at the old Story
 *   profile (Lift 0.4) the cues came up 1 to 2.4 dB, heard by nobody.
 *
 * Own 3D sound, Room off: Counter-Strike 2 (Steam Audio, always on),
 * Valorant (HRTF), Overwatch 2 (Dolby Atmos for Headphones), Marvel Rivals
 * (3D Enhancement), Call of Duty (Enhanced Headphone Mode), Fortnite (3D
 * Headphones), PUBG (HRTF), Battlefield 6 (3D Headphones), Tarkov
 * (binaural), Hunt (CrySpatial), Cyberpunk 2077 (its headphone mode), the
 * Resident Evil 2 and 3 remakes (binaural), The Last of Us (3D audio) and
 * Dead Space (3D Headphones). Alien: Isolation has none and keeps the Room
 * off all the same: it is more frightening as it was mixed (Ivan,
 * 2026-11-01). Final Fantasy XIV has 3D sound only with a paid add-on, so it
 * gets the Room, like the rest.
 */
const FOOTSTEPS_PRESET_TABLE = {
  competitive: kind(
    'dsp.footstepsPreset.competitive',
    'dsp.footstepsPreset.competitiveGames',
    'keep',
    {
      lift: 0.85,
      calm: 0.5,
      heavy: false,
      environment: -0.4,
      voices: 0.3,
      duck: false,
    },
  ),
  battleRoyale: kind(
    'dsp.footstepsPreset.battleRoyale',
    'dsp.footstepsPreset.battleRoyaleGames',
    'keep',
    {
      lift: 1,
      calm: 0.8,
      heavy: false,
      environment: -0.5,
      voices: 0.3,
      duck: false,
    },
  ),
  tactical: kind(
    'dsp.footstepsPreset.tactical',
    'dsp.footstepsPreset.tacticalGames',
    'keep',
    {
      lift: 0.8,
      calm: 0.6,
      heavy: true,
      environment: -0.2,
      voices: 0.3,
      duck: false,
    },
  ),
  story: kind(
    'dsp.footstepsPreset.story',
    'dsp.footstepsPreset.storyGames',
    'keep',
    {
      lift: 0.75,
      calm: 0.3,
      heavy: false,
      environment: 0.2,
      voices: 0.55,
      duck: true,
    },
  ),
  immersive: kind(
    'dsp.footstepsPreset.immersive',
    'dsp.footstepsPreset.immersiveGames',
    'gameWorldV2',
    {
      lift: 0.65,
      calm: 0.35,
      heavy: true,
      environment: 0.3,
      voices: 0.5,
      duck: true,
    },
  ),
  // Four kinds by what a game needs heard rather than by genre name (Ivan,
  // 2026-11-03), each the Game filter's half of a gaming chain.
  topDown: kind(
    'dsp.footstepsPreset.topDown',
    'dsp.footstepsPreset.topDownGames',
    'wideStageV2',
    {
      // Seen from above: an ability coming out of the fog lifted, team
      // fights calmed hard, a hero's lines forward over the score.
      lift: 0.55,
      calm: 0.6,
      heavy: false,
      environment: -0.2,
      voices: 0.55,
      duck: true,
    },
  ),
  worlds: kind(
    'dsp.footstepsPreset.worlds',
    'dsp.footstepsPreset.worldsGames',
    'allAroundV2',
    {
      // A world to be in: weather and towns up, quest dialogue forward with
      // the score stepping back, mounts carried.
      lift: 0.5,
      calm: 0.3,
      heavy: true,
      environment: 0.35,
      voices: 0.55,
      duck: true,
    },
  ),
  speed: kind(
    'dsp.footstepsPreset.speed',
    'dsp.footstepsPreset.speedGames',
    'gameWorldV2',
    {
      // Racing: a car closing in lifted, crashes calmed, wind turned down;
      // the engine is the game's and is left as it is.
      lift: 0.35,
      calm: 0.4,
      heavy: false,
      environment: -0.35,
      voices: 0.4,
      duck: false,
    },
  ),
  impact: kind(
    'dsp.footstepsPreset.impact',
    'dsp.footstepsPreset.impactGames',
    'cinemaV2',
    {
      // Fighting, action and sports: a move's wind-up lifted, the crowd's
      // roar calmed so the announcer and the hits stay on top.
      lift: 0.45,
      calm: 0.5,
      heavy: true,
      environment: -0.25,
      voices: 0.45,
      duck: false,
    },
  ),

  cs2: title('Counter-Strike 2', 'competitive', 'own3d', {
    lift: 0.9,
    calm: 0.5,
    heavy: false,
    environment: -0.4,
    voices: 0.2,
    duck: false,
  }),
  valorant: title('Valorant', 'competitive', 'own3d', {
    lift: 0.85,
    calm: 0.5,
    heavy: false,
    environment: -0.4,
    voices: 0.25,
    duck: false,
  }),
  r6: title('Rainbow Six Siege', 'competitive', 'competitiveV2', {
    lift: 0.9,
    calm: 0.55,
    heavy: true,
    environment: -0.3,
    voices: 0.2,
    duck: false,
  }),
  ow2: title('Overwatch 2', 'competitive', 'own3d', {
    lift: 0.85,
    calm: 0.45,
    heavy: false,
    environment: -0.3,
    voices: 0.45,
    duck: false,
  }),
  marvelRivals: title('Marvel Rivals', 'competitive', 'own3d', {
    lift: 0.85,
    calm: 0.55,
    heavy: false,
    environment: -0.3,
    voices: 0.45,
    duck: false,
  }),

  cod: title('Call of Duty: Warzone, Black Ops', 'battle', 'own3d', {
    lift: 1,
    calm: 0.8,
    heavy: false,
    environment: -0.5,
    voices: 0.3,
    duck: false,
  }),
  apex: title('Apex Legends', 'battle', 'competitiveV2', {
    lift: 1,
    calm: 0.75,
    heavy: false,
    environment: -0.4,
    voices: 0.35,
    duck: false,
  }),
  fortnite: title('Fortnite', 'battle', 'own3d', {
    lift: 1,
    calm: 0.7,
    heavy: false,
    environment: -0.4,
    voices: 0.3,
    duck: false,
  }),
  pubg: title('PUBG: Battlegrounds', 'battle', 'own3d', {
    lift: 1,
    calm: 0.8,
    heavy: true,
    environment: -0.5,
    voices: 0.3,
    duck: false,
  }),
  bf6: title('Battlefield 6', 'battle', 'own3d', {
    lift: 1,
    calm: 0.85,
    heavy: true,
    environment: -0.5,
    voices: 0.35,
    duck: false,
  }),
  helldivers2: title('Helldivers 2', 'battle', 'gameWorldV2', {
    lift: 0.9,
    calm: 0.85,
    heavy: true,
    environment: -0.3,
    voices: 0.4,
    duck: false,
  }),

  tarkov: title('Escape from Tarkov', 'tactical', 'own3d', {
    lift: 0.85,
    calm: 0.6,
    heavy: true,
    environment: -0.3,
    voices: 0.3,
    duck: false,
  }),
  hunt: title('Hunt: Showdown 1896', 'tactical', 'own3d', {
    lift: 0.9,
    calm: 0.6,
    heavy: true,
    environment: -0.2,
    voices: 0.2,
    duck: false,
  }),
  arma: title('Arma Reforger', 'tactical', 'wideStageV2', {
    lift: 0.95,
    calm: 0.7,
    heavy: true,
    environment: -0.3,
    voices: 0.35,
    duck: false,
  }),
  dayz: title('DayZ', 'tactical', 'gameWorldV2', {
    lift: 0.9,
    calm: 0.5,
    heavy: true,
    environment: -0.2,
    voices: 0.45,
    duck: false,
  }),
  rust: title('Rust', 'tactical', 'competitiveV2', {
    lift: 0.95,
    calm: 0.6,
    heavy: true,
    environment: -0.3,
    voices: 0.35,
    duck: false,
  }),

  lol: title('League of Legends', 'moba', 'wideStageV2', {
    lift: 0.6,
    calm: 0.6,
    heavy: false,
    environment: -0.2,
    voices: 0.4,
    duck: false,
  }),
  dota2: title('Dota 2', 'moba', 'wideStageV2', {
    lift: 0.6,
    calm: 0.6,
    heavy: false,
    environment: -0.2,
    voices: 0.4,
    duck: false,
  }),
  hots: title('Heroes of the Storm', 'moba', 'wideStageV2', {
    lift: 0.6,
    calm: 0.55,
    heavy: false,
    environment: -0.1,
    voices: 0.45,
    duck: false,
  }),

  wow: title('World of Warcraft', 'rpg', 'allAroundV2', {
    lift: 0.55,
    calm: 0.4,
    heavy: true,
    environment: 0.25,
    voices: 0.5,
    duck: true,
  }),
  ffxiv: title('Final Fantasy XIV', 'rpg', 'allAroundV2', {
    lift: 0.5,
    calm: 0.4,
    heavy: true,
    environment: 0.25,
    voices: 0.55,
    duck: true,
  }),
  diablo4: title('Diablo IV', 'rpg', 'wideStageV2', {
    lift: 0.6,
    calm: 0.6,
    heavy: false,
    environment: 0.1,
    voices: 0.5,
    duck: true,
  }),
  eldenRing: title('Elden Ring', 'rpg', 'allAroundV2', {
    lift: 0.75,
    calm: 0.45,
    heavy: true,
    environment: 0.3,
    voices: 0.5,
    duck: true,
  }),
  bg3: title("Baldur's Gate 3", 'rpg', 'cinemaV2', {
    lift: 0.45,
    calm: 0.3,
    heavy: false,
    environment: 0.2,
    voices: 0.7,
    duck: true,
  }),
  cyberpunk: title('Cyberpunk 2077', 'rpg', 'own3d', {
    lift: 0.7,
    calm: 0.55,
    heavy: false,
    environment: 0.1,
    voices: 0.6,
    duck: true,
  }),

  re23: title('Resident Evil 2, Resident Evil 3', 'story', 'own3d', {
    lift: 0.8,
    calm: 0.25,
    heavy: false,
    environment: 0.25,
    voices: 0.55,
    duck: true,
  }),
  re4: title('Resident Evil 4', 'story', 'rearGuardV2', {
    lift: 0.8,
    calm: 0.3,
    heavy: false,
    environment: 0.25,
    voices: 0.55,
    duck: true,
  }),
  alien: title('Alien: Isolation', 'story', 'none', {
    lift: 0.75,
    calm: 0.2,
    heavy: false,
    environment: 0.35,
    voices: 0.45,
    duck: true,
  }),
  tlou: title('The Last of Us', 'story', 'own3d', {
    lift: 0.8,
    calm: 0.3,
    heavy: false,
    environment: 0.25,
    voices: 0.6,
    duck: true,
  }),
  sh2: title('Silent Hill 2', 'story', 'rearGuardV2', {
    lift: 0.75,
    calm: 0.25,
    heavy: false,
    environment: 0.45,
    voices: 0.55,
    duck: true,
  }),
  deadspace: title('Dead Space', 'story', 'own3d', {
    lift: 0.75,
    calm: 0.3,
    heavy: false,
    environment: 0.35,
    voices: 0.5,
    duck: true,
  }),
  hogwarts: title('Hogwarts Legacy', 'story', 'cinemaV2', {
    lift: 0.6,
    calm: 0.35,
    heavy: false,
    environment: 0.2,
    voices: 0.65,
    duck: true,
  }),
  rdr2: title('Red Dead Redemption 2', 'story', 'allAroundV2', {
    lift: 0.7,
    calm: 0.35,
    heavy: true,
    environment: 0.2,
    voices: 0.6,
    duck: true,
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
