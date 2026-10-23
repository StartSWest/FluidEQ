/** @jest-environment node */
import { EventEmitter } from 'events';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import {
  registerOutputMirrorIpc,
  withOutputMirrorsRetargeted,
  withOutputMirrorsStopped,
} from '../../../main/ipc/outputMirror';
import type { ISecondOutputs } from '../../../main/secondOutputRoute';

type Handler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<unknown>;
const mockHandlers = new Map<string, Handler>();
const mockDiscover = jest.fn();
const mockStart = jest.fn();
const mockRetarget = jest.fn<
  ReturnType<ISecondOutputs['retargetMain']>,
  Parameters<ISecondOutputs['retargetMain']>
>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, handler: Handler) => mockHandlers.set(name, handler),
  },
}));
jest.mock('../../../main/audioDevices', () => ({
  discoverAudioDevices: () => mockDiscover(),
}));

const guid = '{12345678-1234-1234-1234-123456789abc}';
const mainGuid = '{87654321-4321-4321-4321-cba987654321}';
const mainOutput = {
  id: 'main',
  name: 'Main',
  guid: mainGuid,
  isActive: true,
  isDefault: true,
};
const secondOutput = {
  id: 'second',
  name: 'Second',
  guid,
  isActive: true,
  isDefault: false,
};
const deferred = <T>() => {
  let complete: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    complete = resolve;
  });
  return { promise, resolve: complete };
};
const mirror = () => ({
  close: jest.fn().mockResolvedValue(undefined),
  setVolume: jest.fn().mockResolvedValue(undefined),
});
let event: IpcMainInvokeEvent;
let reset: () => Promise<void>;
const invoke = (name: string, ...args: unknown[]) => {
  const handler = mockHandlers.get(`output-mirror-${name}`);
  if (!handler) {
    throw new Error('Missing handler');
  }
  return handler(event, ...args);
};
beforeEach(() => {
  mockHandlers.clear();
  mockDiscover.mockReset().mockResolvedValue([mainOutput, secondOutput]);
  mockStart.mockReset();
  mockRetarget.mockReset().mockImplementation(async (_main, change, after) => {
    await change();
    await after?.();
  });
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: {},
    isDestroyed: () => false,
    send: jest.fn(),
  });
  event = {
    sender: contents,
    senderFrame: contents.mainFrame,
  } as unknown as IpcMainInvokeEvent;
  reset = registerOutputMirrorIpc(
    () => ({ webContents: contents }) as unknown as BrowserWindow,
    {
      start: (...args) => mockStart(...args),
      reroute: () => Promise.resolve(),
      retargetMain: mockRetarget,
      onHealth: () => undefined,
    },
  );
});
afterEach(async () => reset());

it('waits for a pending mirror to stop before switching the main output', async () => {
  const opening = deferred<ReturnType<typeof mirror>>();
  mockStart.mockReturnValue(opening.promise);
  const starting = invoke('start', 'one', guid, 1);
  await Promise.resolve();
  expect(mockStart).toHaveBeenCalledTimes(1);
  const changeOutput = jest.fn().mockResolvedValue(undefined);
  const switching = withOutputMirrorsStopped(changeOutput);
  const output = mirror();
  const closing = deferred<void>();
  output.close.mockReturnValue(closing.promise);
  opening.resolve(output);
  await Promise.resolve();
  expect(output.close).toHaveBeenCalledTimes(1);
  expect(changeOutput).not.toHaveBeenCalled();
  const waiting = invoke('start', 'two', guid, 1);
  await invoke('stop', 'two');
  expect(mockStart).toHaveBeenCalledTimes(1);
  closing.resolve();
  await expect(starting).resolves.toBe(false);
  await switching;
  await expect(waiting).resolves.toBe(false);
  expect(changeOutput).toHaveBeenCalledTimes(1);
});

it('closes a late start after the user disables it and never attaches it again', async () => {
  const opening = deferred<ReturnType<typeof mirror>>();
  mockStart.mockReturnValue(opening.promise);
  const starting = invoke('start', 'one', guid, 1);
  await Promise.resolve();
  await invoke('stop', 'one');
  const output = mirror();
  opening.resolve(output);
  await expect(starting).resolves.toBe(false);
  expect(output.close).toHaveBeenCalledTimes(1);
  await invoke('volume', 'one', 0.5);
  expect(output.setVolume).not.toHaveBeenCalled();
});

