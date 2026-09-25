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

/** Where Equalizer APO reads its config, and the file that says it is there. */
interface IApoInstall {
  configDir: string;
  dllPath: string;
}

interface IApoLookup {
  installed: boolean;
  install?: IApoInstall;
}

/**
 * Equalizer APO's installation, as the registry described it, kept for the
 * session.
 *
 * `regedit` answers every question by starting `cscript.exe` (`regList.wsf`),
 * and the flush asked one before every EQ write — each step of a drag, every
 * Auto normalize measurement during playback — while a state read or a health
 * check asked four (installed, then the path, which asked again and read two
 * keys). The answer only changes when Equalizer APO is uninstalled or moved,
 * and its uninstaller deletes `EqualizerAPO.dll` from `InstallPath` (its
 * `Setup.nsi`), so the DLL and the config folder still being there stand in
 * for the registry once it has spoken. An answer of "not installed" is never
 * kept: an install that happens while the app runs is found on the next ask,
 * as it always was.
 */
let knownApoInstall: IApoInstall | undefined;
let apoLookup: Promise<IApoLookup> | undefined;
/** Moved by `forgetApoInstall`, so a lookup it overtook is not kept. */
let apoLookupGeneration = 0;

const isApoStillThere = ({ configDir, dllPath }: IApoInstall) =>
  fs.existsSync(dllPath) && fs.existsSync(configDir);

const APO_REGISTRY_KEYS = [
  // regedit accepts the normal HKLM hive on both 32-bit and 64-bit Windows;
  // HKLM64 is not a valid hive name and only produces a noisy warning.
  'HKLM\\SOFTWARE\\EqualizerAPO',
  'HKLM\\SOFTWARE\\Wow6432Node\\EqualizerAPO',
] as const;

const readRegistryText = (value: { value: unknown } | undefined) =>
  typeof value?.value === 'string' && value.value.length > 0
    ? value.value
    : undefined;

const lookUpApoInstall = async (): Promise<IApoLookup> => {
  if (!(await isSoftwareInstalled('EqualizerAPO'))) {
    return { installed: false };
  }
  const found = await Promise.all(
    APO_REGISTRY_KEYS.map(async (registryKey) => {
      try {
        const values = (await regedit.list([registryKey]))[registryKey]?.values;
        const configDir = readRegistryText(values?.ConfigPath);
        return configDir
          ? {
              configDir,
              // The same key's `InstallPath`, because `ConfigPath` may point
              // anywhere and the DLL is always installed there; without one,
              // the config folder's parent, which is where Setup.nsi puts both.
              installDir:
                readRegistryText(values?.InstallPath) ??
                path.dirname(configDir),
            }
          : undefined;
      } catch {
        return undefined;
      }
    }),
  );
  const first = found.find((candidate) => candidate !== undefined);
  return first
    ? {
        installed: true,
        install: {
          configDir: first.configDir,
          dllPath: path.join(first.installDir, 'EqualizerAPO.dll'),
        },
      }
    : { installed: true };
};

/** The registry's answer, read once for everyone asking at the same time. */
const resolveApoInstall = (): Promise<IApoLookup> => {
  if (knownApoInstall && isApoStillThere(knownApoInstall)) {
    return Promise.resolve({ installed: true, install: knownApoInstall });
  }
  knownApoInstall = undefined;
  if (apoLookup) {
    return apoLookup;
  }
  const generation = apoLookupGeneration;
  const lookup: Promise<IApoLookup> = lookUpApoInstall()
    .then((answer) => {
      if (
        generation === apoLookupGeneration &&
        answer.install &&
        isApoStillThere(answer.install)
      ) {
        knownApoInstall = answer.install;
      }
      return answer;
    })
    .finally(() => {
      if (apoLookup === lookup) {
        apoLookup = undefined;
      }
    });
  apoLookup = lookup;
  return lookup;
};

/**
 * Ask the registry about Equalizer APO again on the next question: the engine
 * was switched, or its config folder's watcher failed.
 */
export const forgetApoInstall = (): void => {
  knownApoInstall = undefined;
  apoLookup = undefined;
  apoLookupGeneration += 1;
};

export const isEqualizerAPOInstalled = async (): Promise<boolean> =>
  process.platform === 'win32' ? (await resolveApoInstall()).installed : true;

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

  const apo = await resolveApoInstall();
  if (!apo.installed) {
    throw new Error('Equalizer APO not installed');
  }
  if (apo.install) {
    return apo.install.configDir;
  }

  throw new Error('Config path not found');
};
