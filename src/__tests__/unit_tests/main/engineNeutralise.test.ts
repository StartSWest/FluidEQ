/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The one write the engine that is NOT in use ever receives.
 *
 * Both engines read the same `config.txt` -> `fluideq.txt` layout, so an
 * engine left holding the last chain FluidEQ wrote keeps processing audio
 * after the user has switched away from it — every output processed twice,
 * with no control in the app that touches the second copy. Neutralising is
 * what stops that, and it must do exactly two things: nothing at all when the
 * other engine is not installed, and a root file with no `Device:` block when
 * it is.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IDeviceProfileSettings } from '../../../common/constants';

jest.mock('../../../main/registry', () => ({
  isEngineInstalled: jest.fn(),
  getConfigPath: jest.fn(),
}));

// eslint-disable-next-line import/first
import { getConfigPath, isEngineInstalled } from '../../../main/registry';
// eslint-disable-next-line import/first
import { neutraliseEngine } from '../../../main/engineNeutralise';
// eslint-disable-next-line import/first
import { flushPendingWrites, forgetPath } from '../../../main/asyncWriter';
// eslint-disable-next-line import/first
import { FLUIDEQ_CONFIG_FILENAME } from '../../../main/flush';

const installed = isEngineInstalled as jest.MockedFunction<
  typeof isEngineInstalled
>;
const configPath = getConfigPath as jest.MockedFunction<typeof getConfigPath>;

const SETTINGS: IDeviceProfileSettings = {
  version: 1,
  assignments: {
    headphones: {
      deviceId: 'headphones',
      deviceName: 'Headphones',
      deviceGuid: '{headphones}',
      presetName: 'Studio',
    },
  },
};

describe('neutralising the engine that is not in use', () => {
  let root: string;
  let presets: string;

  beforeEach(() => {
    jest.clearAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-neutralise-'));
    presets = path.join(root, 'presets');
    fs.mkdirSync(presets, { recursive: true });
    fs.writeFileSync(
      path.join(presets, 'Studio'),
      JSON.stringify({ preAmp: -3, filters: {} }),
      'utf8',
    );
  });

  afterEach(async () => {
    await flushPendingWrites().catch(() => undefined);
    forgetPath(path.join(root, 'config', FLUIDEQ_CONFIG_FILENAME));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('touches nothing when the other engine is not installed', async () => {
    const configDir = path.join(root, 'config');
    fs.mkdirSync(configDir, { recursive: true });
    installed.mockResolvedValue(false);

    const outcome = await neutraliseEngine('apo', SETTINGS, () => presets);

    expect(outcome).toBe('not-installed');
    expect(configPath).not.toHaveBeenCalled();
    expect(fs.readdirSync(configDir)).toEqual([]);
  });

  it('writes a root with no Device block when it is installed', async () => {
    const configDir = path.join(root, 'config');
    fs.mkdirSync(configDir, { recursive: true });
    installed.mockResolvedValue(true);
    configPath.mockResolvedValue(configDir);

    const outcome = await neutraliseEngine('apo', SETTINGS, () => presets);
    await flushPendingWrites();

    expect(outcome).toBe('written');
    expect(configPath).toHaveBeenCalledWith('apo');
    const written = fs.readFileSync(
      path.join(configDir, FLUIDEQ_CONFIG_FILENAME),
      'utf8',
    );
    expect(written).not.toMatch(/^Device:/m);
    expect(written).not.toMatch(/^Include:/m);
  });
});
