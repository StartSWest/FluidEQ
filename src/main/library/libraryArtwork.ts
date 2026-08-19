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

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { nativeImage } from 'electron';

const ARTWORK_DIRNAME = 'library-art';

// A grid tile is at most 160 CSS pixels, so 320 covers a 2x display and
// nothing beyond it. Full-resolution covers in a grid of five hundred are
// what makes a library scroll badly.
export const ARTWORK_EDGE_PIXELS = 320;

// An id this module did not mint is never trusted as a path fragment,
// however it arrived — a corrupt index entry or, from Task 10 onward, a
// custom-protocol URL built from a document. A hex string of this length
// cannot contain a separator, so refusing anything else is the whole check;
// no amount of path-joining or `..` inspection after this point is stronger
// than never building the path in the first place.
const ARTWORK_ID_PATTERN = /^[0-9a-f]{6,64}$/;

export const artworkCacheDir = (userDataDir: string): string =>
  path.join(userDataDir, ARTWORK_DIRNAME);

export const artworkId = (bytes: Uint8Array): string =>
  crypto.createHash('sha1').update(bytes).digest('hex');

export const artworkPath = (
  userDataDir: string,
  id: string,
): string | undefined => {
  if (!ARTWORK_ID_PATTERN.test(id)) {
    return undefined;
  }
  return path.join(artworkCacheDir(userDataDir), `${id}.jpg`);
};

/**
 * Resizes and caches a cover image, returning the id future lookups use.
 *
 * Two hundred tracks from one album carry the same embedded picture; hashing
 * the bytes before touching the disk is what lets them share one file
 * instead of writing it two hundred times. A hash that already has a file on
 * disk skips `resize` entirely — decoding and re-encoding a JPEG the cache
 * already holds would cost real time across a scan of thousands of tracks
 * for no different a result.
 *
 * Returns `undefined` on any failure — an empty image, a write that throws —
 * so the caller falls through to the generated tile from Task 4 rather than
 * showing a broken image.
 */
export const storeArtwork = async (
  userDataDir: string,
  bytes: Uint8Array,
): Promise<string | undefined> => {
  const id = artworkId(bytes);
  const target = artworkPath(userDataDir, id);
  if (!target) {
    return undefined;
  }
  if (fs.existsSync(target)) {
    return id;
  }
  try {
    const image = nativeImage.createFromBuffer(Buffer.from(bytes));
    if (image.isEmpty()) {
      return undefined;
    }
    const resized = image.resize({ height: ARTWORK_EDGE_PIXELS });
    const jpeg = resized.toJPEG(82);
    fs.mkdirSync(artworkCacheDir(userDataDir), { recursive: true });
    fs.writeFileSync(target, jpeg);
    return id;
  } catch (error) {
    // A cover that will not decode or a cache directory that will not write
    // is the single most useful line in a bug report about a missing thumbnail.
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error(`Could not cache artwork ${id}`, error);
    return undefined;
  }
};
