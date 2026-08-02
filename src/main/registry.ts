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

export const isPeaceInstalled = () => isSoftwareInstalled('Peace');
export const isEqualizerAPOInstalled = () =>
  process.platform === 'win32'
    ? isSoftwareInstalled('EqualizerAPO')
    : Promise.resolve(true);

export const getConfigPath = async () => {
  if (process.platform !== 'win32') {
    const demoConfigPath = path.join(
      app.getPath('userData'),
      'demo-equalizerapo',
    );
    fs.mkdirSync(demoConfigPath, { recursive: true });
    const configFile = path.join(demoConfigPath, 'config.txt');
    if (!fs.existsSync(configFile)) {
      fs.writeFileSync(configFile, '', 'utf8');
    }
    return demoConfigPath;
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
