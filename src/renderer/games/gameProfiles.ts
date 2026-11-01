/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The game profiles this listener has made, as they are kept and read back.
 *
 * Beside the saved chains and the starred ones, in the window's own storage,
 * where the Games page makes and changes them. The core keeps a copy of each
 * change (`CoreCopies`), because a game's sound is switched there now, with
 * the window minimised or not open at all.
 */

import {
  GAME_NAME_MAX,
  IGameProfile,
  IGameProgram,
  parseGameProfiles,
} from '../../common/games';

export { GAME_NAME_MAX };

const STORAGE_KEY = 'fluideq.games.profiles.v1';

export const GAME_PROFILES_CHANGED = 'fluideq-game-profiles-changed';

/** A picture worth keeping in storage: a 32px icon is a few kilobytes. */
const ICON_MAX = 24 * 1024;

/** Read only complete rows: one malformed save cannot empty the list. */
export const readGameProfiles = (): IGameProfile[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return parseGameProfiles(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
};

const write = (profiles: readonly IGameProfile[]): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // A full or disabled store costs the list, never the sound playing now.
  }
  window.dispatchEvent(new Event(GAME_PROFILES_CHANGED));
};

const ENABLED_KEY = 'fluideq.games.enabled.v1';

/**
 * Whether game presets run at all — the page's own switch.
 *
 * On unless it was switched off: every list saved before the switch existed
 * was a list somebody wanted running. Off is the whole feature, not a pause
 * of one game: no watching what is in front, no switching, no cards.
 */
let enabledNow: boolean | undefined;

export const readGamesEnabled = (): boolean => {
  if (enabledNow !== undefined) {
    return enabledNow;
  }
  try {
    return window.localStorage.getItem(ENABLED_KEY) !== 'off';
  } catch {
    return true;
  }
};

/** For a test that starts from nothing, as a fresh window would. */
export const resetGamesEnabled = (): void => {
  enabledNow = undefined;
};

export const setGamesEnabled = (enabled: boolean): void => {
  enabledNow = enabled;
  try {
    window.localStorage.setItem(ENABLED_KEY, enabled ? 'on' : 'off');
  } catch {
    // A full or disabled store costs the choice surviving a restart, not
    // the choice itself, which is held above for this window's life.
  }
  window.dispatchEvent(new Event(GAME_PROFILES_CHANGED));
};

const newId = (): string =>
  `game-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Add a program to the list, or leave it alone if it is already there.
 *
 * The same game reached twice — once from a launcher's library and once
 * because it happens to be running — is one row: what it matches is its path,
 * and two rows for one path would fight over the sound.
 *
 * The program's own icon is kept with it, so the row and the toast show the
 * game rather than a glyph without asking the launchers again.
 */
export const addGameProfile = (
  program: Omit<IGameProfile, 'id' | 'presetId'>,
  presetId = '',
): IGameProfile[] => {
  const profiles = readGameProfiles();
  const key = program.path.toLowerCase();
  if (profiles.some((profile) => profile.path.toLowerCase() === key)) {
    return profiles;
  }
  const next = [
    ...profiles,
    {
      ...program,
      name: program.name.slice(0, GAME_NAME_MAX),
      id: newId(),
      presetId,
      ...(program.icon && program.icon.length <= ICON_MAX
        ? { icon: program.icon }
        : { icon: undefined }),
    },
  ];
  write(next);
  return next;
};

export const setGameProfilePreset = (
  id: string,
  presetId: string,
): IGameProfile[] => {
  const next = readGameProfiles().map((profile) =>
    profile.id === id ? { ...profile, presetId } : profile,
  );
  write(next);
  return next;
};

export const removeGameProfile = (id: string): IGameProfile[] => {
  const next = readGameProfiles().filter((profile) => profile.id !== id);
  write(next);
  return next;
};

/**
 * Give a saved row the icon it should have had, from the launchers' answer.
 *
 * A row saved without one keeps its gamepad for ever otherwise: the same game
 * cannot be added twice, so nothing would ever look at it again — and the
 * card a game raises draws that same glyph on the desktop. Rows that already
 * have a picture are left alone, and nothing is written unless something
 * changed, because a write tells every page holding this list to re-read it.
 */
export const fillGameProfileIcons = (
  programs: readonly IGameProgram[],
): IGameProfile[] => {
  const profiles = readGameProfiles();
  const icons = new Map(
    programs
      .filter((program) => program.icon)
      .map((program) => [program.path.toLowerCase(), program.icon]),
  );
  let filled = false;
  const next = profiles.map((profile) => {
    const icon = profile.icon
      ? undefined
      : icons.get(profile.path.toLowerCase());
    if (!icon || icon.length > ICON_MAX) {
      return profile;
    }
    filled = true;
    return { ...profile, icon };
  });
  if (!filled) {
    return profiles;
  }
  write(next);
  return next;
};
