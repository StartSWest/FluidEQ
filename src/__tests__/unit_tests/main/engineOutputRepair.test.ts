/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The slot ladder, from the state a user's machine was in: the engine
 * installed, attached as an endpoint effect on the output he listened to,
 * enhancements on, every machine-wide fact in order, and the engine never
 * once created by Windows there.
 */

import type { IAudioEngineStatus } from 'common/audioEngine';
import { createAutomaticSetup } from 'main/automaticSetup';
import {
  SLOT_LADDER,
  createEngineOutputRepair,
  nextSlot,
  whatToTry,
} from 'main/engineOutputRepair';

const RME = '{9E7B1C2A-0000-0000-0000-00000000ABCD}';

const status = (
  fluid: Partial<IAudioEngineStatus['fluid']> = {},
): IAudioEngineStatus => ({
  engine: 'fluid',
  apo: { installed: false },
  fluid: {
    installed: true,
    dllVersion: '1.8.0.0',
    endpoints: [{ guid: RME, attached: true, backupExists: true, slot: 'efx' }],
    unsignedAllowed: true,
    runtimeBeside: true,
    serviceCanWrite: true,
    everRan: false,
    ...fluid,
  },
  fluidSupported: true,
  fluidUpdateReady: false,
});

describe('the slot ladder', () => {
  it('runs newest to oldest and ends', () => {
    expect(SLOT_LADDER).toEqual(['efx', 'mfx', 'sfx', 'gfx', 'lfx']);
    expect(nextSlot('efx')).toBe('mfx');
    expect(nextSlot('gfx')).toBe('lfx');
    expect(nextSlot('lfx')).toBeUndefined();
  });
});

describe('whatToTry', () => {
  it('moves the engine one slot down where the machine is otherwise in order', () => {
    expect(whatToTry(status(), RME)).toEqual({
      kind: 'move',
      from: 'efx',
      to: 'mfx',
    });
  });

  it('re-installs first where a machine-wide switch was undone', () => {
    expect(whatToTry(status({ unsignedAllowed: false }), RME)).toMatchObject({
      kind: 'install',
    });
  });

  it('matches the output however either side spelled its id', () => {
    expect(
      whatToTry(status(), RME.toLowerCase().replace(/[{}]/g, '')),
    ).toMatchObject({ kind: 'move' });
  });

  it('has nothing to try on an output the engine is not on', () => {
    expect(
      whatToTry(
        status({
          endpoints: [{ guid: RME, attached: false, backupExists: false }],
        }),
        RME,
      ),
    ).toMatchObject({ kind: 'nothing' });
  });

  it('has nothing to try when the helper cannot say where the engine is', () => {
    expect(
      whatToTry(
        status({
          endpoints: [{ guid: RME, attached: true, backupExists: true }],
        }),
        RME,
      ),
    ).toMatchObject({ kind: 'nothing' });
  });

  it('has nothing to try at the bottom of the ladder', () => {
    expect(
      whatToTry(
        status({
          endpoints: [
            { guid: RME, attached: true, backupExists: true, slot: 'lfx' },
          ],
        }),
        RME,
      ),
    ).toMatchObject({ kind: 'nothing' });
  });
});

describe('createEngineOutputRepair', () => {
  const originalPlatform = process.platform;
  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
  });
  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  type TRun = (
    command: 'install' | 'attach',
    args: string[],
  ) => Promise<{ ok: boolean; declined: boolean; error?: string }>;

  const repairFor = (
    read: () => IAudioEngineStatus,
    engine: 'fluid' | 'apo' = 'fluid',
  ) => {
    const runEngineSetup = jest.fn<ReturnType<TRun>, Parameters<TRun>>(
      async () => ({ ok: true, declined: false }),
    );
    return {
      runEngineSetup,
      repair: createEngineOutputRepair({
        getEngine: () => engine,
        readStatus: async () => read(),
        runEngineSetup,
        automatic: createAutomaticSetup(),
      }),
    };
  };

  it('moves the engine to the next slot on that output and restarts Windows audio', async () => {
    const { repair, runEngineSetup } = repairFor(() => status());
    await expect(repair.repair(RME)).resolves.toEqual({
      ok: true,
      declined: false,
    });
    expect(runEngineSetup).toHaveBeenCalledWith('attach', [
      RME,
      '--slot',
      'mfx',
      '--restart-audio',
    ]);
  });

  it('walks the whole ladder as the helper reports each new slot', async () => {
    let current: 'efx' | 'mfx' | 'sfx' | 'gfx' | 'lfx' = 'efx';
    const { repair, runEngineSetup } = repairFor(() =>
      status({
        endpoints: [
          { guid: RME, attached: true, backupExists: true, slot: current },
        ],
      }),
    );
    const rungs = ['mfx', 'sfx', 'gfx', 'lfx'] as const;
    // One rung after another, each after the helper reports the last.
    await rungs.reduce(async (previous, to) => {
      await previous;
      await expect(repair.repair(RME)).resolves.toMatchObject({ ok: true });
      current = to;
    }, Promise.resolve());
    expect(runEngineSetup.mock.calls.map(([, args]) => args[2])).toEqual([
      ...rungs,
    ]);
    // The bottom: nothing more, and no helper run.
    await expect(repair.repair(RME)).resolves.toMatchObject({
      ok: false,
      detail: expect.stringContaining('every slot'),
    });
    expect(runEngineSetup).toHaveBeenCalledTimes(4);
  });

  it('re-installs, never attaches, where the machine cannot load the engine at all', async () => {
    const { repair, runEngineSetup } = repairFor(() =>
      status({ runtimeBeside: false }),
    );
    await repair.repair(RME);
    // Never `--attach-all`: which outputs the engine is on stays the user's.
    expect(runEngineSetup).toHaveBeenCalledWith('install', ['--restart-audio']);
  });

  it("carries a refusal back: a declined prompt, and the helper's own reason", async () => {
    const { repair, runEngineSetup } = repairFor(() => status());
    runEngineSetup.mockResolvedValueOnce({ ok: false, declined: true });
    await expect(repair.repair(RME)).resolves.toEqual({
      ok: false,
      declined: true,
    });
    const { repair: again, runEngineSetup: run } = repairFor(() =>
      status({
        endpoints: [
          { guid: RME, attached: true, backupExists: true, slot: 'sfx' },
        ],
      }),
    );
    run.mockResolvedValueOnce({
      ok: false,
      declined: false,
      error: 'cannot attach to gfx: GFX already holds another effect',
    });
    await expect(again.repair(RME)).resolves.toEqual({
      ok: false,
      declined: false,
      detail: 'cannot attach to gfx: GFX already holds another effect',
    });
  });

  it('does nothing under Equalizer APO, or with no engine installed', async () => {
    const { repair, runEngineSetup } = repairFor(() => status(), 'apo');
    await expect(repair.repair(RME)).resolves.toMatchObject({ ok: false });
    const { repair: none, runEngineSetup: run } = repairFor(() =>
      status({ installed: false }),
    );
    await expect(none.repair(RME)).resolves.toMatchObject({ ok: false });
    expect(runEngineSetup).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
});
