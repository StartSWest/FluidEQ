/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import crypto from 'crypto';
import net from 'net';
import type { ILanRemoteAudioChunk } from '../common/remoteAudio';
import { createCaptureFrameReader } from '../core/platform/windows/captureFrames';
import { type ILanAudioLease, leaseLanAudioHelper } from './lanAudioHelper';

const MAX_HELLO_BYTES = 256;
const MAX_COMMAND_QUEUE_BYTES = 32_768;

/**
 * Which capture. `local` leaves out only itself and renders the second
 * output's mirrors, so it hears the sound other computers send here; `lan`
 * leaves out the LAN audio helper's whole tree, so it never does — the
 * capture sent to the network, which must not send a computer's own sound
 * back to it (`lanAudioHelper.ts`). `hold` captures nothing: it holds second
 * outputs open in silence for the FluidEQ Engine to play into.
 */
export type TCaptureMode = 'local' | 'lan' | 'hold';

export interface INativeCaptureProcess {
  close(): void;
  command(value: string): void;
}

/** Hex compared in constant time: the token is the pipe's only lock. */
const tokenMatches = (offered: string, token: string): boolean => {
  const a = Buffer.from(offered, 'utf8');
  const b = Buffer.from(token, 'utf8');
  return a.byteLength === b.byteLength && crypto.timingSafeEqual(a, b);
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
  let frameReady = false;
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
  const completeReady = () => {
    // The two pipe connections arrive independently. A ready audio frame
    // alone used to expose a handle before its command pipe had connected.
    if (
      !ready &&
      !stopped &&
      !failureReported &&
      frameReady &&
      commands &&
      frames
    ) {
      ready = true;
      settle?.resolve(handle);
    }
  };
  const readFrames = createCaptureFrameReader({
    ready: () => {
      frameReady = true;
      completeReady();
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
      completeReady();
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
