/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { types } from 'util';
import {
  MAX_SHARE_FRAME_BYTES,
  createShareFrameReader,
  encodeShareFrame,
} from 'main/shareAudio/shareServiceWire';

/**
 * Main's half of the frames it exchanges with `FluidEQ-Share.exe`. The C++
 * half is held to these bytes by `share_main_wire_test.cpp`; here, the
 * values come back as the types they left as, however the pipe splits them.
 */

const readAll = (bytes: Buffer, step = bytes.byteLength) => {
  const messages: unknown[] = [];
  const read = createShareFrameReader((message) => messages.push(message));
  for (let at = 0; at < bytes.byteLength; at += step) {
    read(bytes.subarray(at, at + step));
  }
  return messages;
};

const capture = {
  type: 'event',
  event: {
    type: 'capture',
    id: 4,
    chunk: {
      peerId: '',
      sampleRate: 48000,
      channels: 2,
      frames: 2,
      sequence: 9,
      pcm: new Float32Array([0.5, -0.5, 0.25, -0.25]).buffer,
    },
    meter: { waveform: new Float32Array([1, -1, 0.125]) },
    payload: Buffer.from([7, 8, 9]),
  },
  credit: 'capture:4',
};

it('gives every binary part back as the type it left as', () => {
  const [message] = readAll(encodeShareFrame(capture)) as [typeof capture];
  const { chunk, meter, payload } = message.event;
  // By Node's type checks: Jest's environment hands typed arrays a realm of
  // their own, where `instanceof` answers about the realm, not the value.
  expect(types.isArrayBuffer(chunk.pcm)).toBe(true);
  expect([...new Float32Array(chunk.pcm)]).toEqual([0.5, -0.5, 0.25, -0.25]);
  expect(types.isFloat32Array(meter.waveform)).toBe(true);
  expect([...meter.waveform]).toEqual([1, -1, 0.125]);
  expect(types.isUint8Array(payload)).toBe(true);
  expect([...payload]).toEqual([7, 8, 9]);
  expect(message.credit).toBe('capture:4');
  expect(chunk.sequence).toBe(9);
});

it('reads a frame however the pipe splits it, and two frames in one read', () => {
  const frame = encodeShareFrame(capture);
  expect(readAll(frame, 1)).toHaveLength(1);
  expect(readAll(Buffer.concat([frame, frame]))).toHaveLength(2);
});

it('keeps an empty argument where it was, as null', () => {
  const [message] = readAll(
    encodeShareFrame({ type: 'request', id: 1, args: [undefined, 2] }),
  ) as [{ args: unknown[] }];
  expect(message.args).toEqual([null, 2]);
});

it('never hands back a view of the frame it came in', () => {
  const frame = encodeShareFrame(capture);
  const [message] = readAll(frame) as [typeof capture];
  frame.fill(0);
  expect([...new Float32Array(message.event.chunk.pcm)]).toEqual([
    0.5, -0.5, 0.25, -0.25,
  ]);
});

it('refuses a frame no service sends, and reads its control', () => {
  const oversized = Buffer.alloc(4);
  oversized.writeUInt32LE(MAX_SHARE_FRAME_BYTES + 1, 0);
  expect(() => readAll(oversized)).toThrow('oversized');
  const frame = encodeShareFrame(capture);
  const overrun = Buffer.from(frame);
  // The last part's length, one longer than what follows it.
  overrun.writeUInt32LE(4, overrun.byteLength - 3 - 4);
  expect(() => readAll(overrun)).toThrow('broken');
  const missing = encodeShareFrame({ value: { $bin: 3, $as: 'ArrayBuffer' } });
  expect(() => readAll(missing)).toThrow('does not hold');
  // The control: the frame itself.
  expect(readAll(frame)).toHaveLength(1);
});
