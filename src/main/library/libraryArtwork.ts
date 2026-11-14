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
import type { TCoverSize } from '../../common/library/mediaUrl';

const ARTWORK_DIRNAME = 'library-art';

// A grid tile is at most 160 CSS pixels, so 320 covers a 2x display and
// nothing beyond it. Full-resolution covers in a grid of five hundred are
// what makes a library scroll badly.
export const ARTWORK_EDGE_PIXELS = 320;

/**
 * The smaller pictures, by name (`librarySizedArtUrl`):
 *
 * - small: a row draws its cover at 30 to 36 CSS pixels (the list and Up
 *   Next at 30-32, the player's bar at 36), and 96 covers that up to 2.6x.
 *   The 320 one there decoded 61 times the pixels on screen (measured, the
 *   Songs list over 14,000 songs).
 * - medium: a grid tile is 160 CSS pixels at most, and 224 covers it up to
 *   1.4x — the browser takes 320 itself beyond that (the tile's `srcset`).
 */
export const ARTWORK_SIZED_EDGES: Readonly<Record<TCoverSize, number>> = {
  small: 96,
  medium: 224,
};

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

/** Where a cover's smaller picture lives: a folder per size, by the same id. */
export const sizedArtworkPath = (
  userDataDir: string,
  id: string,
  size: TCoverSize,
): string | undefined =>
  ARTWORK_ID_PATTERN.test(id)
    ? path.join(artworkCacheDir(userDataDir), size, `${id}.jpg`)
    : undefined;

/** Pictures being made, so two rows asking at once make one file. */
const making = new Map<string, Promise<string | undefined>>();

/**
 * A cover's smaller picture, made from the cached cover the first time it is
 * asked for: the middle square at its size's edge, the way a row or a tile
 * crops a cover anyway. Written through a temporary file and a rename, so a
 * half-written picture is never what a later request finds. Undefined when
 * there is no cover to make it from or it will not decode — the caller
 * serves the cover itself then.
 */
export const ensureSizedArtwork = (
  userDataDir: string,
  id: string,
  size: TCoverSize,
): Promise<string | undefined> => {
  const target = sizedArtworkPath(userDataDir, id, size);
  const source = artworkPath(userDataDir, id);
  if (!target || !source) {
    return Promise.resolve(undefined);
  }
  if (fs.existsSync(target)) {
    return Promise.resolve(target);
  }
  const pending = making.get(target);
  if (pending) {
    return pending;
  }
  const made = (async () => {
    try {
      const image = nativeImage.createFromPath(source);
      if (image.isEmpty()) {
        return undefined;
      }
      const { width, height } = image.getSize();
      const side = Math.min(width, height);
      const square = image.crop({
        x: Math.floor((width - side) / 2),
        y: Math.floor((height - side) / 2),
        width: side,
        height: side,
      });
      const edge = ARTWORK_SIZED_EDGES[size];
      const resized = square.resize({
        width: edge,
        height: edge,
        quality: 'good',
      });
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      const temporary = `${target}.${process.pid}.tmp`;
      await fs.promises.writeFile(temporary, resized.toJPEG(82));
      await fs.promises.rename(temporary, target);
      return target;
    } catch (error) {
      // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
      console.error(
        `Could not make the ${size} picture of artwork ${id}`,
        error,
      );
      return undefined;
    } finally {
      making.delete(target);
    }
  })();
  making.set(target, made);
  return made;
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
    const temporary = `${target}.tmp`;
    // A write that dies partway through leaves the .tmp file damaged, not
    // the path every future call treats as already cached — the same
    // discipline the index's writer keeps (`asyncWriter`). The rename is
    // atomic on both NTFS and the POSIX filesystems this app ships on, and
    // overwrites an existing destination on Windows without an unlink first.
    fs.writeFileSync(temporary, jpeg);
    fs.renameSync(temporary, target);
    return id;
  } catch (error) {
    // A cover that will not decode or a cache directory that will not write
    // is the single most useful line in a bug report about a missing thumbnail.
    // eslint-disable-next-line no-console -- this project's one sanctioned console sink; see libraryIndex.ts
    console.error(`Could not cache artwork ${id}`, error);
    return undefined;
  }
};
