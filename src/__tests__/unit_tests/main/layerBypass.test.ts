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
import { flushDeviceProfiles } from 'main/deviceProfiles';
import { stateToApoFiles } from 'main/flush';
import {
  FilterTypeEnum,
  IDeviceProfileSettings,
  IState,
  getDefaultState,
} from 'common/constants';

const GUID = '{1234-ABCD}';

/**
 * Switching a layer off is one line that is not written.
 *
 * This is the whole reason the config was split. The first attempt at an A/B
 * switch for the bands had to clear every gain and put them back one at a time,
 * because ten `Filter:` lines inside one shared numbering cannot be removed
 * atomically. Half of those per-band writes succeeding is what produced
 * "Invalid parameter" and a chip that erased itself.
 */
describe('switching a layer out of the config', () => {
  const shaped = (): IState => ({
    ...getDefaultState(),
    isFlat: false,
    filters: {
      bass: {
        id: 'bass',
        frequency: 80,
        gain: 6,
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
  });

  it('writes nothing at all for the layer that is off', () => {
    const applied = stateToApoFiles(shaped());
    const bypassed = stateToApoFiles({ ...shaped(), bypassed: ['voicing'] });

    expect(applied?.features.map(({ feature }) => feature)).toEqual([
      'eq',
      'voicing',
      'smart',
    ]);
    expect(bypassed?.features.map(({ feature }) => feature)).toEqual([
      'eq',
      'smart',
    ]);
  });

  // The bands are the case that could not be done before. One switch, one
  // absent file, and every gain still exactly where the user left it.
  it('takes the bands out whole and leaves them untouched', () => {
    const state = { ...shaped(), bypassed: ['eq' as const] };
    const files = stateToApoFiles(state);

    expect(files?.features.map(({ feature }) => feature)).not.toContain('eq');
    expect(state.filters.bass.gain).toBe(6);
  });

  // Headroom is measured over what was written, so a boost that is no longer
  // applied stops being reserved for. Getting this wrong leaves the output
  // several dB down for a band nobody can hear.
  it('gives back the headroom the layer was holding', () => {
    const withBands = stateToApoFiles(shaped());
    const withoutBands = stateToApoFiles({ ...shaped(), bypassed: ['eq'] });

    const preAmpOf = (line?: string) => Number(line?.match(/-?[\d.]+/)?.[0]);

    expect(preAmpOf(withBands?.preAmp)).toBeLessThan(
      preAmpOf(withoutBands?.preAmp),
    );
  });

  it('leaves a GraphicEQ curve out just as completely', () => {
    const state: IState = {
      ...getDefaultState(),
      isFlat: false,
      eqFormat: 'graphic' as IState['eqFormat'],
      graphicEq: [{ frequency: 160, gain: 6 }],
    };

    expect(stateToApoFiles(state)?.features).toHaveLength(1);
    expect(
      stateToApoFiles({ ...state, bypassed: ['eq'] })?.features,
    ).toHaveLength(0);
  });

  // The config states it, so a restart can read it back — which the old
  // session-only stash could never do, because a stash and a config would have
  // been two places disagreeing about what was applied.
  it('survives the round trip through the config', () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-bypass-'));
    const presetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-bp-p-'));
    fs.writeFileSync(
      path.join(presetsDir, 'Compared'),
      JSON.stringify({
        preAmp: 0,
        isFlat: false,
        filters: shaped().filters,
        voicing: { profileId: 'music', intensity: 1 },
        bypassed: ['voicing'],
      }),
    );
    const settings: IDeviceProfileSettings = {
      version: 1,
      assignments: {
        endpoint: {
          deviceId: 'endpoint',
          deviceName: 'USB Headphones',
          deviceGuid: GUID,
          presetName: 'Compared',
        },
      },
    };

    flushDeviceProfiles(settings, presetsDir, configDir);
    const chain = readApoDeviceChain(configDir, GUID);

    // The bands are there, the voicing is not, and the reader can say so.
    expect(Object.keys(chain?.features ?? {})).toEqual(['eq']);
    expect(chain?.text).not.toContain('Fc 3000 Hz');

    fs.rmSync(configDir, { recursive: true, force: true });
    fs.rmSync(presetsDir, { recursive: true, force: true });
  });
});
