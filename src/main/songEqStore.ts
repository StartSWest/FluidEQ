/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import {
  ISongEqEntry,
  ISongEqOutput,
  ISongEqSettings,
  getDefaultSongEqSettings,
} from '../common/songEq';
import {
  type ISongMemoryLoad,
  type TParseSongMemory,
  keepSongMemory,
  readSongMemoryText,
  readSongMemoryTextSoon,
  settleSongMemory,
} from './songMemoryFile';

/**
 * Where remembered songs live. `device-profiles.json`'s neighbour, and read and
 * written the same way: one versioned JSON file in `userData`, no rules of its
 * own — everything that decides what goes in is in `common/songEq.ts`.
 */
const SETTINGS_FILENAME = 'song-eq.json';

/**
 * An object, and not an array.
 *
 * Arrays are objects too, and one reaching the pure store arrives as a record
 * whose only keys are "0", "1", … — every lookup misses, every write grows it,
 * and the eviction cap counts positions rather than songs. A hand-edited file
 * may cost a few remembered songs; it must not put a wrong shape into main's
 * memory for the rest of the run.
 */
const isRecord = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Every output, guaranteed to have both halves.
 *
 * A file that is valid JSON but missing an output's `entries` or `aliases`
 * reaches the pure store, which indexes them without checking — and the
 * TypeError lands inside an ipcMain handler that has already committed to
 * replying. No reply is ever sent, so the renderer waits forever. Coercing
 * here is what keeps a hand-edited or half-written file from hanging the
 * feature instead of just losing a few remembered songs. Only the shape is
 * fixed up; what is inside each entry is still `common/songEq.ts`'s concern.
 */
const normalizeOutputs = (
  outputs: Record<string, unknown>,
): Record<string, ISongEqOutput> => {
  const normalized: Record<string, ISongEqOutput> = {};
  Object.entries(outputs).forEach(([deviceId, output]) => {
    if (typeof output !== 'object' || output === null) {
      return;
    }
    const { entries, aliases } = output as {
      entries?: unknown;
      aliases?: unknown;
    };
    normalized[deviceId] = {
      entries: isRecord(entries) ? (entries as ISongEqOutput['entries']) : {},
      aliases: isRecord(aliases) ? (aliases as ISongEqOutput['aliases']) : {},
    };
  });
  return normalized;
};

export const saveSongEqSettings = (
  userDataDir: string,
  settings: ISongEqSettings,
): void => {
  const settingsPath = path.join(userDataDir, SETTINGS_FILENAME);
  const temporaryPath = `${settingsPath}.tmp`;
  try {
    // Written beside and renamed over, so a crash mid-write leaves the
    // previous file intact rather than a truncated one. This file is rewritten
    // on every song that reaches two minutes, so that window is not rare.
    fs.writeFileSync(temporaryPath, JSON.stringify(settings), 'utf8');
    fs.renameSync(temporaryPath, settingsPath);
  } catch (error) {
    log.error('Failed to save song EQ settings', error);
  }
};

/**
 * The file's contents as settings, or nothing for contents that are not this
 * file — another version's, or not a song memory at all — which is then set
 * aside rather than saved over (`keepSongMemory`).
 */
const parse: TParseSongMemory<ISongEqEntry> = (input) => {
  const outputs = (input as { outputs?: unknown } | null)?.outputs;
  if (
    typeof input !== 'object' ||
    input === null ||
    (input as { version?: unknown }).version !== 1 ||
    typeof outputs !== 'object' ||
    outputs === null
  ) {
    return undefined;
  }
  return {
    settings: {
      version: 1,
      outputs: normalizeOutputs(outputs as Record<string, unknown>),
    },
    dropped: 0,
  };
};

const fileOf = (userDataDir: string) =>
  path.join(userDataDir, SETTINGS_FILENAME);

/**
 * The file read just now, filed by fingerprints with every name of a song
 * not the listener's own gone (`songMemoryNames.ts`), and what has to happen
 * to it — see `ISongMemoryLoad`. A missing file is the ordinary case at first
 * launch: no songs, and nothing to do.
 */
const settle = (text: string | undefined) =>
  settleSongMemory(text, parse, getDefaultSongEqSettings);

/** A read file taken in: set aside if damaged, written again if it names
 * songs, and what to hold handed back. */
export const keepSongEqSettings = (
  userDataDir: string,
  loaded: ISongMemoryLoad<ISongEqEntry>,
): ISongEqSettings =>
  keepSongMemory(fileOf(userDataDir), loaded, (settings) =>
    saveSongEqSettings(userDataDir, settings),
  );

/** Read now, and taken in at once. */
export const loadSongEqSettings = (userDataDir: string): ISongEqSettings =>
  keepSongEqSettings(
    userDataDir,
    settle(readSongMemoryText(fileOf(userDataDir))),
  );

/**
 * Read off the main thread, for the read just after launch
 * (`ipc/songEq.ts`), which takes it in only if nothing has read the file
 * since: by then a lookup may have read it and saved a song over it.
 */
export const readSongEqSettings = async (
  userDataDir: string,
): Promise<ISongMemoryLoad<ISongEqEntry>> =>
  settle(await readSongMemoryTextSoon(fileOf(userDataDir)));
