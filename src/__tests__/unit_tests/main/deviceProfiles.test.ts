import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  deviceProfilesToString,
  getDefaultDeviceProfileSettings,
} from '../../../main/deviceProfiles';
import { FilterTypeEnum } from '../../../common/constants';

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

    expect(output).toContain('# USB Headphones -> Studio');
    expect(output).toContain('Device: {1234-ABCD}');
    expect(output).toContain('Preamp: -4dB');
    expect(output).toContain('Fc 80 Hz Gain 3 dB Q 0.8');
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
