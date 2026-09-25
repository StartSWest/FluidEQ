/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An edit re-renders the output it changed and no other.
 *
 * Every flush used to read, parse, validate and render every attached output's
 * profile again, on every step of a drag, although an edit changes one of
 * them. Counted here in profile reads: `fetchPreset` is where each render
 * starts.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { FilterTypeEnum, IPresetV2 } from 'common/constants';
import {
  deviceProfilesToFiles,
  getDefaultDeviceProfileSettings,
  TApoConfigFiles,
} from 'main/deviceProfiles';
import { fetchPreset, FLUIDEQ_CONFIG_FILENAME, savePreset } from 'main/flush';
import { flushPendingWrites } from 'main/asyncWriter';
import expandApoConfig from '../../utils/apoConfig';

jest.mock('main/flush', () => {
  const actual = jest.requireActual<typeof import('main/flush')>('main/flush');
  return { ...actual, fetchPreset: jest.fn(actual.fetchPreset) };
});

const fetches = fetchPreset as jest.MockedFunction<typeof fetchPreset>;

let root: string;
const presetDir = (deviceId: string) => path.join(root, deviceId);

const preset = (gain: number, extra: Partial<IPresetV2> = {}): IPresetV2 => ({
  preAmp: 0,
  filters: {
    bass: {
      id: 'bass',
      frequency: 80,
      gain,
      quality: 0.8,
      type: FilterTypeEnum.PK,
    },
  },
  ...extra,
});

const writeProfile = (deviceId: string, profile: IPresetV2) => {
  fs.mkdirSync(presetDir(deviceId), { recursive: true });
  fs.writeFileSync(
    path.join(presetDir(deviceId), 'Studio'),
    JSON.stringify(profile),
  );
};

const settingsFor = (...deviceIds: string[]) => {
  const settings = getDefaultDeviceProfileSettings();
  deviceIds.forEach((deviceId) => {
    settings.assignments[deviceId] = {
      deviceId,
      deviceName: `Output ${deviceId}`,
      deviceGuid: `{${deviceId}}`,
      presetName: 'Studio',
    };
  });
  return settings;
};

/** The file a device's `Include:` points at, found through the root config. */
const deviceFileFor = (files: TApoConfigFiles, deviceId: string) => {
  const root = (files.get(FLUIDEQ_CONFIG_FILENAME) ?? '').split(/\r?\n/);
  const deviceLine = root.indexOf(`Device: {${deviceId}}`);
  const include = root
    .slice(deviceLine)
    .find((line) => line.startsWith('Include: '));
  return files.get(include?.replace('Include: ', '') ?? '') ?? '';
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-render-memo-'));
  fetches.mockClear();
});

afterEach(async () => {
  await flushPendingWrites().catch(() => undefined);
  fs.rmSync(root, { recursive: true, force: true });
});

it('renders nothing again when nothing changed', () => {
  writeProfile('a', preset(3));
  writeProfile('b', preset(-2));
  const settings = settingsFor('a', 'b');

  const first = deviceProfilesToFiles(settings, presetDir);
  expect(fetches).toHaveBeenCalledTimes(2);

  const second = deviceProfilesToFiles(settings, presetDir);
  expect(fetches).toHaveBeenCalledTimes(2);
  expect([...second]).toEqual([...first]);
});

it('renders again only the output whose profile an edit saved', () => {
  writeProfile('a', preset(3));
  writeProfile('b', preset(-2));
  const settings = settingsFor('a', 'b');
  const first = deviceProfilesToFiles(settings, presetDir);

  // Saved the way every edit saves it, through the coalescing writer.
  savePreset('Studio', preset(6), presetDir('a'));
  const edited = deviceProfilesToFiles(settings, presetDir);

  expect(fetches).toHaveBeenCalledTimes(3);
  expect(fetches).toHaveBeenLastCalledWith('Studio', presetDir('a'));
  expect(expandApoConfig(edited)).toContain('Fc 80 Hz Gain 6 dB Q 0.8');
  expect(deviceFileFor(edited, 'b')).toBe(deviceFileFor(first, 'b'));
  expect(deviceFileFor(edited, 'b')).not.toBe('');
});

it('renders again only the output a new measurement was heard on', () => {
  writeProfile('a', preset(3));
  writeProfile('b', preset(-2));
  const settings = settingsFor('a', 'b');
  const measured = {
    deviceId: 'a',
    programme: [{ frequency: 100, gain: -10 }],
    trimDb: -1,
  };
  deviceProfilesToFiles(
    settings,
    presetDir,
    undefined,
    undefined,
    true,
    measured,
  );
  fetches.mockClear();

  deviceProfilesToFiles(settings, presetDir, undefined, undefined, true, {
    ...measured,
    programme: [{ frequency: 100, gain: -10 }],
  });
  expect(fetches).not.toHaveBeenCalled();

  deviceProfilesToFiles(settings, presetDir, undefined, undefined, true, {
    ...measured,
    trimDb: -3,
  });
  expect(fetches).toHaveBeenCalledTimes(1);
  expect(fetches).toHaveBeenLastCalledWith('Studio', presetDir('a'));
});

it('still renders a profile with an impulse every time, as it writes and migrates as it goes', () => {
  writeProfile(
    'a',
    preset(3, { convolution: { name: 'Some HRTF', filters: {} } }),
  );
  const settings = settingsFor('a');

  deviceProfilesToFiles(settings, presetDir);
  deviceProfilesToFiles(settings, presetDir);

  expect(fetches).toHaveBeenCalledTimes(2);
});

it('says why an output it cannot read is left out, every time it is asked', () => {
  writeProfile('a', preset(3));
  const settings = settingsFor('a', 'missing');

  const files = deviceProfilesToFiles(settings, presetDir);
  deviceProfilesToFiles(settings, presetDir);

  expect(deviceFileFor(files, 'a')).not.toBe('');
  expect(files.get(FLUIDEQ_CONFIG_FILENAME)).not.toContain('{missing}');
  // One read for "a", then two failed reads of "missing".
  expect(fetches).toHaveBeenCalledTimes(3);
});
