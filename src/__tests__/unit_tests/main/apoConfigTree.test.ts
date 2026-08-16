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
import { readApoConfigTree } from 'main/apoConfigReader';
import { flushDeviceProfiles } from 'main/deviceProfiles';
import { FLUIDEQ_CONFIG_FILENAME } from 'main/flush';
import { FilterTypeEnum, IDeviceProfileSettings } from 'common/constants';

const KRAKEN = '{KRAKEN}';
const SPEAKERS = '{SPEAKERS}';

/**
 * The config as a shape, for showing somebody what is actually applied.
 *
 * Read from disk rather than rebuilt from the profiles, because what the app
 * would write is visible everywhere else in the interface. The question this
 * answers is what Equalizer APO has actually got — which is a different
 * question exactly when it matters.
 */
describe('reading the whole config as a tree', () => {
  let configDir: string;
  let presetsDir: string;

  const settings: IDeviceProfileSettings = {
    version: 1,
    assignments: {
      kraken: {
        deviceId: 'kraken',
        deviceName: 'Razer Kraken',
        deviceGuid: KRAKEN,
        presetName: 'Layered',
      },
      speakers: {
        deviceId: 'speakers',
        deviceName: 'Desk Speakers',
        deviceGuid: SPEAKERS,
        presetName: 'Bare',
      },
    },
  };

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-tree-'));
    presetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-tree-p-'));
    fs.writeFileSync(
      path.join(presetsDir, 'Layered'),
      JSON.stringify({
        preAmp: 0,
        isFlat: false,
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
      }),
    );
    fs.writeFileSync(
      path.join(presetsDir, 'Bare'),
      JSON.stringify({ preAmp: 0, isFlat: true, filters: {} }),
    );
  });

  afterEach(() => {
    fs.rmSync(configDir, { recursive: true, force: true });
    fs.rmSync(presetsDir, { recursive: true, force: true });
  });

  it('gives every output its own branch, in the order the config lists them', () => {
    flushDeviceProfiles(settings, () => presetsDir, configDir);

    const tree = readApoConfigTree(configDir);

    expect(tree?.root.fileName).toBe(FLUIDEQ_CONFIG_FILENAME);
    // The neutral fallback plus one block per assigned output.
    expect(tree?.devices.map(({ devicePattern }) => devicePattern)).toEqual([
      'all',
      KRAKEN,
      SPEAKERS,
    ]);
  });

  it('carries the label, the preamp and the filter count for a device', () => {
    flushDeviceProfiles(settings, () => presetsDir, configDir);

    const tree = readApoConfigTree(configDir);
    const kraken = tree?.devices.find((d) => d.devicePattern === KRAKEN);

    expect(kraken?.label).toBe('Razer Kraken -> Layered');
    expect(kraken?.preAmp).toMatch(/^Preamp: /);
    // One band plus the voicing's own filters, counted across the whole branch.
    expect(kraken?.filterCount).toBeGreaterThan(1);
  });

  it('keeps the include structure rather than flattening it', () => {
    flushDeviceProfiles(settings, () => presetsDir, configDir);

    const tree = readApoConfigTree(configDir);
    const kraken = tree?.devices.find((d) => d.devicePattern === KRAKEN);

    expect(kraken?.file?.fileName).toMatch(
      /^fluideq-device-[0-9a-f]{12}\.txt$/,
    );
    expect(
      kraken?.file?.includes.map(({ fileName }) => fileName.split('-').pop()),
    ).toEqual(['eq.txt', 'voicing.txt', 'custom.txt']);
    // The device file holds the preamp itself and delegates the rest.
    expect(kraken?.file?.lines.some((line) => /^Preamp:/.test(line))).toBe(
      true,
    );
    expect(kraken?.file?.lines.some((line) => /^Filter/.test(line))).toBe(
      false,
    );
    // And each feature file holds only its own filters.
    expect(
      kraken?.file?.includes.every((child) => child.includes.length === 0),
    ).toBe(true);
  });

  it('says so when an output applies nothing at all', () => {
    flushDeviceProfiles(settings, () => presetsDir, configDir);

    const tree = readApoConfigTree(configDir);
    const speakers = tree?.devices.find((d) => d.devicePattern === SPEAKERS);

    expect(speakers?.filterCount).toBe(0);
    expect(speakers?.preAmp).toBe('Preamp: 0 dB');
    // The custom file and nothing else: an output with no chain still gets
    // somewhere of its own to put one.
    expect(
      speakers?.file?.includes.map(({ fileName }) => fileName.split('-').pop()),
    ).toEqual(['custom.txt']);
  });

  // A file named by an Include that is not there is the single most useful
  // thing this view can report, because it is silent everywhere else.
  it('marks an include that points at nothing', () => {
    fs.writeFileSync(
      path.join(configDir, FLUIDEQ_CONFIG_FILENAME),
      [
        `Device: ${KRAKEN}`,
        'Channel: all',
        'Include: fluideq-device-aaaaaaaaaaaa.txt',
      ].join('\r\n'),
    );

    const tree = readApoConfigTree(configDir);
    const kraken = tree?.devices.find((d) => d.devicePattern === KRAKEN);

    expect(kraken?.file?.isMissing).toBe(true);
    expect(kraken?.filterCount).toBe(0);
  });

  it('returns nothing when FluidEQ has never written here', () => {
    expect(readApoConfigTree(configDir)).toBeUndefined();
  });

  // Three ways to be silent, and only one of them is a chain that happens to
  // be flat. A tree of files looks identical in all three.
  it('says whether any of it is being applied', () => {
    flushDeviceProfiles(settings, () => presetsDir, configDir);
    expect(readApoConfigTree(configDir)?.isApplied).toBe(true);

    // The engine switch: a config that names no output at all.
    flushDeviceProfiles(
      settings,
      () => presetsDir,
      configDir,
      undefined,
      false,
    );
    expect(readApoConfigTree(configDir)?.isApplied).toBe(false);
  });

  // Everything below is inert if Equalizer APO is not reading the root file,
  // and that is APO's own config.txt — anything can have rewritten it.
  it('says whether Equalizer APO is including the config at all', () => {
    flushDeviceProfiles(settings, () => presetsDir, configDir);
    expect(readApoConfigTree(configDir)?.isIncludedByApo).toBe(false);

    fs.writeFileSync(
      path.join(configDir, 'config.txt'),
      'Include: fluideq.txt\n',
    );
    expect(readApoConfigTree(configDir)?.isIncludedByApo).toBe(true);
  });
});
