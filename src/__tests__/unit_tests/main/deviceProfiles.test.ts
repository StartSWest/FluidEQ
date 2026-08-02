import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  deviceProfilesToString,
  getDefaultDeviceProfileSettings,
  filterVisibleAudioDevices,
  getStateForAudioDevice,
} from '../../../main/deviceProfiles';
import { FilterTypeEnum, getDefaultState } from '../../../common/constants';

describe('device profile configuration', () => {
  let presetsDir: string;

  beforeEach(() => {
    presetsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'aqua-device-profiles-'),
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

    const output = deviceProfilesToString(settings, presetsDir);

    expect(output.indexOf('Device: all')).toBeLessThan(
      output.indexOf('Device: {1234-ABCD}'),
    );
    expect(output).toContain('Preamp: 0 dB');
    expect(output).toContain('# USB Headphones -> Studio');
    expect(output).toContain('Device: {1234-ABCD}');
    expect(output).toContain('Preamp: -4 dB');
    expect(output).toContain('Fc 80 Hz Gain 3 dB Q 0.8');
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

    const output = deviceProfilesToString(settings, presetsDir, configDir);
    expect(output.indexOf('Convolution: fluideq-convolution-')).toBeGreaterThan(
      -1,
    );
    expect(output.indexOf('Convolution:')).toBeLessThan(
      output.indexOf('Filter 1:'),
    );
    expect(output.indexOf('Filter 1:')).toBeLessThan(
      output.indexOf('Preamp: -2 dB'),
    );
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

    const output = deviceProfilesToString(settings, presetsDir, undefined, {
      devicePattern: '{ACTIVE-ENDPOINT}',
      state,
    });

    expect(output).toContain('# Active FluidEQ session override.');
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

    expect(deviceProfilesToString(settings, presetsDir)).not.toContain(
      'Device: {1234-ABCD}',
    );
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
