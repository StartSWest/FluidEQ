/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The state a user's machine was in: the engine installed, attached to the
 * output he was listening to, Windows' enhancements on, and the engine never
 * once created by Windows — with the app calling it healthy, because an
 * effect that is never created says nothing at all.
 */

import {
  createEngineLoadRepair,
  whatStopsTheEngineLoading,
} from 'main/engineLoadRepair';
import type { IAudioEngineStatus } from 'common/audioEngine';

const status = (
  fluid: Partial<IAudioEngineStatus['fluid']> = {},
): IAudioEngineStatus => ({
  engine: 'fluid',
  apo: { installed: false },
  fluid: {
    installed: true,
    dllVersion: '1.8.0.0',
    endpoints: [],
    unsignedAllowed: true,
    runtimeBeside: true,
    everRan: true,
    ...fluid,
  },
  fluidSupported: true,
  fluidUpdateReady: false,
});

describe('whatStopsTheEngineLoading', () => {
  it('names Windows refusing effects it did not sign', () => {
    expect(
      whatStopsTheEngineLoading(status({ unsignedAllowed: false })),
    ).toMatch(/did not sign/);
  });

  it('names a missing runtime beside the engine', () => {
    expect(whatStopsTheEngineLoading(status({ runtimeBeside: false }))).toMatch(
      /runtime/,
    );
  });

  it('names a folder the engine may not write in', () => {
    expect(
      whatStopsTheEngineLoading(status({ serviceCanWrite: false })),
    ).toMatch(/write/);
  });

  it('says nothing about an engine that has simply never run yet', () => {
    // Deliberately silent, even attached: from this read a machine where
    // Windows has never created the engine is identical to one where setup
    // finished a minute ago and nothing has played. A Windows permission
    // prompt seconds after an install is its own bug, so the window asks for
    // that repair instead, once it has heard sound go past
    // (`useRepairWhenEngineNeverRan`).
    expect(
      whatStopsTheEngineLoading(
        status({
          everRan: false,
          endpoints: [{ guid: '{A}', attached: true, backupExists: true }],
        }),
      ),
    ).toBeUndefined();
  });

  it('is silent when both are in order', () => {
    expect(whatStopsTheEngineLoading(status())).toBeUndefined();
  });

  it('is silent when the helper is too old to answer', () => {
    expect(
      whatStopsTheEngineLoading(
        status({ unsignedAllowed: undefined, runtimeBeside: undefined }),
      ),
    ).toBeUndefined();
  });

  it('is silent on a machine with no engine installed', () => {
    expect(
      whatStopsTheEngineLoading(
        status({ installed: false, unsignedAllowed: false }),
      ),
    ).toBeUndefined();
  });
});

describe('createEngineLoadRepair', () => {
  const repairFor = (engine: 'fluid' | 'apo') => {
    const runEngineSetup = jest.fn(async () => ({
      ok: true,
      declined: false,
    }));
    return {
      runEngineSetup,
      repair: createEngineLoadRepair({
        getEngine: () => engine,
        runEngineSetup,
      }),
    };
  };

  it('puts the install back and restarts Windows audio', async () => {
    const { repair, runEngineSetup } = repairFor('fluid');
    await repair.check(status({ unsignedAllowed: false }));
    // Never `--attach-all`: which outputs the engine is on stays the user's.
    expect(runEngineSetup).toHaveBeenCalledWith('install', ['--restart-audio']);
  });

  it('asks Windows once a session, however often the status is read', async () => {
    const { repair, runEngineSetup } = repairFor('fluid');
    await repair.check(status({ unsignedAllowed: false }));
    await repair.check(status({ unsignedAllowed: false }));
    await repair.check(status({ runtimeBeside: false }));
    expect(runEngineSetup).toHaveBeenCalledTimes(1);
  });

  it('leaves a healthy machine alone', async () => {
    const { repair, runEngineSetup } = repairFor('fluid');
    await repair.check(status());
    expect(runEngineSetup).not.toHaveBeenCalled();
  });

  it('does nothing under Equalizer APO', async () => {
    const { repair, runEngineSetup } = repairFor('apo');
    await repair.check(status({ unsignedAllowed: false }));
    expect(runEngineSetup).not.toHaveBeenCalled();
  });

  it('survives a helper that cannot be run', async () => {
    const repair = createEngineLoadRepair({
      getEngine: () => 'fluid',
      runEngineSetup: async () => {
        throw new Error('the helper is missing');
      },
    });
    await expect(
      repair.check(status({ unsignedAllowed: false })),
    ).resolves.toBeUndefined();
  });
});
