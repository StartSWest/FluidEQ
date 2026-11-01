/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's live displays on the Mac (`main/macEngine/macMonitorIpc.ts`):
 * a port from the window's own top frame hears the core's sound — the one
 * tap every listener shares — and never a tap of its own. A new port
 * replaces the old one, and a port that goes stops listening.
 */
import { EventEmitter } from 'events';
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { MAC_AUDIO_CAPTURE_PORT } from 'common/macAudioCapture';
import type {
  ISystemSound,
  ISystemSoundListener,
} from 'core/systemSound/systemSound';
import registerMacMonitorIpc from 'main/macEngine/macMonitorIpc';
import onWindowMessage from 'main/ipc/windowMessages';

jest.mock('electron', () => ({ app: { once: jest.fn() } }));
jest.mock('electron-log', () => ({ warn: jest.fn() }));
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

const setUp = () => {
  (onWindowMessage as jest.Mock).mockClear();
  const listeners: ISystemSoundListener[] = [];
  const stops: jest.Mock[] = [];
  const systemSound: ISystemSound = {
    listen: jest.fn((listener: ISystemSoundListener) => {
      listeners.push(listener);
      const stop = jest.fn();
      stops.push(stop);
      return stop;
    }),
  };
  registerMacMonitorIpc(() => window, systemSound);
  const [[channel, receive]] = (onWindowMessage as jest.Mock).mock.calls;
  expect(channel).toBe(MAC_AUDIO_CAPTURE_PORT);
  const send = (port: FakePort, from: Partial<IpcMainEvent> = {}) =>
    (receive as (event: IpcMainEvent) => void)({
      sender: webContents,
      senderFrame: mainFrame,
      ports: [port],
      ...from,
    } as unknown as IpcMainEvent);
  return { systemSound, listeners, stops, send };
};

const BLOCK = {
  sampleRate: 48_000,
  channels: 2,
  frames: 480,
  sequence: 3,
  pcm: new Float32Array(960).buffer,
};

it('hands the window the core’s sound, ready first', () => {
  const { listeners, send } = setUp();
  const port = new FakePort();
  send(port);
  listeners[0].ready();
  listeners[0].audio(BLOCK);
  expect(port.postMessage).toHaveBeenNthCalledWith(1, { kind: 'ready' });
  expect(port.postMessage).toHaveBeenNthCalledWith(2, {
    kind: 'push',
    ...BLOCK,
    peerId: 'mac-loopback',
  });
});

it('says failed when the sound never came, lost when it went', () => {
  const { listeners, send } = setUp();
  const never = new FakePort();
  send(never);
  listeners[0].lost();
  expect(never.postMessage).toHaveBeenCalledWith({ kind: 'failed' });
  expect(never.close).toHaveBeenCalled();

  const went = new FakePort();
  send(went);
  listeners[1].ready();
  listeners[1].lost();
  expect(went.postMessage).toHaveBeenLastCalledWith({ kind: 'lost' });
});

it('stops listening when the port goes, or a new one replaces it', () => {
  const { stops, send } = setUp();
  const first = new FakePort();
  send(first);
  const second = new FakePort();
  send(second);
  expect(stops[0]).toHaveBeenCalledTimes(1);
  expect(first.close).toHaveBeenCalled();
  second.emit('close');
  expect(stops[1]).toHaveBeenCalledTimes(1);
});

it('hears nothing for a port from anywhere but the window’s top frame', () => {
  const { systemSound, send } = setUp();
  const fromFrame = new FakePort();
  send(fromFrame, { senderFrame: {} as never });
  expect(systemSound.listen).not.toHaveBeenCalled();
  expect(fromFrame.close).toHaveBeenCalled();
  // POSITIVE CONTROL: the same port from the top frame is heard.
  send(new FakePort());
  expect(systemSound.listen).toHaveBeenCalledTimes(1);
});
