/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import crypto from 'crypto';
import net from 'net';
import type { ILanRemoteAudioChunk } from '../common/remoteAudio';
import { type ILanAudioLease, leaseLanAudioHelper } from './lanAudioHelper';

const FRAME_MAGIC = 0x314e414c;
const FRAME_READY = 1;
const FRAME_AUDIO = 2;
const HEADER_BYTES = 24;
const MAX_PAYLOAD_BYTES = 8_192 * 8 * 4;
const MAX_HELLO_BYTES = 256;
const MAX_COMMAND_QUEUE_BYTES = 32_768;

/**
 * Which capture. `local` leaves out only itself and renders the second
 * output's mirrors, so it hears the sound other computers send here; `lan`
 * leaves out the LAN audio helper's whole tree, so it never does — the
 * capture sent to the network, which must not send a computer's own sound
 * back to it (`lanAudioHelper.ts`).
 */
export type TCaptureMode = 'local' | 'lan';

export interface INativeCaptureProcess {
  close(): void;
  command(value: string): void;
}

interface ICaptureFrame {
  channels: number;
  frames: number;
  kind: number;
  payloadBytes: number;
  sampleRate: number;
  sequence: number;
}

const decodeHeader = (buffer: Buffer): ICaptureFrame => ({
  kind: buffer.readUInt32LE(4),
  sequence: buffer.readUInt32LE(8),
  sampleRate: buffer.readUInt32LE(12),
  channels: buffer.readUInt16LE(16),
  frames: buffer.readUInt16LE(18),
  payloadBytes: buffer.readUInt32LE(20),
});

const frameIsValid = (header: ICaptureFrame): boolean => {
  if (header.kind === 3 || header.kind === 4) {
    return (
      header.payloadBytes === 0 && header.frames === 0 && header.channels === 0
    );
  }
  if (header.kind === FRAME_READY) {
    return (
      header.payloadBytes === 0 &&
      header.frames === 0 &&
      header.channels >= 1 &&
      header.channels <= 8 &&
      header.sampleRate >= 8_000 &&
      header.sampleRate <= 384_000
    );
  }
  return (
    header.kind === FRAME_AUDIO &&
    header.channels >= 1 &&
    header.channels <= 8 &&
    header.frames >= 1 &&
    header.frames <= 8_192 &&
    header.sampleRate >= 8_000 &&
    header.sampleRate <= 384_000 &&
    header.payloadBytes === header.frames * header.channels * 4 &&
    header.payloadBytes <= MAX_PAYLOAD_BYTES
  );
};

/** Hex compared in constant time: the token is the pipe's only lock. */
const tokenMatches = (offered: string, token: string): boolean => {
  const a = Buffer.from(offered, 'utf8');
  const b = Buffer.from(token, 'utf8');
  return a.byteLength === b.byteLength && crypto.timingSafeEqual(a, b);
};

/**
 * The capture helper's frames, as they arrive: a partial read is not a frame
 * boundary, and the first thing it says must be that it is ready.
 */
export const createCaptureFrameReader = (handlers: {
  ready(): void;
  reply(kind: number, id: number, result: number): void;
  audio(frame: ICaptureFrame, payload: Buffer): void;
  invalid(error: Error): void;
}) => {
  let buffered = Buffer.alloc(0);
  let ready = false;
  let broken = false;
  return (data: Buffer) => {
    if (broken) {
      return;
    }
    buffered = Buffer.concat([buffered, data]);
    while (buffered.byteLength >= HEADER_BYTES) {
      if (buffered.readUInt32LE(0) !== FRAME_MAGIC) {
        broken = true;
        handlers.invalid(
          new Error('The capture helper sent an invalid frame.'),
        );
        return;
      }
      const header = decodeHeader(buffered);
      if (!frameIsValid(header)) {
        broken = true;
        handlers.invalid(
          new Error('The capture helper sent invalid audio metadata.'),
        );
        return;
      }
      const frameBytes = HEADER_BYTES + header.payloadBytes;
      if (buffered.byteLength < frameBytes) {
        return;
      }
      const payload = buffered.subarray(HEADER_BYTES, frameBytes);
      buffered = buffered.subarray(frameBytes);
      if (header.kind === FRAME_READY) {
        if (ready) {
          broken = true;
          handlers.invalid(
            new Error('The capture helper restarted its stream.'),
          );
          return;
        }
        ready = true;
        handlers.ready();
      } else if (!ready) {
        broken = true;
        handlers.invalid(
          new Error('The capture helper sent audio before it was ready.'),
        );
        return;
      } else if (header.kind === 3 || header.kind === 4) {
        handlers.reply(header.kind, header.sequence, header.sampleRate);
      } else {
        handlers.audio(header, payload);
      }
    }
  };
};

