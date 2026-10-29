/* FluidEQ — GPL-3.0-or-later */
/** @jest-environment node */
import {
  createAudioRuntime,
  failureReason,
  type IAudioRuntimeDeps,
} from '../../../main/shareAudio/runtime';
import { createAudioTelemetry } from '../../../main/shareAudio/telemetry';
import type {
  TAudioRequest,
  TAudioResponse,
  IAudioMethods,
  TAudioMethod,
} from '../../../main/shareAudio/protocol';
import type {
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
} from '../../../common/remoteAudio';
import type { IRemotePlaybackMeter } from '../../../common/remoteAudioPlayback';
import type { ILanLinkBook } from '../../../main/remoteAudioLanTypes';

const chunk = (peerId = 'one', sequence = 0): ILanRemoteAudioChunk => ({
  peerId,
  sequence,
  channels: 2,
  frames: 240,
  sampleRate: 48000,
  pcm: new Float32Array(480).fill(0.25).buffer,
});
const setup = () => {
  const messages: TAudioResponse[] = [];
  const answers = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();
  let clock = 0;
  let capture: (audio: ILanRemoteAudioChunk) => void = () => undefined;
  let arriving: (audio: ILanRemoteAudioChunk) => void = () => undefined;
  let signal: (message: ILanRemoteAudioSignal) => void = () => undefined;
  let meter: (value: IRemotePlaybackMeter) => void = () => undefined;
  let playerFailed: () => void = () => undefined;
  let linkBook: ILanLinkBook | undefined;
  const player = {
    push: jest.fn(),
    remove: jest.fn(),
    reset: jest.fn(),
    setVolume: jest.fn(),
    setOutput: jest.fn(async () => undefined),
    close: jest.fn(async () => undefined),
  };
  const stopCapture = jest.fn();
  const openCapture = jest.fn(
    async (
      audio: (value: ILanRemoteAudioChunk) => void,
      _failed: () => void,
    ) => {
      capture = audio;
      return { close: stopCapture };
    },
  );
  const lan = {
    start: jest.fn(async () => ({
      credentials: { port: 9000, secret: 'fixture' },
      details: {
        code: 'fixture',
        deviceName: 'Fixture',
        computerId: 'fixture',
      },
    })),
    join: jest.fn(),
    unlink: jest.fn(),
    retry: jest.fn(),
    sendSignal: jest.fn(),
    sendAudio: jest.fn(),
    setStreamMode: jest.fn(),
    stop: jest.fn(),
  };
  const deps: IAudioRuntimeDeps = {
    post: (message) => {
      messages.push(message);
      if (message.type === 'answer') {
        const pending = answers.get(message.id);
        answers.delete(message.id);
        if (message.error) {
          pending?.reject(new Error(message.error));
        } else {
          pending?.resolve(message.value);
        }
      }
      if (message.type === 'event' && message.credit === 'control') {
        queueMicrotask(() => runtime({ type: 'credit', key: 'control' }));
      }
    },
    now: () => clock,
    createLan: (emitSignal, emitAudio, _emitError, _emitNetwork, book) => {
      signal = emitSignal;
      arriving = emitAudio;
      linkBook = book;
      return lan;
    },
    startCapture: openCapture,
    startPlayback: async (onMeter, failed) => {
      meter = onMeter;
      playerFailed = failed;
      return player;
    },
    leaseHelper: jest.fn(),
    helperPid: () => undefined,
  };
  const runtime = createAudioRuntime(deps);
  let next = 0;
  const request = <K extends TAudioMethod>(
    method: K,
    ...args: IAudioMethods[K]['args']
  ): Promise<IAudioMethods[K]['result']> => {
    next += 1;
    const id = next;
    return new Promise((resolve, reject) => {
      answers.set(id, {
        resolve: (value) => resolve(value as IAudioMethods[K]['result']),
        reject,
      });
      runtime({ type: 'request', id, method, args } as TAudioRequest);
    });
  };
  return {
    messages,
    request,
    runtime,
    lan,
    player,
    stopCapture,
    openCapture,
    capture: (audio: ILanRemoteAudioChunk) => {
      clock += 5;
      capture(audio);
    },
    arrive: (audio: ILanRemoteAudioChunk) => arriving(audio),
    signal: (message: ILanRemoteAudioSignal) => signal(message),
    meter: (value: IRemotePlaybackMeter) => meter(value),
    failPlayer: () => playerFailed(),
    book: () => {
      if (!linkBook) {
        throw new Error('Fixture network was not started.');
      }
      return linkBook;
    },
  };
};

