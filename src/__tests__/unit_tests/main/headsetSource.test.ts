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
import {
  fetchPreset,
  fetchSettings,
  save,
  savePreset,
} from '../../../main/flush';
import { getStateForAudioDevice } from '../../../main/deviceProfiles';
import {
  AUTOEQ_SOURCE_ID,
  FilterTypeEnum,
  IDeviceProfileSettings,
  IPresetV2,
  getDefaultState,
} from '../../../common/constants';

const SQUIG_SOURCE_ID = 'squiglink-gadgetrytech-headphones-headsets';

const bands = () => ({
  a: {
    id: 'a',
    frequency: 120,
    gain: 3,
    quality: 1.1,
    type: FilterTypeEnum.PK,
  },
});

/**
 * Which database a reference came from has to survive the round trip.
 *
 * The model name alone cannot be looked back up: the same headphones appear in
 * several databases with unrelated measurements behind them, so restoring a
 * selection by name picks whichever database sorts first and then fails to find
 * the measurement in it. These cover the two ways the field reaches disk and
 * the one way it does not — an older profile, which has to keep working.
 */
describe('the source of an applied reference', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-headset-source-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('survives a profile write and read', () => {
    const preset: IPresetV2 = {
      preAmp: -4,
      filters: bands(),
      headset: 'HD 600',
      headsetTarget: 'Harman 2018',
      headsetSource: SQUIG_SOURCE_ID,
    };
    savePreset('Studio', preset, dir);

    const restored = fetchPreset('Studio', dir);
    expect(restored.headset).toBe('HD 600');
    expect(restored.headsetTarget).toBe('Harman 2018');
    expect(restored.headsetSource).toBe(SQUIG_SOURCE_ID);
  });

  it('leaves a profile written before the field existed loadable', () => {
    // Exactly what is on users' disks today: a model name and nothing to say
    // where it came from. The validator has no additionalProperties clause and
    // does not require the field, so this must load rather than be rejected.
    fs.writeFileSync(
      path.join(dir, 'Legacy'),
      JSON.stringify({ preAmp: -4, filters: bands(), headset: 'HD 600' }),
    );

    const restored = fetchPreset('Legacy', dir);
    expect(restored.headset).toBe('HD 600');
    expect(restored.headsetSource).toBeUndefined();
  });

  it('survives an app restart', () => {
    const state = {
      ...getDefaultState(),
      headset: 'HD 600',
      headsetTarget: 'HD 600 ParametricEQ.txt',
      headsetSource: AUTOEQ_SOURCE_ID,
    };
    save(state, dir);

    const reloaded = fetchSettings(dir);
    expect(reloaded.headset).toBe('HD 600');
    expect(reloaded.headsetSource).toBe(AUTOEQ_SOURCE_ID);
  });

  it('travels with the output it was applied to', () => {
    // The bug this guards is subtle: getStateForAudioDevice is applied over the
    // live state with Object.assign, so a source the next output does not have
    // must be present-and-undefined, not absent, or the previous output's
    // database follows the user across and gets auto-saved into their profile.
    savePreset(
      'Headphones',
      {
        preAmp: -4,
        filters: bands(),
        headset: 'HD 600',
        headsetTarget: 'Harman 2018',
        headsetSource: SQUIG_SOURCE_ID,
      },
      dir,
    );
    savePreset('Speakers', { preAmp: 0, filters: bands() }, dir);

    const settings: IDeviceProfileSettings = {
      version: 1,
      assignments: {
        headphones: {
          deviceId: 'headphones',
          deviceName: 'Headphones',
          deviceGuid: '{HP}',
          presetName: 'Headphones',
        },
        speakers: {
          deviceId: 'speakers',
          deviceName: 'Speakers',
          deviceGuid: '{SP}',
          presetName: 'Speakers',
        },
      },
    };

    const live = getDefaultState();
    Object.assign(live, getStateForAudioDevice(settings, 'headphones', dir));
    expect(live.headsetSource).toBe(SQUIG_SOURCE_ID);

    Object.assign(live, getStateForAudioDevice(settings, 'speakers', dir));
    expect(live.headset).toBeUndefined();
    expect(live.headsetTarget).toBeUndefined();
    expect(live.headsetSource).toBeUndefined();
  });
});
