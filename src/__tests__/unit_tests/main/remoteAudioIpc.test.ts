/* FluidEQ — GPL-3.0-or-later */

/** @jest-environment node */

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const mockStartRemoteAudioHostSession = jest.fn();

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
  default: (...args: unknown[]) => mockStartRemoteAudioHostSession(...args),
}));

// eslint-disable-next-line import/first
import { registerRemoteAudioIpc } from '../../../main/ipc/remoteAudio';
// eslint-disable-next-line import/first
import { encodePairingCode } from '../../../main/remoteAudioLanProtocol';

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

  it('does not reactivate a listener restore after a manual stop', async () => {
    credentials.read.mockReturnValue({
      port: 49_100,
      role: 'listener',
      secret: 'saved-secret',
    });
    let finishHost: ((value: unknown) => void) | undefined;
    mockStartRemoteAudioHostSession.mockReturnValue(
      new Promise((resolve) => {
        finishHost = resolve;
      }),
    );
    const restore = handlers.get('remote-audio-lan-restore');
    const stop = handlers.get('remote-audio-lan-stop');

    const restoring = restore?.({}, 'video');
    await stop?.({}, 'pause');
    finishHost?.({
      credentials: { port: 49_100, secret: 'saved-secret' },
      details: { deviceName: 'HEADSET-PC', options: [] },
    });
    await restoring;

    expect(credentials.pause).toHaveBeenCalledTimes(1);
    expect(credentials.write).not.toHaveBeenCalled();
  });

  it('does not reactivate a sender restore after a manual stop', async () => {
    credentials.read.mockReturnValue({ role: 'sender' });
    credentials.readSender.mockReturnValue({ code: 'saved-code' });
    let finishJoin: ((value: unknown) => void) | undefined;
    lan.restoreJoin.mockReturnValue(
      new Promise((resolve) => {
        finishJoin = resolve;
      }),
    );
    const restore = handlers.get('remote-audio-lan-restore');
    const stop = handlers.get('remote-audio-lan-stop');

    const restoring = restore?.({}, 'video');
    await stop?.({}, 'pause');
    finishJoin?.({
      deviceName: 'HEADSET-PC',
      peerId: 'peer-after-stop',
    });
    await restoring;

    expect(credentials.pause).toHaveBeenCalledTimes(1);
    expect(credentials.activate).not.toHaveBeenCalled();
  });

  it('keeps a validated sender pairing active while its receiver is offline', async () => {
    const code = encodePairingCode(
      '192.168.1.20',
      49_100,
      'c'.repeat(43),
      'HEADSET-PC',
    );
    let finishJoin: ((value: unknown) => void) | undefined;
    lan.restoreJoin.mockReturnValue(
      new Promise((resolve) => {
        finishJoin = resolve;
      }),
    );
    const join = handlers.get('remote-audio-lan-join');

    const connecting = join?.({}, code, 'video');
    await Promise.resolve();

    expect(credentials.write).toHaveBeenCalledWith({
      role: 'sender',
      code,
    });
    expect(lan.restoreJoin).toHaveBeenCalledWith(code);
    finishJoin?.({ deviceName: 'HEADSET-PC', peerId: 'peer-1' });
    await connecting;
  });

  it('cancels that pending sender retry only after an explicit stop', async () => {
    const code = encodePairingCode(
      '192.168.1.20',
      49_100,
      'c'.repeat(43),
      'HEADSET-PC',
    );
    let rejectJoin: ((error: Error) => void) | undefined;
    lan.restoreJoin.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectJoin = reject;
      }),
    );
    const join = handlers.get('remote-audio-lan-join');
    const stop = handlers.get('remote-audio-lan-stop');

    const connecting = join?.({}, code, 'video') as Promise<unknown>;
    const connectingResult = connecting.catch((error: unknown) => error);
    await Promise.resolve();
    await stop?.({}, 'pause');
    rejectJoin?.(new Error('stopped'));
    await expect(connectingResult).resolves.toThrow('stopped');

    expect(lan.stop).toHaveBeenCalledTimes(1);
    expect(credentials.pause).toHaveBeenCalledTimes(1);
    expect(credentials.activate).not.toHaveBeenCalled();
  });

  it('does not let a replaced listener start stop the newer session', async () => {
    let finishHost: ((value: unknown) => void) | undefined;
    mockStartRemoteAudioHostSession.mockReturnValue(
      new Promise((resolve) => {
        finishHost = resolve;
      }),
    );
    const host = handlers.get('remote-audio-lan-host');
    const stop = handlers.get('remote-audio-lan-stop');

    const starting = host?.({}, false);
    await stop?.({}, 'pause');
    finishHost?.({
      credentials: { port: 49_100, secret: 'saved-secret' },
      details: { deviceName: 'HEADSET-PC', options: [] },
    });

    await expect(starting).rejects.toThrow('LAN audio session was replaced.');
    expect(lan.stop).toHaveBeenCalledTimes(1);
  });
});
