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
  start: jest.fn(),
  join: jest.fn(),
  unlink: jest.fn(),
  retry: jest.fn(),
  sendAudio: jest.fn(),
  sendSignal: jest.fn(),
  setStreamMode: jest.fn(),
  stop: jest.fn(),
};
const credentials = {
  read: jest.fn(),
  writeIdentity: jest.fn(),
  addJoin: jest.fn(),
  removeJoin: jest.fn(),
  revoke: jest.fn(),
  unrevoke: jest.fn(),
  clear: jest.fn(),
};
const hostSession = {
  credentials: { port: 49_100, secret: 's'.repeat(43) },
  details: { deviceName: 'HEADSET-PC', computerId: 'h'.repeat(32) },
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

describe('Share Audio all to all: one code, every link kept', () => {
  const originalPlatform = process.platform;
  const sent: [string, unknown][] = [];
  const window = {
    isDestroyed: () => false,
    webContents: {
      send: (channel: string, value: unknown) => sent.push([channel, value]),
    },
  };
  const codeOf = (secret: string, name: string) =>
    encodePairingCode(['192.168.1.20'], 49_100, secret, name);

  beforeAll(() =>
    Object.defineProperty(process, 'platform', { value: 'win32' }),
  );
  afterAll(() =>
    Object.defineProperty(process, 'platform', { value: originalPlatform }),
  );
  beforeEach(() => {
    handlers.clear();
    jest.clearAllMocks();
    sent.length = 0;
    credentials.read.mockReturnValue({ joins: [], revoked: [] });
    mockStartRemoteAudioHostSession.mockResolvedValue(hostSession);
    mockRawSharing.mockReset().mockResolvedValue(undefined);
    mockCapture.mockReset().mockResolvedValue({ close: jest.fn() });
    registerRemoteAudioIpc({
      getMainWindow: () => window as unknown as BrowserWindow,
      userDataDir: 'C:\\FluidEQ-test',
    });
  });

  it('listens on its code and goes back to every computer pasted here', async () => {
    const first = codeOf('a'.repeat(43), 'DESK');
    const second = codeOf('b'.repeat(43), 'LAPTOP');
    credentials.read.mockReturnValue({
      joins: [first, second],
      revoked: [],
    });

    await handlers.get('remote-audio-lan-start')?.({}, true);

    expect(credentials.writeIdentity).toHaveBeenCalledWith(
      hostSession.credentials,
    );
    expect(lan.join).toHaveBeenCalledWith(first, false);
    expect(lan.join).toHaveBeenCalledWith(second, false);
  });

  it('opening the page again keeps every link up', async () => {
    credentials.read.mockReturnValue({
      joins: [codeOf('a'.repeat(43), 'DESK')],
      revoked: [],
    });
    await handlers.get('remote-audio-lan-start')?.({}, true);
    await handlers.get('remote-audio-lan-start')?.({}, false);

    expect(createRemoteAudioLan).toHaveBeenCalledTimes(1);
    expect(lan.stop).not.toHaveBeenCalled();
  });

  it('saves a pasted code beside the others and links it as a paste', async () => {
    const code = codeOf('c'.repeat(43), 'HEADSET-PC');
    lan.join.mockReturnValue({
      computerId: 'c-id',
      deviceName: 'HEADSET-PC',
    });

    await expect(
      handlers.get('remote-audio-lan-join')?.({}, ` ${code} `),
    ).resolves.toEqual({ computerId: 'c-id', deviceName: 'HEADSET-PC' });

    expect(lan.join).toHaveBeenCalledWith(code, true);
    expect(credentials.addJoin).toHaveBeenCalledWith(
      code,
      expect.any(Function),
    );
    expect(sent.map(([channel]) => channel)).toContain(
      'remote-audio-lan-joins',
    );
  });

  it('saves nothing for a code that is not one', async () => {
    lan.join.mockImplementation(() => {
      throw new Error('Invalid FluidEQ LAN pairing code.');
    });

    await expect(
      handlers.get('remote-audio-lan-join')?.({}, 'not a code'),
    ).rejects.toThrow('Invalid FluidEQ LAN pairing code.');
    expect(credentials.addJoin).not.toHaveBeenCalled();
  });

  it('unlinks one computer and nothing else', async () => {
    await handlers.get('remote-audio-lan-unlink')?.({}, { peerId: 'peer-2' });

    expect(lan.unlink).toHaveBeenCalledWith({ peerId: 'peer-2' });
    expect(lan.stop).not.toHaveBeenCalled();
  });

  it('tells a new window about the links already up, but never a past press', async () => {
    credentials.read.mockReturnValue({
      joins: [codeOf('d'.repeat(43), 'DESK')],
      revoked: [],
    });
    await handlers.get('remote-audio-lan-start')?.({}, true);
    const [onSignal] = jest.mocked(createRemoteAudioLan).mock.calls[0];
    onSignal({
      peerId: 'peer',
      signal: { kind: 'peer-ready', deviceName: 'DESK', computerId: 'd-id' },
    });
    onSignal({
      peerId: 'peer',
      signal: {
        kind: 'now-playing',
        started: true,
        singlePlayer: true,
        playing: {
          title: 'Song',
          isPlaying: true,
          positionMs: 0,
          durationMs: 1_000,
          canNext: false,
          canPrevious: false,
          canStep: false,
          canStop: false,
        },
      },
    });

    const again = (await handlers.get('remote-audio-lan-start')?.(
      {},
      true,
    )) as { links: { signal: Record<string, unknown> }[] };

    expect(again.links.map(({ signal }) => signal.kind)).toEqual([
      'peer-ready',
      'now-playing',
    ]);
    expect(again.links[1].signal.started).toBeUndefined();
    expect(again.links[1].signal.singlePlayer).toBeUndefined();

    onSignal({ peerId: 'peer', signal: { kind: 'stop' } });
    const after = (await handlers.get('remote-audio-lan-start')?.(
      {},
      true,
    )) as { links: unknown[] };
    expect(after.links).toEqual([]);
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
    // Each test's switches are its own, not the last test's saved ones.
    fs.rmSync(path.join(userDataDir, 'remote-audio-links.json'), {
      force: true,
    });
    mockRawSharing.mockReset().mockResolvedValue(undefined);
    mockCapture.mockReset().mockResolvedValue({ close: jest.fn() });
    credentials.read.mockReturnValue({ joins: [], revoked: [] });
    mockStartRemoteAudioHostSession.mockResolvedValue(hostSession);
    lan.join.mockReturnValue({ computerId: 'r-id', deviceName: 'Receiver' });
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

  it('tells a replacement window that its existing capture is still sending', async () => {
    await linkJoined();
    await settle();
    sent.length = 0;
    await handlers.get('remote-audio-lan-start')?.({}, true);
    expect(sent).toContainEqual(['remote-audio-lan-sending', true]);
    expect(mockCapture).toHaveBeenCalledTimes(1);
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
      paused: false,
      volume: 1,
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

  /** One block of the joined computer's sound, as the transport hands it. */
  const arrive = (sequence: number) => {
    const [, onAudio] = jest.mocked(createRemoteAudioLan).mock.calls[0];
    onAudio({
      channels: 2,
      frames: 1,
      pcm: new Float32Array([0.5, 0.5]).buffer,
      peerId: 'peer',
      sampleRate: 48_000,
      sequence,
    });
  };
  const arrivalsTold = () =>
    sent.filter(([channel]) => channel === 'remote-audio-lan-streaming').length;
  const theySay = (
    onSignal: Awaited<ReturnType<typeof linkJoined>>,
    duplex: { sends: boolean; plays: boolean; paused?: boolean },
  ) =>
    onSignal({
      peerId: 'peer',
      signal: { kind: 'stream-mode', mode: 'video', duplex },
    });

  it('tells the window again when the sound comes back after the other computer paused', async () => {
    const onSignal = await linkJoined();
    arrive(1);
    arrive(2);
    expect(arrivalsTold()).toBe(1);
    // The window stops showing it arriving at this word (`acceptSignal`).
    theySay(onSignal, { sends: false, plays: false, paused: true });
    theySay(onSignal, { sends: true, plays: true });
    arrive(3);
    expect(arrivalsTold()).toBe(2);
  });

  it('drops what was decoded after the other computer said it stopped', async () => {
    const onSignal = await linkJoined();
    arrive(1);
    theySay(onSignal, { sends: false, plays: false, paused: true });
    // A block decoded after the word was read: the tail of the pause. Told,
    // it would show the sound arriving again just after the pause.
    arrive(2);
    expect(arrivalsTold()).toBe(1);
  });

  it('tells the window again when "Play it here" comes back on', async () => {
    await linkJoined();
    arrive(1);
    const choose = handlers.get('remote-audio-lan-switches');
    const on = { send: true, play: true, paused: false, volume: 1 };
    // Nothing arrives in between: the other computer was told to stop.
    await choose?.({}, 'Receiver', { ...on, paused: true });
    await choose?.({}, 'Receiver', on);
    arrive(2);
    expect(arrivalsTold()).toBe(2);
  });

  it('starts every new connection playing, whatever Pause was left on', async () => {
    const onSignal = await linkJoined();
    const choose = handlers.get('remote-audio-lan-switches');
    await choose?.({}, 'Receiver', {
      send: false,
      play: true,
      paused: true,
      volume: 0.4,
    });
    onSignal({ peerId: 'peer', signal: { kind: 'stop' } });
    onSignal({
      peerId: 'peer-again',
      signal: { kind: 'peer-ready', deviceName: 'Receiver', joined: true },
    });
    expect(
      await handlers.get('remote-audio-lan-switches-for')?.({}, 'Receiver'),
    ).toEqual({ send: false, play: true, paused: false, volume: 0.4 });
  });

  it('refuses switches that are not two yes-or-noes', async () => {
    expect(() =>
      handlers.get('remote-audio-lan-switches')?.({}, 'Receiver', {
        send: 'yes',
      }),
    ).toThrow('Invalid Share Audio switches.');
  });
});