it('keeps send and receive PCM inside the audio owner while the UI withholds every meter credit', async () => {
  const fixture = setup();
  await fixture.request('lan.start', undefined, { revoked: [], links: [] });
  await fixture.request('playback.start');
  await fixture.request('routing', {
    targets: ['one', 'two'],
    receive: [{ peerId: 'one', volume: 1 }],
  });
  await fixture.request('capture.start');
  for (let sequence = 0; sequence < 600; sequence += 1) {
    fixture.capture(chunk('', sequence));
    fixture.arrive(chunk('one', sequence));
  }
  expect(fixture.lan.sendAudio).toHaveBeenCalledTimes(1200);
  expect(fixture.player.push).toHaveBeenCalledTimes(600);
  expect(fixture.player.push.mock.calls[599][0].sequence).toBe(599);
  expect(
    fixture.messages.filter(
      (message) => message.type === 'event' && message.event.type === 'capture',
    ),
  ).toHaveLength(1);
  expect(
    fixture.messages.filter(
      (message) =>
        message.type === 'event' && message.event.type === 'streaming',
    ),
  ).toHaveLength(1);
});

it('preserves new links and revocations when a reopened page supplies an older disk snapshot', async () => {
  const fixture = setup();
  await fixture.request('lan.start', undefined, { revoked: [], links: [] });
  const book = fixture.book();
  const link = {
    computerId: 'a'.repeat(32),
    issuer: 'b'.repeat(32),
    secret: 'public-fixture-only'.padEnd(43, '_'),
    deviceName: 'Fixture peer',
    port: 9001,
    addresses: ['127.0.0.1'],
  };
  book.revoke('old-computer');
  book.saveGroupLink?.(link);
  await fixture.request('lan.start', undefined, { revoked: [], links: [] });
  expect(book.isRevoked('old-computer')).toBe(true);
  expect(book.groupLinks?.()).toEqual([link]);
  expect(fixture.lan.stop).not.toHaveBeenCalled();
});

it('keeps independent receive gains, removes disabled audio and reannounces a reloaded window', async () => {
  const fixture = setup();
  await fixture.request('lan.start', undefined, { revoked: [], links: [] });
  await fixture.request('playback.start');
  await fixture.request('routing', {
    targets: [],
    receive: [
      { peerId: 'one', volume: 0.5 },
      { peerId: 'two', volume: 1 },
    ],
  });
  const audio = chunk();
  fixture.arrive(audio);
  fixture.arrive(chunk('two'));
  fixture.arrive(chunk('three'));
  expect(fixture.player.push).toHaveBeenCalledTimes(2);
  expect(new Float32Array(fixture.player.push.mock.calls[0][0].pcm)[0]).toBe(
    0.125,
  );
  expect(new Float32Array(fixture.player.push.mock.calls[1][0].pcm)[0]).toBe(
    0.25,
  );
  expect(new Float32Array(audio.pcm)[0]).toBe(0.25);
  await fixture.request('routing', {
    targets: [],
    receive: [{ peerId: 'two', volume: 1 }],
  });
  fixture.arrive(chunk());
  expect(fixture.player.remove).toHaveBeenCalledWith('one');
  expect(fixture.player.push).toHaveBeenCalledTimes(2);
  await fixture.request('streams.replay');
  fixture.arrive(chunk('two'));
  expect(
    fixture.messages.filter(
      (message) =>
        message.type === 'event' && message.event.type === 'streaming',
    ),
  ).toHaveLength(3);
});

