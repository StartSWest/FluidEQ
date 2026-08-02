import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  deviceProfilesToString,
  getDefaultDeviceProfileSettings,
  getStateForAudioDevice,
} from '../../../main/deviceProfiles';
import {
  FilterTypeEnum,
  getDefaultState,
} from '../../../common/constants';

describe('device profile configuration', () => {
  let presetsDir: string;

  beforeEach(() => {
    presetsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'aqua-device-profiles-')
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
      })
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
      output.indexOf('Device: {1234-ABCD}')
    );
    expect(output).toContain('Preamp: 0 dB');
    expect(output).toContain('# USB Headphones -> Studio');
    expect(output).toContain('Device: {1234-ABCD}');
    expect(output).toContain('Preamp: -4dB');
    expect(output).toContain('Fc 80 Hz Gain 3 dB Q 0.8');
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
    expect(Object.values(state.filters).map(({ frequency }) => frequency)).toEqual(
      Object.values(defaults.filters).map(({ frequency }) => frequency)
    );
    expect(Object.values(state.filters).every(({ gain }) => gain === 0)).toBe(
      true
    );
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
      'Device: {1234-ABCD}'
    );
  });
});
