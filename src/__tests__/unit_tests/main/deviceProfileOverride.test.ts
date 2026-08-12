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
import { deviceProfilesToFiles } from '../../../main/deviceProfiles';
import {
  FilterTypeEnum,
  IDeviceProfileSettings,
  getDefaultState,
} from '../../../common/constants';

/**
 * Every file the writer produced, run together.
 *
 * Deliberately all of them rather than only the ones the root includes.
 * Stacking is what these tests are about, and a preset left behind in a file
 * nobody includes is one write away from being audible again — the strictest
 * question is whether the overridden device's filters were written down at all.
 */
const configFor = (...args: Parameters<typeof deviceProfilesToFiles>) =>
  [...deviceProfilesToFiles(...args).values()].join('\n');

const KRAKEN_GUID = '{2de2e800-7980-4b45-a318-34276fe3d3b4}';
const LEVIATHAN_GUID = '{df3f87bf-424b-4635-ba54-44da3227dedd}';

/**
 * Equalizer APO's config grammar is cumulative: `Device:` gates the commands
 * that follow it, it does not reset anything declared earlier. Two blocks
 * naming the same device therefore STACK. These tests pin that down, because
 * getting it wrong makes Clear EQ silently do nothing to the audio.
 */
describe('device profiles with an active session override', () => {
  let presetsDir: string;

  const writePreset = (name: string, gain: number, preAmp: number) =>
    fs.writeFileSync(
      path.join(presetsDir, name),
      JSON.stringify({
        preAmp,
        isFlat: false,
        filters: {
          a: {
            id: 'a',
            frequency: 100,
            gain,
            quality: 1,
            type: FilterTypeEnum.PK,
          },
        },
      }),
    );

  beforeEach(() => {
    presetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-override-'));
    writePreset('kraken-preset', 5, -4.4);
    writePreset('leviathan-preset', 7, -3.91);
  });

  afterEach(() => {
    fs.rmSync(presetsDir, { recursive: true, force: true });
  });

  const settings: IDeviceProfileSettings = {
    version: 1,
    assignments: {
      kraken: {
        deviceId: 'kraken',
        deviceName: 'Speakers (Razer Kraken V4 Pro USB - Game)',
        deviceGuid: KRAKEN_GUID,
        presetName: 'kraken-preset',
      },
      leviathan: {
        deviceId: 'leviathan',
        deviceName: 'Speakers (Razer Leviathan V2)',
        deviceGuid: LEVIATHAN_GUID,
        presetName: 'leviathan-preset',
      },
    },
  };

  const clearedState = () => {
    const state = getDefaultState();
    state.preAmp = 0;
    state.isFlat = true;
    Object.values(state.filters).forEach((filter) => {
      // eslint-disable-next-line no-param-reassign
      filter.gain = 0;
    });
    return state;
  };

  it('names the overridden device exactly once', () => {
    const output = configFor(settings, presetsDir, undefined, {
      deviceId: 'kraken',
      devicePattern: KRAKEN_GUID,
      state: clearedState(),
    });

    const occurrences = output.split(`Device: ${KRAKEN_GUID}`).length - 1;
    expect(occurrences).toBe(1);
  });

  it('drops the assigned preset once the EQ is cleared', () => {
    const output = configFor(settings, presetsDir, undefined, {
      deviceId: 'kraken',
      devicePattern: KRAKEN_GUID,
      state: clearedState(),
    });

    // The cleared session must not leave the preset's band or its makeup gain
    // stacked underneath it.
    expect(output).not.toContain('Gain 5 dB');
  });

  it('leaves every other device on its own profile', () => {
    const output = configFor(settings, presetsDir, undefined, {
      deviceId: 'kraken',
      devicePattern: KRAKEN_GUID,
      state: clearedState(),
    });

    expect(output).toContain(`Device: ${LEVIATHAN_GUID}`);
    expect(output).toContain('Gain 7 dB');
  });

  it('matches the overridden device by pattern when there is no id', () => {
    const output = configFor(settings, presetsDir, undefined, {
      devicePattern: KRAKEN_GUID,
      state: clearedState(),
    });

    expect(output.split(`Device: ${KRAKEN_GUID}`).length - 1).toBe(1);
    expect(output).not.toContain('Gain 5 dB');
  });

  it('keeps every profile when nothing is overriding them', () => {
    const output = configFor(settings, presetsDir);

    expect(output).toContain(`Device: ${KRAKEN_GUID}`);
    expect(output).toContain(`Device: ${LEVIATHAN_GUID}`);
    expect(output).toContain('Gain 5 dB');
    expect(output).toContain('Gain 7 dB');
  });

  it('writes the live bands, not the preset, while tuning', () => {
    const tuned = getDefaultState();
    tuned.isFlat = false;
    tuned.preAmp = -2;
    tuned.filters = {
      live: {
        id: 'live',
        frequency: 880,
        gain: 3.5,
        quality: 1.4,
        type: FilterTypeEnum.PK,
      },
    };

    const output = configFor(settings, presetsDir, undefined, {
      deviceId: 'kraken',
      devicePattern: KRAKEN_GUID,
      state: tuned,
    });

    expect(output).toContain('Filter 1: ON PK Fc 880 Hz Gain 3.5 dB Q 1.4');
    expect(output).not.toContain('Gain 5 dB');
  });
});
