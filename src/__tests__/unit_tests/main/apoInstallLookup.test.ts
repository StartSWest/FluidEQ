/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Equalizer APO's installation is read from the registry once and kept.
 *
 * Every `regedit.list` starts a `cscript.exe`, and the flush asked whether
 * Equalizer APO was installed before every EQ write — about twenty processes a
 * second while a slider was dragged. The answers below are counted in registry
 * reads, and each "reads nothing" has a read beside it that does.
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

// registry.ts reads `app` and sets regedit's VBS folder as it loads, so both
// mocks above have to be in place first.
// eslint-disable-next-line import/first -- see above
import {
  forgetApoInstall,
  getConfigPath,
  isEngineInstalled,
  isEqualizerAPOInstalled,
} from 'main/registry';

const UNINSTALL =
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall';
const NATIVE_KEY = 'HKLM\\SOFTWARE\\EqualizerAPO';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

let installDir: string;
let configDir: string;
let isListedInUninstall: boolean;
let writesInstallPath: boolean;

const registry = ([key]: string[]) => {
  if (key === UNINSTALL) {
    return Promise.resolve({
      [key]: {
        exists: true,
        keys: isListedInUninstall ? ['Other', 'EqualizerAPO'] : ['Other'],
        values: {},
      },
    });
  }
  if (key === NATIVE_KEY) {
    return Promise.resolve({
      [key]: {
        exists: true,
        keys: [],
        values: {
          ConfigPath: { type: 'REG_SZ', value: configDir },
          ...(writesInstallPath
            ? { InstallPath: { type: 'REG_SZ', value: installDir } }
            : {}),
        },
      },
    });
  }
  return Promise.resolve({ [key]: { exists: false, keys: [], values: {} } });
};

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  installDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-apo-install-'));
  configDir = path.join(installDir, 'config');
  fs.mkdirSync(configDir);
  fs.writeFileSync(path.join(installDir, 'EqualizerAPO.dll'), '');
  isListedInUninstall = true;
  writesInstallPath = true;
  listSpy.mockReset().mockImplementation(registry);
  forgetApoInstall();
});

afterEach(() => {
  fs.rmSync(installDir, { recursive: true, force: true });
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
});

it('reads the registry once however many edits ask', async () => {
  expect(await getConfigPath('apo')).toBe(configDir);
  // The uninstall list, then the two views of Equalizer APO's own key.
  expect(listSpy).toHaveBeenCalledTimes(3);

  for (let edit = 0; edit < 20; edit += 1) {
    expect(await isEngineInstalled('apo')).toBe(true);
    expect(await getConfigPath('apo')).toBe(configDir);
  }

  expect(listSpy).toHaveBeenCalledTimes(3);
});

it('answers everybody asking at once with one lookup', async () => {
  const answers = await Promise.all([
    isEqualizerAPOInstalled(),
    getConfigPath('apo'),
    isEngineInstalled('apo'),
    getConfigPath('apo'),
  ]);

  expect(answers).toEqual([true, configDir, true, configDir]);
  expect(listSpy).toHaveBeenCalledTimes(3);
});

it('asks the registry again once the DLL has gone, and hears it is uninstalled', async () => {
  await getConfigPath('apo');
  // What Equalizer APO's uninstaller does, and what it tells the registry.
  fs.rmSync(path.join(installDir, 'EqualizerAPO.dll'));
  isListedInUninstall = false;

  expect(await isEngineInstalled('apo')).toBe(false);
  await expect(getConfigPath('apo')).rejects.toThrow(
    'Equalizer APO not installed',
  );
  expect(listSpy).toHaveBeenCalledTimes(5);
});

it('asks again after its config folder vanishes, and keeps nothing it cannot find', async () => {
  await getConfigPath('apo');
  fs.rmSync(configDir, { recursive: true, force: true });

  // The registry still names it, so the answer is the registry's, as before.
  expect(await getConfigPath('apo')).toBe(configDir);
  expect(await getConfigPath('apo')).toBe(configDir);
  expect(listSpy).toHaveBeenCalledTimes(9);
});

it('never keeps "not installed", so an install is found on the next ask', async () => {
  isListedInUninstall = false;
  expect(await isEqualizerAPOInstalled()).toBe(false);
  expect(await isEqualizerAPOInstalled()).toBe(false);
  expect(listSpy).toHaveBeenCalledTimes(2);

  isListedInUninstall = true;
  expect(await isEqualizerAPOInstalled()).toBe(true);
  expect(await getConfigPath('apo')).toBe(configDir);
  expect(listSpy).toHaveBeenCalledTimes(5);
});

it('asks again after an engine switch forgets it', async () => {
  await getConfigPath('apo');
  forgetApoInstall();
  await getConfigPath('apo');

  expect(listSpy).toHaveBeenCalledTimes(6);
});

it('looks for the DLL beside the config folder when no InstallPath is written', async () => {
  writesInstallPath = false;
  await getConfigPath('apo');
  await getConfigPath('apo');
  expect(listSpy).toHaveBeenCalledTimes(3);

  fs.rmSync(path.join(installDir, 'EqualizerAPO.dll'));
  await getConfigPath('apo');
  expect(listSpy).toHaveBeenCalledTimes(6);
});
