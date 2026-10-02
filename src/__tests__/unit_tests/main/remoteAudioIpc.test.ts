/* FluidEQ — GPL-3.0-or-later */

/** @jest-environment node */

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const mockStartRemoteAudioHostSession = jest.fn();
const mockRawSharing = jest.fn().mockResolvedValue(undefined);
const mockCapture = jest.fn().mockResolvedValue({ close: jest.fn() });

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
  forgetSender: jest.fn(),
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
  startNetworkCapture: (...args: unknown[]) => mockCapture(...args),
  startRawSourceCapture: jest.fn(),
}));
jest.mock('../../../main/remoteAudioHostSession', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockStartRemoteAudioHostSession(...args),
}));

jest.mock('../../../main/ipc/dspHost', () => ({
  setDspHostRawSharing: (enabled: boolean) => mockRawSharing(enabled),
}));

// eslint-disable-next-line import/first
import fs from 'fs';
// eslint-disable-next-line import/first
import os from 'os';
// eslint-disable-next-line import/first
import path from 'path';
// eslint-disable-next-line import/first
import type { BrowserWindow } from 'electron';
// eslint-disable-next-line import/first
import { registerRemoteAudioIpc } from '../../../main/ipc/remoteAudio';
// eslint-disable-next-line import/first
import createRemoteAudioLan from '../../../main/remoteAudioLan';
// eslint-disable-next-line import/first
import { encodePairingCode } from '../../../main/remoteAudioLanProtocol';

describe('remote audio IPC session persistence', () => {
  const originalPlatform = process.platform;
  beforeAll(() =>
    Object.defineProperty(process, 'platform', { value: 'win32' }),
  );
  afterAll(() =>
    Object.defineProperty(process, 'platform', { value: originalPlatform }),
  );
  beforeEach(() => {
    handlers.clear();
    jest.clearAllMocks();
    mockRawSharing.mockReset().mockResolvedValue(undefined);
    mockCapture.mockReset().mockResolvedValue({ close: jest.fn() });
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

/**
 * This computer's sound goes out once a link needs it: the computer it joined
 * is sent to from the moment it connects. What the network gets is the
 * Library untouched, so its player goes raw first — and a refusal there, or a
 * link ended while the capture was still starting, must leave neither the
 * raw player nor a capture behind.
 */
describe('the network capture a link starts', () => {
  const originalPlatform = process.platform;
  // The switches are remembered on disk; never in a real profile.
  let userDataDir = '';
  beforeAll(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-links-'));
  });
  afterAll(() => fs.rmSync(userDataDir, { recursive: true, force: true }));
  const sent: [string, unknown][] = [];
  const window = {
    isDestroyed: () => false,
    webContents: {
      send: (channel: string, value: unknown) => sent.push([channel, value]),
    },
  };

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    handlers.clear();
    jest.clearAllMocks();
    sent.length = 0;
    mockRawSharing.mockReset().mockResolvedValue(undefined);
    mockCapture.mockReset().mockResolvedValue({ close: jest.fn() });
    lan.restoreJoin.mockResolvedValue({
      peerId: 'peer',
      deviceName: 'Receiver',
    });
    registerRemoteAudioIpc({
      getMainWindow: () => window as unknown as BrowserWindow,
      userDataDir,
    });
  });
  afterEach(() =>
    Object.defineProperty(process, 'platform', { value: originalPlatform }),
  );

  /** Joins, then the joined computer connects, as the transport reports it. */
  const linkJoined = async () => {
    const code = encodePairingCode(
      '192.168.1.20',
      49100,
      'c'.repeat(43),
      'Receiver',
    );
    await handlers.get('remote-audio-lan-join')?.({}, code);
    const [onSignal] = jest.mocked(createRemoteAudioLan).mock.calls[0];
    onSignal({
      peerId: 'peer',
      signal: { kind: 'peer-ready', deviceName: 'Receiver', joined: true },
    });
    return onSignal;
  };
  /** Lets the chain of promises a link starts run to its end. */
  const settle = async () => {
    for (let step = 0; step < 20; step += 1) {
      // eslint-disable-next-line no-await-in-loop -- one microtask per step, on purpose
      await Promise.resolve();
    }
  };

  it('starts sending to the computer it joined, its Library raw first', async () => {
    await linkJoined();
    await settle();
    expect(mockRawSharing).toHaveBeenCalledWith(true);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(sent).toContainEqual(['remote-audio-lan-sending', true]);
    expect(lan.sendSignal).toHaveBeenCalledWith({
      peerId: 'peer',
      signal: {
        kind: 'stream-mode',
        mode: 'video',
        duplex: { sends: true, plays: true },
      },
    });
  });

  it('puts the Library back and says so when it cannot go raw', async () => {
    mockRawSharing.mockImplementation(async (enabled: boolean) => {
      if (enabled) {
        throw new Error('bypass refused');
      }
    });
    await linkJoined();
    await settle();
    expect(mockRawSharing).toHaveBeenLastCalledWith(false);
    expect(mockCapture).not.toHaveBeenCalled();
    expect(sent).toContainEqual(['remote-audio-lan-sending-failed', undefined]);
  });

  it('closes a capture that finishes starting after the link ended', async () => {
    let finishCapture: (capture: { close: () => void }) => void = () =>
      undefined;
    mockCapture.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishCapture = resolve;
        }),
    );
    const onSignal = await linkJoined();
    await settle();
    expect(mockCapture).toHaveBeenCalledTimes(1);
    onSignal({ peerId: 'peer', signal: { kind: 'stop' } });
    const close = jest.fn();
    finishCapture({ close });
    await settle();
    expect(close).toHaveBeenCalledTimes(1);
    expect(mockRawSharing).toHaveBeenLastCalledWith(false);
    expect(sent).not.toContainEqual(['remote-audio-lan-sending', true]);
  });

  it('never plays the sound of a computer whose "Play it here" is off', async () => {
    await linkJoined();
    await handlers.get('remote-audio-lan-switches')?.({}, 'Receiver', {
      send: true,
      play: false,
    });
    const [, onAudio] = jest.mocked(createRemoteAudioLan).mock.calls[0];
    onAudio({
      channels: 2,
      frames: 1,
      pcm: new Float32Array([0.5, 0.5]).buffer,
      peerId: 'peer',
      sampleRate: 48_000,
      sequence: 1,
    });
    expect(sent.map(([channel]) => channel)).not.toContain(
      'remote-audio-lan-streaming',
    );
  });

  it('refuses switches that are not two yes-or-noes', async () => {
    expect(() =>
      handlers.get('remote-audio-lan-switches')?.({}, 'Receiver', {
        send: 'yes',
      }),
    ).toThrow('Invalid Share Audio switches.');
  });
});
