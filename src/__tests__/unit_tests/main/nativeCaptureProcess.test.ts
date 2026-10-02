/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * A capture helper reaching this process over a named pipe of its own.
 *
 * Any program on the machine can list a pipe's name, so the pipe's lock is
 * the token on the helper's command line: a connection that does not open
 * with it — or names a role already taken — is dropped, and once both of the
 * helper's connections are in nobody else is let near it. Held here with a
 * real pipe, the test playing the helper's part.
 */

import net from 'net';

const mockRequest = jest.fn();
const mockRelease = jest.fn();
let helperClient: {
  reply?(reply: { kind: number; id: number; rate: number }): void;
} = {};

jest.mock('../../../main/lanAudioHelper', () => ({
  leaseLanAudioHelper: (client: typeof helperClient) => {
    helperClient = client;
    return Promise.resolve({
      request: (...args: unknown[]) => mockRequest(...args),
      send: jest.fn(),
      release: mockRelease,
    });
  },
}));

// eslint-disable-next-line import/first
import {
  createCaptureFrameReader,
  startNativeCaptureProcess,
} from '../../../main/nativeCaptureProcess';

const MAGIC = 0x314e414c;

const frame = (
  kind: number,
  { payload = Buffer.alloc(0), sequence = 0, rate = 48_000, channels = 2 } = {},
) => {
  const header = Buffer.alloc(24);
  header.writeUInt32LE(MAGIC, 0);
  header.writeUInt32LE(kind, 4);
  header.writeUInt32LE(sequence, 8);
  header.writeUInt32LE(rate, 12);
  header.writeUInt16LE(channels, 16);
  header.writeUInt16LE(payload.byteLength / channels / 4, 18);
  header.writeUInt32LE(payload.byteLength, 20);
  return Buffer.concat([header, payload]);
};

const READY = frame(1);

/** The pipe, token and mode the helper was asked to start a capture with. */
const spawned = (): Promise<{ pipe: string; token: string; mode: string }> =>
  new Promise((resolve) => {
    mockRequest.mockImplementation((kind: number, payload: Buffer) => {
      expect(kind).toBe(8);
      const [pipe, token, mode] = payload.toString('utf8').split(' ');
      resolve({ pipe, token, mode });
      return { id: 41, answered: Promise.resolve() };
    });
  });

const connect = (pipe: string, hello: string) =>
  new Promise<net.Socket>((resolve, reject) => {
    const socket = net.connect(pipe, () => {
      socket.write(hello);
      resolve(socket);
    });
    socket.once('error', reject);
  });

const closed = (socket: net.Socket) =>
  new Promise<void>((resolve) => {
    if (socket.destroyed) {
      resolve();
      return;
    }
    socket.once('close', () => resolve());
  });

const sockets: net.Socket[] = [];
afterEach(() => {
  sockets.splice(0).forEach((socket) => socket.destroy());
  mockRequest.mockReset();
  mockRelease.mockReset();
});

