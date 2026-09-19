/** @jest-environment node */
import type { BrowserWindow } from 'electron';
import { registerRemoteAudioPlayback } from 'main/ipc/remoteAudioPlayback';
import { startNativeRemoteAudioPlayback } from 'main/nativeRemoteAudioPlayback';

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, handler: (...args: unknown[]) => Promise<unknown>) =>
      handlers.set(name, handler),
  },
}));
jest.mock('main/nativeRemoteAudioPlayback', () => ({
  startNativeRemoteAudioPlayback: jest.fn(),
}));
const createPlayer = () => ({
  push: jest.fn(),
  remove: jest.fn(),
  reset: jest.fn(),
  setVolume: jest.fn(),
  setOutput: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
});
const webContents = { mainFrame: {}, send: jest.fn() };
const window = {
  webContents,
  isDestroyed: () => false,
} as unknown as BrowserWindow;
const event = { sender: webContents, senderFrame: webContents.mainFrame };
const invoke = (name: string, ...args: unknown[]) => {
  const handler = handlers.get(`remote-audio-playback-${name}`);
  if (!handler) {
    throw new Error(`Missing playback handler: ${name}`);
  }
  return handler(event, ...args);
};
const deferred = <T>() => {
  let complete: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    complete = resolve;
  });
  return { promise, resolve: complete };
};
const originalPlatform = process.platform;
beforeAll(() => Object.defineProperty(process, 'platform', { value: 'win32' }));
afterAll(() =>
  Object.defineProperty(process, 'platform', { value: originalPlatform }),
);
beforeEach(() => {
  handlers.clear();
  jest.clearAllMocks();
  jest.mocked(startNativeRemoteAudioPlayback).mockReset();
});

it('closes a replaced output once and ignores commands from its old mixer', async () => {
  const old = createPlayer();
  const next = createPlayer();
  jest
    .mocked(startNativeRemoteAudioPlayback)
    .mockResolvedValueOnce(old)
    .mockResolvedValueOnce(next);
  registerRemoteAudioPlayback(() => window);
  const first = await invoke('open', 'default', 0.5);
  const second = await invoke('open', 'default', 0.8);
  await invoke('command', first, 'close');
  expect(old.close).toHaveBeenCalledTimes(1);
  expect(next.close).not.toHaveBeenCalled();
  expect(next.setVolume).toHaveBeenCalledWith(0.8);
  await invoke('command', second, 'close');
  expect(next.close).toHaveBeenCalledTimes(1);
});

it('disposes an output that finishes opening after a newer receiver replaces it', async () => {
  const pending = deferred<void>();
  const old = createPlayer();
  const opening = deferred<void>();
  old.setOutput.mockImplementation(() => {
    opening.resolve();
    return pending.promise;
  });
  const next = createPlayer();
  jest
    .mocked(startNativeRemoteAudioPlayback)
    .mockResolvedValueOnce(old)
    .mockResolvedValueOnce(next);
  registerRemoteAudioPlayback(() => window);
  const first = invoke('open', 'default', 0.5).catch((error: unknown) => error);
  await opening.promise;
  await invoke('open', 'default', 1);
  pending.resolve();
  expect(await first).toEqual(new Error('Playback request was replaced.'));
  expect(old.close).toHaveBeenCalledTimes(1);
  expect(next.close).not.toHaveBeenCalled();
});

it('keeps failed native playback out of later network and Stop callbacks', async () => {
  const player = createPlayer();
  jest.mocked(startNativeRemoteAudioPlayback).mockResolvedValue(player);
  const controller = registerRemoteAudioPlayback(() => window);
  const id = await invoke('open', 'default', 1);
  player.reset.mockImplementation(() => {
    throw new Error('device gone');
  });
  expect(() => controller.reset()).not.toThrow();
  expect(webContents.send).toHaveBeenCalledWith('remote-audio-playback-event', {
    session: id,
    kind: 'failed',
  });
  expect(player.close).toHaveBeenCalledTimes(1);
  expect(() => controller.reset()).not.toThrow();
  await expect(invoke('command', id, 'output', 'default')).rejects.toThrow(
    'reopened',
  );
  await controller.close();
});

it('refuses requests from another frame and invalid playback volume', async () => {
  registerRemoteAudioPlayback(() => window);
  await expect(
    handlers.get('remote-audio-playback-open')?.(
      { ...event, senderFrame: {} },
      'default',
      1,
    ),
  ).rejects.toThrow('app window');
  await expect(invoke('open', 'default', Number.NaN)).rejects.toThrow(
    'Invalid',
  );
  expect(startNativeRemoteAudioPlayback).not.toHaveBeenCalled();
});

it('does not mark a resumed session failed when the old helper closes late', async () => {
  const old = createPlayer();
  const next = createPlayer();
  const finishClose = deferred<void>();
  const closed = finishClose.promise.then(() => {
    throw new Error('old pipe closed');
  });
  old.close.mockReturnValue(closed);
  old.reset.mockImplementation(() => {
    throw new Error('old device gone');
  });
  jest
    .mocked(startNativeRemoteAudioPlayback)
    .mockResolvedValueOnce(old)
    .mockResolvedValueOnce(next);
  const controller = registerRemoteAudioPlayback(() => window);
  await invoke('open', 'default', 1);
  controller.reset();
  const resumed = await invoke('open', 'default', 1);
  finishClose.resolve();
  await closed.catch(() => undefined);
  expect(webContents.send).not.toHaveBeenCalledWith(
    'remote-audio-playback-event',
    {
      session: resumed,
      kind: 'failed',
    },
  );
  expect(next.close).not.toHaveBeenCalled();
});
