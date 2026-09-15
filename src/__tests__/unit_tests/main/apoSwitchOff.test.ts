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
import {
  createApoGuard,
  isApoOnAnyOutput,
  isApoSwitchedOff,
} from 'main/apoSwitchOff';
// eslint-disable-next-line import/first
import type { IAudioDevice } from 'common/constants';
// eslint-disable-next-line import/first
import { createAutomaticSetup } from 'main/automaticSetup';

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

/**
 * The app doing it, not the user: Equalizer APO's own Device Selector can be
 * run at any moment while FluidEQ is open — which is how one machine ended up
 * with THX, FluidEQ and Equalizer APO all registered on the same output — so
 * the rule is enforced from the output list rather than only at the switch.
 */
describe('createApoGuard', () => {
  const withApo = [
    device({ isEqualizerApoAttached: true, isFluidEngineAttached: true }),
  ] as unknown as IAudioDevice[];
  const withoutApo = [
    device({ isEqualizerApoAttached: false, isFluidEngineAttached: true }),
  ] as unknown as IAudioDevice[];
  // Chosen and never installed — setup picked the engine, the Windows prompt
  // was declined — so Equalizer APO is all that machine has.
  const withoutEngine = [
    device({ isEqualizerApoAttached: true, isFluidEngineAttached: false }),
  ] as unknown as IAudioDevice[];

  const guardFor = (engine: 'fluid' | 'apo' | null) => {
    const runEngineSetup = jest.fn(async () => ({
      ok: true,
      declined: false,
    }));
    return {
      runEngineSetup,
      guard: createApoGuard({
        getEngine: () => engine,
        runEngineSetup,
        automatic: createAutomaticSetup(),
      }),
    };
  };

  it('switches Equalizer APO off when it is on an output under the engine', async () => {
    const { guard, runEngineSetup } = guardFor('fluid');
    await guard.check(withApo);
    expect(runEngineSetup).toHaveBeenCalledWith('suspend-apo', [
      '--restart-audio',
    ]);
  });

  it('asks Windows once a session, however often the list is read', async () => {
    const { guard, runEngineSetup } = guardFor('fluid');
    await guard.check(withApo);
    await guard.check(withApo);
    await guard.check(withApo);
    expect(runEngineSetup).toHaveBeenCalledTimes(1);
  });

  it('does nothing under Equalizer APO, which is then the engine', async () => {
    const { guard, runEngineSetup } = guardFor('apo');
    await guard.check(withApo);
    expect(runEngineSetup).not.toHaveBeenCalled();
  });

  it('leaves Equalizer APO alone where the engine itself is on no output', async () => {
    const { guard, runEngineSetup } = guardFor('fluid');
    await guard.check(withoutEngine);
    expect(runEngineSetup).not.toHaveBeenCalled();
  });

  it('does nothing on a machine Equalizer APO is on no output of', async () => {
    const { guard, runEngineSetup } = guardFor('fluid');
    await guard.check(withoutApo);
    expect(runEngineSetup).not.toHaveBeenCalled();
  });

  it('survives a helper that cannot be run', async () => {
    const runEngineSetup = jest.fn(async () => {
      throw new Error('the helper is missing');
    });
    const guard = createApoGuard({
      getEngine: () => 'fluid',
      runEngineSetup,
      automatic: createAutomaticSetup(),
    });
    await expect(guard.check(withApo)).resolves.toBeUndefined();
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
