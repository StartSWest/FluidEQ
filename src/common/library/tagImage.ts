/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * A cover's kind and size from its own first bytes — what the panel says
 * under a cover ("1500 × 1500 · JPEG") and what main checks a picture is
 * before writing it into somebody's file. Header reading only: no decoder,
 * so it runs the same in main, in the window and in the harness's Node.
 */

import type { TTagCoverMime } from './tagFields';

export interface IImageFacts {
  mime: TTagCoverMime;
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const readU16 = (bytes: Uint8Array, at: number): number =>
  // eslint-disable-next-line no-bitwise -- big-endian bytes to a number
  (bytes[at] << 8) | bytes[at + 1];

const readU32 = (bytes: Uint8Array, at: number): number =>
  readU16(bytes, at) * 0x10000 + readU16(bytes, at + 2);

const pngFacts = (bytes: Uint8Array): IImageFacts | undefined => {
  // The IHDR chunk is first, its width and height at 16 and 20.
  if (bytes.length < 24 || !PNG_SIGNATURE.every((b, i) => bytes[i] === b)) {
    return undefined;
  }
  return {
    mime: 'image/png',
    width: readU32(bytes, 16),
    height: readU32(bytes, 20),
  };
};

/** Start-of-frame markers that carry the picture's size; DHT, JPG and DAC
 * share the range and do not. */
const isStartOfFrame = (marker: number): boolean =>
  marker >= 0xc0 &&
  marker <= 0xcf &&
  marker !== 0xc4 &&
  marker !== 0xc8 &&
  marker !== 0xcc;

const jpegFacts = (bytes: Uint8Array): IImageFacts | undefined => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return undefined;
  }
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      return undefined;
    }
    const marker = bytes[at + 1];
    if (marker === 0xff) {
      at += 1;
    } else if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
    } else {
      const length = readU16(bytes, at + 2);
      if (length < 2) {
        return undefined;
      }
      if (isStartOfFrame(marker)) {
        return {
          mime: 'image/jpeg',
          height: readU16(bytes, at + 5),
          width: readU16(bytes, at + 7),
        };
      }
      at += 2 + length;
    }
  }
  return undefined;
};

/** The picture's kind and size, or `undefined` for anything that is not a
 * JPEG or a PNG. */
export const readImageFacts = (bytes: Uint8Array): IImageFacts | undefined =>
  pngFacts(bytes) ?? jpegFacts(bytes);
