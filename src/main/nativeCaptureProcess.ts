/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import type { ILanRemoteAudioChunk } from '../common/remoteAudio';
import { findRemoteAudioCaptureExecutable } from './remoteAudioCapturePath';

const FRAME_MAGIC = 0x314e414c;
const FRAME_READY = 1;
const FRAME_AUDIO = 2;
const HEADER_BYTES = 24;
const MAX_PAYLOAD_BYTES = 8_192 * 8 * 4;
const MAX_STDERR_BYTES = 4_096;

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

/**
 * Capture the Windows process mix before endpoint effects such as Equalizer APO.
 *
 * The helper excludes its own process tree (including mirrors) from loopback,
 * makes Windows provide every other rendered process independently of the
 * selected endpoint. Transport receives those Float32 bits directly; the
 * sender's endpoint EQ remains local and the listening PC applies its own EQ.
 */
export const startNativeCaptureProcess = async (
  peerId: string,
  onAudio: (chunk: ILanRemoteAudioChunk) => void,
  onFailure: () => void,
  onReply: (kind: number, id: number, result: number) => void,
): Promise<INativeCaptureProcess> => {
  const executable = findRemoteAudioCaptureExecutable();
  if (!executable) {
    throw new Error('The lossless system-audio capture helper is unavailable.');
  }

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(executable, ['--parent-pid', String(process.pid)], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new Error(
      `The lossless system-audio capture helper could not start.${detail}`,
    );
  }

  return new Promise<INativeCaptureProcess>((resolve, reject) => {
    let buffered = Buffer.alloc(0);
    let errorText = '';
    let ready = false;
    let stopped = false;
    let failureReported = false;
    const captureHandle: INativeCaptureProcess = {
      command: (value) => {
        if (stopped || failureReported) {
          throw new Error('The system audio capture has stopped.');
        }
        if (child.stdin.writableLength > 32_768) {
          throw new Error('The second output command queue is full.');
        }
        child.stdin.write(`${value}\n`);
      },
      close: () => {
        if (stopped) {
          return;
        }
        stopped = true;
        child.kill();
      },
    };

    const failure = (error: Error) => {
      if (failureReported || stopped) {
        return;
      }
      failureReported = true;
      if (!ready) {
        reject(error);
      } else {
        onFailure();
      }
      child.kill();
    };

    child.stdin.on('error', failure);

    child.stderr.on('data', (data: Buffer) => {
      if (errorText.length < MAX_STDERR_BYTES) {
        errorText += data
          .toString('utf8')
          .slice(0, MAX_STDERR_BYTES - errorText.length);
      }
    });
    child.stdout.on('data', (data: Buffer) => {
      if (stopped || failureReported) {
        return;
      }
      buffered = Buffer.concat([buffered, data]);
      while (buffered.byteLength >= HEADER_BYTES) {
        if (buffered.readUInt32LE(0) !== FRAME_MAGIC) {
          failure(new Error('The capture helper sent an invalid frame.'));
          return;
        }
        const header = decodeHeader(buffered);
        if (!frameIsValid(header)) {
          failure(new Error('The capture helper sent invalid audio metadata.'));
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
            failure(new Error('The capture helper restarted its stream.'));
            return;
          }
          ready = true;
          resolve(captureHandle);
        } else if (ready && (header.kind === 3 || header.kind === 4)) {
          onReply(header.kind, header.sequence, header.sampleRate);
        } else if (ready) {
          onAudio({
            channels: header.channels,
            frames: header.frames,
            pcm: Uint8Array.from(payload).buffer,
            peerId,
            sampleRate: header.sampleRate,
            sequence: header.sequence,
          });
        } else {
          failure(
            new Error('The capture helper sent audio before it was ready.'),
          );
          return;
        }
      }
    });
    child.once('error', (error) => failure(error));
    child.once('close', (code) => {
      if (stopped || failureReported) {
        return;
      }
      const detail = errorText.trim();
      failure(
        new Error(
          detail ||
            `The lossless system-audio capture helper stopped with code ${code ?? 'unknown'}.`,
        ),
      );
    });
  });
};
