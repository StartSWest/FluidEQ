/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { promisified as regedit, setExternalVBSLocation } from 'regedit';
import { TAudioEngine } from '../common/audioEngine';

// app will only be defined in the electron main process environment.
// in the test environment, we expect it to be undefined.
if (app) {
  const vbsDirectory = path.join(
    path.dirname(app.getPath('exe')),
    './resources/vbs',
  );
  setExternalVBSLocation(vbsDirectory);
} else {
  const vbsDirectory = path.join(
    __dirname,
    '../../../node_modules/regedit/vbs',
  );
  setExternalVBSLocation(vbsDirectory);
}

const isSoftwareInstalled = async (softwareKey: string) => {
  const registryKey =
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall';
  const listResult = await regedit.list([registryKey]);

  if (listResult[registryKey].exists) {
    // eslint-disable-next-line no-restricted-syntax
    for (const key of listResult[registryKey].keys) {
      if (key === softwareKey) {
        return true;
      }
    }
  }
  return false;
};

export const isEqualizerAPOInstalled = () =>
  process.platform === 'win32'
    ? isSoftwareInstalled('EqualizerAPO')
    : Promise.resolve(true);

/**
 * `%ProgramData%\FluidEQ\engine\config` — the FluidEQ Engine DLL watches this
 * directory directly, the same way Equalizer APO watches its own. Nothing
 * installs it into the registry, so this is a plain, computed path rather
 * than a lookup.
 */
export const getFluidEngineConfigDir = (): string =>
  path.join(
    process.env.ProgramData ?? 'C:\\ProgramData',
    'FluidEQ',
    'engine',
    'config',
  );

export const getFluidEngineDllPath = (): string =>
  path.join(
    process.env.ProgramFiles ?? 'C:\\Program Files',
    'FluidEQ Engine',
    'FluidEQ-Engine.dll',
  );

/**
 * What the helper's `status` last said about the effect being registered
 * with Windows, or nothing until it has been asked.
 *
 * The DLL on disk is not the whole of "installed": the first machine this
 * ran on had the DLL, the class registration and every output attached, and
 * no audio-engine record — so audiodg.exe never loaded it. The DLL check
 * said installed, the helper said not, and the app offered nothing because
 * the two disagreed. The helper is the authority; this remembers its answer
 * between reads, because a process spawn on every slider move is not.
 */
let fluidEngineRegistered: boolean | undefined;

export const noteFluidEngineRegistered = (registered: boolean): void => {
  fluidEngineRegistered = registered;
};

export const isEngineInstalled = (engine: TAudioEngine): Promise<boolean> =>
  engine === 'apo'
    ? isEqualizerAPOInstalled()
    : Promise.resolve(
        fs.existsSync(getFluidEngineDllPath()) &&
          fluidEngineRegistered !== false,
      );

/**
 * A config directory is unusable to Equalizer APO's own reader unless
 * `config.txt` exists, so every code path that hands one out creates that
 * file first — empty, never overwritten once present, because a config.txt
 * an install already wrote (with a user's own other includes in it) must
 * survive untouched. `checkConfigFile`/`updateConfig` in `flush.ts` are what
 * add the `Include: fluideq.txt` line, once this file is known to exist.
 */
const ensureConfigDirWithEmptyConfigFile = (configDir: string): string => {
  fs.mkdirSync(configDir, { recursive: true });
  const configFile = path.join(configDir, 'config.txt');
  if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, '', 'utf8');
  }
  return configDir;
};

export const getConfigPath = async (engine: TAudioEngine): Promise<string> => {
  if (process.platform !== 'win32') {
    // Neither engine is really installable off Windows: both resolve to the
    // same sandbox directory this always used, regardless of which engine was
    // chosen.
    return ensureConfigDirWithEmptyConfigFile(
      path.join(app.getPath('userData'), 'demo-equalizerapo'),
    );
  }

  if (engine === 'fluid') {
    // The engine's directory is never in the registry — see
    // `getFluidEngineConfigDir` — so no APO probe belongs on this path.
    return ensureConfigDirWithEmptyConfigFile(getFluidEngineConfigDir());
  }

  const isInstalled = await isEqualizerAPOInstalled();
  if (!isInstalled) {
    throw new Error('Equalizer APO not installed');
  }

  // regedit accepts the normal HKLM hive on both 32-bit and 64-bit Windows;
  // HKLM64 is not a valid hive name and only produces a noisy warning.
  const registryKeys = [
    'HKLM\\SOFTWARE\\EqualizerAPO',
    'HKLM\\SOFTWARE\\Wow6432Node\\EqualizerAPO',
  ];
  const configPaths = await Promise.all(
    registryKeys.map(async (registryKey) => {
      try {
        const listResult = await regedit.list([registryKey]);
        const configPath = listResult[registryKey]?.values?.ConfigPath?.value;
        return typeof configPath === 'string' && configPath.length > 0
          ? configPath
          : undefined;
      } catch (e) {
        return undefined;
      }
    }),
  );
  const configPath = configPaths.find((candidate): candidate is string =>
    Boolean(candidate),
  );
  if (configPath) {
    return configPath;
  }

  throw new Error('Config path not found');
};
