/** @jest-environment node */
import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';
import ChannelEnum from '../../../common/channels';

const mockApp = Object.assign(new EventEmitter(), { quit: jest.fn() });
const mockIpc = new EventEmitter();
const mockDialog = jest.fn();
const mockFlush = jest.fn().mockResolvedValue(undefined);
jest.mock('electron', () => ({
  app: mockApp,
  ipcMain: mockIpc,
  dialog: { showMessageBox: (...args: unknown[]) => mockDialog(...args) },
}));
jest.mock('../../../main/asyncWriter', () => ({
  flushPendingWrites: () => mockFlush(),
}));
jest.mock('../../../main/tray', () => ({
  getTrayLocale: () => 'en',
  isAppQuitting: () => false,
}));
jest.mock('electron-log', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  transports: { file: { getFile: () => ({ path: 'C:/logs/main.log' }) } },
}));

// eslint-disable-next-line import/first -- Initialize the Electron lifecycle mock before importing its subscriber.
import {
  installWindowRecovery,
  recordFailure,
} from '../../../main/crashRecovery';

const url = 'file:///app/index.html';
const setup = (showFailureLog = false) => {
  const order: string[] = [];
  const state = { url, crashed: false };
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: {},
    isDestroyed: () => false,
    isCrashed: () => state.crashed,
    isLoading: () => false,
    getURL: () => state.url,
    send: jest.fn(),
    loadURL: jest.fn(async (next: string) => {
      order.push(next);
      state.url = next;
    }),
  });
  const window = {
    webContents: contents,
    isDestroyed: () => false,
  } as unknown as BrowserWindow;
  const stop = jest.fn(async () => {
    order.push('stop');
  });
  const recover = installWindowRecovery(window, url, stop, showFailureLog);
  return { contents, recover, stop, order, state };
};
beforeEach(() => {
  mockApp.removeAllListeners();
  mockIpc.removeAllListeners();
  mockDialog.mockReset().mockResolvedValue({ response: 1 });
  mockApp.quit.mockClear();
  mockFlush.mockClear();
});

it('destroys the old document and stops playback before reloading; a live page keeps its own crash screen when retries run out', async () => {
  const { recover, contents, order, stop } = setup();
  await recover();
  expect(order).toEqual(['about:blank', 'stop', url]);
  expect(mockFlush).toHaveBeenCalledTimes(1);
  await recover();
  await recover();
  expect(
    contents.loadURL.mock.calls.filter(([next]) => next === url),
  ).toHaveLength(2);
  expect(stop).toHaveBeenCalledTimes(3);
  // The page survived, so it is told rather than covered by a native box, and
  // the document it is still showing is not torn down under it.
  expect(contents.send).toHaveBeenCalledWith(
    ChannelEnum.RECOVERY_STATUS,
    'blocked',
    '',
  );
  expect(contents.getURL()).toBe(url);
  expect(mockDialog).not.toHaveBeenCalled();
  expect(mockApp.quit).not.toHaveBeenCalled();
});

it('falls back to the native box when the page cannot show anything', async () => {
  const { recover, state, contents } = setup();
  await recover();
  await recover();
  state.crashed = true;
  await recover();
  expect(contents.send).not.toHaveBeenCalled();
  expect(mockDialog).toHaveBeenCalledTimes(1);
  expect(mockApp.quit).toHaveBeenCalledTimes(1);
});

it('ignores unrelated frames and cleans up recovery listeners on destruction', async () => {
  const { contents } = setup();
  mockIpc.emit(
    ChannelEnum.RECOVER_WINDOW,
    { sender: contents, senderFrame: {} },
    ['automatic'],
  );
  mockIpc.emit(
    ChannelEnum.RECOVER_WINDOW,
    { sender: contents, senderFrame: contents.mainFrame },
    ['invalid'],
  );
  expect(contents.loadURL).not.toHaveBeenCalled();
  contents.emit('render-process-gone', {}, { reason: 'clean-exit' });
  expect(contents.loadURL).not.toHaveBeenCalled();
  contents.emit('destroyed');
  expect(mockIpc.listenerCount(ChannelEnum.RECOVER_WINDOW)).toBe(0);
  expect(mockApp.listenerCount('before-quit')).toBe(0);
});

it('does not reload when playback shutdown fails', async () => {
  const { recover, stop, contents } = setup();
  stop.mockRejectedValue(new Error('stop failed'));
  await recover();
  expect(contents.loadURL.mock.calls).toEqual([['about:blank']]);
  expect(mockDialog).toHaveBeenCalledTimes(1);
});

it('keeps the user-facing explanation, and no log, in a packaged build', async () => {
  const { recover, state, contents } = setup();
  recordFailure('[renderer] Crashed while rendering', 'TypeError: boom');
  await recover();
  await recover();
  state.crashed = true;
  await recover();
  const [, options] = mockDialog.mock.calls[0] as [unknown, { detail: string }];
  expect(options.detail).toBe(
    'FluidEQ could not recover safely. Automatic retries have stopped. You can try reloading or quit. Unsaved work may be lost.',
  );
  expect(contents.send).not.toHaveBeenCalled();
});

it('sends the renderer error, the exit reason and the log path to the crash screen in a debug build', async () => {
  const { recover, contents } = setup(true);
  recordFailure(
    '[renderer] Crashed while rendering',
    'TypeError: boom\n    at Graph (Graph.tsx:12)',
  );
  await recover();
  await recover();
  // The exit event spends the last automatic attempt itself, so wait on the
  // message it ends with rather than on a number of ticks.
  const sent = new Promise<void>((resolve) => {
    contents.send.mockImplementation(() => resolve());
  });
  contents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 5 });
  await sent;
  expect(mockDialog).not.toHaveBeenCalled();
  const [, state, history] = contents.send.mock.calls[0] as [
    string,
    string,
    string,
  ];
  expect(state).toBe('blocked');
  expect(history).toMatch(
    /\[renderer\] Crashed while rendering\nTypeError: boom\n {4}at Graph \(Graph\.tsx:12\)/,
  );
  expect(history).toContain('Renderer process gone: crashed (exit code 5)');
  expect(history).toContain('Automatic window recovery budget exhausted');
  expect(history.endsWith('C:/logs/main.log')).toBe(true);
});
