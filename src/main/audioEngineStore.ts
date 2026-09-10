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
import {
  AUDIO_ENGINE_FILENAME,
  IAudioEnginePreference,
  TAudioEngine,
  isAudioEngine,
} from '../common/audioEngine';

const NEVER_CHOSEN: IAudioEnginePreference = { version: 1, engine: null };

const preferencePath = (userDataDir: string) =>
  path.join(userDataDir, AUDIO_ENGINE_FILENAME);

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The engine choice, read at startup before `getConfigPath` can be called.
 *
 * Never throws. This runs on every launch, and the file can be missing (never
 * chosen), hand-edited, or left over from a build that wrote a different
 * shape — none of those are the app's problem to crash over, so every failure
 * here answers the same as "never chosen" rather than propagating.
 */
export const loadAudioEnginePreference = (
  userDataDir: string,
): IAudioEnginePreference => {
  try {
    const input: unknown = JSON.parse(
      fs.readFileSync(preferencePath(userDataDir), 'utf8'),
    );
    if (!isObject(input) || input.version !== 1) {
      return NEVER_CHOSEN;
    }
    const { engine } = input;
    if (engine === null) {
      return { version: 1, engine: null };
    }
    if (!isAudioEngine(engine)) {
      return NEVER_CHOSEN;
    }
    return { version: 1, engine };
  } catch {
    return NEVER_CHOSEN;
  }
};

/** What the machine looks like, for the migration rule below. */
export interface IAudioEngineFacts {
  isWindows: boolean;
  apoInstalled: boolean;
}

/** The engine this launch uses, and whether the answer is worth recording. */
export interface IAudioEngineMigration {
  engine: TAudioEngine | null;
  persist: boolean;
}

/**
 * The engine a launch runs on, from the file and the machine.
 *
 * A rule rather than four lines inside `onAppReady`, because it is the one
 * decision at startup that can silently move an existing install onto the
 * wrong engine and there was nothing exercising it:
 *
 * - A file that names an engine is obeyed, and nothing is written back.
 * - No file, Equalizer APO present: an install that predates the FluidEQ
 *   Engine keeps working with nothing asked and nothing changed, and the
 *   answer is written down so the question is settled once.
 * - No file, no Equalizer APO, on Windows: `null` — the state the first-run
 *   dialog exists to answer, and nothing is written until it is answered.
 * - Off Windows neither engine is really installable and both resolve to the
 *   same sandbox directory, so `'apo'` is the honest answer there too.
 */
export const migrateAudioEnginePreference = (
  preference: IAudioEnginePreference,
  facts: IAudioEngineFacts,
): IAudioEngineMigration => {
  if (preference.engine !== null) {
    return { engine: preference.engine, persist: false };
  }
  if (!facts.isWindows || facts.apoInstalled) {
    return { engine: 'apo', persist: true };
  }
  return { engine: null, persist: false };
};

export const saveAudioEnginePreference = (
  userDataDir: string,
  engine: TAudioEngine | null,
): void => {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(
    preferencePath(userDataDir),
    JSON.stringify({ version: 1, engine }, null, 2),
    'utf8',
  );
};
