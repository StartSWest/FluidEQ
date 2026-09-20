/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The game profiles this listener has made, as they are kept and read back.
 *
 * Beside the saved chains and the starred ones, in the window's own storage:
 * they are a listener's list rather than a setting of the sound, and nothing
 * outside the window needs them — main watches what is in front and the
 * window decides what that means.
 */

import { GAME_SOURCES, IGameProfile, TGameSource } from '../../common/games';

const STORAGE_KEY = 'fluideq.games.profiles.v1';

export const GAME_PROFILES_CHANGED = 'fluideq-game-profiles-changed';

export const GAME_NAME_MAX = 60;

/** A picture worth keeping in storage: a 32px icon is a few kilobytes. */
const ICON_MAX = 24 * 1024;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asSource = (value: unknown): TGameSource =>
  GAME_SOURCES.find((source) => source === value) ?? 'file';

/** Read only complete rows: one malformed save cannot empty the list. */
export const readGameProfiles = (): IGameProfile[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((entry): IGameProfile[] => {
      if (
        !isRecord(entry) ||
        typeof entry.id !== 'string' ||
        typeof entry.name !== 'string' ||
        typeof entry.path !== 'string' ||
        entry.path === ''
      ) {
        return [];
      }
      return [
        {
          id: entry.id,
          name: entry.name.slice(0, GAME_NAME_MAX),
          path: entry.path,
          presetId: typeof entry.presetId === 'string' ? entry.presetId : '',
          source: asSource(entry.source),
          ...(typeof entry.icon === 'string' && entry.icon.startsWith('data:')
            ? { icon: entry.icon }
            : {}),
        },
      ];
    });
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
