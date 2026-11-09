/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Pictures as a decoder first reads them: only the header that says how big
 * they decode. A few dozen bytes can say 40000 by 40000, which is the whole
 * of a decompression bomb as far as a size check is concerned.
 */

const uint32 = (value: number) => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
};

/** A PNG's signature and IHDR, saying `width` by `height`. */
export const pngHeader = (width: number, height: number): Uint8Array =>
  new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      uint32(13),
      Buffer.from('IHDR', 'ascii'),
      uint32(width),
      uint32(height),
      Buffer.from([8, 6, 0, 0, 0]),
      uint32(0),
    ]),
  );

/** A JPEG's start and first frame header (SOF0), saying `width` by `height`. */
export const jpegHeader = (width: number, height: number): Uint8Array => {
  const bytes = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0, 0x03, 0x01, 0x22,
  ]);
  bytes.writeUInt16BE(height, 7);
  bytes.writeUInt16BE(width, 9);
  return new Uint8Array(bytes);
};

/** A WebP whose VP8X chunk gives its canvas as `width` by `height`. */
export const webpHeader = (width: number, height: number): Uint8Array => {
  const bytes = Buffer.alloc(30);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(22, 4);
  bytes.write('WEBP', 8, 'ascii');
  bytes.write('VP8X', 12, 'ascii');
  bytes.writeUInt32LE(10, 16);
  bytes.writeUIntLE(width - 1, 24, 3);
  bytes.writeUIntLE(height - 1, 27, 3);
  return new Uint8Array(bytes);
};

/** A BMP's header: a format a decoder sniffs whatever the file is called. */
export const bmpHeader = (width: number, height: number): Uint8Array => {
  const bytes = Buffer.alloc(54);
  bytes.write('BM', 0, 'ascii');
  bytes.writeInt32LE(width, 18);
  bytes.writeInt32LE(height, 22);
  return new Uint8Array(bytes);
};
