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

/**
 * The engine preference file: which config directory `getConfigPath` reads
 * from before anything else about the app has started. A missing or corrupt
 * file must never throw, because it is read at every launch and a throw here
 * would take the whole app down over a hand-edited or half-written file.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  loadAudioEnginePreference,
  migrateAudioEnginePreference,
  saveAudioEnginePreference,
} from 'main/audioEngineStore';
import { AUDIO_ENGINE_FILENAME } from 'common/audioEngine';

describe('the audio engine preference file', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'fluideq-engine-pref-'),
    );
  });

  afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  it('is "never chosen" before the file exists', () => {
    expect(loadAudioEnginePreference(userDataDir)).toEqual({
      version: 1,
      engine: null,
    });
  });

  it('round-trips a fluid choice', () => {
    saveAudioEnginePreference(userDataDir, 'fluid');
    expect(loadAudioEnginePreference(userDataDir)).toEqual({
      version: 1,
      engine: 'fluid',
    });
  });

  it('round-trips an apo choice', () => {
    saveAudioEnginePreference(userDataDir, 'apo');
    expect(loadAudioEnginePreference(userDataDir)).toEqual({
      version: 1,
      engine: 'apo',
    });
  });

  it('writes pretty JSON that creates the directory if absent', () => {
    const nestedDir = path.join(userDataDir, 'nested');
    saveAudioEnginePreference(nestedDir, 'fluid');
    const filePath = path.join(nestedDir, AUDIO_ENGINE_FILENAME);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toContain('\n');
  });

  it('falls back to "never chosen" rather than throwing on corrupt JSON', () => {
    fs.writeFileSync(
      path.join(userDataDir, AUDIO_ENGINE_FILENAME),
      '{not valid json',
      'utf8',
    );
    expect(() => loadAudioEnginePreference(userDataDir)).not.toThrow();
    expect(loadAudioEnginePreference(userDataDir)).toEqual({
      version: 1,
      engine: null,
    });
  });

  it('falls back to "never chosen" when the stored engine name is not one FluidEQ knows', () => {
    fs.writeFileSync(
      path.join(userDataDir, AUDIO_ENGINE_FILENAME),
      JSON.stringify({ version: 1, engine: 'some-future-engine' }),
      'utf8',
    );
    expect(loadAudioEnginePreference(userDataDir)).toEqual({
      version: 1,
      engine: null,
    });
  });
});

/**
 * The startup rule that decides which engine an existing install runs on.
 *
 * It ran on every launch with nothing exercising it, and it is the one place
 * that can quietly move a working install onto the other engine — or write a
 * choice the user was never asked for.
 */
describe('migrating the audio engine preference at startup', () => {
  it('obeys a recorded choice and records nothing', () => {
    expect(
      migrateAudioEnginePreference(
        { version: 1, engine: 'fluid' },
        { isWindows: true, apoInstalled: true },
      ),
    ).toEqual({ engine: 'fluid', persist: false });
    expect(
      migrateAudioEnginePreference(
        { version: 1, engine: 'apo' },
        { isWindows: true, apoInstalled: false },
      ),
    ).toEqual({ engine: 'apo', persist: false });
  });

  it('settles an install that predates the engine on Equalizer APO', () => {
    expect(
      migrateAudioEnginePreference(
        { version: 1, engine: null },
        { isWindows: true, apoInstalled: true },
      ),
    ).toEqual({ engine: 'apo', persist: true });
  });

  it('leaves a fresh Windows machine unanswered for the first-run dialog', () => {
    expect(
      migrateAudioEnginePreference(
        { version: 1, engine: null },
        { isWindows: true, apoInstalled: false },
      ),
    ).toEqual({ engine: null, persist: false });
  });

  it('answers Equalizer APO off Windows, where both engines are the same sandbox', () => {
    expect(
      migrateAudioEnginePreference(
        { version: 1, engine: null },
        { isWindows: false, apoInstalled: false },
      ),
    ).toEqual({ engine: 'apo', persist: true });
  });
});
