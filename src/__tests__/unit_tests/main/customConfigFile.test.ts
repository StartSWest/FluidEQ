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
import { flushDeviceProfiles } from 'main/deviceProfiles';
import { FilterTypeEnum, IDeviceProfileSettings } from 'common/constants';

const GUID = '{1234-ABCD}';

const customFileIn = (configDir: string) =>
  fs.readdirSync(configDir).find((name) => name.endsWith('-custom.txt'));

/**
 * The one file in a chain that FluidEQ does not own.
 *
 * Every other file here is generated from the profile and rewritten the moment
 * anything changes, which makes them all the wrong place to put anything by
 * hand: an edit is not refused, it simply disappears at the next slider move.
 * This one is created empty and then left alone forever, which is the whole
 * property — and the only one worth testing, because everything else about it
 * follows from being included like any other file.
 */
describe('the custom file in a device chain', () => {
  let configDir: string;
  let presetsDir: string;

  const settings: IDeviceProfileSettings = {
    version: 1,
    assignments: {
      endpoint: {
        deviceId: 'endpoint',
        deviceName: 'USB Headphones',
        deviceGuid: GUID,
        presetName: 'Tuned',
      },
    },
  };

  const writeProfile = (gain: number) =>
    fs.writeFileSync(
      path.join(presetsDir, 'Tuned'),
      JSON.stringify({
        preAmp: 0,
        isFlat: false,
        filters: {
          bass: {
            id: 'bass',
            frequency: 80,
            gain,
            quality: 0.8,
            type: FilterTypeEnum.PK,
          },
        },
      }),
    );

  beforeEach(async () => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-custom-'));
    presetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-custom-p-'));
    writeProfile(3);
  });

  afterEach(async () => {
    fs.rmSync(configDir, { recursive: true, force: true });
    fs.rmSync(presetsDir, { recursive: true, force: true });
  });

  // Created rather than waited for. A file that only appears once somebody has
  // found the right menu is a feature nobody discovers.
  it('is there from the first flush, and included', async () => {
    await flushDeviceProfiles(settings, () => presetsDir, configDir);

    const custom = customFileIn(configDir);
    expect(custom).toBeDefined();

    const deviceFile = fs
      .readdirSync(configDir)
      .find((name) => name.startsWith('fluideq-device-'));
    const contents = fs.readFileSync(
      path.join(configDir, deviceFile as string),
      'utf8',
    );
    expect(contents).toContain(`Include: ${custom}`);
  });

  // Last, and after the preamp. The file remains user-owned, while its
  // measurable EQ commands are read back so the generated preamp can protect
  // the complete chain.
  it('is applied after the generated chain and its preamp', async () => {
    await flushDeviceProfiles(settings, () => presetsDir, configDir);

    const deviceFile = fs
      .readdirSync(configDir)
      .find((name) => name.startsWith('fluideq-device-'));
    const lines = fs
      .readFileSync(path.join(configDir, deviceFile as string), 'utf8')
      .split(/\r?\n/);

    expect(lines[lines.length - 1]).toBe(`Include: ${customFileIn(configDir)}`);
    expect(lines.findIndex((line) => /^Preamp:/.test(line))).toBeLessThan(
      lines.length - 1,
    );
  });

  // The property the whole design rests on.
  it('survives every flush, whatever is put in it', async () => {
    await flushDeviceProfiles(settings, () => presetsDir, configDir);
    const custom = path.join(configDir, customFileIn(configDir) as string);

    const mine = 'Preamp: -2 dB\r\nFilter 1: ON PK Fc 900 Hz Gain 4 dB Q 1';
    fs.writeFileSync(custom, mine, 'utf8');

    // Everything a person does in the app: edit a band, flush, repeatedly.
    writeProfile(-4);
    await flushDeviceProfiles(settings, () => presetsDir, configDir);
    writeProfile(6);
    await flushDeviceProfiles(settings, () => presetsDir, configDir);

    expect(fs.readFileSync(custom, 'utf8')).toBe(mine);
  });

  it('includes measurable custom gain when deriving the generated preamp', async () => {
    await flushDeviceProfiles(settings, () => presetsDir, configDir);
    const custom = path.join(configDir, customFileIn(configDir) as string);
    fs.writeFileSync(
      custom,
      'Preamp: 2 dB\r\nFilter 1: ON PK Fc 900 Hz Gain 4 dB Q 1',
      'utf8',
    );

    await flushDeviceProfiles(settings, () => presetsDir, configDir);

    const deviceFile = fs
      .readdirSync(configDir)
      .find((name) => name.startsWith('fluideq-device-'));
    const preamp = Number(
      /-?[\d.]+/.exec(
        fs
          .readFileSync(path.join(configDir, deviceFile as string), 'utf8')
          .split(/\r?\n/)
          .find((line) => line.startsWith('Preamp:')) ?? '',
      )?.[0],
    );

    expect(preamp).toBeLessThan(-5);
  });

  // It outlives its generated siblings AND the output itself. An empty
  // assignment list is not proof the headset is gone for good — it is also
  // what an unplugged one looks like — and deleting on it costs somebody work
  // that nothing in the app can write again.
  it('stays when the output it belongs to goes away', async () => {
    await flushDeviceProfiles(settings, () => presetsDir, configDir);
    const custom = customFileIn(configDir) as string;
    fs.writeFileSync(path.join(configDir, custom), 'Delay: 5 ms', 'utf8');

    await flushDeviceProfiles(
      { version: 1, assignments: {} },
      () => presetsDir,
      configDir,
    );

    expect(fs.readFileSync(path.join(configDir, custom), 'utf8')).toBe(
      'Delay: 5 ms',
    );
    // The positive control: the generated files for that same output DO go,
    // so the assertion above is about the exemption and not about a sweep
    // that quietly stopped running.
    expect(
      fs.readdirSync(configDir).filter((name) => name.includes('-device-')),
    ).toEqual([]);
  });

  // What switching engines does to the engine being left: one flush with the
  // chain disabled, which used to empty the directory of custom files too.
  it('survives the disabled flush that neutralises an engine', async () => {
    await flushDeviceProfiles(settings, () => presetsDir, configDir);
    const custom = customFileIn(configDir) as string;
    const mine = 'Preamp: -2 dB\r\nFilter 1: ON PK Fc 900 Hz Gain 4 dB Q 1';
    fs.writeFileSync(path.join(configDir, custom), mine, 'utf8');

    await flushDeviceProfiles(
      settings,
      () => presetsDir,
      configDir,
      undefined,
      false,
    );

    expect(fs.readFileSync(path.join(configDir, custom), 'utf8')).toBe(mine);
    // Positive control again: the generated chain really was swept, so the
    // custom file above survived an exemption rather than an inert sweep.
    expect(
      fs
        .readdirSync(configDir)
        .filter((name) => /-device-|-eq\.txt$/.test(name)),
    ).toEqual([]);
  });
});
