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
  type TEngineSlot,
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
    expect(SLOT_LADDER).toEqual([
      'efx',
      'mfx',
      'sfx',
      'efx-single',
      'mfx-single',
      'sfx-single',
      'gfx',
      'lfx',
    ]);
    expect(nextSlot('efx')).toBe('mfx');
    // The generation the ladder used to step straight past, which is where a
    // Bluetooth headset's own defaults were registered and where Windows was
    // reading. Without these three the engine went from the lists to a value
    // that endpoint is never read from.
    expect(nextSlot('sfx')).toBe('efx-single');
    expect(nextSlot('sfx-single')).toBe('gfx');
    expect(
      nextSlot('lfx', [
        'efx',
        'mfx',
        'sfx',
        'efx-single',
        'mfx-single',
        'sfx-single',
        'gfx',
        'lfx',
      ]),
    ).toBeUndefined();
  });

  it('offers a new rung to an output that already walked to the bottom', () => {
    // The case this is all for. An output that reached the oldest value of
    // all was offered every rung there was at the time and heard in none of
    // them — and the three that did not exist then are not among those. It
    // gets them now rather than starting the whole walk again.
    expect(nextSlot('lfx')).toBe('efx-single');
    expect(nextSlot('gfx')).toBe('efx-single');
    // And once they have been spent, there is genuinely nothing left.
    expect(
      nextSlot('lfx', [
        'efx',
        'mfx',
        'sfx',
        'efx-single',
        'mfx-single',
        'sfx-single',
        'gfx',
        'lfx',
      ]),
    ).toBeUndefined();
  });

  it('does not send an output back up the ladder it has already walked', () => {
    // Taken from the machine: a Bluetooth headset that had walked to the
    // oldest value of all, then took the first of the new rungs. The helper
    // records only the moves it was asked for by name, so the rung the
    // first attach chose for itself is in no record — and reading the
    // record as the whole history offered the top of the ladder again, a
    // place this output had already been heard failing in.
    expect(nextSlot('efx-single', ['lfx', 'efx-single'])).toBe('mfx-single');
    // And on down: the two Windows' own effects sit in are still rungs,
    // because Windows' own is the one registration ours may replace.
    expect(nextSlot('mfx-single', ['lfx', 'efx-single', 'mfx-single'])).toBe(
      'sfx-single',
    );
    expect(
      nextSlot('sfx-single', ['lfx', 'efx-single', 'mfx-single', 'sfx-single']),
    ).toBeUndefined();
  });

  it('never offers a rung this output has already been put in', () => {
    // What the helper remembers wins over where the engine happens to be:
    // the ladder spends each rung once, so it can never circle.
    expect(nextSlot('mfx', ['efx', 'mfx'])).toBe('sfx');
    expect(nextSlot('efx-single', ['efx', 'efx-single'])).toBe('mfx');
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

  it('offers the single values under an engine older than the app', () => {
    // Issue 29, as its report read: a Bluetooth headset with Windows' own two
    // effects in pids 5 and 6 and no list, walked by 1.7.4 to the pre-8.1 GFX
    // value, and an engine that is still 1.9 when the updated app first hears
    // sound go past it. The move is made by the helper shipped with this app,
    // which knows every rung — gated on the installed engine instead, the
    // walk skipped all three and spent LFX, and the headset stayed silent.
    expect(
      whatToTry(
        status({
          dllVersion: '1.9.0.0',
          endpoints: [
            {
              guid: RME,
              attached: true,
              backupExists: true,
              slot: 'gfx',
              slotsTried: ['gfx'],
            },
          ],
        }),
        RME,
      ),
    ).toEqual({ kind: 'move', from: 'gfx', to: 'efx-single' });
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
            {
              guid: RME,
              attached: true,
              backupExists: true,
              slot: 'lfx',
              slotsTried: SLOT_LADDER.slice(1),
            },
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
    // What the helper answers after each move: where the engine is now, and
    // every rung it has been asked for by name.
    let current: TEngineSlot = 'efx';
    const tried: TEngineSlot[] = [];
    const read = () =>
      status({
        endpoints: [
          {
            guid: RME,
            attached: true,
            backupExists: true,
            slot: current,
            slotsTried: [...tried],
          },
        ],
      });
    // One rung after another, each after the helper reports the last.
    const take = async (
      repair: ReturnType<typeof repairFor>['repair'],
      rungs: readonly TEngineSlot[],
    ) =>
      rungs.reduce(async (previous, to) => {
        await previous;
        await expect(repair.repair(RME)).resolves.toMatchObject({ ok: true });
        current = to;
        tried.push(to);
      }, Promise.resolve());
    const movedTo = (run: ReturnType<typeof repairFor>['runEngineSetup']) =>
      run.mock.calls.map(([, args]) => args[2]);

    // A session's allowance is four moves; the rest waits for the next.
    const first = repairFor(read);
    await take(first.repair, ['mfx', 'sfx', 'efx-single', 'mfx-single']);
    expect(movedTo(first.runEngineSetup)).toEqual([
      'mfx',
      'sfx',
      'efx-single',
      'mfx-single',
    ]);
    await expect(first.repair.repair(RME)).resolves.toMatchObject({
      ok: false,
      detail: expect.stringContaining('already ran'),
    });
    expect(first.runEngineSetup).toHaveBeenCalledTimes(4);

    const second = repairFor(read);
    await take(second.repair, ['sfx-single', 'gfx', 'lfx']);
    expect(movedTo(second.runEngineSetup)).toEqual([
      'sfx-single',
      'gfx',
      'lfx',
    ]);
    // The bottom: nothing more, and no helper run.
    await expect(second.repair.repair(RME)).resolves.toMatchObject({
      ok: false,
      detail: expect.stringContaining('every slot'),
    });
    expect(second.runEngineSetup).toHaveBeenCalledTimes(3);
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
