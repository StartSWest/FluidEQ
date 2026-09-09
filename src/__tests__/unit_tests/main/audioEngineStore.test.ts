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
