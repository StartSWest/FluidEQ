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

import fs from 'fs';
import os from 'os';
import path from 'path';
import log from 'electron-log';
import {
  deviceProfilesToFiles,
  getDefaultDeviceProfileSettings,
  filterVisibleAudioDevices,
  getStateForAudioDevice,
  removeAssignmentForPreset,
  renameAssignedPreset,
  TApoConfigFiles,
} from '../../../main/deviceProfiles';
import { FilterTypeEnum, getDefaultState } from '../../../common/constants';
import { FLUIDEQ_CONFIG_FILENAME, renamePreset } from '../../../main/flush';
import { expandApoConfig } from '../../utils/apoConfig';

/** The file a device's `Include:` points at, found through the root config. */
const deviceFileFor = (files: TApoConfigFiles, devicePattern: string) => {
  const root = (files.get(FLUIDEQ_CONFIG_FILENAME) ?? '').split(/\r?\n/);
  const deviceLine = root.indexOf(`Device: ${devicePattern}`);
  const include = root
    .slice(deviceLine)
    .find((line) => line.startsWith('Include: '));
  return files.get(include?.replace('Include: ', '') ?? '') ?? '';
};

describe('device profile configuration', () => {
  let presetsDir: string;

  beforeEach(() => {
    presetsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'fluideq-device-profiles-'),
    );
    fs.writeFileSync(
      path.join(presetsDir, 'Studio'),
      JSON.stringify({
        preAmp: -4,
        filters: {
          bass: {
            id: 'bass',
            frequency: 80,
            gain: 3,
            quality: 0.8,
            type: FilterTypeEnum.PK,
          },
        },
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(presetsDir, { recursive: true, force: true });
  });

  it('writes the named preset under the stable endpoint GUID', () => {
    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.endpoint = {
      deviceId: 'endpoint',
      deviceName: 'USB Headphones',
      deviceGuid: '{1234-ABCD}',
      presetName: 'Studio',
    };

    const files = deviceProfilesToFiles(settings, () => presetsDir);
    const root = files.get(FLUIDEQ_CONFIG_FILENAME) ?? '';
    const output = expandApoConfig(files);

    expect(root.indexOf('Device: all')).toBeLessThan(
      root.indexOf('Device: {1234-ABCD}'),
    );
    expect(root).not.toContain(
      '# Neutral fallback for every output without an attached profile.\r\nDevice: all\r\nChannel: all\r\nPreamp:',
    );
    expect(root).toContain('# USB Headphones -> Studio');
    expect(root).toContain('Device: {1234-ABCD}');
    // The preamp is derived from the chain, not read back from the preset.
    // This profile stored -4 dB, but its only band is a +3 dB peak, so the
    // The filter needs 3 dB plus the shared 0.2 dB safety ceiling. The extra
    // attenuation the preset carried beyond that is not reused.
    expect(output).toContain('Preamp: -3.2 dB');
    expect(output).toContain('Fc 80 Hz Gain 3 dB Q 0.8');
  });

  // The whole reason for the split: one feature's filters live in one file, so
  // rewriting a feature cannot touch another's, and switching one off is an
  // Include line that is simply not written rather than a loop over bands.
  it('gives every feature a file of its own, included in order', () => {
    fs.writeFileSync(
      path.join(presetsDir, 'Layered'),
      JSON.stringify({
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
        voicing: { profileId: 'music', intensity: 1 },
        driver: { profileId: 'balanced-armature-iem', intensity: 1 },
      }),
    );
    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.endpoint = {
      deviceId: 'endpoint',
      deviceName: 'USB Headphones',
      deviceGuid: '{1234-ABCD}',
      presetName: 'Layered',
    };

    const files = deviceProfilesToFiles(settings, () => presetsDir);
    const deviceFile = deviceFileFor(files, '{1234-ABCD}');
    const includes = deviceFile
      .split(/\r?\n/)
      .filter((line) => line.startsWith('Include: '));

    // The custom file rides last, after the generated preamp. Its measurable
    // EQ subset is read back for headroom, while arbitrary APO commands remain
    // outside the calculation.
    expect(includes).toHaveLength(4);
    expect(includes.map((line) => line.split('-').pop())).toEqual([
      'driver.txt',
      'eq.txt',
      'voicing.txt',
      'custom.txt',
    ]);

    // Each feature file holds that feature's lines and nothing else, and each
    // numbers from one — the index is a label APO never refers back to.
    includes
      .filter((line) => !line.endsWith('custom.txt'))
      .forEach((line) => {
        const contents = files.get(line.replace('Include: ', '')) ?? '';
        expect(contents).toContain('Filter 1:');
        expect(contents).not.toContain('Preamp:');
        expect(contents).not.toContain('Device:');
      });

    const eq = files.get(
      includes
        .find((line) => line.endsWith('eq.txt'))
        ?.replace('Include: ', '') ?? '',
    );
    expect(eq).toContain('Fc 80 Hz Gain 3 dB Q 0.8');
    expect(eq).not.toContain('Fc 3000 Hz');
  });

  // The peak of a sum is not the sum of the peaks, so the reserve cannot be
  // split up with the filters. It belongs to the device, after everything it
  // is protecting.
  it('keeps one preamp for the device, last in its file', () => {
    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.endpoint = {
      deviceId: 'endpoint',
      deviceName: 'USB Headphones',
      deviceGuid: '{1234-ABCD}',
      presetName: 'Studio',
    };

    const files = deviceProfilesToFiles(settings, () => presetsDir);
    const deviceFile = deviceFileFor(files, '{1234-ABCD}');
    const lines = deviceFile.split(/\r?\n/);

    // Last of the generated lines. Only the user's own file comes after it.
    expect(lines[lines.length - 2]).toBe('Preamp: -3.2 dB');
    expect(lines[lines.length - 1]).toMatch(/^Include: fluideq-.*-custom.txt$/);
    expect(
      [...files.values()].filter((contents) => contents.includes('Preamp:')),
    ).toHaveLength(1);
  });

  // Every output keeps its Include in the root, always. APO's own Device guard
  // picks the matching one at playback time, so switching Windows outputs needs
  // no config write — which is exactly what this app declines to do.
  it('names every assigned output in the root config', () => {
    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.first = {
      deviceId: 'first',
      deviceName: 'USB Headphones',
      deviceGuid: '{1234-ABCD}',
      presetName: 'Studio',
    };
    settings.assignments.second = {
      deviceId: 'second',
      deviceName: 'Speakers',
      deviceGuid: '{5678-EF01}',
      presetName: 'Studio',
    };

    const files = deviceProfilesToFiles(settings, () => presetsDir);
    const root = files.get(FLUIDEQ_CONFIG_FILENAME) ?? '';

    expect(root).toContain('Device: {1234-ABCD}');
    expect(root).toContain('Device: {5678-EF01}');
    // The root says which output, never what to do with it.
    expect(root).not.toContain('Filter ');
    expect(root).not.toContain('Preamp:');
    expect(deviceFileFor(files, '{1234-ABCD}')).not.toBe(
      deviceFileFor(files, '{5678-EF01}'),
    );
  });

  it('removes all APO rules while the FluidEQ engine is disabled', () => {
    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.endpoint = {
      deviceId: 'endpoint',
      deviceName: 'USB Headphones',
      deviceGuid: '{1234-ABCD}',
      presetName: 'Studio',
    };

    const files = deviceProfilesToFiles(
      settings,
      () => presetsDir,
      undefined,
      undefined,
      false,
    );
    const output = expandApoConfig(files);

    expect(output).toContain('# FluidEQ engine disabled');
    expect(output).not.toContain('Device: all');
    expect(output).not.toContain('Device: {1234-ABCD}');
    expect(output).not.toContain('Preamp:');
    // Nothing left for anything to include, so nothing is left behind either:
    // the flush deletes whatever this run did not write.
    expect([...files.keys()]).toEqual([FLUIDEQ_CONFIG_FILENAME]);
  });

  it('writes the convolution before EQ and preamp', () => {
    const configDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'fluideq-convolution-'),
    );
    fs.writeFileSync(
      path.join(presetsDir, 'Headset'),
      JSON.stringify({
        preAmp: -2,
        filters: {
          eq: {
            id: 'eq',
            frequency: 2000,
            gain: 2,
            quality: 1,
            type: FilterTypeEnum.PK,
          },
        },
        convolution: {
          name: 'Measured response',
          filters: {
            correction: {
              id: 'correction',
              frequency: 1000,
              gain: 3,
              quality: 1,
              type: FilterTypeEnum.PK,
            },
          },
        },
      }),
    );
    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.endpoint = {
      deviceId: 'endpoint',
      deviceName: 'USB Headphones',
      deviceGuid: '{1234-ABCD}',
      presetName: 'Headset',
    };

    const files = deviceProfilesToFiles(settings, () => presetsDir, configDir);
    const output = expandApoConfig(files);
    expect(output.indexOf('Convolution: fluideq-convolution-')).toBeGreaterThan(
      -1,
    );
    // Ordering is what this test is about, and it now spans two files: the
    // device file states the convolution before it includes anything, and the
    // preamp after. Expanding the includes is how APO sees the same sequence.
    expect(output.indexOf('Convolution:')).toBeLessThan(
      output.indexOf('Filter 1:'),
    );
    // The value is derived from the chain now — this profile boosts +2 dB of
    // EQ on top of a +3 dB convolution — so asserting the stored -2 dB would be
    // pinning a number that is no longer where the preamp comes from.
    expect(output.indexOf('Filter 1:')).toBeLessThan(output.indexOf('Preamp:'));
    expect(output).toMatch(/Preamp: -[\d.]+ dB/);
    expect(
      fs.readdirSync(configDir).some((file) => file.endsWith('.wav')),
    ).toBe(true);
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('loads the attached preset for the active endpoint', () => {
    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.endpoint = {
      deviceId: 'endpoint',
      deviceName: 'USB Headphones',
      deviceGuid: '{1234-ABCD}',
      presetName: 'Studio',
    };

    const state = getStateForAudioDevice(
      settings,
      'endpoint',
      () => presetsDir,
    );

    expect(state.preAmp).toBe(-4);
    expect(state.filters.bass.gain).toBe(3);
  });

  it('uses a clean default state for an endpoint without a profile', () => {
    const settings = getDefaultDeviceProfileSettings();
    const state = getStateForAudioDevice(
      settings,
      'unassigned',
      () => presetsDir,
    );
    const defaults = getDefaultState();

    expect(state).toMatchObject({
      isEnabled: defaults.isEnabled,
      isAutoPreAmpOn: defaults.isAutoPreAmpOn,
      isGraphViewOn: defaults.isGraphViewOn,
      preAmp: 0,
    });
    expect(
      Object.values(state.filters)
        .map(({ frequency }) => frequency)
        .sort((left, right) => left - right),
    ).toEqual(
      Object.values(defaults.filters)
        .map(({ frequency }) => frequency)
        .sort((left, right) => left - right),
    );
    expect(Object.values(state.filters).every(({ gain }) => gain === 0)).toBe(
      true,
    );
  });

  it('writes an explicit session override for an unassigned endpoint', () => {
    const settings = getDefaultDeviceProfileSettings();
    const state = getDefaultState();
    const firstFilter = Object.values(state.filters)[0];
    firstFilter.gain = 6;

    const output = expandApoConfig(
      deviceProfilesToFiles(settings, () => presetsDir, undefined, {
        devicePattern: '{ACTIVE-ENDPOINT}',
        state,
      }),
    );

    expect(output).toContain('# Active FluidEQ session override');
    expect(output).toContain('Device: {ACTIVE-ENDPOINT}');
    expect(output).toContain('Gain 6 dB');
  });

  it('ignores assignments whose preset was removed', () => {
    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.endpoint = {
      deviceId: 'endpoint',
      deviceName: 'USB Headphones',
      deviceGuid: '{1234-ABCD}',
      presetName: 'Missing',
    };

    const files = deviceProfilesToFiles(settings, () => presetsDir);

    expect(expandApoConfig(files)).not.toContain('Device: {1234-ABCD}');
    // And no orphan files for a device that never made it into the root.
    expect([...files.keys()]).toEqual([FLUIDEQ_CONFIG_FILENAME]);
  });

  it('shows only active named outputs and removes exact duplicates', () => {
    const devices = filterVisibleAudioDevices([
      {
        id: 'old',
        name: 'Speakers',
        guid: '{OLD}',
        isDefault: false,
        isActive: false,
      },
      {
        id: 'blank',
        name: '   ',
        guid: '{BLANK}',
        isDefault: false,
        isActive: true,
      },
      {
        id: 'duplicate',
        name: 'speakers',
        guid: '{DUPLICATE}',
        isDefault: false,
        isActive: true,
      },
      {
        id: 'default',
        name: 'Speakers',
        guid: '{DEFAULT}',
        isDefault: true,
        isActive: true,
      },
      {
        id: 'headphones',
        name: 'Headphones',
        guid: '{HEADPHONES}',
        isDefault: false,
        isActive: true,
      },
    ]);

    expect(devices.map(({ id }) => id)).toEqual(['headphones', 'default']);
  });
});

/**
 * Profiles belong to an output, so a name means nothing on its own.
 *
 * This is the whole point of resolving a directory per device rather than
 * taking one for all of them. Under a single flat folder these tests cannot
 * even be written: there is one file called "Bass boost" and both outputs get
 * whatever it holds.
 */
describe('profiles scoped to one output', () => {
  let root: string;

  /**
   * A profile in one output's folder, identified by its band gain.
   *
   * The gain rather than the preamp, because the preamp written to the config
   * is recalculated from the bands rather than copied from the profile — two
   * profiles differing only in preamp would come out identical and prove
   * nothing about which folder they were read from.
   */
  const writeProfile = (deviceId: string, name: string, gain: number) => {
    const dir = path.join(root, deviceId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, name),
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
  };

  /** The bands an output actually got, following its `Include:` one more hop. */
  const bandsFor = (files: TApoConfigFiles, devicePattern: string) => {
    const include = deviceFileFor(files, devicePattern)
      .split(/\r?\n/)
      .find((line) => line.endsWith('-eq.txt'));
    return files.get(include?.replace('Include: ', '') ?? '') ?? '';
  };

  const dirFor = (deviceId: string) => path.join(root, deviceId);

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-per-output-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('keeps two outputs’ same-named profiles apart', () => {
    // The case that used to be impossible: the speakers and the headphones
    // both have a "Bass boost", and they are different tunings. One flat
    // folder made the second save overwrite the first.
    writeProfile('headphones', 'Bass boost', 6);
    writeProfile('speakers', 'Bass boost', 2);

    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.headphones = {
      deviceId: 'headphones',
      deviceName: 'Headphones',
      deviceGuid: '{HP}',
      presetName: 'Bass boost',
    };
    settings.assignments.speakers = {
      deviceId: 'speakers',
      deviceName: 'Speakers',
      deviceGuid: '{SP}',
      presetName: 'Bass boost',
    };

    const files = deviceProfilesToFiles(settings, dirFor);

    expect(bandsFor(files, '{HP}')).toContain('Gain 6 dB');
    expect(bandsFor(files, '{SP}')).toContain('Gain 2 dB');
  });

  it('reads each output’s own copy into the live state', () => {
    writeProfile('headphones', 'Bass boost', 6);
    writeProfile('speakers', 'Bass boost', 2);

    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.headphones = {
      deviceId: 'headphones',
      deviceName: 'Headphones',
      deviceGuid: '{HP}',
      presetName: 'Bass boost',
    };
    settings.assignments.speakers = {
      deviceId: 'speakers',
      deviceName: 'Speakers',
      deviceGuid: '{SP}',
      presetName: 'Bass boost',
    };

    expect(
      getStateForAudioDevice(settings, 'headphones', dirFor).filters.bass.gain,
    ).toBe(6);
    expect(
      getStateForAudioDevice(settings, 'speakers', dirFor).filters.bass.gain,
    ).toBe(2);
  });

  it('does not find another output’s profile', () => {
    // "pepe" exists, but not for the speakers, and there is no fallback that
    // would quietly hand them somebody else's tuning.
    writeProfile('headphones', 'pepe', 9);
    fs.mkdirSync(path.join(root, 'speakers'), { recursive: true });

    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.speakers = {
      deviceId: 'speakers',
      deviceName: 'Speakers',
      deviceGuid: '{SP}',
      presetName: 'pepe',
    };

    // The default preamp, not the -9 stored under the headphones.
    expect(getStateForAudioDevice(settings, 'speakers', dirFor).preAmp).toBe(
      getDefaultState().preAmp,
    );
  });

  /**
   * Two outputs sharing a name is the normal case, not a corner one: every
   * output FluidEQ has ever created for itself is called "Untitled profile 1".
   */
  const twoOutputsSharingAName = () => {
    writeProfile('headphones', 'Untitled profile 1', 6);
    writeProfile('speakers', 'Untitled profile 1', 2);

    const settings = getDefaultDeviceProfileSettings();
    settings.assignments.headphones = {
      deviceId: 'headphones',
      deviceName: 'Headphones',
      deviceGuid: '{HP}',
      presetName: 'Untitled profile 1',
    };
    settings.assignments.speakers = {
      deviceId: 'speakers',
      deviceName: 'Speakers',
      deviceGuid: '{SP}',
      presetName: 'Untitled profile 1',
    };
    return settings;
  };

  it('renames one output’s profile and leaves the other playing', () => {
    const settings = twoOutputsSharingAName();

    // What the IPC handler does: the file moves in one folder, so exactly one
    // assignment may follow it.
    renamePreset('Untitled profile 1', 'Studio', dirFor('headphones'));
    renameAssignedPreset(
      settings,
      'headphones',
      'Untitled profile 1',
      'Studio',
    );

    // The positive control. Asserting only that the speakers were untouched
    // would pass just as well if the rename had done nothing at all.
    expect(settings.assignments.headphones.presetName).toBe('Studio');
    expect(settings.assignments.speakers.presetName).toBe('Untitled profile 1');

    // And the consequence that made this worth finding. `flushDeviceProfiles`
    // swallows a profile it cannot read, so a speaker assignment dragged along
    // to "Studio" would not throw — the output would simply vanish from the
    // config and stop being equalised, with the error surfacing much later
    // somewhere that looked unrelated.
    const files = deviceProfilesToFiles(settings, dirFor);
    expect(bandsFor(files, '{HP}')).toContain('Gain 6 dB');
    expect(bandsFor(files, '{SP}')).toContain('Gain 2 dB');
  });

  it('leaves an output whose assignment has moved on', () => {
    const settings = twoOutputsSharingAName();
    settings.assignments.headphones.presetName = 'Something else';

    renameAssignedPreset(
      settings,
      'headphones',
      'Untitled profile 1',
      'Studio',
    );

    expect(settings.assignments.headphones.presetName).toBe('Something else');
  });

  it('detaches only the output whose profile was deleted', () => {
    const settings = twoOutputsSharingAName();

    removeAssignmentForPreset(settings, 'headphones', 'Untitled profile 1');

    expect(settings.assignments.headphones).toBeUndefined();
    expect(settings.assignments.speakers.presetName).toBe('Untitled profile 1');
  });

  it('keeps an output attached when the deleted name is not the one it plays', () => {
    const settings = twoOutputsSharingAName();
    settings.assignments.headphones.presetName = 'Something else';

    removeAssignmentForPreset(settings, 'headphones', 'Untitled profile 1');

    expect(settings.assignments.headphones.presetName).toBe('Something else');
  });

  it('says so when an output is dropped for an unreadable profile', () => {
    const settings = twoOutputsSharingAName();
    // Only the speakers have a file. The headphones name one that is not there,
    // which is exactly the state a cross-output rename used to leave behind.
    fs.rmSync(path.join(root, 'headphones', 'Untitled profile 1'));
    const complaints: unknown[] = [];
    const reportedError = jest
      .spyOn(log, 'error')
      .mockImplementation((...args: unknown[]) => {
        complaints.push(args[0]);
      });

    try {
      const files = deviceProfilesToFiles(settings, dirFor);

      // The output that can still be read is still served — one bad profile
      // does not take the chain down.
      expect(bandsFor(files, '{SP}')).toContain('Gain 2 dB');
      // And the one that cannot is named, rather than disappearing in silence.
      expect(
        complaints.some(
          (line) =>
            typeof line === 'string' &&
            line.includes('Headphones') &&
            line.includes('Untitled profile 1'),
        ),
      ).toBe(true);
    } finally {
      reportedError.mockRestore();
    }
  });
});
