/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Turning a byte stream back into frames.
 *
 * A pipe delivers whatever the OS felt like handing over: half a frame, three
 * frames, a frame split across two chunks. Nothing about the boundaries the
 * writer used survives the journey, so the reader has to rebuild them — and
 * the one thing it must never do is guess. A stream that no longer starts on a
 * frame boundary is not recoverable by skipping bytes until something looks
 * plausible; it is a fault, and it is reported as one.
 */
import {
  IHostAck,
  IHostHandshake,
  IHostTelemetry,
  MAGIC_ACK,
  MAGIC_HANDSHAKE,
  MAGIC_TELEMETRY,
  decodeAck,
  decodeHandshake,
  decodeTelemetry,
  frameLengthFor,
} from './wire';

export interface IFrameHandlers {
  onHandshake: (handshake: IHostHandshake) => void;
  onAck: (ack: IHostAck) => void;
  onTelemetry: (telemetry: IHostTelemetry) => void;
  /** The stream no longer begins on a frame. Fatal; the reader stops. */
  onDesynchronised: (magic: number) => void;
}

export class FrameReader {
  private pending: Buffer = Buffer.alloc(0);

  private broken = false;

  private readonly handlers: IFrameHandlers;

  constructor(handlers: IFrameHandlers) {
    this.handlers = handlers;
  }

  /**
   * Feed one chunk. Emits every complete frame it now holds.
   *
   * Buffers are concatenated rather than kept as a list of chunks: frames here
   * are at most 104 bytes and arrive a few dozen times a second, so the copy
   * is nothing, and a chunk list would be a second place for an off-by-one to
   * live.
   */
  push(chunk: Buffer): void {
    if (this.broken) {
      return;
    }
    this.pending =
      this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);

    for (;;) {
      if (this.pending.length < 4) {
        return;
      }
      const magic = this.pending.readUInt32LE(0);
      const length = frameLengthFor(magic);
      if (length === 0) {
        this.broken = true;
        this.handlers.onDesynchronised(magic);
        return;
      }
      if (this.pending.length < length) {
        return;
      }
      const frame = this.pending.subarray(0, length);
      this.pending = this.pending.subarray(length);
      this.dispatch(magic, frame);
      if (this.broken) {
        return;
      }
    }
  }

  private dispatch(magic: number, frame: Buffer): void {
    if (magic === MAGIC_HANDSHAKE) {
      const handshake = decodeHandshake(frame);
      if (handshake) {
        this.handlers.onHandshake(handshake);
      }
      return;
    }
    if (magic === MAGIC_ACK) {
      const ack = decodeAck(frame);
      if (ack) {
        this.handlers.onAck(ack);
      }
      return;
    }
    if (magic === MAGIC_TELEMETRY) {
      const telemetry = decodeTelemetry(frame);
      if (telemetry) {
        this.handlers.onTelemetry(telemetry);
      }
    }
  }
}
