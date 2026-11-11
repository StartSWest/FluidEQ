/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A profile that cannot be read is said once (unreadableProfiles.ts).
 *
 * The reader is asked for the same profile on every flush, every refresh of
 * the layer list and every change of output, and it logged the failure with
 * its stack each time: a 2.4.0 report carried 106 stack traces for one output.
 * Every case here stands beside its control, so "said once" is never the log
 * simply being off.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import log from 'electron-log';
import { FilterTypeEnum, IPresetV2 } from 'common/constants';
import {
  deviceProfilesToFiles,
  getStateForAudioDevice,
} from 'main/deviceProfiles';
import { fetchPreset } from 'main/flush';
import { flushPendingWrites } from 'main/asyncWriter';
import { getDefaultDeviceProfileSettings } from '../../../main/deviceProfileSettings';

const GOOD: IPresetV2 = {
  preAmp: 0,
  filters: {
    bass: {
      id: 'bass',
      frequency: 80,
      gain: 3,
      quality: 0.8,
      type: FilterTypeEnum.PK,
    },
  },
};

let root: string;
/** Every call to `log.error`, whatever it was given. */
let errors: unknown[][];
let reportedError: jest.SpyInstance;

/** The lines that name a profile as unreadable. */
const said = () =>
  errors
    .map(([first]) => first)
    .filter(
      (first): first is string =>
        typeof first === 'string' && first.includes('Could not read'),
    );

const write = (dir: string, name: string, text: string) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), text);
};

const throwsFor = (name: string, dir: string) => {
  expect(() => fetchPreset(name, dir)).toThrow();
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-unreadable-'));
  errors = [];
  reportedError = jest
    .spyOn(log, 'error')
    .mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
});

afterEach(async () => {
  reportedError.mockRestore();
  await flushPendingWrites().catch(() => undefined);
  fs.rmSync(root, { recursive: true, force: true });
});

it('says once that a profile cannot be read, however often it is asked for', () => {
  write(root, 'Studio', '{ not a profile');

  throwsFor('Studio', root);
  throwsFor('Studio', root);
  throwsFor('Studio', root);

  expect(said()).toHaveLength(1);
  expect(said()[0]).toContain('"Studio"');
  expect(said()[0]).toContain(root);
  // With what went wrong, once: the line and the error behind it.
  expect(errors).toHaveLength(2);
  expect(errors[1][0]).toBeInstanceOf(Error);
});

it('says it again after the profile has read, and when what is wrong changes', () => {
  write(root, 'Studio', '{ not a profile');
  throwsFor('Studio', root);
  expect(said()).toHaveLength(1);

  // The control for the silence: it read, so losing it again is news.
  write(root, 'Studio', JSON.stringify(GOOD));
  expect(fetchPreset('Studio', root).filters.bass.gain).toBe(3);
  write(root, 'Studio', '{ not a profile');
  throwsFor('Studio', root);
  expect(said()).toHaveLength(2);

  // Another kind of damage in the same file is another thing to say.
  write(root, 'Studio', '{ "preAmp": "loud", "filters": 7 }');
  throwsFor('Studio', root);
  throwsFor('Studio', root);
  expect(said()).toHaveLength(3);
});

it('says once that a profile is not there', () => {
  throwsFor('Gone', root);
  throwsFor('Gone', root);

  expect(said()).toHaveLength(1);
  expect(said()[0]).toContain('"Gone"');
});

it('keeps one profile’s failure from silencing another’s', () => {
  const speakers = path.join(root, 'speakers');
  const headset = path.join(root, 'headset');
  // The same name and the same damage in two outputs' folders, and another
  // name beside one of them: three profiles, three lines.
  write(speakers, 'Studio', '{ not a profile');
  write(headset, 'Studio', '{ not a profile');
  write(headset, 'Night', '{ not a profile');

  throwsFor('Studio', speakers);
  throwsFor('Studio', headset);
  throwsFor('Night', headset);
  throwsFor('Studio', speakers);

  expect(said()).toHaveLength(3);
});

it('logs nothing more for a damaged profile after the first flush', () => {
  const dirFor = (deviceId: string) => path.join(root, deviceId);
  write(dirFor('a'), 'Studio', JSON.stringify(GOOD));
  write(dirFor('broken'), 'Studio', '{ not a profile');
  const settings = getDefaultDeviceProfileSettings();
  ['a', 'broken'].forEach((deviceId) => {
    settings.assignments[deviceId] = {
      deviceId,
      deviceName: `Output ${deviceId}`,
      deviceGuid: `{${deviceId}}`,
      presetName: 'Studio',
    };
  });

  deviceProfilesToFiles(settings, dirFor);
  // The control: the first flush did say it.
  const afterFirst = errors.length;
  expect(said()).toHaveLength(1);
  expect(afterFirst).toBeGreaterThan(0);

  // A drag is dozens of flushes, and the window asks for the output's state
  // beside them.
  deviceProfilesToFiles(settings, dirFor);
  deviceProfilesToFiles(settings, dirFor);
  getStateForAudioDevice(settings, 'broken', dirFor);
  getStateForAudioDevice(settings, 'broken', dirFor);

  expect(errors).toHaveLength(afterFirst);
});
