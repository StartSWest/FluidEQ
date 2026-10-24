/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';
import {
  GROUP_MEDIA_COMMAND,
  GROUP_MEDIA_KEYS,
  GROUP_MEDIA_WATCH,
} from '../../../common/groupMediaTransport';

const handlers = new Map<string, (event: unknown, value: unknown) => void>();
const keys = new Map<string, () => void>();
const unregister = jest.fn((key: string) => keys.delete(key));
const register = jest.fn((key: string, callback: () => void) => {
  keys.set(key, callback);
  return true;
});
jest.mock('electron', () => ({
  globalShortcut: { register, unregister },
  ipcMain: {
    handle: (
      channel: string,
      handler: (event: unknown, value: unknown) => void,
    ) => handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));
// eslint-disable-next-line import/first -- install the native boundary before importing its controller
import installGroupMediaKeys, {
  forwardGroupMediaCommand,
} from '../../../main/groupMediaKeys';

let window: BrowserWindow;
let nativeWindow: EventEmitter;
let webContents: EventEmitter & {
  mainFrame: object;
  send: jest.Mock;
  isDestroyed: () => boolean;
  isLoadingMainFrame: () => boolean;
};
const watch = (value: unknown, event?: unknown) =>
  handlers.get(GROUP_MEDIA_WATCH)?.(
    event ?? { sender: webContents, senderFrame: webContents.mainFrame },
    value,
  );
beforeEach(() => {
  keys.clear();
  handlers.clear();
  jest.clearAllMocks();
  nativeWindow = new EventEmitter();
  webContents = Object.assign(new EventEmitter(), {
    mainFrame: {},
    send: jest.fn(),
    isDestroyed: () => false,
    isLoadingMainFrame: () => false,
  });
  window = Object.assign(nativeWindow, {
    webContents,
    isDestroyed: () => false,
  }) as unknown as BrowserWindow;
  installGroupMediaKeys(window);
});
afterEach(() => nativeWindow.emit('closed'));

it('owns only transport keys while a linked renderer asks, and delivers each press once', () => {
  expect(keys.size).toBe(0);
  watch(true);
  watch(true);
  expect(register).toHaveBeenCalledTimes(4);
  GROUP_MEDIA_KEYS.forEach(([key, command]) => {
    keys.get(key)?.();
    expect(webContents.send).toHaveBeenLastCalledWith(GROUP_MEDIA_COMMAND, {
      command,
    });
  });
  expect(webContents.send).toHaveBeenCalledTimes(4);
  expect(keys.has('VolumeMute')).toBe(false);
  watch(false);
  expect(keys.size).toBe(0);
  expect(forwardGroupMediaCommand({ command: 'next' })).toBe(false);
});

it('rejects guest frames and arbitrary enabled values', () => {
  watch(true, { sender: webContents, senderFrame: {} });
  watch(true, { sender: {}, senderFrame: webContents.mainFrame });
  watch('true');
  expect(register).not.toHaveBeenCalled();
});

it('releases keys on a renderer crash or reload and reacquires by a new watch', () => {
  watch(true);
  webContents.emit('render-process-gone');
  expect(keys.size).toBe(0);
  watch(true);
  webContents.emit('did-start-navigation', {
    isMainFrame: true,
    isSameDocument: false,
  });
  expect(keys.size).toBe(0);
  expect(forwardGroupMediaCommand({ command: 'next' })).toBe(false);
  watch(true);
  expect(forwardGroupMediaCommand({ command: 'next' })).toBe(true);
  expect(webContents.send).toHaveBeenCalledTimes(1);
});

it('does not release another app’s keys when the OS refuses a registration', () => {
  register.mockImplementationOnce(() => false);
  watch(true);
  watch(false);
  expect(unregister.mock.calls.map(([key]) => key)).not.toContain(
    'MediaPlayPause',
  );
});