it('keeps the existing 64-computer revocation limit and refreshes a repeated unlink', async () => {
  const fixture = setup();
  await fixture.request('lan.start', undefined, { revoked: [], links: [] });
  const book = fixture.book();
  for (let index = 0; index < 64; index += 1) {
    book.revoke(String(index));
  }
  book.revoke('0');
  book.revoke('64');
  expect(book.isRevoked('0')).toBe(true);
  expect(book.isRevoked('1')).toBe(false);
  expect(book.isRevoked('64')).toBe(true);
});

it('rejects a capture that fails during its open and permits a clean retry', async () => {
  const fixture = setup();
  fixture.openCapture.mockImplementationOnce(async (_audio, failed) => {
    failed();
    return { close: fixture.stopCapture };
  });
  await expect(fixture.request('capture.start')).rejects.toThrow(
    'operation failed',
  );
  await fixture.request('lan.start', undefined, { revoked: [], links: [] });
  await fixture.request('routing', { targets: ['one'], receive: [] });
  await fixture.request('capture.start');
  fixture.capture(chunk());
  expect(fixture.openCapture).toHaveBeenCalledTimes(2);
  expect(fixture.stopCapture).toHaveBeenCalledTimes(1);
  expect(fixture.lan.sendAudio).toHaveBeenCalledTimes(1);
});

it('honors a remote pause before main processes its signal and preserves other links', async () => {
  const fixture = setup();
  await fixture.request('lan.start', undefined, { revoked: [], links: [] });
  await fixture.request('playback.start');
  await fixture.request('routing', {
    targets: [],
    receive: [
      { peerId: 'one', volume: 1 },
      { peerId: 'two', volume: 1 },
    ],
  });
  fixture.signal({
    peerId: 'one',
    signal: {
      kind: 'stream-mode',
      mode: 'video',
      duplex: { sends: false, plays: true },
    },
  });
  fixture.arrive(chunk());
  fixture.arrive(chunk('two'));
  expect(fixture.player.push).toHaveBeenCalledTimes(1);
  expect(fixture.player.push.mock.calls[0][0].peerId).toBe('two');
  await fixture.request('routing', {
    targets: [],
    receive: [
      { peerId: 'one', volume: 1 },
      { peerId: 'two', volume: 1 },
    ],
  });
  fixture.arrive(chunk());
  expect(fixture.player.push).toHaveBeenCalledTimes(1);
});

it('supplies a complete preview often enough for the existing 33 ms display pulls', async () => {
  const fixture = setup();
  const id = await fixture.request('capture.start');
  const emittedAt: number[] = [];
  let seen = 0;
  for (let sequence = 0; sequence < 200; sequence += 1) {
    fixture.capture(chunk('', sequence));
    const captures = fixture.messages.filter(
      (message) => message.type === 'event' && message.event.type === 'capture',
    );
    if (captures.length > seen) {
      emittedAt.push((sequence + 1) * 5);
      seen = captures.length;
      fixture.runtime({ type: 'credit', key: `capture:${id}` });
    }
  }
  expect(emittedAt.length).toBeGreaterThan(40);
  expect(
    emittedAt.slice(1).every((at, index) => at - emittedAt[index] <= 20),
  ).toBe(true);
});

it('does not let closing an old player close its replacement or stop the sending capture', async () => {
  const fixture = setup();
  await fixture.request('lan.start', undefined, { revoked: [], links: [] });
  const old = await fixture.request('playback.start');
  const current = await fixture.request('playback.start');
  await fixture.request('capture.start');
  await fixture.request('routing', {
    targets: ['one'],
    receive: [{ peerId: 'one', volume: 1 }],
  });
  await fixture.request('playback.close', old);
  fixture.capture(chunk());
  fixture.arrive(chunk());
  expect(fixture.lan.sendAudio).toHaveBeenCalledTimes(1);
  expect(fixture.player.push).toHaveBeenCalledTimes(1);
  expect(fixture.stopCapture).not.toHaveBeenCalled();
  await fixture.request('playback.close', current);
});

