/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import type { IAudioDevice } from '../../../common/constants';
import type {
  IAudioEngineStatus,
  TAudioEngine,
} from '../../../common/audioEngine';
import {
  normaliseEndpointGuid,
  type IEngineHealth,
} from '../../../common/engineHealth';
import { createSecondOutputs } from '../../../main/secondOutputRoute';
import type { INativeOutputMirror } from '../../../main/remoteAudioCapture';

const device = (id: string, isDefault = false): IAudioDevice => ({
  id,
  name: id,
  guid: `{${id}}`,
  isDefault,
  isActive: true,
});
const main = device('a', true);
const promoted = device('b');
const retained = device('c');
const outputs = [main, promoted, retained];
const nativeHandle = () => ({
  close: jest.fn(async () => undefined),
  setVolume: jest.fn(async (_volume: number) => undefined),
});
const status: IAudioEngineStatus = {
  engine: 'fluid',
  apo: { installed: false },
  fluidSupported: true,
  fluidUpdateReady: false,
  fluid: {
    installed: true,
    dllVersion: '1.20.0',
    endpoints: outputs.map(({ guid }) => ({
      guid,
      attached: true,
      backupExists: true,
      slot: 'efx',
    })),
  },
};
const health: IEngineHealth = {
  outputs: outputs.map(({ guid }) => ({
    endpoint: normaliseEndpointGuid(guid),
    locked: true,
    processing: true,
    owner: true,
    problems: [],
  })),
};