it('rejects the current main output and requests from other frames', async () => {
  mockDiscover.mockResolvedValue([{ guid, isActive: true, isDefault: true }]);
  await expect(invoke('start', 'one', guid, 1)).rejects.toThrow('main output');
  event = { ...event, senderFrame: {} } as IpcMainInvokeEvent;
  await expect(invoke('start', 'two', guid, 1)).rejects.toThrow(
    'unknown window',
  );
  expect(mockStart).not.toHaveBeenCalled();
});

it('stops a running mirror when its page navigates away', async () => {
  const output = mirror();
  mockStart.mockResolvedValue(output);
  await expect(invoke('start', 'one', guid, 1)).resolves.toBe(true);
  event.sender.emit('did-start-navigation', {}, 'about:blank', false, true);
  expect(output.close).toHaveBeenCalledTimes(1);
});

it('refuses a start that still names a buffering mode', async () => {
  // The Game/Video and Music choice is gone; an old caller sending it would
  // be passing the word where the level now goes.
  await expect(invoke('start', 'one', guid, 'music', 1)).rejects.toThrow(
    'Invalid second output request.',
  );
  expect(mockStart).not.toHaveBeenCalled();
});

it('tells the window how far behind its mirror plays', async () => {
  mockStart.mockResolvedValue(mirror());
  await expect(invoke('start', 'one', guid, 0.5)).resolves.toBe(true);
  const [main, second, volume, , onDelay] = mockStart.mock.calls[0];
  expect([main.guid, second.guid, volume]).toEqual([mainGuid, guid, 0.5]);
  onDelay(41.6, 'engine');
  expect(event.sender.send).toHaveBeenCalledWith(
    'output-mirror-delay',
    'one',
    41.6,
    'engine',
  );
});

it('retargets the selected main output while preserving owned receiver handles', async () => {
  const output = mirror();
  mockStart.mockResolvedValue(output);
  await expect(invoke('start', 'one', guid, 0.5)).resolves.toBe(true);
  const change = jest.fn().mockResolvedValue(undefined);
  const after = jest.fn().mockResolvedValue(undefined);

  await withOutputMirrorsRetargeted(secondOutput.id, change, after);

  expect(mockRetarget).toHaveBeenCalledWith(secondOutput, change, after);
  expect(change).toHaveBeenCalledTimes(1);
  expect(after).toHaveBeenCalledTimes(1);
  expect(output.close).not.toHaveBeenCalled();
  await invoke('volume', 'one', 0.25);
  expect(output.setVolume).toHaveBeenCalledWith(0.25);
});

it('waits for an opening receiver before retargeting and holds new starts until it settles', async () => {
  const opening = deferred<ReturnType<typeof mirror>>();
  const started = deferred<void>();
  mockStart.mockImplementationOnce(() => {
    started.resolve();
    return opening.promise;
  });
  const starting = invoke('start', 'one', guid, 0.5);
  await started.promise;
  const switching = deferred<void>();
  const changing = deferred<void>();
  const change = jest.fn(async () => {
    changing.resolve();
    await switching.promise;
  });
  const moved = withOutputMirrorsRetargeted(secondOutput.id, change);
  const waiting = invoke('start', 'two', guid, 0.75);
  expect(mockRetarget).not.toHaveBeenCalled();

  const output = mirror();
  opening.resolve(output);
  await expect(starting).resolves.toBe(true);
  await changing.promise;
  expect(mockStart).toHaveBeenCalledTimes(1);
  expect(output.close).not.toHaveBeenCalled();
  mockStart.mockResolvedValue(mirror());
  switching.resolve();
  await moved;
  await expect(waiting).resolves.toBe(true);
  expect(mockStart).toHaveBeenCalledTimes(2);
});

it('rejects a disappeared target without moving Windows or closing receivers', async () => {
  const output = mirror();
  mockStart.mockResolvedValue(output);
  await invoke('start', 'one', guid, 1);
  mockDiscover.mockResolvedValue([mainOutput]);
  const change = jest.fn().mockResolvedValue(undefined);

  await expect(
    withOutputMirrorsRetargeted(secondOutput.id, change),
  ).rejects.toThrow('no longer available');

  expect(mockRetarget).not.toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
  expect(output.close).not.toHaveBeenCalled();
  await invoke('volume', 'one', 0.25);
  expect(output.setVolume).toHaveBeenCalledWith(0.25);
});