/**
 * Capture the Windows process mix before endpoint effects such as Equalizer
 * APO, through a helper the LAN audio helper starts as its child.
 *
 * The helper reaches this process through a named pipe served here for it
 * alone. A pipe name can be listed by anyone on the machine, so the pipe's
 * lock is the token on the helper's command line, which only its own user can
 * read: each of its two connections opens with it, and any connection that
 * does not — or that names a role already taken — is dropped. Two
 * connections, because the helper reads its commands synchronously and
 * writes its frames overlapped, and one pipe handle cannot be both.
 *
 * Transport receives the Float32 bits directly; the sender's endpoint EQ
 * stays local and the listening PC applies its own.
 */
export const startNativeCaptureProcess = async (
  mode: TCaptureMode,
  onAudio: (chunk: ILanRemoteAudioChunk) => void,
  onFailure: () => void,
  onReply: (kind: number, id: number, result: number) => void,
): Promise<INativeCaptureProcess> => {
  const token = crypto.randomBytes(32).toString('hex');
  const pipeName = `\\\\.\\pipe\\FluidEQ-LAN-${crypto.randomBytes(16).toString('hex')}`;
  const server = net.createServer();
  let commands: net.Socket | undefined;
  let frames: net.Socket | undefined;
  let lease: ILanAudioLease | undefined;
  let spawnId = 0;
  let ready = false;
  let stopped = false;
  let failureReported = false;
  let settle:
    | {
        resolve(handle: INativeCaptureProcess): void;
        reject(error: Error): void;
      }
    | undefined;

  const cleanUp = () => {
    server.close();
    commands?.destroy();
    frames?.destroy();
    lease?.release();
  };
  const failure = (error: Error) => {
    if (failureReported || stopped) {
      return;
    }
    failureReported = true;
    cleanUp();
    if (!ready) {
      settle?.reject(error);
    } else {
      onFailure();
    }
  };
  const handle: INativeCaptureProcess = {
    command: (value) => {
      if (stopped || failureReported || !commands) {
        throw new Error('The system audio capture has stopped.');
      }
      if (commands.writableLength > MAX_COMMAND_QUEUE_BYTES) {
        throw new Error('The second output command queue is full.');
      }
      commands.write(`${value}\n`);
    },
    close: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      // The helper ends on its own when its command pipe closes.
      cleanUp();
    },
  };
  const readFrames = createCaptureFrameReader({
    ready: () => {
      ready = true;
      settle?.resolve(handle);
    },
    reply: onReply,
    audio: (header, payload) =>
      onAudio({
        channels: header.channels,
        frames: header.frames,
        pcm: Uint8Array.from(payload).buffer,
        peerId: '',
        sampleRate: header.sampleRate,
        sequence: header.sequence,
      }),
    invalid: failure,
  });

  const introduced = (socket: net.Socket, line: string, rest: Buffer) => {
    const [word, offered, role] = line.split(' ');
    const taken = role === 'commands' ? commands : frames;
    if (
      word !== 'FLUIDEQ-CAPTURE' ||
      typeof offered !== 'string' ||
      !tokenMatches(offered, token) ||
      (role !== 'commands' && role !== 'frames') ||
      taken !== undefined
    ) {
      socket.destroy();
      return;
    }
    socket.on('error', () => failure(new Error('The capture pipe broke.')));
    socket.on('close', () =>
      failure(new Error('The system audio capture stopped.')),
    );
    if (role === 'commands') {
      commands = socket;
      // Commands flow one way; anything written back is not a frame.
      socket.on('data', () => undefined);
    } else {
      frames = socket;
      socket.on('data', readFrames);
      if (rest.byteLength > 0) {
        readFrames(rest);
      }
    }
    if (commands && frames) {
      // Both are in: nobody else is let near this pipe.
      server.close();
    }
  };
  server.on('connection', (socket) => {
    let hello = Buffer.alloc(0);
    const onHello = (data: Buffer) => {
      hello = Buffer.concat([hello, data]);
      const end = hello.indexOf(0x0a);
      if (end < 0) {
        if (hello.byteLength > MAX_HELLO_BYTES) {
          socket.destroy();
        }
        return;
      }
      socket.removeListener('data', onHello);
      introduced(
        socket,
        hello.subarray(0, end).toString('utf8'),
        hello.subarray(end + 1),
      );
    };
    socket.on('data', onHello);
    socket.on('error', () => socket.destroy());
  });

  const started = new Promise<INativeCaptureProcess>((resolve, reject) => {
    settle = { resolve, reject };
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(pipeName, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    lease = await leaseLanAudioHelper({
      reply: (reply) => {
        // The helper reports a capture that ended under the id it was started
        // with: before it ever reached this pipe, that is the only word of it.
        if (reply.kind === 9 && reply.id === spawnId) {
          failure(
            new Error(
              `The system audio capture ended (0x${reply.rate.toString(16)}).`,
            ),
          );
        }
      },
      stopped: failure,
    });
    const request = lease.request(
      8,
      Buffer.from(`${pipeName} ${token} ${mode}`, 'utf8'),
    );
    spawnId = request.id;
    await request.answered;
  } catch (error) {
    failure(
      error instanceof Error
        ? error
        : new Error('The system audio capture could not start.'),
    );
  }
  return started;
};
