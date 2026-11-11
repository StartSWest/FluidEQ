/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { pngHeader } from './pictureHeaders';

/**
 * Electron's `nativeImage` for main-process tests that only need a picture's
 * size: a PNG is read from its IHDR header (`pngHeader`), and a resize
 * answers a header of the size asked for. Nothing is decoded.
 */

interface IFakeImage {
  isEmpty(): boolean;
  getSize(): { width: number; height: number };
  resize(size: { width: number; height: number }): IFakeImage;
  toPNG(): Buffer;
  /** Every pixel clear: a test that needs a drawing gives its own pixels. */
  toBitmap(): Buffer;
}

const imageOf = (
  size: { width: number; height: number } | undefined,
): IFakeImage => ({
  isEmpty: () => size === undefined,
  getSize: () => size ?? { width: 0, height: 0 },
  resize: (next) => imageOf({ width: next.width, height: next.height }),
  toPNG: () =>
    size ? Buffer.from(pngHeader(size.width, size.height)) : Buffer.alloc(0),
  toBitmap: () => Buffer.alloc((size?.width ?? 0) * (size?.height ?? 0) * 4),
});

const sizeOf = (bytes: Buffer) =>
  bytes.length >= 24 && bytes.toString('ascii', 12, 16) === 'IHDR'
    ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
    : undefined;

const fakeNativeImage = {
  createFromBuffer: (bytes: Buffer) => imageOf(sizeOf(bytes)),
  createEmpty: () => imageOf(undefined),
};

export default fakeNativeImage;
