/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import { deviceProfilesToFiles } from '../../../main/deviceProfiles';
import { flushDeviceProfiles } from '../../../main/deviceProfileFlush';
import { flushPendingWrites } from '../../../main/asyncWriter';
import {
  FilterTypeEnum,
  getDefaultState,
  IDeviceProfileSettings,
  IState,
} from '../../../common/constants';

/**
 * The impulse a generated convolution plays from: a 64 KB WAV written beside
 * the config files the engines reload on any change in their folder. It was
 * synthesised and written again, in place, on every flush of the output being
 * listened to, and never taken away once nothing named it.
 */

const correction = (gain: number) => ({
  name: 'Measured response',
  filters: {
    correction: {
      id: 'correction',
      frequency: 1000,
      gain,
      quality: 1,
      type: FilterTypeEnum.PK,
    },
  },
});

const stateWith = (gain: number | undefined): IState => ({
  ...getDefaultState(),
  convolution: gain === undefined ? undefined : correction(gain),
});

const NO_ASSIGNMENTS: IDeviceProfileSettings = { version: 1, assignments: {} };

const impulsesIn = (directory: string) =>
  fs
    .readdirSync(directory)
    .filter((file) => /^fluideq-convolution-[0-9a-f]{12}\.wav$/.test(file));

describe('an output’s generated impulse', () => {
  let configDir: string;
  let presetsDir: string;

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-impulse-'));
    presetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-presets-'));
  });

  afterEach(async () => {
    await flushPendingWrites();
    fs.rmSync(configDir, { recursive: true, force: true });
    fs.rmSync(presetsDir, { recursive: true, force: true });
  });

  it('is written once while its filters stay where they are', () => {
    const writes = jest.spyOn(fs, 'writeFileSync');
    try {
      const override = {
        deviceId: 'endpoint',
        devicePattern: '{1234-ABCD}',
        state: stateWith(3),
      };
      const presets = presetsDir;
      const presetDirOf = () => presets;
      for (let edit = 0; edit < 5; edit += 1) {
        deviceProfilesToFiles(NO_ASSIGNMENTS, presetDirOf, configDir, {
          ...override,
          // A slider step elsewhere in the state: the impulse's own filters
          // do not move.
          state: { ...override.state, preAmp: -edit },
        });
      }
      const impulseWrites = () =>
        writes.mock.calls.filter(([file]) => String(file).includes('.wav'))
          .length;
      expect(impulseWrites()).toBe(1);

      // POSITIVE CONTROL: a change to the impulse's own filters writes it.
      deviceProfilesToFiles(NO_ASSIGNMENTS, () => presetsDir, configDir, {
        ...override,
        state: stateWith(4),
      });
      expect(impulseWrites()).toBe(2);
    } finally {
      writes.mockRestore();
    }
  });

  it('is taken away once nothing names it, and nobody else’s WAV is', async () => {
    fs.writeFileSync(path.join(configDir, 'my-room.wav'), 'not ours');
    const override = (gain: number | undefined) => ({
      deviceId: 'endpoint',
      devicePattern: '{1234-ABCD}',
      state: stateWith(gain),
    });

    await flushDeviceProfiles(
      NO_ASSIGNMENTS,
      () => presetsDir,
      configDir,
      override(3),
    );
    await flushPendingWrites();
    expect(impulsesIn(configDir)).toHaveLength(1);

    await flushDeviceProfiles(
      NO_ASSIGNMENTS,
      () => presetsDir,
      configDir,
      override(undefined),
    );
    await flushPendingWrites();
    expect(impulsesIn(configDir)).toEqual([]);
    expect(fs.existsSync(path.join(configDir, 'my-room.wav'))).toBe(true);
  });
});
