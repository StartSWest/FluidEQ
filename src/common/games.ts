/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The listener's games: a program, the Gaming profile its own sound started
 * from, and which program a running one is.
 *
 * Both halves of the app read these rules — the window keeps the list and
 * puts a game's sound on, main watches what Windows puts in front — so the
 * matching lives here, as arithmetic over values, and is tested as
 * arithmetic.
 */

import { chainGamingProfileId, suggestGamingProfile } from './gaming';

/** Where a program came from, which is all the row says about it. */
export type TGameSource =
  | 'steam'
  | 'epic'
  | 'ea'
  | 'gog'
  | 'ubisoft'
  | 'battlenet'
  | 'xbox'
  | 'running'
  | 'file';

export const GAME_SOURCES: readonly TGameSource[] = [
  'steam',
  'epic',
  'ea',
  'gog',
  'ubisoft',
  'battlenet',
  'xbox',
  'running',
  'file',
];

export interface IGameProgram {
  /** What the player calls it: the file's own description, or its folder. */
  name: string;
  /**
   * The program's own file, or the folder its files live in.
   *
   * A launcher's library says where a game is installed and not which of the
   * forty executables under it is the game — an anti-cheat service, a crash
   * reporter and three redistributables share that folder — so a library
   * entry is the folder and matches anything run from inside it. A program
   * picked while it is running is its own file, which is exact.
   */
  path: string;
  source: TGameSource;
  /**
   * The program's own icon, as Windows draws it, for the row to show.
   *
   * A picture of the game beats a row of identical gamepads, and it is the
   * one the player already knows from their desktop. Optional: a game whose
   * icon could not be read still has a name and a sound, and the row falls
   * back to a drawn glyph.
   */
  icon?: string;
  /**
   * Where its window was drawn, `x,y,w,h` in real pixels, as the watcher
   * saw it: which screen a card about this game belongs on.
   */
  rect?: string;
  /**
   * The running process, while this record is one the watcher just saw.
   *
   * It is what the app asks to be told the end of, so a game keeps its sound
   * until it is really closed. Never kept in a saved row: a profile outlives
   * a hundred runs of the game and a pid means nothing an hour later.
   */
  pid?: number;
}

export interface IGameProfile extends IGameProgram {
  /**
   * Stable across renames, so the row keeps its place when it is edited — and
   * what main names the game's copy of its sound by on each output.
   */
  id: string;
  /**
   * The DSP chain a row from before the Gaming Lab played. Read once, as
   * where that game's copy starts (`gamingProfileOf`); never written again.
   */
  presetId: string;
  /** The Gaming profile the game's copy starts from (`common/gaming.ts`). */
  profileId?: string;
  /** What the listener named the game's copy ("Rename this copy"). */
  copyName?: string;
}

/**
 * The Gaming profile a game's copy starts from: the one it was given, the
 * chain an older row played, or the one made for its title.
 */
export const gamingProfileOf = (
  game: Pick<IGameProfile, 'profileId' | 'presetId' | 'name'>,
): string => {
  if (game.profileId) {
    return game.profileId;
  }
  if (game.presetId && game.presetId !== 'none') {
    return chainGamingProfileId(game.presetId);
  }
  return suggestGamingProfile(game.name);
};

/** Windows paths differ by case and by trailing separator, and mean one file. */
const asKey = (value: string): string =>
  value
    .trim()
    .replace(/[\\/]+$/, '')
    .replace(/\//g, '\\')
    .toLowerCase();

/** Whether `programPath` is `entry`, or a file inside it. */
export const gamePathHolds = (entry: string, programPath: string): boolean => {
  const held = asKey(entry);
  const program = asKey(programPath);
  if (held === '' || program === '') {
    return false;
  }
  return program === held || program.startsWith(`${held}\\`);
};

/**
 * The profile a running program belongs to, or none.
 *
 * The longest path wins, so a profile for one game of a launcher's library
 * beats a profile somebody made for the whole library folder, and an
 * executable named exactly beats the folder around it.
 */
export const gameProfileFor = (
  profiles: readonly IGameProfile[],
  programPath: string,
): IGameProfile | undefined =>
  profiles
    .filter((profile) => gamePathHolds(profile.path, programPath))
    .sort((a, b) => b.path.length - a.path.length)[0];