it('bounds stalled UI telemetry to one in flight plus the newest sample per lane', () => {
  const posted: TAudioResponse[] = [];
  const telemetry = createAudioTelemetry((message) => posted.push(message));
  for (let sequence = 0; sequence < 10000; sequence += 1) {
    telemetry.send('capture:1', {
      type: 'capture',
      id: 1,
      chunk: chunk('', sequence),
    });
  }
  expect(posted).toHaveLength(1);
  telemetry.credit('capture:1');
  expect(posted).toHaveLength(2);
  const latest = posted[1];
  expect(
    latest.type === 'event' &&
      latest.event.type === 'capture' &&
      latest.event.chunk.sequence,
  ).toBe(9999);
  telemetry.credit('capture:1');
  expect(posted).toHaveLength(2);
});

it('bounds reliable state events and retains their original order', () => {
  const posted: TAudioResponse[] = [];
  const telemetry = createAudioTelemetry((message) => posted.push(message));
  for (let index = 0; index < 129; index += 1) {
    telemetry.sendReliable({
      type: 'book',
      operation: 'forget',
      value: String(index),
    });
  }
  expect(posted).toHaveLength(1);
  expect(() => telemetry.sendReliable({ type: 'lan-failed' })).toThrow(
    'queue is full',
  );
  for (let index = 0; index < 129; index += 1) {
    telemetry.credit('control');
  }
  expect(
    posted.map(
      (message) =>
        message.type === 'event' &&
        message.event.type === 'book' &&
        message.event.value,
    ),
  ).toEqual(Array.from({ length: 129 }, (_, index) => String(index)));
});

it('recovers a failed local player while the sending capture and network stay running', async () => {
  const fixture = setup();
  await fixture.request('lan.start', undefined, { revoked: [], links: [] });
  await fixture.request('playback.start');
  await fixture.request('capture.start');
  await fixture.request('routing', {
    targets: ['two'],
    receive: [{ peerId: 'one', volume: 1 }],
  });
  fixture.failPlayer();
  expect(() =>
    fixture.signal({ peerId: 'one', signal: { kind: 'stop' } }),
  ).not.toThrow();
  fixture.capture(chunk('', 0));
  expect(fixture.lan.sendAudio).toHaveBeenCalledTimes(1);
  expect(fixture.lan.stop).not.toHaveBeenCalled();
  expect(fixture.stopCapture).not.toHaveBeenCalled();
  await fixture.request('playback.start');
  await fixture.request('routing', {
    targets: ['two'],
    receive: [{ peerId: 'one', volume: 1 }],
  });
  fixture.arrive(chunk());
  expect(fixture.player.push).toHaveBeenCalledTimes(1);
});

// A local link that would not start reached the log as "operation failed"
// and nothing else; the system's code for it says why without its text.
it("names a failed start by the system's code alone, never by its text", async () => {
  const fixture = setup();
  fixture.lan.start.mockRejectedValueOnce(
    Object.assign(new Error('listen EADDRINUSE pairing secret s3cr3t'), {
      code: 'EADDRINUSE',
      syscall: 'listen',
    }),
  );
  await expect(
    fixture.request('lan.start', undefined, { revoked: [], links: [] }),
  ).rejects.toThrow('operation failed');
  const failed = fixture.messages.filter(
    (message) => message.type === 'answer' && message.error,
  );
  expect(failed).toEqual([
    expect.objectContaining({ reason: 'EADDRINUSE listen' }),
  ]);
  expect(JSON.stringify(failed)).not.toContain('s3cr3t');
  // The control: a failure with no system code carries nothing more.
  fixture.lan.start.mockRejectedValueOnce(new Error('pairing secret s3cr3t'));
  await expect(
    fixture.request('lan.start', undefined, { revoked: [], links: [] }),
  ).rejects.toThrow('operation failed');
  const plain = fixture.messages.filter(
    (message) => message.type === 'answer' && message.error,
  );
  expect(plain[1]).not.toHaveProperty('reason', expect.anything());
  expect(JSON.stringify(plain)).not.toContain('s3cr3t');
});

it('keeps a code that could carry text out of the reason', () => {
  expect(failureReason({ code: 'EACCES', syscall: 'bind' })).toBe(
    'EACCES bind',
  );
  expect(failureReason({ code: 'not a code: s3cr3t' })).toBeUndefined();
  expect(failureReason('EADDRINUSE')).toBeUndefined();
});
