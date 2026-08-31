/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The handshake has to catch a host whose analysis frame is a different size.
 *
 * WHAT HAPPENED, because the test is shaped by it. Denoise's forty floor bands
 * took `FeqWireAnalysisFrame` from 160 bytes to 320. `FEQ_WIRE_PROTOCOL_VERSION`
 * stayed at 1 — it is maintained by hand and the frame had already grown four
 * times without it moving — so a host binary built twenty-two minutes before
 * that change handshook cleanly and then wrote 160-byte headers into a reader
 * slicing them at 320.
 *
 * That is not a dropped frame. The length of an analysis frame is read from
 * inside its own header, so a header of the wrong size makes the reader consume
 * part of the NEXT frame as spectrum, and every frame after it is misread. A
 * few seconds later a magic landed on four zero bytes of silent spectrum, the
 * supervisor declared the stream lost and killed the host, and the app went
 * silent while still showing itself as playing.
 *
 * `dspHostWireLayout.test.ts` cannot see this: it compares the C++ SOURCE to
 * the TypeScript constants, and both were 320. Only the binary was old. So the
 * host now states `sizeof(FeqWireAnalysisFrame)` in its handshake, where the
 * compiler computes it rather than a person remembering to, and the supervisor
 * refuses a host that disagrees before it reads a single frame.
 */
import { FrameReader } from '../../../main/dspHost/transport';
import {
  ANALYSIS_BINS,
  ANALYSIS_HEADER_BYTES,
  HANDSHAKE_BYTES,
  MAGIC_ANALYSIS,
  MAGIC_HANDSHAKE,
  decodeHandshake,
} from '../../../main/dspHost/wire';

/**
 * What `sizeof(FeqWireAnalysisFrame)` was before the Denoise bands landed.
 *
 * A literal on purpose. It is the size the host in the field was actually
 * writing, and the test is only about that disagreement.
 */
const PREVIOUS_ANALYSIS_HEADER_BYTES = 160;

/** One analysis frame as a host with the previous header layout writes it. */
const previousLayoutFrame = (): Buffer => {
  const frame = Buffer.alloc(
    PREVIOUS_ANALYSIS_HEADER_BYTES + ANALYSIS_BINS * 4,
  );
  frame.writeUInt32LE(MAGIC_ANALYSIS, 0);
  frame.writeUInt32LE(1, 4);
  // One stage present, and the count/scope/band fields sit at the same offsets
  // in both layouts — which is exactly why nothing upstream rejected it.
  frame.writeUInt32LE(1, 8);
  frame.writeUInt32LE(ANALYSIS_BINS, 12);
  frame.writeUInt32LE(0, 16);
  frame.writeUInt32LE(0, 20);
  // The spectrum is left at zero: silence, which is what put four zero bytes
  // under the reader's next magic and produced `magic: 0` in the log.
  return frame;
};

const handshakeFrame = (analysisFrameBytes: number): Buffer => {
  const frame = Buffer.alloc(HANDSHAKE_BYTES);
  frame.writeUInt32LE(MAGIC_HANDSHAKE, 0);
  frame.writeUInt32LE(1, 4);
  frame.writeUInt32LE(1, 8);
  frame.writeUInt32LE(1, 12);
  frame.writeUInt32LE(200, 16);
  frame.writeUInt32LE(analysisFrameBytes, 20);
  return frame;
};

describe('a host whose analysis frame is the previous size', () => {
  it('desynchronises the stream, and reports the magic from the log', () => {
    const seen: number[] = [];
    const reader = new FrameReader({
      onHandshake: () => undefined,
      onAck: () => undefined,
      onTelemetry: () => undefined,
      onDesynchronised: (magic) => seen.push(magic),
    });

    // Two frames, because the first is consumed as one oversized frame and the
    // reader only lands on a wrong boundary once it reaches into the second.
    reader.push(Buffer.concat([previousLayoutFrame(), previousLayoutFrame()]));

    expect(seen).toEqual([0]);
  });

  /**
   * The positive control. A reader that reported a desynchronisation for
   * everything would pass the test above without proving anything.
   */
  it('POSITIVE CONTROL: the current size does not desynchronise it', () => {
    const seen: number[] = [];
    const reader = new FrameReader({
      onHandshake: () => undefined,
      onAck: () => undefined,
      onTelemetry: () => undefined,
      onDesynchronised: (magic) => seen.push(magic),
    });

    const frame = Buffer.alloc(ANALYSIS_HEADER_BYTES + ANALYSIS_BINS * 4);
    frame.writeUInt32LE(MAGIC_ANALYSIS, 0);
    frame.writeUInt32LE(1, 4);
    frame.writeUInt32LE(1, 8);
    frame.writeUInt32LE(ANALYSIS_BINS, 12);
    frame.writeUInt32LE(0, 16);
    frame.writeUInt32LE(0, 20);
    reader.push(Buffer.concat([frame, frame]));

    expect(seen).toEqual([]);
  });
});

describe('the handshake states the size, so the stream is never reached', () => {
  it('carries the size the host was compiled with', () => {
    const handshake = decodeHandshake(handshakeFrame(ANALYSIS_HEADER_BYTES));
    expect(handshake?.analysisFrameBytes).toBe(ANALYSIS_HEADER_BYTES);
  });

  it('reads the stale build as the size it really writes', () => {
    const handshake = decodeHandshake(
      handshakeFrame(PREVIOUS_ANALYSIS_HEADER_BYTES),
    );
    expect(handshake?.analysisFrameBytes).toBe(PREVIOUS_ANALYSIS_HEADER_BYTES);
    expect(handshake?.analysisFrameBytes).not.toBe(ANALYSIS_HEADER_BYTES);
  });

  /**
   * A host built before the field existed leaves it zero.
   *
   * Zero is not any frame size this protocol has ever had, so it is refused
   * like any other disagreement rather than being read as "not stated".
   */
  it('reads a host that predates the field as zero', () => {
    const handshake = decodeHandshake(handshakeFrame(0));
    expect(handshake?.analysisFrameBytes).toBe(0);
    expect(handshake?.analysisFrameBytes).not.toBe(ANALYSIS_HEADER_BYTES);
  });
});
