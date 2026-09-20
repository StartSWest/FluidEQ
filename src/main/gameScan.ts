/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The games this machine has, read from the launchers that installed them.
 *
 * A player adding a profile should find their games in the list whether or
 * not they are running, so this asks the launchers rather than the task list:
 * Steam's library files, the Epic launcher's manifests, the Xbox app's own
 * folder, and — through `windows-game-libraries.ps1`, because they keep no
 * files to read — EA, GOG, Ubisoft and Battle.net from the registry.
 *
 * Every row is a folder, never a guessed executable: see `gameLibraries.ts`.
 * A launcher that is not installed contributes nothing and is not an error;
 * a machine with none of them still has the programs that are running now.
 */

import { execFile } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { promisify } from 'util';
import log from 'electron-log';
import {
  epicGame,
  mergeGamePrograms,
  steamGame,
  steamLibraries,
} from '../common/gameLibraries';
import { IGameProgram } from '../common/games';
import { POWERSHELL_PATH } from './powershell';

const execFileAsync = promisify(execFile);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Every drive letter this machine answers to: a library is rarely on C. */
const drives = (): string[] => {
  const found: string[] = [];
  for (
    let letter = 'A'.charCodeAt(0);
    letter <= 'Z'.charCodeAt(0);
    letter += 1
  ) {
    const root = `${String.fromCharCode(letter)}:\\`;
    try {
      if (existsSync(root)) {
        found.push(root);
      }
    } catch {
      // An empty card reader answers by throwing; it holds no games either.
    }
  }
  return found;
};

const folders = (directory: string): string[] => {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
};

const files = (directory: string, extension: string): string[] => {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() && entry.name.toLowerCase().endsWith(extension),
      )
      .map((entry) => path.join(directory, entry.name));
  } catch {
    return [];
  }
};

const text = (file: string): string | undefined => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
};

/**
 * Steam's libraries: the ones its own list names, and the ones a bare drive
 * carries.
 *
 * The list is the answer where Steam is installed. Where it is not — Steam
 * removed, or a library left behind by a machine that had it — the folder is
 * still there with its games in it, and a player who sees them in Explorer
 * expects to see them here.
 */
const steamRoots = (client: string | undefined): string[] => {
  const roots = new Set<string>();
  const add = (candidate: string) => {
    if (existsSync(path.join(candidate, 'steamapps'))) {
      roots.add(candidate);
    }
  };
  if (client) {
    add(client);
    const list = text(path.join(client, 'steamapps', 'libraryfolders.vdf'));
    if (list) {
      steamLibraries(list).forEach(add);
    }
  }
  drives().forEach((root) => {
    add(path.join(root, 'SteamLibrary'));
    add(path.join(root, 'Steam'));
    add(path.join(root, 'Program Files (x86)', 'Steam'));
    add(path.join(root, 'Games', 'SteamLibrary'));
  });
  return [...roots];
};

const steamGames = (client: string | undefined): IGameProgram[] =>
  steamRoots(client).flatMap((library) =>
    files(path.join(library, 'steamapps'), '.acf').flatMap((manifest) => {
      const manifestText = text(manifest);
      const game = manifestText ? steamGame(manifestText, library) : undefined;
      return game && existsSync(game.path) ? [game] : [];
    }),
  );

const epicGames = (): IGameProgram[] => {
  const manifests = path.join(
    process.env.ProgramData ?? 'C:\\ProgramData',
    'Epic',
    'EpicGamesLauncher',
    'Data',
    'Manifests',
  );
  return files(manifests, '.item').flatMap((manifest) => {
    const manifestText = text(manifest);
    const game = manifestText ? epicGame(manifestText) : undefined;
    return game && existsSync(game.path) ? [game] : [];
  });
};

/**
 * Whether an `XboxGames` folder holds a game or a placeholder.
 *
 * Buying an add-on puts a folder beside the game with the same shape and none
 * of it inside — "BO6 PC MS DLC12 Beta Early Access", "MW3 PC MS DLC02
 * Cross-Gen Pack 01" — and on this machine fifteen of twenty-two folders were
 * those. What every one of them holds is Microsoft's own launcher shim and
 * nothing else.
 *
 * Two ways to tell, because the folders are not laid out alike. The store's
 * own `MicrosoftGame.config` names the program it launches, which a stub's
 * does not — that is how a 69 GB Halo whose executable is four folders down
 * is recognised. And a program beside the shim, which is how Call of Duty is,
 * its `_retail_` folder carrying no config at all.
 */
const holdsAProgram = (folder: string): boolean => {
  const shim = 'gamelaunchhelper.exe';
  const program = /<Executable\s[^>]*Name="([^"]+)"/i;
  const named = (directory: string): boolean => {
    const config = text(path.join(directory, 'MicrosoftGame.config'));
    const found = config ? program.exec(config) : undefined;
    return (
      found !== undefined &&
      found !== null &&
      path.basename(found[1]).toLowerCase() !== shim
    );
  };
  const own = (directory: string): boolean =>
    files(directory, '.exe').some(
      (file) => path.basename(file).toLowerCase() !== shim,
    );
  const inside = folders(folder).map((name) => path.join(folder, name));
  return (
    named(folder) ||
    own(folder) ||
    inside.some((directory) => named(directory) || own(directory))
  );
};

