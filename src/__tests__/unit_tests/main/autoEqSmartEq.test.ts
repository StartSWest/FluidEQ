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
import { flushDeviceProfiles } from 'main/deviceProfiles';
import { readApoDeviceChain } from 'main/apoConfigReader';
import { parseEqText } from 'common/apoText';
import {
  hasSmartEqLayer,
  smartEqFromFilters,
  SMART_EQ_QUALITY,
} from 'common/smartEq';
import {
  FilterTypeEnum,
  IDeviceProfileSettings,
  IFiltersMap,
  ISmartEqSettings,
} from 'common/constants';

const GUID = '{1234-ABCD}';

/**
 * Applying an AutoEQ model must not cost somebody their measured correction.
 *
 * Reported and never reproduced, and the two candidate explanations wanted
 * different fixes. If the loss happened at write time — one path emitting the
 * whole chain and dropping another layer's filters on the way — then a file per
 * feature settles it structurally, because the write for the bands cannot reach
 * the measurement's file. If it happened in the state, files protect nothing:
 * the writer would faithfully record a Smart EQ that had already gone.
 *
 * These pin the first half. A model arriving replaces the bands and everything
 * else stays exactly as it was, byte for byte — and the measurement's file is
 * not merely rewritten with the same contents, it is not touched at all.
 */
describe('applying a model beside a measured correction', () => {
  let configDir: string;
  let presetsDir: string;

  const bands = (gain: number): IFiltersMap => ({
    band: {
      id: 'band',
      frequency: 80,
      gain,
      quality: 0.8,
      type: FilterTypeEnum.PK,
    },
  });

  const measured: ISmartEqSettings = {
    filters: {
      'smart-1000': {
        id: 'smart-1000',
        frequency: 1000,
        gain: 2,
        quality: 1.4,
        type: FilterTypeEnum.PK,
      },
      'smart-4000': {
        id: 'smart-4000',
        frequency: 4000,
        gain: -1.5,
        quality: 1.4,
        type: FilterTypeEnum.PK,
      },
    },
    status: 'ready',
  };

  const settings: IDeviceProfileSettings = {
    version: 1,
    assignments: {
      endpoint: {
        deviceId: 'endpoint',
        deviceName: 'USB Headphones',
        deviceGuid: GUID,
        presetName: 'Measured',
      },
    },
  };

  const writeProfile = (filters: IFiltersMap) =>
    fs.writeFileSync(
      path.join(presetsDir, 'Measured'),
      JSON.stringify({
        preAmp: 0,
        isFlat: false,
        filters,
        smartEq: measured,
        headset: 'HD 600',
        headsetTarget: 'Harman 2018',
      }),
    );

  /** Every generated file, with the modification time it was left at. */
  const snapshot = () =>
    Object.fromEntries(
      fs
        .readdirSync(configDir)
        .filter((name) => name.startsWith('fluideq-'))
        .map((name) => {
          const filePath = path.join(configDir, name);
          return [
            name,
            {
              contents: fs.readFileSync(filePath, 'utf8'),
              modifiedAt: fs.statSync(filePath).mtimeMs,
            },
          ];
        }),
    );

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-autoeq-'));
    presetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-autoeq-p-'));
    writeProfile(bands(3));
  });

  afterEach(() => {
    fs.rmSync(configDir, { recursive: true, force: true });
    fs.rmSync(presetsDir, { recursive: true, force: true });
  });

  it('leaves the measurement where it was when the bands are replaced', () => {
    flushDeviceProfiles(settings, presetsDir, configDir);
    const before = snapshot();
    const smartFile = Object.keys(before).find((name) =>
      name.endsWith('-smart.txt'),
    );
    const eqFile = Object.keys(before).find((name) => name.endsWith('-eq.txt'));
    expect(smartFile).toBeDefined();
    expect(eqFile).toBeDefined();

    // A model arriving: the bands are replaced and nothing else is said.
    writeProfile(bands(-5));
    flushDeviceProfiles(settings, presetsDir, configDir);
    const after = snapshot();

    expect(after[eqFile as string].contents).not.toBe(
      before[eqFile as string].contents,
    );
    expect(after[smartFile as string].contents).toBe(
      before[smartFile as string].contents,
    );
    // Not rewritten with the same text — not written at all. There is no
    // sequence of failures in the middle of this flush that could empty it.
    expect(after[smartFile as string].modifiedAt).toBe(
      before[smartFile as string].modifiedAt,
    );
  });

  it('keeps the correction readable as its own layer afterwards', () => {
    flushDeviceProfiles(settings, presetsDir, configDir);
    writeProfile(bands(-5));
    flushDeviceProfiles(settings, presetsDir, configDir);

    const chain = readApoDeviceChain(configDir, GUID);

    expect(chain?.features?.smart).toContain('Fc 1000 Hz Gain 2 dB Q 1.4');
    expect(chain?.features?.smart).toContain('Fc 4000 Hz Gain -1.5 dB Q 1.4');
    expect(chain?.features?.eq).toContain('Fc 80 Hz Gain -5 dB');
  });

  // The other half of the report, and the one files alone cannot fix. If a
  // profile reaches the writer without its measurement, the writer records
  // exactly that — so a Smart EQ that vanishes despite the test above is a
  // state bug, not a config one, and this is what it looks like from here.
  it('writes no measurement for a profile that arrives without one', () => {
    fs.writeFileSync(
      path.join(presetsDir, 'Measured'),
      JSON.stringify({ preAmp: 0, isFlat: false, filters: bands(3) }),
    );
    flushDeviceProfiles(settings, presetsDir, configDir);

    const chain = readApoDeviceChain(configDir, GUID);

    expect(Object.keys(chain?.features ?? {})).toEqual(['eq']);
  });

  // Which is why the state is no longer the only copy. The measurement is the
  // one layer whose file IS the layer, so whatever loses it, the config still
  // has it and startup can hand it back.
  it('reads the measurement back out of its own file, whole', () => {
    flushDeviceProfiles(settings, presetsDir, configDir);
    const chain = readApoDeviceChain(configDir, GUID);

    const recovered = smartEqFromFilters(
      Object.values(parseEqText(chain?.features?.smart ?? '').filters),
    );

    expect(hasSmartEqLayer(recovered)).toBe(true);
    expect(recovered?.filters['smart-1000'].gain).toBe(2);
    expect(recovered?.filters['smart-4000'].gain).toBe(-1.5);
    expect(recovered?.filters['smart-1000'].quality).toBe(SMART_EQ_QUALITY);

    // Only ever fed this layer's own file, and only ever takes this layer's own
    // frequencies out of it. A band at a centre the fixed layout never uses did
    // not come from a measurement, whatever file it turned up in.
    expect(
      smartEqFromFilters([
        { type: FilterTypeEnum.PK, frequency: 1800, gain: 4, quality: 1.4 },
      ]),
    ).toBeUndefined();
  });
});
