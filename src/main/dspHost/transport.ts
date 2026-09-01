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
  IHostAnalysis,
  IHostHandshake,
  IHostStats,
  IHostTelemetry,
  MAGIC_ACK,
  MAGIC_ANALYSIS,
  MAGIC_HANDSHAKE,
  MAGIC_STATS,
  MAGIC_TELEMETRY,
  analysisFrameLength,
  decodeAck,
  decodeAnalysis,
  decodeHandshake,
  decodeStats,
  decodeTelemetry,
  frameLengthFor,
} from './wire';

export interface IFrameHandlers {
  onHandshake: (handshake: IHostHandshake) => void;
  onAck: (ack: IHostAck) => void;
  onTelemetry: (telemetry: IHostTelemetry) => void;
  /** Optional: only a renderer with the DSP panel open ever asks for these. */
  onAnalysis?: (analysis: IHostAnalysis) => void;
  /**
   * Optional, and absent from a host older than protocol 5 — which cannot get
   * past the handshake, so in practice absent only from a caller that does not
   * care what the engine costs.
   */
  onStats?: (stats: IHostStats) => void;
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
      const header = frameLengthFor(magic);
      if (header === 0) {
        this.broken = true;
        this.handlers.onDesynchronised(magic);
        return;
      }
      if (this.pending.length < header) {
        return;
      }

      /**
       * The one frame whose length lives inside itself.
       *
       * Every other frame here is a fixed struct, which is what makes a
       * desynchronised stream obvious. The analysis frame carries up to twelve
       * kilobytes of spectrum and cannot be a fixed size without every quiet
       * moment costing what a loud one does, so its header says how much
       * follows — and a header that does not describe something this build can
       * read breaks the stream rather than skipping a frame. The length is how
       * the next frame is found at all; guessing it would misread all of them.
       */
      let length = header;
      if (magic === MAGIC_ANALYSIS) {
        length = analysisFrameLength(this.pending.subarray(0, header));
        if (length === 0) {
          this.broken = true;
          this.handlers.onDesynchronised(magic);
          return;
        }
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
      return;
    }
    if (magic === MAGIC_ANALYSIS) {
      const analysis = decodeAnalysis(frame);
      if (analysis) {
        this.handlers.onAnalysis?.(analysis);
      }
      return;
    }
    if (magic === MAGIC_STATS) {
      const stats = decodeStats(frame);
      if (stats) {
        this.handlers.onStats?.(stats);
      }
    }
  }
}
