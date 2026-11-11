/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
/** @jest-environment node */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  AUTOMATIC_PRESET_PREFIX,
  FilterTypeEnum,
} from '../../../common/constants';
import { getDefaultDeviceProfileSettings } from '../../../main/deviceProfileSettings';
import { flushPendingWrites } from '../../../main/asyncWriter';
import { fetchPreset } from '../../../main/flush';
import { gameCopyName } from '../../../main/gameSound';
import recoverMissingProfiles from '../../../main/missingProfiles';

jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

/*
 * The 2.4.0 report's state, on disk: an output attached to a profile its own
 * folder does not hold. Each case names the outputs as the report did.
 */
describe('an output that lost its profile', () => {
  let root: string;
  const dirFor = (deviceId: string) => {
    const dir = path.join(root, deviceId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  /** A profile told apart by its one band's gain, written `secondsAgo` ago. */
  const writeProfile = (
    folder: string,
    name: string,
    gain: number,
    secondsAgo = 0,
  ) => {
    const file = path.join(root, folder, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({
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
      }),
    );
    const at = Date.now() / 1000 - secondsAgo;
    fs.utimesSync(file, at, at);
  };

  const gainOf = (folder: string, name: string) =>
    fetchPreset(name, path.join(root, folder)).filters.bass?.gain;

  /** The base station attached to "Kraken V3 Pro"; the headset as given. */
  const attached = (basePreset = 'Kraken V3 Pro') => {
    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.headset = {
      deviceId: 'headset',
      deviceName: 'Kraken V3 Pro',
      deviceGuid: '{KR}',
      presetName: 'Kraken V3 Pro',
    };
    settings.assignments.base = {
      deviceId: 'base',
      deviceName: 'Headphones (Razer Base Station V2 Chroma)',
      deviceGuid: '{BS}',
      presetName: basePreset,
    };
    return settings;
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-lost-profile-'));
  });

  afterEach(async () => {
    await flushPendingWrites();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('gets the same profile back from the output whose folder kept it', async () => {
    writeProfile('headset', 'Kraken V3 Pro', 5);
    const settings = attached();

    const said = recoverMissingProfiles(settings, root, dirFor);
    await flushPendingWrites();

    expect(said).toEqual([
      {
        deviceName: 'Headphones (Razer Base Station V2 Chroma)',
        missing: 'Kraken V3 Pro',
        now: 'Kraken V3 Pro',
        how: 'copied',
      },
    ]);
    expect(settings.assignments.base.presetName).toBe('Kraken V3 Pro');
    expect(gainOf('base', 'Kraken V3 Pro')).toBe(5);
    // The control: the output that had its profile is left exactly as it was.
    expect(gainOf('headset', 'Kraken V3 Pro')).toBe(5);
    expect(said.map(({ deviceName }) => deviceName)).not.toContain(
      'Kraken V3 Pro',
    );
  });

  it('takes the newest copy that reads, and passes over one that does not', async () => {
    writeProfile('speakers', 'Kraken V3 Pro', 2, 600);
    writeProfile('monitor', 'Kraken V3 Pro', 7, 60);
    fs.mkdirSync(path.join(root, 'broken'), { recursive: true });
    fs.writeFileSync(path.join(root, 'broken', 'Kraken V3 Pro'), '{ not json');
    writeProfile('headset', 'Other', 1);
    const settings = attached();
    settings.assignments.headset.presetName = 'Other';

    recoverMissingProfiles(settings, root, dirFor);
    await flushPendingWrites();

    // The broken one is the newest file of all; the monitor's is the newest
    // that reads.
    expect(gainOf('base', 'Kraken V3 Pro')).toBe(7);
  });

  it('plays its own newest profile when no other folder has the lost one', () => {
    writeProfile('base', 'Flat', 0, 600);
    writeProfile('base', 'Night', -3, 60);
    // A game's copy is never the music profile, however recently it was saved.
    writeProfile('base', gameCopyName('steam:730'), 9, 1);
    writeProfile('headset', 'Kraken V3 Pro', 5);
    const settings = attached('Movie night');

    const said = recoverMissingProfiles(settings, root, dirFor);

    expect(said).toEqual([
      expect.objectContaining({
        missing: 'Movie night',
        now: 'Night',
        how: 'own',
      }),
    ]);
    expect(settings.assignments.base.presetName).toBe('Night');
  });

  it('starts an empty profile when it has nothing of its own', async () => {
    const settings = attached();

    const said = recoverMissingProfiles(settings, root, dirFor);
    await flushPendingWrites();

    // Both outputs lost it here, and neither had anything else.
    expect(said.map(({ how, now }) => [how, now])).toEqual([
      ['new', 'Untitled profile 1'],
      ['new', 'Untitled profile 1'],
    ]);
    expect(settings.assignments.base.presetName).toBe('Untitled profile 1');
    expect(fetchPreset('Untitled profile 1', dirFor('base')).isFlat).toBe(true);
  });

  it('never copies a hidden profile in from another output', () => {
    const automatic = `${AUTOMATIC_PRESET_PREFIX}60afadfab7ad`;
    // Contrived on purpose: the same hidden name in another output's folder.
    writeProfile('headset', automatic, 4);
    writeProfile('headset', 'Kraken V3 Pro', 5);
    const settings = attached(automatic);

    const [said] = recoverMissingProfiles(settings, root, dirFor);

    expect(said.how).toBe('new');
    expect(fs.existsSync(path.join(root, 'base', automatic))).toBe(false);
  });
});
