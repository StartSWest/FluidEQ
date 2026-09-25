/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The LAN link, and the `ws` it brings with it, is built by the first thing
 * that needs it rather than at every launch: most sessions never share audio.
 */

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const mockCreateLan = jest.fn();

jest.mock('electron', () => ({
  BrowserWindow: class {},
  ipcMain: {
    handle: jest.fn(
      (channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      },
    ),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
}));

const lan = {
  restoreJoin: jest.fn(),
  sendAudio: jest.fn(),
  sendSignal: jest.fn(),
  setStreamMode: jest.fn(),
  startHost: jest.fn(),
  stop: jest.fn(),
};

jest.mock('../../../main/remoteAudioLan', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockCreateLan(...args),
}));
jest.mock('../../../main/remoteAudioCredentials', () => ({
  createRemoteAudioCredentialStore: jest.fn(() => ({
    activate: jest.fn(),
    clear: jest.fn(),
    pause: jest.fn(),
    read: jest.fn(),
    readListener: jest.fn(),
    readSender: jest.fn(),
    role: jest.fn(),
    write: jest.fn(),
  })),
}));
jest.mock('../../../main/ipc/dspHost', () => ({
  setDspHostRawSharing: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line import/first -- the mocks above must be in place first
import { registerRemoteAudioIpc } from '../../../main/ipc/remoteAudio';

beforeEach(() => {
  handlers.clear();
  jest.clearAllMocks();
  mockCreateLan.mockReturnValue(lan);
});

it('builds no LAN link while nothing has asked for one, not even to quit', () => {
  const stopAll = registerRemoteAudioIpc({
    getMainWindow: () => null,
    userDataDir: 'C:\\FluidEQ-test',
  });

  expect(handlers.size).toBeGreaterThan(0);
  expect(mockCreateLan).not.toHaveBeenCalled();

  stopAll();
  expect(mockCreateLan).not.toHaveBeenCalled();
  expect(lan.stop).not.toHaveBeenCalled();
});

it('builds it once, for the first thing that needs it, and keeps it', async () => {
  const stopAll = registerRemoteAudioIpc({
    getMainWindow: () => null,
    userDataDir: 'C:\\FluidEQ-test',
  });
  lan.startHost.mockResolvedValue({
    credentials: { port: 49_100, secret: 'secret' },
    details: { deviceName: 'HEADSET-PC', options: [] },
  });

  await handlers.get('remote-audio-lan-host')?.({}, false);
  await handlers.get('remote-audio-lan-stop')?.({}, 'pause');
  stopAll();

  expect(mockCreateLan).toHaveBeenCalledTimes(1);
  expect(lan.startHost).toHaveBeenCalledTimes(1);
  expect(lan.stop).toHaveBeenCalledTimes(2);
});
