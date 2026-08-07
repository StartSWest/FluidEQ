/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
import {
  flushDeviceProfiles,
  getStateForAudioDevice,
} from 'main/deviceProfiles';
import { FilterTypeEnum, IDeviceProfileSettings } from 'common/constants';

const GUID = '{1234-ABCD}';

/**
 * The loudness contour has to survive the profile, like every other layer.
 *
 * Device profile blocks are rendered from the preset file alone, and every
 * output is given a profile the moment it is used — so a layer the profile does
 * not carry is a layer that reaches Equalizer APO exactly never. That is what
 * happened here: loudness was added to the config writer, the chips and the
 * graph long after the list of layers a profile saves was written, and never
 * joined it. It could be switched on, drawn, and reasoned about, and it changed
 * nothing anybody could hear.
 */
describe('the loudness contour and the profile', () => {
  let configDir: string;
  let presetsDir: string;

  const settings: IDeviceProfileSettings = {
    version: 1,
    assignments: {
      endpoint: {
        deviceId: 'endpoint',
        deviceName: 'USB Headphones',
        deviceGuid: GUID,
        presetName: 'Loud',
      },
      quiet: {
        deviceId: 'quiet',
        deviceName: 'Desk Speakers',
        deviceGuid: '{QUIET}',
        presetName: 'Plain',
      },
    },
  };

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-loud-'));
    presetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-loud-p-'));
    fs.writeFileSync(
      path.join(presetsDir, 'Loud'),
      JSON.stringify({
        preAmp: 0,
        isFlat: false,
        filters: {
          bass: {
            id: 'bass',
            frequency: 80,
            gain: 2,
            quality: 0.8,
            type: FilterTypeEnum.PK,
          },
        },
        loudness: { isOn: true, intensity: 1 },
      }),
    );
    fs.writeFileSync(
      path.join(presetsDir, 'Plain'),
      JSON.stringify({ preAmp: 0, isFlat: true, filters: {} }),
    );
  });

  afterEach(() => {
    fs.rmSync(configDir, { recursive: true, force: true });
    fs.rmSync(presetsDir, { recursive: true, force: true });
  });

  it('reaches Equalizer APO for a device that has a profile', () => {
    flushDeviceProfiles(settings, presetsDir, configDir);

    const chain = readApoDeviceChain(configDir, GUID);

    expect(Object.keys(chain?.features ?? {})).toContain('loudness');
    // The contour's own shape: a low shelf at 105 Hz is the bulk of it.
    expect(chain?.features?.loudness).toContain('Fc 105 Hz');
  });

  it('comes back when the output is selected again', () => {
    const state = getStateForAudioDevice(settings, 'endpoint', presetsDir);

    expect(state.loudness).toEqual({ isOn: true, intensity: 1 });
  });

  // Applied over the live state with Object.assign, so an omitted key leaves
  // the previous output's contour running on one that never asked for it.
  it('does not follow the user onto an output that never asked for it', () => {
    const quiet = getStateForAudioDevice(settings, 'quiet', presetsDir);

    expect(Object.prototype.hasOwnProperty.call(quiet, 'loudness')).toBe(true);
    expect(quiet.loudness).toBeUndefined();
  });

  it('writes nothing for a contour that is switched off', () => {
    fs.writeFileSync(
      path.join(presetsDir, 'Loud'),
      JSON.stringify({
        preAmp: 0,
        isFlat: true,
        filters: {},
        loudness: { isOn: false, intensity: 1 },
      }),
    );
    flushDeviceProfiles(settings, presetsDir, configDir);

    expect(
      Object.keys(readApoDeviceChain(configDir, GUID)?.features ?? {}),
    ).not.toContain('loudness');
  });
});
