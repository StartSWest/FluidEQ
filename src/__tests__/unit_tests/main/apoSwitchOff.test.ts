/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The two reads that decide whether switching engines has to ask Windows for
 * administrator rights at all.
 *
 * Both answer "no" when they cannot tell, and that direction is the whole
 * point: the cost of a wrong "no" is that Equalizer APO stays registered,
 * which is where every version before this left it; the cost of a wrong
 * "yes" is a Windows prompt in front of somebody who has no Equalizer APO
 * and no idea what it is being asked for.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const discoverAudioDevices = jest.fn();
jest.mock('main/audioDevices', () => ({
  discoverAudioDevices: () => discoverAudioDevices(),
}));

let root: string;
jest.mock('main/registry', () => ({
  getFluidEngineConfigDir: () => path.join(root, 'config'),
}));

// eslint-disable-next-line import/first
import { isApoOnAnyOutput, isApoSwitchedOff } from 'main/apoSwitchOff';

const device = (fields: Record<string, unknown>) => ({
  id: 'x',
  name: 'Speakers',
  guid: '{AAAA}',
  isDefault: true,
  isActive: true,
  ...fields,
});

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-apo-off-'));
  discoverAudioDevices.mockReset();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('isApoOnAnyOutput', () => {
  it('is true when Equalizer APO is on any output', async () => {
    discoverAudioDevices.mockResolvedValue([
      device({ isEqualizerApoAttached: false }),
      device({ isEqualizerApoAttached: true, guid: '{BBBB}' }),
    ]);
    await expect(isApoOnAnyOutput()).resolves.toBe(true);
  });

  it('is false when it is on none of them, or unknown', async () => {
    discoverAudioDevices.mockResolvedValue([
      device({ isEqualizerApoAttached: false }),
      device({ isEqualizerApoAttached: null, guid: '{BBBB}' }),
    ]);
    await expect(isApoOnAnyOutput()).resolves.toBe(false);
  });

  it('is false when the output list could not be read', async () => {
    discoverAudioDevices.mockRejectedValue(new Error('no PowerShell'));
    await expect(isApoOnAnyOutput()).resolves.toBe(false);
  });
});

describe('isApoSwitchedOff', () => {
  it('is false on a machine it was never switched off on', async () => {
    await expect(isApoSwitchedOff()).resolves.toBe(false);
  });

  it('is true once the helper has recorded an output', async () => {
    const directory = path.join(root, 'apo-off');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, '{AAAA}.json'), '{}');
    await expect(isApoSwitchedOff()).resolves.toBe(true);
  });

  it('ignores anything that is not one of its records', async () => {
    const directory = path.join(root, 'apo-off');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'readme.txt'), 'x');
    await expect(isApoSwitchedOff()).resolves.toBe(false);
  });
});
