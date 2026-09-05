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
jest.mock('electron-log', () => ({ error: jest.fn(), warn: jest.fn() }));

// eslint-disable-next-line import/first -- Initialize the Electron lifecycle mock before importing its subscriber.
import { installWindowRecovery } from '../../../main/crashRecovery';

const url = 'file:///app/index.html';
const setup = () => {
  const order: string[] = [];
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: {},
    isDestroyed: () => false,
    isCrashed: () => false,
    getURL: () => url,
    send: jest.fn(),
    loadURL: jest.fn(async (next: string) => {
      order.push(next);
    }),
  });
  const window = {
    webContents: contents,
    isDestroyed: () => false,
  } as unknown as BrowserWindow;
  const stop = jest.fn(async () => {
    order.push('stop');
  });
  const recover = installWindowRecovery(window, url, stop);
  return { contents, recover, stop, order };
};
beforeEach(() => {
  mockApp.removeAllListeners();
  mockIpc.removeAllListeners();
  mockDialog.mockReset().mockResolvedValue({ response: 1 });
  mockApp.quit.mockClear();
  mockFlush.mockClear();
});

it('destroys the old document and stops playback before reloading; repeated crashes reach a bounded retry choice', async () => {
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
