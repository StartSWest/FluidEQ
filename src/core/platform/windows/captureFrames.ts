/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Windows capture helpers' wire (`native/remote-audio-capture/src/
 * capture_queue.h`): a 24-byte header, then the payload. Spoken by
 * `FluidEQ-LAN-Capture.exe` for Share Audio and the second output, and by
 * `FluidEQ-Listen.exe` for the live displays.
 */

const FRAME_MAGIC = 0x314e414c;
const FRAME_READY = 1;
const FRAME_AUDIO = 2;
export const CAPTURE_HEADER_BYTES = 24;
const MAX_PAYLOAD_BYTES = 8_192 * 8 * 4;

export interface ICaptureFrame {
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

/**
 * The second output's replies, which carry no sound: 3 a command's answer, 4
 * a mirror that failed, 5 a mirror's delay in microseconds (`mirror_control.h`).
 */
const isMirrorReply = (kind: number): boolean =>
  kind === 3 || kind === 4 || kind === 5;

const frameIsValid = (header: ICaptureFrame): boolean => {
  if (isMirrorReply(header.kind)) {
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
 * A capture helper's frames, as they arrive: a partial read is not a frame
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
    while (buffered.byteLength >= CAPTURE_HEADER_BYTES) {
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
      const frameBytes = CAPTURE_HEADER_BYTES + header.payloadBytes;
      if (buffered.byteLength < frameBytes) {
        return;
      }
      const payload = buffered.subarray(CAPTURE_HEADER_BYTES, frameBytes);
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
      } else if (isMirrorReply(header.kind)) {
        handlers.reply(header.kind, header.sequence, header.sampleRate);
      } else {
        handlers.audio(header, payload);
      }
    }
  };
};
