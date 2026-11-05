/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Gaming profiles, and the copy of one each game plays.
 *
 * A Gaming profile is a whole sound for games: its own EQ, Tone, curve and
 * rack, the Game filter in it. It is never played as it is. A game added to
 * the Gaming Lab takes a copy, and that copy is what is tuned and heard for
 * that game alone; the profile it came from stays as it was (Ivan,
 * 2026-11-02: "they kind of get the copy of the original and tune it more
 * for their taste"). Ready-made profiles come from the Game filter's own
 * presets, one per kind of game and one per title; the listener's own are a
 * game's copy saved under a name.
 */

import type { IDspSettings, IEqSettings } from './dsp/chain';
import {
  FOOTSTEPS_PRESETS,
  footstepsPresetOf,
  IFootstepsPreset,
  TFootstepsPresetGroup,
} from './dsp/footstepsPresets';
import type { TRoomPresetId } from './dsp/roomPresets';

/** A ready-made profile's id: its Game filter preset's, prefixed. */
const READY = 'ready:';
/** One of the listener's own, by the id main gave it. */
const YOURS = 'yours:';
/**
 * A game row from before the Gaming Lab, which named a DSP chain. Kept
 * playing as it did: its copy starts from that chain's rack.
 */
const CHAIN = 'chain:';

export const readyGamingProfileId = (footstepsId: string): string =>
  `${READY}${footstepsId}`;
export const yoursGamingProfileId = (id: string): string => `${YOURS}${id}`;
export const chainGamingProfileId = (chainId: string): string =>
  `${CHAIN}${chainId}`;

export type TGamingProfileRef =
  | { kind: 'ready'; preset: IFootstepsPreset }
  | { kind: 'yours'; id: string }
  | { kind: 'chain'; chainId: string };

/** What a stored profile id names, or nothing for one that is gone. */
export const gamingProfileRef = (
  id: string | undefined,
): TGamingProfileRef | undefined => {
  if (!id) {
    return undefined;
  }
  if (id.startsWith(READY)) {
    const preset = footstepsPresetOf(id.slice(READY.length));
    return preset ? { kind: 'ready', preset } : undefined;
  }
  if (id.startsWith(YOURS)) {
    const own = id.slice(YOURS.length);
    return own ? { kind: 'yours', id: own } : undefined;
  }
  if (id.startsWith(CHAIN)) {
    const chainId = id.slice(CHAIN.length);
    return chainId ? { kind: 'chain', chainId } : undefined;
  }
  return undefined;
};

const COMPETITIVE_GROUPS: readonly TFootstepsPresetGroup[] = [
  'competitive',
  'battle',
  'tactical',
];
const COMPETITIVE_KINDS: readonly string[] = [
  'competitive',
  'battleRoyale',
  'tactical',
];

/*
 * The gaming chains a ready-made profile starts from (10. DSP's, group
 * 'gaming', 2026-11-03: each a gaming Game filter kind, Dynamics, Punch,
 * Forge, Dimension and Maximizer, levelled within 1 dB of the global Gaming
 * chain), by kind of game and by title group. Game Night is the listener's
 * to pick, never a start.
 */
const KIND_CHAINS: Readonly<Record<string, string>> = {
  competitive: 'game-pinpoint',
  battleRoyale: 'game-blast',
  tactical: 'game-stealth',
  story: 'game-cinematic',
  immersive: 'game-cinematic',
  topDown: 'game-topdown',
  worlds: 'game-worlds',
  speed: 'game-speed',
  impact: 'game-impact',
};

const GROUP_CHAINS: Readonly<Record<string, string>> = {
  competitive: 'game-pinpoint',
  battle: 'game-blast',
  tactical: 'game-stealth',
  moba: 'game-topdown',
  rpg: 'game-worlds',
  story: 'game-cinematic',
};

/** The horror among the story titles: something hunting you in the dark. */
const DREAD_TITLES: readonly string[] = [
  're23',
  're4',
  'alien',
  'sh2',
  'deadspace',
];

/** For a kind or a group added later with no chain named for it yet. */
const ANY_GAME_CHAIN = 'game-cinematic';

/**
 * The rack a ready-made profile starts from: its kind's gaming chain, or
 * its title's group's, Dread for the horror titles. The Room is not the
 * chain's — none of them carries one — but `readyGamingRoom`'s and the
 * profile's, through `pickGame`. It used to be the global Gaming chain or
 * one of its two Room copies; those stay for the DSP page.
 */
export const readyGamingChain = (preset: IFootstepsPreset): string => {
  if (DREAD_TITLES.includes(preset.id)) {
    return 'game-dread';
  }
  return (
    (preset.group === 'kinds'
      ? KIND_CHAINS[preset.id]
      : GROUP_CHAINS[preset.group]) ?? ANY_GAME_CHAIN
  );
};

/**
 * The room a kind that keeps its chain's room (`room: 'keep'`) stands in,
 * for a listener who has said they wear headphones (their Room on, or the
 * word kept on the Game filter): the rooms the global Gaming chain's two
 * Room copies carried — the Competitive room, no walls and no tail, for
 * shooters', battle and tactical games; Game World for the rest. On
 * speakers there is none: the Room is wrong there, and taken for everybody
 * the competitive kinds once put a room round somebody's speakers.
 */
export const readyGamingRoom = (preset: IFootstepsPreset): TRoomPresetId =>
  COMPETITIVE_GROUPS.includes(preset.group) ||
  (preset.group === 'kinds' && COMPETITIVE_KINDS.includes(preset.id))
    ? 'competitiveV2'
    : 'gameWorldV2';

/** The ready-made profiles, in the Game filter's own order. */
export const READY_GAMING_PROFILES: readonly IFootstepsPreset[] =
  FOOTSTEPS_PRESETS;

/** The kind a game nobody tuned for starts from. */
export const ANY_GAME_PROFILE = 'immersive';

/** A name as its words, without the ™, the colon or the case. */
const wordsOf = (text: string): string[] =>
  text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Whether `inner` stands in `outer` as whole words, one after another. */
const standsIn = (
  outer: readonly string[],
  inner: readonly string[],
): boolean =>
  inner.length > 0 &&
  outer.some((_, start) =>
    inner.every((word, offset) => outer[start + offset] === word),
  );

/** The fewest letters that still say which game: "Call" alone says nothing. */
const MIN_MATCH = 4;

/**
 * The ready-made profile a newly added game starts from: the one made for
 * its title, or the one for any game.
 *
 * Whole words, never letters: "Rust" is not heard inside "Trust Issues". A
 * title's preset may name a series ("Call of Duty: Warzone, Black Ops"), so
 * each name between its commas is tried, both ways round — the game's own
 * file says "Call of Duty" as often as the preset says "Warzone".
 */
export const suggestGamingProfile = (gameName: string): string => {
  const game = wordsOf(gameName);
  const found = READY_GAMING_PROFILES.find(
    (preset) =>
      preset.title !== undefined &&
      preset.title
        .split(/,\s*/)
        .map(wordsOf)
        .some((name) => {
          const shorter = name.length < game.length ? name : game;
          return (
            shorter.join('').length >= MIN_MATCH &&
            (standsIn(game, name) || standsIn(name, game))
          );
        }),
  );
  return readyGamingProfileId(found ? found.id : ANY_GAME_PROFILE);
};

/**
 * How main makes a game's copy that does not exist yet, or makes it again.
 *
 * `rack` is a ready-made profile (or an old row's chain): the window works
 * the rack out, since the presets and the Game filter's rules live there.
 * A ready-made profile names its game curve (`gameCurve`, a Preset layer id
 * from `gameCurves.ts`), which main builds itself; an old row's chain hands
 * its own curve (`curve`, the Preset layer a pick of the chain puts on).
 * Main builds the rest from nothing, as a new profile starts: each Gaming
 * profile has its own sound to reset to, never the music's EQ, Tone and
 * curves (Ivan, 2026-11-03). `yours` is one of the listener's own: its
 * whole sound.
 */
export type TGameSeed =
  | {
      kind: 'rack';
      dsp: IDspSettings;
      curve?: IEqSettings;
      gameCurve?: string;
    }
  | { kind: 'yours'; id: string };

/** One of the listener's own Gaming profiles, as the lists show it. */
/**
 * What a profile of the listener's own plays, for its card to draw as a
 * ready-made one's (Ivan, 2026-11-04: "make curve also on saved"). Main
 * reads it from the saved sound; the list never carries the sound itself.
 */
export interface IYoursSoundSummary {
  /** The Preset layer's preset id (`dsp:` taken off), a game curve's or none. */
  curveId?: string;
  /** The rack's chain. */
  chainId?: string;
  /** The Game filter's dials, while it is on. */
  footsteps?: { lift: number; voices: number; environment: number };
}

export interface IYoursGamingProfile {
  id: string;
  name: string;
  /** The game whose copy it was saved from, as that game was named. */
  from: string;
  /** Milliseconds since the epoch. */
  savedAt: number;
  summary?: IYoursSoundSummary;
}

export const GAMING_PROFILE_NAME_MAX = 60;

/** The name a copy is saved under, trimmed, or nothing for an empty one. */
export const gamingProfileName = (name: string): string | undefined => {
  const trimmed = name.trim().slice(0, GAMING_PROFILE_NAME_MAX);
  return trimmed === '' ? undefined : trimmed;
};

/** Which game's copy the playing output has on, if any. */
export interface IGameSoundState {
  gameId?: string;
  /**
   * The rack of the music sound waiting for the game to end, for the DSP
   * page to say what is paused: its preset's name and the stages it plays.
   * Absent when the music profile carries no rack, or could not be read.
   */
  musicDsp?: IDspSettings;
}