describe('retargeting existing second outputs', () => {
  let engine: TAudioEngine;
  let installed: IAudioEngineStatus;
  let routes: ReturnType<typeof createSecondOutputs>;
  let handles: Map<string, ReturnType<typeof nativeHandle>[]>;
  let opened: INativeOutputMirror[];
  const writeSplit = jest.fn(async (_text: string) => undefined);
  const syncProfiles = jest.fn(async (_devices: IAudioDevice[]) => undefined);
  const startHold = jest.fn(async (guid: string) => {
    const handle = nativeHandle();
    handles.set(guid, [...(handles.get(guid) ?? []), handle]);
    return handle;
  });
  const startMirror = jest.fn(async (guid: string) => {
    const handle = nativeHandle();
    handles.set(guid, [...(handles.get(guid) ?? []), handle]);
    return handle;
  });
  const failure = jest.fn();
  const delay = jest.fn();
  const start = async (target: IAudioDevice, volume: number) => {
    const mirror = await routes.start(main, target, volume, failure, delay);
    opened.push(mirror);
    return mirror;
  };
  const handleFor = (target: IAudioDevice, index = 0) => {
    const handle = handles.get(target.guid)?.[index];
    if (!handle) {
      throw new Error(`Missing handle for ${target.id}`);
    }
    return handle;
  };
  const lastSplit = () =>
    writeSplit.mock.calls[writeSplit.mock.calls.length - 1][0];
  beforeEach(() => {
    engine = 'fluid';
    installed = status;
    handles = new Map();
    opened = [];
    [writeSplit, syncProfiles, startHold, startMirror, failure, delay].forEach(
      (mock) => mock.mockClear(),
    );
    routes = createSecondOutputs({
      getEngine: () => engine,
      readStatus: async () => installed,
      readHealth: async () => health,
      writeSplit,
      syncProfiles,
      startHold,
      startMirror,
    });
  });
  afterEach(async () => {
    await Promise.all(opened.map((mirror) => mirror.close()));
  });

  it('keeps older process-local engines on the helper path', async () => {
    installed = {
      ...status,
      fluid: { ...status.fluid, dllVersion: '1.19.0.0' },
    };
    await start(promoted, 0.4);
    expect(startMirror).toHaveBeenCalledTimes(1);
    expect(startHold).not.toHaveBeenCalled();
    expect(writeSplit).not.toHaveBeenCalled();
    expect(syncProfiles).toHaveBeenLastCalledWith([promoted]);
    expect(failure).not.toHaveBeenCalled();
  });

  it('closes only the receiver whose shared transport was refused', async () => {
    await start(promoted, 0.4);
    const c = await start(retained, 0.7);
    routes.onHealth({
      outputs: health.outputs.map((output) => ({
        ...output,
        problems: output.endpoint === '{B}' ? ['split-transport'] : [],
      })),
    });
    // The surviving route's update follows the failed receiver's cleanup.
    await c.setVolume(0.6);
    expect(failure).toHaveBeenCalledTimes(1);
    expect(handleFor(promoted).close).toHaveBeenCalledTimes(1);
    expect(handleFor(retained).close).not.toHaveBeenCalled();
    expect(lastSplit()).toContain('# main {a}');
    expect(lastSplit()).toContain('{a} {c} 0.600');
    expect(lastSplit()).not.toContain('{a} {b}');
    expect(startMirror).not.toHaveBeenCalled();
    expect(delay).toHaveBeenLastCalledWith(0, 'unavailable');
  });

  it('ends optional routes when their source cannot share, preserving the main marker', async () => {
    const b = await start(promoted, 0.4);
    const c = await start(retained, 0.7);
    routes.onHealth({
      outputs: health.outputs.map((output) => ({
        ...output,
        problems: output.endpoint === '{A}' ? ['split-transport'] : [],
      })),
    });
    await Promise.all([b.close(), c.close()]);
    expect(failure).toHaveBeenCalledTimes(2);
    expect(handleFor(promoted).close).toHaveBeenCalledTimes(1);
    expect(handleFor(retained).close).toHaveBeenCalledTimes(1);
    expect(lastSplit()).toContain('# main {a}');
    expect(lastSplit()).not.toContain('{a} {b}');
    expect(lastSplit()).not.toContain('{a} {c}');
    expect(handles.has(main.guid)).toBe(false);
  });

  it('does not confuse a waiting source or a dead status with transport refusal', async () => {
    const b = await start(promoted, 0.4);
    routes.onHealth({
      outputs: health.outputs.map((output) =>
        output.endpoint === '{B}'
          ? {
              ...output,
              split: { from: '{A}', state: 'waiting', lagMs: 0, underruns: 0 },
            }
          : output,
      ),
    });
    routes.onHealth({
      outputs: health.outputs.map((output) => ({
        ...output,
        locked: false,
        problems: ['split-transport'],
      })),
    });
    await b.setVolume(0.3);
    expect(failure).not.toHaveBeenCalled();
    expect(handleFor(promoted).close).not.toHaveBeenCalled();
    expect(lastSplit()).toContain('{a} {b} 0.300');
    expect(delay).toHaveBeenLastCalledWith(0, 'unavailable');
  });

  it("promotes B, preserves C's stream and volume, and leaves A for its new renderer-owned receiver", async () => {
    await start(promoted, 0.4);
    const c = await start(retained, 0.7);
    const change = jest.fn(async () => {
      expect(lastSplit()).toContain('# main {b}');
      expect(lastSplit()).toContain('{b} {c} 0.700');
      expect(lastSplit()).not.toContain('{a} {b}');
      expect(handleFor(retained).close).not.toHaveBeenCalled();
    });
    const after = jest.fn(async () => {
      expect(change).toHaveBeenCalledTimes(1);
      expect(handleFor(retained).close).not.toHaveBeenCalled();
    });

    await routes.retargetMain(promoted, change, after);

    expect(change).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(handleFor(promoted).close).toHaveBeenCalledTimes(1);
    expect(handleFor(retained).close).not.toHaveBeenCalled();
    expect(startHold).toHaveBeenCalledTimes(2);
    expect(startMirror).not.toHaveBeenCalled();
    expect(syncProfiles).toHaveBeenLastCalledWith([retained]);
    expect(failure).not.toHaveBeenCalled();
    await c.setVolume(0.25);
    expect(lastSplit()).toContain('{b} {c} 0.250');
    expect(lastSplit()).not.toContain('{b} {a}');

    const a = await routes.start(promoted, main, 0.4, failure, delay);
    opened.push(a);
    expect(startHold).toHaveBeenCalledTimes(3);
    expect(lastSplit()).toContain('{b} {a} 0.400');
    expect(handleFor(retained).close).not.toHaveBeenCalled();
  });

  it('stops helper copies before the Windows switch and resumes unaffected C under the same owner', async () => {
    engine = 'apo';
    await start(promoted, 0.4);
    const c = await start(retained, 0.7);
    const change = jest.fn(async () => {
      expect(handleFor(promoted).close).toHaveBeenCalledTimes(1);
      expect(handleFor(retained).close).toHaveBeenCalledTimes(1);
      expect(startMirror).toHaveBeenCalledTimes(2);
    });
    await routes.retargetMain(promoted, change);
    expect(change).toHaveBeenCalledTimes(1);
    expect(startMirror).toHaveBeenCalledTimes(3);
    expect(startMirror).toHaveBeenLastCalledWith(
      retained.guid,
      0.7,
      expect.any(Function),
      expect.any(Function),
    );
    expect(startHold).not.toHaveBeenCalled();
    await c.setVolume(0.25);
    expect(handleFor(retained, 1).setVolume).toHaveBeenCalledWith(0.25);
    expect(failure).not.toHaveBeenCalled();
  });

  it('restores the original routes and their profiles when Windows refuses the main switch', async () => {
    const b = await start(promoted, 0.4);
    await start(retained, 0.7);
    const change = jest.fn(async () => {
      throw new Error('Windows refused');
    });

    await expect(routes.retargetMain(promoted, change)).rejects.toThrow(
      'Windows refused',
    );

    expect(lastSplit()).toContain('# main {a}');
    expect(lastSplit()).toContain('{a} {b} 0.400');
    expect(lastSplit()).toContain('{a} {c} 0.700');
    expect(handleFor(promoted).close).not.toHaveBeenCalled();
    expect(handleFor(retained).close).not.toHaveBeenCalled();
    expect(syncProfiles).toHaveBeenLastCalledWith([promoted, retained]);
    await b.setVolume(0.6);
    expect(lastSplit()).toContain('{a} {b} 0.600');
    expect(failure).not.toHaveBeenCalled();
  });
});
