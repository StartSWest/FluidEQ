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
  ISongEqOutput,
  ISongEqSettings,
  getDefaultSongEqSettings,
} from '../common/songEq';

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

export const loadSongEqSettings = (userDataDir: string): ISongEqSettings => {
  const settingsPath = path.join(userDataDir, SETTINGS_FILENAME);
  try {
    const input: unknown = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const outputs = (input as { outputs?: unknown } | null)?.outputs;
    if (
      typeof input !== 'object' ||
      input === null ||
      (input as { version?: unknown }).version !== 1 ||
      typeof outputs !== 'object' ||
      outputs === null
    ) {
      return getDefaultSongEqSettings();
    }
    return {
      version: 1,
      outputs: normalizeOutputs(outputs as Record<string, unknown>),
    };
  } catch {
    // A missing file is the ordinary case at first launch, and a corrupt one
    // is a half-written file after a power cut. Neither is worth stopping the
    // app for: the worst it costs is a set of songs to learn again.
    return getDefaultSongEqSettings();
  }
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
