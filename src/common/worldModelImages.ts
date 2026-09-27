/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The size an image in a model will decode to, read from its own header
 * before anything decodes it (`worldModelCheck.ts`). A decoder allocates what
 * the header says, and nothing about a file's length bounds that: a 1 MB PNG
 * of one colour is a gigabyte decoded. Read the way decoders read them — the
 * first frame header of a JPEG, a WebP's canvas — so the number checked is
 * the number decoded.
 */

const readModelUint32 = (bytes: Uint8Array, at: number, little: boolean) =>
  new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0, little);

const readModelUint16 = (bytes: Uint8Array, at: number, little: boolean) =>
  new DataView(bytes.buffer, bytes.byteOffset + at, 2).getUint16(0, little);

/** A PNG's size, from its IHDR chunk, which the format puts first. */
const modelPngSize = (bytes: Uint8Array): [number, number] | null => {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.byteLength < 24 ||
    !signature.every((byte, i) => bytes[i] === byte) ||
    readModelUint32(bytes, 12, false) !== 0x49484452
  ) {
    return null;
  }
  return [readModelUint32(bytes, 16, false), readModelUint32(bytes, 20, false)];
};

/** Markers that stand alone, with no length after them. */
const isBareJpegMarker = (marker: number) =>
  marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8);

/** Frame headers: SOF0 to SOF15 but for DHT, JPG and DAC. */
const isJpegFrameMarker = (marker: number) =>
  marker >= 0xc0 &&
  marker <= 0xcf &&
  marker !== 0xc4 &&
  marker !== 0xc8 &&
  marker !== 0xcc;

/** A JPEG's size from its first frame header, which is the one decoded. */
const modelJpegSize = (bytes: Uint8Array): [number, number] | null => {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  let at = 2;
  while (at + 4 <= bytes.byteLength) {
    if (bytes[at] !== 0xff) {
      return null;
    }
    const marker = bytes[at + 1];
    if (marker === 0xff) {
      at += 1;
    } else if (isBareJpegMarker(marker)) {
      at += 2;
    } else if (marker === 0xda || marker === 0xd9) {
      return null;
    } else if (isJpegFrameMarker(marker)) {
      if (at + 9 > bytes.byteLength) {
        return null;
      }
      return [
        readModelUint16(bytes, at + 7, false),
        readModelUint16(bytes, at + 5, false),
      ];
    } else {
      at += 2 + readModelUint16(bytes, at + 2, false);
    }
  }
  return null;
};

/** A WebP's size from its first chunk: the canvas, or its one frame. */
const modelWebpSize = (bytes: Uint8Array): [number, number] | null => {
  const tag = (at: number) =>
    String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  if (bytes.byteLength < 30 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') {
    return null;
  }
  // Little-endian fields, read by arithmetic: 24 bits of a VP8X canvas side,
  // and the 14 low bits of each side a lossy or lossless header gives.
  const three = (at: number) =>
    bytes[at] + bytes[at + 1] * 0x100 + bytes[at + 2] * 0x10000;
  const fourteen = (value: number) => value % 0x4000;
  switch (tag(12)) {
    case 'VP8X':
      return [three(24) + 1, three(27) + 1];
    case 'VP8 ':
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
        return null;
      }
      return [
        fourteen(readModelUint16(bytes, 26, true)),
        fourteen(readModelUint16(bytes, 28, true)),
      ];
    case 'VP8L': {
      if (bytes[20] !== 0x2f) {
        return null;
      }
      const bits = readModelUint32(bytes, 21, true);
      return [fourteen(bits) + 1, fourteen(Math.floor(bits / 0x4000)) + 1];
    }
    default:
      return null;
  }
};

const MODEL_IMAGE_SIZE: Readonly<
  Record<string, (bytes: Uint8Array) => [number, number] | null>
> = {
  'image/png': modelPngSize,
  'image/jpeg': modelJpegSize,
  'image/webp': modelWebpSize,
};

/** The image types a model may embed. */
export const MODEL_IMAGE_TYPES: ReadonlySet<string> = new Set(
  Object.keys(MODEL_IMAGE_SIZE),
);

/**
 * Width and height of an embedded image of `mimeType` as it will decode, or
 * null for one whose header is not what its type says.
 */
export const modelImageSize = (
  bytes: Uint8Array,
  mimeType: string,
): [number, number] | null =>
  Object.prototype.hasOwnProperty.call(MODEL_IMAGE_SIZE, mimeType)
    ? MODEL_IMAGE_SIZE[mimeType](bytes)
    : null;
