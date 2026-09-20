/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Game profiles: a program, a sound, and what happens when it comes to the
 * front.
 *
 * Both halves of the app read these rules — the window keeps the list and
 * applies the sound, main watches what Windows puts in front — so the
 * matching and the switching live here, as arithmetic over values, and are
 * tested as arithmetic.
 */

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
}

export interface IGameProfile extends IGameProgram {
  /** Stable across renames, so the row keeps its place when it is edited. */
  id: string;
  /** The chain to play while it is in front; empty leaves the sound alone. */
  presetId: string;
}

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

/**
 * What the app remembers about a sound it switched for a game.
 *
 * `applied` is what it put on and `before` what was playing when it did.
 * Both are needed to put the sound back honestly: without `applied` a
 * listener who changed the chain by hand mid-game had it taken away again
 * when they alt-tabbed out.
 */
export interface IGameSoundMemory {
  before?: string;
  applied?: string;
}

export interface IGameSoundStep {
  memory: IGameSoundMemory;
  /** The chain to select now, or none: nothing about the sound changes. */
  select?: string;
}

/**
 * The step to take now that `wanted` is in front and `current` is playing.
 *
 * - A game with a sound of its own puts it on and remembers what was playing.
 * - Anything else puts back what was playing, but only while the game's sound
 *   is still the one on: a chain the listener picked during the game is
 *   theirs, and taking it away when they alt-tab is the app arguing.
 * - A game whose sound is already on changes nothing and still remembers, so
 *   leaving it is a step back to where they were.
 */
export const gameSoundStep = (
  memory: IGameSoundMemory,
  wanted: string | undefined,
  current: string,
): IGameSoundStep => {
  const ours = memory.applied !== undefined && memory.applied === current;
  if (wanted !== undefined && wanted !== '') {
    // Inside one game already, the chain to go back to is the one from before
    // that game, not the one it is playing.
    const before = ours ? memory.before : current;
    if (wanted === current) {
      return { memory: { before, applied: wanted } };
    }
    return { memory: { before, applied: wanted }, select: wanted };
  }
  if (!ours || memory.before === undefined) {
    return { memory: {} };
  }
  return {
    memory: {},
    ...(memory.before === current ? {} : { select: memory.before }),
  };
};
