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
import { readApoDeviceChain } from 'main/apoConfigReader';
import { flushDeviceProfiles } from 'main/deviceProfiles';
import { FLUIDEQ_CONFIG_FILENAME } from 'main/flush';
import { FilterTypeEnum, IDeviceProfileSettings } from 'common/constants';

const GUID = '{1234-ABCD}';

/**
 * The reader is tested against what the writer actually produced, not against
 * a config typed out here. A fixture would go on passing after the layout
 * changed underneath it, which is the one failure this pair cannot afford.
 */
describe('reading the Equalizer APO config back', () => {
  let configDir: string;
  let presetsDir: string;

  const settings: IDeviceProfileSettings = {
    version: 1,
    assignments: {
      endpoint: {
        deviceId: 'endpoint',
        deviceName: 'USB Headphones',
        deviceGuid: GUID,
        presetName: 'Layered',
      },
    },
  };

  beforeEach(async () => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-read-config-'));
    presetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-read-preset-'));
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
        smartEq: {
          filters: {
            'smart-1000': {
              id: 'smart-1000',
              frequency: 1000,
              gain: 2,
              quality: 1.4,
              type: FilterTypeEnum.PK,
            },
          },
        },
      }),
    );
  });

  afterEach(async () => {
    fs.rmSync(configDir, { recursive: true, force: true });
    fs.rmSync(presetsDir, { recursive: true, force: true });
  });

  it('follows the includes and says which feature wrote what', async () => {
    await flushDeviceProfiles(settings, () => presetsDir, configDir);

    const chain = readApoDeviceChain(configDir, GUID);

    expect(chain?.devicePattern).toBe(GUID);
    // Everything APO applies, gathered from four files.
    expect(chain?.text).toContain('Fc 80 Hz Gain 3 dB Q 0.8');
    expect(chain?.text).toContain('Fc 1000 Hz Gain 2 dB Q 1.4');
    expect(chain?.text).toContain('Preamp:');

    // And attributed, which is the whole reason the split happened: the bands
    // are separable from the voicing and the measurement.
    expect(Object.keys(chain?.features ?? {}).sort()).toEqual([
      'eq',
      'smart',
      'voicing',
    ]);
    expect(chain?.features?.eq).toContain('Fc 80 Hz Gain 3 dB Q 0.8');
    expect(chain?.features?.eq).not.toContain('Fc 1000 Hz');
    expect(chain?.features?.smart).toContain('Fc 1000 Hz Gain 2 dB Q 1.4');
  });

  it('keeps the preamp with the device, not with a feature', async () => {
    await flushDeviceProfiles(settings, () => presetsDir, configDir);

    const chain = readApoDeviceChain(configDir, GUID);

    expect(chain?.shared).toMatch(/Preamp: -[\d.]+ dB/);
    Object.values(chain?.features ?? {}).forEach((contents) => {
      expect(contents).not.toContain('Preamp:');
    });
  });

  // A feature absent from the config is a statement, not a gap: it is how a
  // layer switched off stays switched off across a restart.
  it('reports only the features the config actually includes', async () => {
    fs.writeFileSync(
      path.join(presetsDir, 'BandsOnly'),
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
      }),
    );
    await flushDeviceProfiles(
      {
        version: 1,
        assignments: {
          endpoint: {
            ...settings.assignments.endpoint,
            presetName: 'BandsOnly',
          },
        },
      },
      () => presetsDir,
      configDir,
    );

    const chain = readApoDeviceChain(configDir, GUID);

    expect(Object.keys(chain?.features ?? {})).toEqual(['eq']);
    expect(chain?.features?.voicing).toBeUndefined();
  });

  // An older FluidEQ's config, or a hand-written one. Nothing says where a
  // Filter line came from, so nothing is attributed and the caller falls back
  // to the cautious reading rather than guessing.
  it('attributes nothing in a flat config', async () => {
    fs.writeFileSync(
      path.join(configDir, FLUIDEQ_CONFIG_FILENAME),
      [
        `Device: ${GUID}`,
        'Channel: all',
        'Filter 1: ON PK Fc 80 Hz Gain 3 dB Q 0.8',
        'Preamp: -3 dB',
      ].join('\r\n'),
    );

    const chain = readApoDeviceChain(configDir, GUID);

    expect(chain?.text).toContain('Fc 80 Hz Gain 3 dB Q 0.8');
    expect(chain?.features).toBeUndefined();
    expect(chain?.shared).toBeUndefined();
  });

  it('stops rather than looping on a config that includes itself', async () => {
    fs.writeFileSync(
      path.join(configDir, FLUIDEQ_CONFIG_FILENAME),
      [`Device: ${GUID}`, 'Channel: all', 'Include: loop.txt'].join('\r\n'),
    );
    fs.writeFileSync(
      path.join(configDir, 'loop.txt'),
      ['Filter 1: ON PK Fc 80 Hz Gain 3 dB Q 0.8', 'Include: loop.txt'].join(
        '\r\n',
      ),
    );

    const chain = readApoDeviceChain(configDir, GUID);

    expect(chain?.text).toContain('Fc 80 Hz Gain 3 dB Q 0.8');
    expect(chain?.text.match(/Filter 1:/g)).toHaveLength(1);
  });

  // The name comes out of a file on disk, so it is not trusted to stay in the
  // config directory.
  it('refuses to follow an include that points outside the config directory', async () => {
    const outside = path.join(configDir, '..', 'fluideq-outside-secret.txt');
    fs.writeFileSync(outside, 'Filter 1: ON PK Fc 80 Hz Gain 9 dB Q 1');
    fs.writeFileSync(
      path.join(configDir, FLUIDEQ_CONFIG_FILENAME),
      [
        `Device: ${GUID}`,
        'Channel: all',
        'Include: ../fluideq-outside-secret.txt',
      ].join('\r\n'),
    );

    const chain = readApoDeviceChain(configDir, GUID);

    expect(chain?.text).not.toContain('Gain 9 dB');
    fs.rmSync(outside, { force: true });
  });

  it('returns nothing when there is no config at all', async () => {
    expect(readApoDeviceChain(configDir, GUID)).toBeUndefined();
  });
});
