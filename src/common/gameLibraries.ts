/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Reading the launchers' own lists of what is installed.
 *
 * Every launcher keeps one, and every launcher keeps it differently: Steam in
 * its own key-value text, the Epic launcher in a folder of JSON, the rest in
 * the registry. The parsing is here, as text in and rows out, so it can be
 * tested against the real files without a machine that has the games; the
 * finding and reading of those files is `src/main/gameScan.ts`.
 *
 * What comes out is a folder per game, never a guessed executable. A game's
 * folder holds the game, its anti-cheat service, its crash reporter and three
 * redistributables, and no list anywhere says which of them is the one a
 * player sees — so the profile matches anything run from inside the folder
 * (`gamePathHolds`), which is what a player means by "when this game runs".
 */

import { IGameProgram } from './games';

const clean = (value: string): string => value.trim().replace(/[\\/]+$/, '');

/**
 * Valve's key-value text, flattened to `path -> value` with `/` between keys.
 *
 * Both files this reads are the same shape — the library list and a game's
 * manifest — and both are written by Steam, so this parses what Steam writes
 * rather than the format in general: quoted keys, quoted values or a nested
 * block, comments and stray text ignored.
 */
export const parseValve = (text: string): Map<string, string> => {
  const found = new Map<string, string>();
  const stack: string[] = [];
  let key: string | undefined;
  text.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('//')) {
      return;
    }
    if (line.startsWith('}')) {
      stack.pop();
      key = undefined;
      return;
    }
    if (line.startsWith('{')) {
      stack.push(key ?? '');
      key = undefined;
      return;
    }
    const pair = /^"((?:[^"\\]|\\.)*)"\s*"((?:[^"\\]|\\.)*)"$/.exec(line);
    if (pair) {
      const at = [...stack, pair[1]].filter(Boolean).join('/');
      found.set(at.toLowerCase(), pair[2].replace(/\\\\/g, '\\'));
      return;
    }
    const alone = /^"((?:[^"\\]|\\.)*)"$/.exec(line);
    if (alone) {
      [, key] = alone;
    }
  });
  return found;
};

/**
 * Where Steam keeps games, from `steamapps/libraryfolders.vdf`.
 *
 * A second drive is the normal case, not the exception: Steam's own folder
 * holds the client and often none of the library.
 */
export const steamLibraries = (libraryFolders: string): string[] => {
  const values = parseValve(libraryFolders);
  const found: string[] = [];
  values.forEach((value, at) => {
    if (/^libraryfolders\/\d+\/path$/.test(at)) {
      found.push(clean(value));
    }
  });
  return found;
};

/** One installed game, from `steamapps/appmanifest_<id>.acf`. */
export const steamGame = (
  manifest: string,
  library: string,
): IGameProgram | undefined => {
  const values = parseValve(manifest);
  const name = values.get('appstate/name');
  const folder = values.get('appstate/installdir');
  if (!name || !folder) {
    return undefined;
  }
  return {
    name,
    path: `${clean(library)}\\steamapps\\common\\${clean(folder)}`,
    source: 'steam',
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * One installed game, from a `.item` file of the Epic launcher's manifests.
 *
 * Epic writes one of these per thing it installs, including its own
 * redistributables: anything without an install folder is skipped rather than
 * offered as a game.
 */
export const epicGame = (item: string): IGameProgram | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(item);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }
  const name = parsed.DisplayName;
  const location = parsed.InstallLocation;
  if (typeof name !== 'string' || typeof location !== 'string' || !location) {
    return undefined;
  }
  return { name, path: clean(location), source: 'epic' };
};

/** A game a scan found twice — Steam and the Xbox app both know it — once. */
export const mergeGamePrograms = (
  found: readonly IGameProgram[],
): IGameProgram[] => {
  const byPath = new Map<string, IGameProgram>();
  found.forEach((program) => {
    const key = program.path.replace(/\//g, '\\').toLowerCase();
    if (key !== '' && !byPath.has(key)) {
      byPath.set(key, program);
    }
  });
  return [...byPath.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
};
