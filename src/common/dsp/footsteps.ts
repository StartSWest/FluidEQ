/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Game filter's settings as the app keeps them: what each dial is, what
 * it may reach, and what the stage is at rest. Named Footsteps in the code
 * and on the wire, as the stage first was; the page calls it Game.
 *
 * Its own module, as the De-esser's is, so the rack's defaults can take it
 * in without importing anything back. The dials are fractions of what the
 * engine may do at most (`footsteps.h`, `game_parts.h`): Lift of each band's
 * largest lift, Calm of the rumble's largest cut, Environment of the bed's
 * largest cut (-1) or lift (+1), Voices of the voice band's largest lift.
 * Reading a stored value back is `footstepsClamp.ts`.
 */
export interface IFootstepsSettings {
  enabled: boolean;
  /** Hear only what is added. Not a sound: never part of a profile. */
  isolate: boolean;
  /** Stable profile id, or empty after a hand edit. */
  presetId: string;
  /** 0 to 1: how much of each band's largest lift may be taken. */
  lift: number;
  /** 0 to 1: how much of the rumble's largest cut may be taken. */
  calm: number;
  /** Hooves and heavy steps: the weight band lifts up to 10 dB, not 4. */
  heavy: boolean;
  /** -1 to 1: the game's bed down to -9 dB or up to +6 dB. */
  environment: number;
  /** 0 to 1: how far a voice in the centre is brought forward. */
  voices: number;
  /** While a voice speaks, everything else steps back. */
  duck: boolean;
  /**
   * The listener's word that they wear headphones, kept while a game with
   * its own 3D sound holds the Room off, so the next game without it puts
   * the Room back (`pickGame`); a Gaming chain's Room copy sets it too. The
   * Room folds a game around a head, which is wrong on speakers, and the app
   * cannot tell the two apart. Not on the wire: the Room's own switch is.
   */
  useRoom: boolean;
}

export const FOOTSTEPS_RANGES = {
  lift: { min: 0, max: 1 },
  calm: { min: 0, max: 1 },
  environment: { min: -1, max: 1 },
  voices: { min: 0, max: 1 },
} as const;

/**
 * What the engine does at a dial of one (`kBands` and `kCalmMaxDb` in
 * `footsteps.cpp`, `game_parts.h`): the steps band's lift, the one a
 * listener hears as "the steps came up", the rumble's cut, the bed's cut and
 * lift, and the voice's lift. The page prints them scaled by the dial; they
 * are a limit the stage reaches, not a gain it always applies.
 */
export const FOOTSTEPS_MAX_LIFT_DB = 10;
export const FOOTSTEPS_MAX_CALM_DB = 9;
export const FOOTSTEPS_WEIGHT_MAX_DB = 4;
export const FOOTSTEPS_HEAVY_MAX_DB = 10;
export const ENVIRONMENT_MAX_CUT_DB = 9;
export const ENVIRONMENT_MAX_LIFT_DB = 6;
export const VOICES_MAX_LIFT_DB = 6;
/** How far everything else steps back, at Voices of zero and of one. */
export const DUCK_LEAST_DB = 3;
export const DUCK_MOST_DB = 6;

/** The bed's gain at an Environment dial, dB. */
export const environmentDb = (environment: number): number =>
  environment >= 0
    ? environment * ENVIRONMENT_MAX_LIFT_DB
    : environment * ENVIRONMENT_MAX_CUT_DB;

/** How far the rest steps back for a voice, dB, at a Voices dial. */
export const duckDb = (voices: number): number =>
  DUCK_LEAST_DB + (DUCK_MOST_DB - DUCK_LEAST_DB) * voices;

/**
 * Off, and the Competitive profile underneath, so switching it on does the
 * everyday thing. `gamePresets.ts` holds the same numbers as that profile and
 * `dspFootsteps.test.ts` keeps the two equal.
 */
export const FOOTSTEPS_DEFAULTS: IFootstepsSettings = {
  enabled: false,
  isolate: false,
  presetId: 'competitive',
  lift: 0.85,
  calm: 0,
  heavy: false,
  environment: 0,
  voices: 0,
  duck: false,
  useRoom: false,
};