describe('the capture pipe', () => {
  it('lets in the helper holding the token, and passes its audio through untouched', async () => {
    const asked = spawned();
    const onAudio = jest.fn();
    const starting = startNativeCaptureProcess(
      'lan',
      onAudio,
      jest.fn(),
      jest.fn(),
    );
    const { pipe, token, mode } = await asked;
    expect(mode).toBe('lan');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(pipe).toMatch(/^\\\\\.\\pipe\\FluidEQ-LAN-[0-9a-f]{32}$/);

    const commands = await connect(
      pipe,
      `FLUIDEQ-CAPTURE ${token} commands 1\n`,
    );
    const frames = await connect(
      pipe,
      // The ready frame in the same write as the hello, as a fast helper
      // would send it.
      `FLUIDEQ-CAPTURE ${token} frames 1\n`,
    );
    sockets.push(commands, frames);
    frames.write(READY);
    const capture = await starting;

    const pcm = Buffer.from(new Float32Array([0, -0, 0.5, -0.25]).buffer);
    const audio = frame(2, { payload: pcm, sequence: 42 });
    // Split across two reads: a partial read is not a frame boundary.
    frames.write(audio.subarray(0, 29));
    frames.write(audio.subarray(29));
    await new Promise<void>((resolve) => {
      onAudio.mockImplementation(() => resolve());
    });
    const [delivered] = onAudio.mock.calls[0];
    expect(Buffer.from(delivered.pcm).equals(pcm)).toBe(true);
    expect(delivered.sequence).toBe(42);

    const received = new Promise<string>((resolve) => {
      commands.once('data', (data) => resolve(data.toString('utf8')));
    });
    capture.command('volume 1 2 0.5');
    expect(await received).toBe('volume 1 2 0.5\n');
    capture.close();
    expect(mockRelease).toHaveBeenCalled();
  });

  it('drops a connection without the token, and one for a role already taken', async () => {
    const asked = spawned();
    const starting = startNativeCaptureProcess(
      'local',
      jest.fn(),
      jest.fn(),
      jest.fn(),
    );
    const { pipe, token } = await asked;

    const stranger = await connect(
      pipe,
      `FLUIDEQ-CAPTURE ${'0'.repeat(64)} commands 1\n`,
    );
    sockets.push(stranger);
    await closed(stranger);

    const commands = await connect(
      pipe,
      `FLUIDEQ-CAPTURE ${token} commands 1\n`,
    );
    sockets.push(commands);
    const second = await connect(pipe, `FLUIDEQ-CAPTURE ${token} commands 1\n`);
    sockets.push(second);
    await closed(second);

    // POSITIVE CONTROL: the right connection for the free role still gets in.
    const frames = await connect(pipe, `FLUIDEQ-CAPTURE ${token} frames 1\n`);
    sockets.push(frames);
    frames.write(READY);
    const capture = await starting;
    expect(commands.destroyed).toBe(false);
    capture.close();
  });

  it('stops listening once both connections are in', async () => {
    // A newcomer to a pipe whose places are all taken waits rather than
    // being refused, so this is held where it is decided: the server stops
    // accepting the moment the helper's second connection is in.
    const closing = jest.spyOn(net.Server.prototype, 'close');
    const asked = spawned();
    const starting = startNativeCaptureProcess(
      'lan',
      jest.fn(),
      jest.fn(),
      jest.fn(),
    );
    const { pipe, token } = await asked;
    const commands = await connect(
      pipe,
      `FLUIDEQ-CAPTURE ${token} commands 1\n`,
    );
    sockets.push(commands);
    const frames = await connect(pipe, `FLUIDEQ-CAPTURE ${token} frames 1\n`);
    sockets.push(frames);
    frames.write(READY);
    const capture = await starting;
    expect(closing).toHaveBeenCalledTimes(1);
    closing.mockRestore();
    capture.close();
  });

  it('fails to start when the helper says the capture ended before it connected', async () => {
    const asked = spawned();
    const starting = startNativeCaptureProcess(
      'lan',
      jest.fn(),
      jest.fn(),
      jest.fn(),
    );
    await asked;
    helperClient.reply?.({ kind: 9, id: 41, rate: 0x8889_0008 });
    await expect(starting).rejects.toThrow('0x88890008');
    expect(mockRelease).toHaveBeenCalled();
  });
});

describe('the capture frame reader', () => {
  const reader = () => {
    const handlers = {
      ready: jest.fn(),
      reply: jest.fn(),
      audio: jest.fn(),
      invalid: jest.fn(),
    };
    return { handlers, read: createCaptureFrameReader(handlers) };
  };

  it('refuses audio before the helper said it is ready', () => {
    const { handlers, read } = reader();
    read(frame(2, { payload: Buffer.alloc(8) }));
    expect(handlers.invalid).toHaveBeenCalledTimes(1);
    expect(handlers.audio).not.toHaveBeenCalled();
  });

  it('refuses a frame that is not one, and reads nothing after it', () => {
    const { handlers, read } = reader();
    const broken = Buffer.from(READY);
    broken.writeUInt32LE(0, 0);
    read(broken);
    read(READY);
    expect(handlers.invalid).toHaveBeenCalledTimes(1);
    expect(handlers.ready).not.toHaveBeenCalled();
  });

  it('refuses a second ready, which would be a stream restarted under it', () => {
    const { handlers, read } = reader();
    read(Buffer.concat([READY, READY]));
    expect(handlers.ready).toHaveBeenCalledTimes(1);
    expect(handlers.invalid).toHaveBeenCalledTimes(1);
  });

  it('passes on the second output’s replies', () => {
    const { handlers, read } = reader();
    read(READY);
    read(frame(3, { sequence: 9, rate: 0, channels: 0 }));
    expect(handlers.reply).toHaveBeenCalledWith(3, 9, 0);
  });
});
