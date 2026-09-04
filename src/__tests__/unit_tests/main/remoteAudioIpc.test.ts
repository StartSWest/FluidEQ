/* FluidEQ — GPL-3.0-or-later */

/** @jest-environment node */

const handlers = new Map<string, (...args: unknown[]) => unknown>();

jest.mock('electron', () => ({
  BrowserWindow: class {},
  ipcMain: {
    handle: jest.fn(
      (channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      },
    ),
    on: jest.fn(),
  },
}));

const lan = {
  join: jest.fn(),
  restoreJoin: jest.fn(),
  sendAudio: jest.fn(),
  sendSignal: jest.fn(),
  setStreamMode: jest.fn(),
  startHost: jest.fn(),
  stop: jest.fn(),
};
const credentials = {
  activate: jest.fn(),
  clear: jest.fn(),
  pause: jest.fn(),
  read: jest.fn(),
  readListener: jest.fn(),
  readSender: jest.fn(),
  role: jest.fn(),
  write: jest.fn(),
};

jest.mock('../../../main/remoteAudioLan', () => ({
  __esModule: true,
  default: jest.fn(() => lan),
}));
jest.mock('../../../main/remoteAudioCredentials', () => ({
  createRemoteAudioCredentialStore: jest.fn(() => credentials),
}));
jest.mock('../../../main/remoteAudioCapture', () => ({
  startRemoteAudioCapture: jest.fn(),
}));
jest.mock('../../../main/remoteAudioHostSession', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// eslint-disable-next-line import/first
import { registerRemoteAudioIpc } from '../../../main/ipc/remoteAudio';

describe('remote audio IPC session persistence', () => {
  beforeEach(() => {
    handlers.clear();
    jest.clearAllMocks();
    registerRemoteAudioIpc({
      getMainWindow: () => null,
      userDataDir: 'C:\\FluidEQ-test',
    });
  });

  it('pauses automatic restore without deleting credentials on manual stop', async () => {
    const stop = handlers.get('remote-audio-lan-stop');

    await stop?.({}, 'pause');

    expect(lan.stop).toHaveBeenCalledTimes(1);
    expect(credentials.pause).toHaveBeenCalledTimes(1);
    expect(credentials.clear).not.toHaveBeenCalled();
  });

  it('treats the previous renderer stop value as a manual pause', async () => {
    const stop = handlers.get('remote-audio-lan-stop');

    await stop?.({}, false);

    expect(credentials.pause).toHaveBeenCalledTimes(1);
    expect(credentials.clear).not.toHaveBeenCalled();
  });

  it('keeps automatic restore active for lifecycle teardown', async () => {
    const stop = handlers.get('remote-audio-lan-stop');

    await stop?.({}, 'keep-active');

    expect(credentials.pause).not.toHaveBeenCalled();
    expect(credentials.clear).not.toHaveBeenCalled();
  });

  it('deletes pairing material only for an explicit forget action', async () => {
    const stop = handlers.get('remote-audio-lan-stop');

    await stop?.({}, 'forget');

    expect(credentials.clear).toHaveBeenCalledTimes(1);
    expect(credentials.pause).not.toHaveBeenCalled();
  });
});
