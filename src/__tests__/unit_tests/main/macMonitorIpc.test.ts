/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's live displays on the Mac (`main/macEngine/macMonitorIpc.ts`):
 * a port from the window's own top frame is handed to the core's services —
 * the one tap every listener shares — with every block named as the Mac's
 * own loopback. A new port ends the old one, the window's end going ends it,
 * and so does quitting.
 */
import { EventEmitter } from 'events';
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { app } from 'electron';
import { MAC_AUDIO_CAPTURE_PORT } from 'common/macAudioCapture';
import type { ICorePort } from 'core/process/coreServices';
import registerMacMonitorIpc from 'main/macEngine/macMonitorIpc';
import onWindowMessage from 'main/ipc/windowMessages';

jest.mock('electron', () => ({ app: { once: jest.fn() } }));
jest.mock('main/ipc/windowMessages', () => ({
  __esModule: true,
  default: jest.fn(() => () => undefined),
}));

/**
 * A port as Electron's behaves: `close` here says nothing to this side, and
 * the `close` event is the window's end going.
 */
class FakePort extends EventEmitter {
  postMessage = jest.fn();

  start = jest.fn();

  close = jest.fn();
}

const mainFrame = {};
const webContents = { mainFrame };
const window = {
  webContents,
  isDestroyed: () => false,
} as unknown as BrowserWindow;

const originalPlatform = process.platform;
beforeAll(() =>
  Object.defineProperty(process, 'platform', { value: 'darwin' }),
);
afterAll(() =>
  Object.defineProperty(process, 'platform', { value: originalPlatform }),
);

/** What the core's services were handed, and the close each one listens for. */
const setUp = () => {
  (onWindowMessage as jest.Mock).mockClear();
  jest.mocked(app.once).mockClear();
  const attached: { port: ICorePort; gone: jest.Mock; closed: jest.Mock }[] =
    [];
  registerMacMonitorIpc(
    () => window,
    (port, gone) => {
      const closed = jest.fn();
      port.on('close', closed);
      attached.push({ port, gone: jest.fn(gone), closed });
    },
  );
  const [[channel, receive]] = (onWindowMessage as jest.Mock).mock.calls;
  expect(channel).toBe(MAC_AUDIO_CAPTURE_PORT);
  const send = (port: FakePort, from: Partial<IpcMainEvent> = {}) =>
    (receive as (event: IpcMainEvent) => void)({
      sender: webContents,
      senderFrame: mainFrame,
      ports: [port],
      ...from,
    } as unknown as IpcMainEvent);
  return { attached, send };
};

const BLOCK = {
  sampleRate: 48_000,
  channels: 2,
  frames: 480,
  sequence: 3,
  pcm: new Float32Array(960).buffer,
};

it('names every block the core sends as the Mac’s own loopback', () => {
  const { attached, send } = setUp();
  const port = new FakePort();
  send(port);
  const [{ port: core }] = attached;
  core.start();
  core.postMessage({ kind: 'ready' });
  core.postMessage({ kind: 'push', ...BLOCK });
  expect(port.start).toHaveBeenCalled();
  expect(port.postMessage).toHaveBeenNthCalledWith(1, { kind: 'ready' });
  expect(port.postMessage).toHaveBeenNthCalledWith(2, {
    kind: 'push',
    ...BLOCK,
    peerId: 'mac-loopback',
  });
});

it('ends the old port when a new one replaces it, and the window’s end ends it too', () => {
  const { attached, send } = setUp();
  send(new FakePort());
  const second = new FakePort();
  send(second);
  expect(attached[0].closed).toHaveBeenCalledTimes(1);
  expect(attached[1].closed).not.toHaveBeenCalled();
  second.emit('close');
  second.emit('close');
  expect(attached[1].closed).toHaveBeenCalledTimes(1);
});

it('ends the port in use when the app quits', () => {
  const { attached, send } = setUp();
  send(new FakePort());
  const quit = jest.mocked(app.once).mock.calls[0][1] as () => void;
  quit();
  expect(attached[0].closed).toHaveBeenCalledTimes(1);
});

it('hands nothing over for a port from anywhere but the window’s top frame', () => {
  const { attached, send } = setUp();
  const fromFrame = new FakePort();
  send(fromFrame, { senderFrame: {} as never });
  expect(attached).toHaveLength(0);
  expect(fromFrame.close).toHaveBeenCalled();
  // POSITIVE CONTROL: the same port from the top frame is handed over.
  send(new FakePort());
  expect(attached).toHaveLength(1);
});
