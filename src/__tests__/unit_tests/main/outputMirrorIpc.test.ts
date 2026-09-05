/** @jest-environment node */
import { EventEmitter } from 'events';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import {
  registerOutputMirrorIpc,
  withOutputMirrorsStopped,
} from '../../../main/ipc/outputMirror';

type Handler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<unknown>;
const mockHandlers = new Map<string, Handler>();
const mockDiscover = jest.fn();
const mockStart = jest.fn();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, handler: Handler) => mockHandlers.set(name, handler),
  },
}));
jest.mock('../../../main/audioDevices', () => ({
  discoverAudioDevices: () => mockDiscover(),
}));
jest.mock('../../../main/remoteAudioCapture', () => ({
  startNativeOutputMirror: (...args: unknown[]) => mockStart(...args),
}));

const guid = '{12345678-1234-1234-1234-123456789abc}';
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
  mockDiscover
    .mockReset()
    .mockResolvedValue([{ guid, isActive: true, isDefault: false }]);
  mockStart.mockReset();
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
  );
});
afterEach(async () => reset());

it('waits for a pending mirror to stop before switching the main output', async () => {
  const opening = deferred<ReturnType<typeof mirror>>();
  mockStart.mockReturnValue(opening.promise);
  const starting = invoke('start', 'one', guid, 'video', 1);
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
  expect(await invoke('start', 'two', guid, 'music', 1)).toBe(false);
  closing.resolve();
  await expect(starting).resolves.toBe(false);
  await switching;
  expect(changeOutput).toHaveBeenCalledTimes(1);
});

it('closes a late start after the user disables it and never attaches it again', async () => {
  const opening = deferred<ReturnType<typeof mirror>>();
  mockStart.mockReturnValue(opening.promise);
  const starting = invoke('start', 'one', guid, 'music', 1);
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
  await expect(invoke('start', 'one', guid, 'music', 1)).rejects.toThrow(
    'main output',
  );
  event = { ...event, senderFrame: {} } as IpcMainInvokeEvent;
  await expect(invoke('start', 'two', guid, 'music', 1)).rejects.toThrow(
    'unknown window',
  );
  expect(mockStart).not.toHaveBeenCalled();
});

it('stops a running mirror when its page navigates away', async () => {
  const output = mirror();
  mockStart.mockResolvedValue(output);
  await expect(invoke('start', 'one', guid, 'video', 1)).resolves.toBe(true);
  event.sender.emit('did-start-navigation', {}, 'about:blank', false, true);
  expect(output.close).toHaveBeenCalledTimes(1);
});
