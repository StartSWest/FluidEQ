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
 * The FluidEQ Engine's config directory lives under `%ProgramData%`, a plain
 * folder no installer key ever names — unlike Equalizer APO's, which only the
 * registry can answer. Reading the registry for a path that was never written
 * there would be a silent no-op at best and a hang waiting on `regedit`'s VBS
 * helper at worst, so the fluid path must never touch it.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const listSpy = jest.fn();

jest.mock('electron', () => ({}));
jest.mock('regedit', () => ({
  promisified: { list: (...args: unknown[]) => listSpy(...args) },
  setExternalVBSLocation: jest.fn(),
}));

// registry.ts reads `app` from electron and `regedit`'s VBS location at
// import time, so both mocks above must be in place first.
// eslint-disable-next-line import/first
import {
  getConfigPath,
  getFluidEngineConfigDir,
  isEngineInstalled,
  noteFluidEngineRegistered,
} from 'main/registry';

describe('the engine-aware config directory', () => {
  let programData: string;
  let programFiles: string;
  const originalProgramData = process.env.ProgramData;
  const originalProgramFiles = process.env.ProgramFiles;

  beforeEach(() => {
    programData = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-pd-'));
    programFiles = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-pf-'));
    process.env.ProgramData = programData;
    process.env.ProgramFiles = programFiles;
    listSpy.mockClear();
  });

  afterEach(() => {
    fs.rmSync(programData, { recursive: true, force: true });
    fs.rmSync(programFiles, { recursive: true, force: true });
    process.env.ProgramData = originalProgramData;
    process.env.ProgramFiles = originalProgramFiles;
  });

  it('creates config.txt under %ProgramData%\\FluidEQ\\engine\\config and returns that directory', async () => {
    const configDir = await getConfigPath('fluid');

    expect(configDir).toBe(getFluidEngineConfigDir());
    expect(configDir).toBe(
      path.join(programData, 'FluidEQ', 'engine', 'config'),
    );
    expect(fs.existsSync(path.join(configDir, 'config.txt'))).toBe(true);
  });

  it('leaves an existing config.txt untouched on a second call', async () => {
    const configDir = await getConfigPath('fluid');
    const configFile = path.join(configDir, 'config.txt');
    fs.writeFileSync(configFile, 'Include: fluideq.txt\n', 'utf8');
    const mtimeBefore = fs.statSync(configFile).mtimeMs;

    await getConfigPath('fluid');

    expect(fs.readFileSync(configFile, 'utf8')).toBe('Include: fluideq.txt\n');
    expect(fs.statSync(configFile).mtimeMs).toBe(mtimeBefore);
  });

  it('never asks the registry for the fluid engine directory', async () => {
    await getConfigPath('fluid');

    expect(listSpy).not.toHaveBeenCalled();
  });

  it('reports the fluid engine installed only when its DLL is present', async () => {
    expect(await isEngineInstalled('fluid')).toBe(false);

    const engineDir = path.join(programFiles, 'FluidEQ Engine');
    fs.mkdirSync(engineDir, { recursive: true });
    fs.writeFileSync(path.join(engineDir, 'FluidEQ-Engine.dll'), '', 'utf8');

    expect(await isEngineInstalled('fluid')).toBe(true);
  });

  // The DLL alone once said "installed" on a machine whose effect Windows
  // never loaded, because the registration beside it was missing: the
  // helper's status is the authority once it has spoken.
  it('defers to the helper once it has said the engine is not registered', async () => {
    const engineDir = path.join(programFiles, 'FluidEQ Engine');
    fs.mkdirSync(engineDir, { recursive: true });
    fs.writeFileSync(path.join(engineDir, 'FluidEQ-Engine.dll'), '', 'utf8');

    noteFluidEngineRegistered(false);
    expect(await isEngineInstalled('fluid')).toBe(false);

    noteFluidEngineRegistered(true);
    expect(await isEngineInstalled('fluid')).toBe(true);

    // A registration alone is not an install either: the DLL still decides
    // when the helper's answer and the disk disagree the other way.
    fs.rmSync(engineDir, { recursive: true, force: true });
    expect(await isEngineInstalled('fluid')).toBe(false);
  });
});