/**
 * The Xbox app's games, which are folders under `XboxGames` on any drive.
 *
 * The folder is the name the store shows, with the characters Windows will
 * not have in a path swapped out — "Halo- Campaign Evolved" for "Halo:
 * Campaign Evolved" — so the dash that stands for a colon is put back.
 * `GameSave` is the app's own and holds no game.
 */
const xboxGames = (): IGameProgram[] =>
  drives().flatMap((root) => {
    const library = path.join(root, 'XboxGames');
    return folders(library)
      .filter((name) => name !== 'GameSave')
      .flatMap((name) => {
        const folder = path.join(library, name);
        return holdsAProgram(folder)
          ? [
              {
                name: name.replace(/- /g, ': '),
                path: folder,
                source: 'xbox' as const,
              },
            ]
          : [];
      });
  });

interface IRegistryScan {
  games: IGameProgram[];
  steam?: string;
}

const scriptPath = (): string => {
  const packaged = path.join(
    process.resourcesPath ?? '',
    'assets',
    'windows-game-libraries.ps1',
  );
  return existsSync(packaged)
    ? packaged
    : path.join(__dirname, '../../assets/windows-game-libraries.ps1');
};

/**
 * What the registry knows, or nothing.
 *
 * PowerShell writes its own warnings to the stream the JSON comes on, so the
 * answer is taken from the last line that parses rather than the whole of it
 * — and a machine whose registry cannot be read still gets every game its
 * files name.
 */
const registryScan = async (): Promise<IRegistryScan> => {
  const known = (source: unknown): source is IGameProgram['source'] =>
    typeof source === 'string';
  try {
    const { stdout } = await execFileAsync(
      POWERSHELL_PATH,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath(),
      ],
      { windowsHide: true, timeout: 20000, maxBuffer: 4 * 1024 * 1024 },
    );
    const line = stdout
      .split(/\r?\n/)
      .map((one) => one.trim())
      .filter((one) => one.startsWith('{'))
      .pop();
    const parsed: unknown = line ? JSON.parse(line) : undefined;
    if (!isRecord(parsed)) {
      return { games: [] };
    }
    const rows = Array.isArray(parsed.games) ? parsed.games : [];
    return {
      games: rows.flatMap((row): IGameProgram[] =>
        isRecord(row) &&
        typeof row.name === 'string' &&
        typeof row.path === 'string' &&
        known(row.source)
          ? [{ name: row.name, path: row.path, source: row.source }]
          : [],
      ),
      ...(typeof parsed.steam === 'string' && parsed.steam
        ? { steam: parsed.steam }
        : {}),
    };
  } catch (error) {
    log.info('Game libraries: the registry could not be read', error);
    return { games: [] };
  }
};

/** Every installed game this machine will admit to, by name. */
export const scanGameLibraries = async (): Promise<IGameProgram[]> => {
  if (process.platform !== 'win32') {
    return [];
  }
  const registry = await registryScan();
  return mergeGamePrograms([
    ...steamGames(registry.steam),
    ...epicGames(),
    ...xboxGames(),
    ...registry.games,
  ]);
};

/**
 * The program inside a game's folder whose icon is the game's.
 *
 * For the picture in the list only, never for matching: a folder matches by
 * what runs from inside it, and choosing wrong here costs an icon rather
 * than a sound. The store's own config names it where there is one; failing
 * that it is the largest program in the folder, which is the game and not the
 * crash reporter beside it.
 */
export const gameIconSource = (entry: string): string | undefined => {
  if (!isGameFolder(entry)) {
    return entry;
  }
  const shim = 'gamelaunchhelper.exe';
  const program = /<Executable\s[^>]*Name="([^"]+)"/i;
  const named = (directory: string): string | undefined => {
    const config = text(path.join(directory, 'MicrosoftGame.config'));
    const found = config ? program.exec(config) : undefined;
    if (!found || path.basename(found[1]).toLowerCase() === shim) {
      return undefined;
    }
    const file = path.join(directory, found[1].split('/').join('\\'));
    return existsSync(file) ? file : undefined;
  };
  const biggest = (directory: string): string | undefined => {
    let best: { file: string; size: number } | undefined;
    files(directory, '.exe').forEach((file) => {
      if (path.basename(file).toLowerCase() === shim) {
        return;
      }
      try {
        const { size } = statSync(file);
        if (!best || size > best.size) {
          best = { file, size };
        }
      } catch {
        // A file that went away between the listing and the reading.
      }
    });
    return best?.file;
  };
  const inside = folders(entry).map((name) => path.join(entry, name));
  const found = [entry, ...inside].flatMap((directory) => {
    const one = named(directory) ?? biggest(directory);
    return one ? [one] : [];
  });
  return found[0];
};

/** Whether a path a player chose by hand is a file or a folder. */
export const isGameFolder = (candidate: string): boolean => {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
};
