import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  deviceProfilesToFiles,
  getDefaultDeviceProfileSettings,
  filterVisibleAudioDevices,
  getStateForAudioDevice,
  TApoConfigFiles,
} from '../../../main/deviceProfiles';
import { FilterTypeEnum, getDefaultState } from '../../../common/constants';
import { FLUIDEQ_CONFIG_FILENAME } from '../../../main/flush';
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

    const files = deviceProfilesToFiles(settings, presetsDir);
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
    // headroom actually needed is 3 dB — the extra decibel the preset carried
    // was attenuation nobody could hear a reason for.
    expect(output).toContain('Preamp: -3 dB');
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

    const files = deviceProfilesToFiles(settings, presetsDir);
    const deviceFile = deviceFileFor(files, '{1234-ABCD}');
    const includes = deviceFile
      .split(/\r?\n/)
      .filter((line) => line.startsWith('Include: '));

    expect(includes).toHaveLength(3);
    expect(includes.map((line) => line.split('-').pop())).toEqual([
      'driver.txt',
      'eq.txt',
      'voicing.txt',
    ]);

    // Each feature file holds that feature's lines and nothing else, and each
    // numbers from one — the index is a label APO never refers back to.
    includes.forEach((line) => {
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

    const files = deviceProfilesToFiles(settings, presetsDir);
    const deviceFile = deviceFileFor(files, '{1234-ABCD}');
    const lines = deviceFile.split(/\r?\n/);

    expect(lines[lines.length - 1]).toBe('Preamp: -3 dB');
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

    const files = deviceProfilesToFiles(settings, presetsDir);
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
      presetsDir,
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

    const files = deviceProfilesToFiles(settings, presetsDir, configDir);
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

    const state = getStateForAudioDevice(settings, 'endpoint', presetsDir);

    expect(state.preAmp).toBe(-4);
    expect(state.filters.bass.gain).toBe(3);
  });

  it('uses a clean default state for an endpoint without a profile', () => {
    const settings = getDefaultDeviceProfileSettings();
    const state = getStateForAudioDevice(settings, 'unassigned', presetsDir);
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
      deviceProfilesToFiles(settings, presetsDir, undefined, {
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

    const files = deviceProfilesToFiles(settings, presetsDir);

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
