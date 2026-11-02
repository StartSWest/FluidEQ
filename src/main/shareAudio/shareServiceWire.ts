/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What main and the Share Audio service (`FluidEQ-Share.exe`) say to each
 * other on its standard input and output: the requests, answers and events
 * of `protocol.ts`, each a frame of JSON with its binary values beside it
 * (`native/share-service/src/main_wire.h` reads and writes the same).
 *
 *   frame := u32 body length, body          (little-endian throughout)
 *   body  := u32 JSON length, JSON, u32 part count, part*
 *   part  := u32 length, bytes
 *
 * A binary value in the JSON is `{"$bin": index, "$as": type}` and comes
 * back as the type it left as: the sound's `ArrayBuffer`, a meter's
 * `Float32Array`, a helper's bytes as a `Uint8Array`.
 */

import { types } from 'util';

export const MAX_SHARE_FRAME_BYTES = 16 * 1024 * 1024;

type TPartType = 'ArrayBuffer' | 'Float32Array' | 'Uint8Array';

const isPartMarker = (
  value: unknown,
): value is { $bin: number; $as: TPartType } => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const { $bin, $as } = value as { $bin?: unknown; $as?: unknown };
  return (
    Number.isInteger($bin) &&
    ($as === 'ArrayBuffer' || $as === 'Float32Array' || $as === 'Uint8Array')
  );
};

/**
 * Each binary value out of `value`, a marker in its place. Recognised by
 * Node's own type checks, never `instanceof`: a value made in another realm
 * (a VM context, a test environment) has another `ArrayBuffer`, and
 * `instanceof` sent its samples as an empty object.
 */
const withoutParts = (value: unknown, parts: Buffer[]): unknown => {
  if (types.isArrayBuffer(value)) {
    parts.push(Buffer.from(value));
    return { $bin: parts.length - 1, $as: 'ArrayBuffer' };
  }
  if (ArrayBuffer.isView(value)) {
    parts.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    return {
      $bin: parts.length - 1,
      $as: types.isFloat32Array(value) ? 'Float32Array' : 'Uint8Array',
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => withoutParts(item, parts));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        withoutParts(item, parts),
      ]),
    );
  }
  return value;
};

/** A part copied into memory of its own, never a view of the frame. */
const partAs = (part: Buffer, type: TPartType): unknown => {
  const copy = new Uint8Array(part.byteLength);
  copy.set(part);
  if (type === 'ArrayBuffer') {
    return copy.buffer;
  }
  if (type === 'Float32Array') {
    if (copy.byteLength % 4 !== 0) {
      throw new Error('A Share Audio frame named a part it does not hold.');
    }
    return new Float32Array(copy.buffer);
  }
  return copy;
};

const withParts = (value: unknown, parts: readonly Buffer[]): unknown => {
  if (isPartMarker(value)) {
    const part = parts[value.$bin];
    if (!part) {
      throw new Error('A Share Audio frame named a part it does not hold.');
    }
    return partAs(part, value.$as);
  }
  if (Array.isArray(value)) {
    return value.map((item) => withParts(item, parts));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, withParts(item, parts)]),
    );
  }
  return value;
};

const u32 = (value: number): Buffer => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value, 0);
  return bytes;
};

export const encodeShareFrame = (message: unknown): Buffer => {
  const parts: Buffer[] = [];
  const text = Buffer.from(JSON.stringify(withoutParts(message, parts)));
  const body = Buffer.concat([
    u32(text.byteLength),
    text,
    u32(parts.length),
    ...parts.flatMap((part) => [u32(part.byteLength), part]),
  ]);
  if (body.byteLength > MAX_SHARE_FRAME_BYTES) {
    throw new Error('A Share Audio message is too large to send.');
  }
  return Buffer.concat([u32(body.byteLength), body]);
};

/** Frames in, messages out; a partial read is not a frame boundary. Throws
 * on a frame that cannot be read: the stream is not the service's. */
export const createShareFrameReader = (accept: (message: unknown) => void) => {
  let pending: Buffer = Buffer.alloc(0);
  return (bytes: Buffer) => {
    pending =
      pending.byteLength === 0 ? bytes : Buffer.concat([pending, bytes]);
    while (pending.byteLength >= 4) {
      const length = pending.readUInt32LE(0);
      if (length > MAX_SHARE_FRAME_BYTES) {
        throw new Error('The Share Audio service sent an oversized frame.');
      }
      if (pending.byteLength < 4 + length) {
        return;
      }
      const body = pending.subarray(4, 4 + length);
      pending = pending.subarray(4 + length);
      let at = 0;
      const take = (size: number) => {
        if (body.byteLength - at < size) {
          throw new Error('The Share Audio service sent a broken frame.');
        }
        const piece = body.subarray(at, at + size);
        at += size;
        return piece;
      };
      const text = take(take(4).readUInt32LE(0)).toString('utf8');
      const count = take(4).readUInt32LE(0);
      const parts: Buffer[] = [];
      for (let index = 0; index < count; index += 1) {
        parts.push(take(take(4).readUInt32LE(0)));
      }
      if (at !== body.byteLength) {
        throw new Error('The Share Audio service sent a broken frame.');
      }
      accept(withParts(JSON.parse(text), parts));
    }
  };
};
