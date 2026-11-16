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
 * What Undo needs to put a file back byte for byte, cover included.
 *
 * A tag write changes the bytes around the audio and moves the audio, never
 * the audio itself. So the file before is kept as the bytes in front of the
 * audio and the bytes after it, with where the same audio now sits in the
 * new file: an album's undo is its tags and covers, not a second copy of
 * the album. The audio block is not assumed — it is found, as the longest
 * stretch both files share, by matching a probe from the old file in the new
 * one and growing the match byte by byte in both directions. Where no such
 * stretch covers most of the file (an Ogg stream renumbers every page after
 * a longer comment header) the old file is kept whole.
 */

import fs from 'fs';
import path from 'path';

const CHUNK = 1024 * 1024;

const PROBE = 4096;

/** How far from its old place the audio may have moved: a tag can grow by a
 * cover of `MAX_COVER_BYTES` and a little more. */
const SEARCH_RADIUS = 48 * 1024 * 1024;

/** The largest file kept whole when its audio cannot be found in the new one. */
const MAX_WHOLE_COPY = 512 * 1024 * 1024;

export type TUndoPiece =
  | {
      kind: 'region';
      /** File names inside the job's undo folder. */
      head: string;
      tail: string;
      /** Where the shared audio sits in the file as written. */
      start: number;
      end: number;
    }
  | { kind: 'whole'; copy: string };

export interface IUndoEntry {
  trackId: string;
  piece: TUndoPiece;
  /** The file as written, so Undo can tell it has not changed since. */
  writtenSize: number;
  writtenMtimeMs: number;
}

const readAt = async (
  handle: fs.promises.FileHandle,
  position: number,
  length: number,
): Promise<Buffer> => {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  return bytesRead === length ? buffer : buffer.subarray(0, bytesRead);
};

/** A probe of a few repeated bytes (digital silence) matches anywhere. */
const isDistinctive = (probe: Buffer): boolean => new Set(probe).size >= 24;

/** Where `probe` first appears in `file` between `from` and `to`. */
const findIn = async (
  file: fs.promises.FileHandle,
  probe: Buffer,
  from: number,
  to: number,
): Promise<number | undefined> => {
  let at = Math.max(0, from);
  while (at < to) {
    const length = Math.min(CHUNK + probe.length, to - at);
    // eslint-disable-next-line no-await-in-loop -- one window at a time keeps memory to a chunk
    const window = await readAt(file, at, length);
    const found = window.indexOf(probe);
    if (found >= 0) {
      return at + found;
    }
    if (window.length < length) {
      return undefined;
    }
    at += CHUNK;
  }
  return undefined;
};

/** How many bytes match going forward from `a` in one file and `b` in the other. */
const matchForward = async (
  one: fs.promises.FileHandle,
  a: number,
  two: fs.promises.FileHandle,
  b: number,
  limit: number,
): Promise<number> => {
  let matched = 0;
  while (matched < limit) {
    const length = Math.min(CHUNK, limit - matched);
    // eslint-disable-next-line no-await-in-loop -- chunked comparison
    const [x, y] = await Promise.all([
      readAt(one, a + matched, length),
      readAt(two, b + matched, length),
    ]);
    const n = Math.min(x.length, y.length);
    for (let i = 0; i < n; i += 1) {
      if (x[i] !== y[i]) {
        return matched + i;
      }
    }
    matched += n;
    if (n < length) {
      return matched;
    }
  }
  return matched;
};

/** How many bytes match going backward from just before `a` and `b`. */
const matchBackward = async (
  one: fs.promises.FileHandle,
  a: number,
  two: fs.promises.FileHandle,
  b: number,
): Promise<number> => {
  let matched = 0;
  const limit = Math.min(a, b);
  while (matched < limit) {
    const length = Math.min(CHUNK, limit - matched);
    // eslint-disable-next-line no-await-in-loop -- chunked comparison
    const [x, y] = await Promise.all([
      readAt(one, a - matched - length, length),
      readAt(two, b - matched - length, length),
    ]);
    for (let i = length - 1; i >= 0; i -= 1) {
      if (x[i] !== y[i]) {
        return matched + (length - 1 - i);
      }
    }
    matched += length;
  }
  return matched;
};

interface ISharedBlock {
  /** In the file before. */
  oldStart: number;
  oldEnd: number;
  /** In the file as written. */
  newStart: number;
}

const findSharedBlock = async (
  before: fs.promises.FileHandle,
  beforeSize: number,
  after: fs.promises.FileHandle,
  afterSize: number,
): Promise<ISharedBlock | undefined> => {
  if (beforeSize < PROBE * 4) {
    return undefined;
  }
  // Three probes from the middle outwards: a quiet passage under the first
  // is no reason to give up on the file.
  const places = [0.5, 0.37, 0.63, 0.25, 0.75].map((share) =>
    Math.floor(beforeSize * share),
  );
  for (let index = 0; index < places.length; index += 1) {
    const place = places[index];
    // eslint-disable-next-line no-await-in-loop -- probes tried in order until one is found
    const probe = await readAt(before, place, PROBE);
    if (probe.length === PROBE && isDistinctive(probe)) {
      // eslint-disable-next-line no-await-in-loop -- see above
      const found = await findIn(
        after,
        probe,
        place - SEARCH_RADIUS,
        Math.min(afterSize, place + SEARCH_RADIUS + PROBE),
      );
      if (found !== undefined) {
        // eslint-disable-next-line no-await-in-loop -- see above
        const back = await matchBackward(before, place, after, found);
        // eslint-disable-next-line no-await-in-loop -- see above
        const forward = await matchForward(
          before,
          place,
          after,
          found,
          Math.min(beforeSize - place, afterSize - found),
        );
        return {
          oldStart: place - back,
          oldEnd: place + forward,
          newStart: found - back,
        };
      }
    }
  }
  return undefined;
};

/** Writes a file beside its final name and renames it into place. */
export const writeFileAtomic = async (
  target: string,
  bytes: Uint8Array,
): Promise<void> => {
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.promises.writeFile(temporary, bytes);
  await fs.promises.rename(temporary, target);
};

/**
 * Keeps what Undo needs of `beforePath`, given the same file as written at
 * `afterPath` (still the temporary file: called before the rename, while the
 * old bytes exist). Answers `undefined` when the file is too big to keep and
 * its audio cannot be found — the write is then refused, because a write
 * that cannot be undone is not one this editor makes.
 */
export const keepForUndo = async (
  beforePath: string,
  afterPath: string,
  folder: string,
  name: string,
): Promise<TUndoPiece | undefined> => {
  await fs.promises.mkdir(folder, { recursive: true });
  const before = await fs.promises.open(beforePath, 'r');
  try {
    const after = await fs.promises.open(afterPath, 'r');
    try {
      const beforeSize = (await before.stat()).size;
      const afterSize = (await after.stat()).size;
      const block = await findSharedBlock(before, beforeSize, after, afterSize);
      const shared = block ? block.oldEnd - block.oldStart : 0;
      if (block && shared >= beforeSize / 2) {
        const head = `${name}.head`;
        const tail = `${name}.tail`;
        await writeFileAtomic(
          path.join(folder, head),
          await readAt(before, 0, block.oldStart),
        );
        await writeFileAtomic(
          path.join(folder, tail),
          await readAt(before, block.oldEnd, beforeSize - block.oldEnd),
        );
        return {
          kind: 'region',
          head,
          tail,
          start: block.newStart,
          end: block.newStart + shared,
        };
      }
      if (beforeSize > MAX_WHOLE_COPY) {
        return undefined;
      }
    } finally {
      await after.close();
    }
  } finally {
    await before.close();
  }
  const copy = `${name}.whole`;
  const temporary = path.join(folder, `${copy}.tmp`);
  await fs.promises.copyFile(beforePath, temporary);
  await fs.promises.rename(temporary, path.join(folder, copy));
  return { kind: 'whole', copy };
};

/** The undo files a piece keeps, for removing them once they are not needed. */
export const undoFilesOf = (piece: TUndoPiece): string[] =>
  piece.kind === 'region' ? [piece.head, piece.tail] : [piece.copy];

/**
 * Builds the file as it was into `temporary`, from the kept pieces and the
 * audio in `current`. The caller renames it into place.
 */
export const rebuildFromUndo = async (
  piece: TUndoPiece,
  folder: string,
  current: string,
  temporary: string,
): Promise<void> => {
  if (piece.kind === 'whole') {
    await fs.promises.copyFile(path.join(folder, piece.copy), temporary);
    return;
  }
  const out = await fs.promises.open(temporary, 'w');
  try {
    await out.write(await fs.promises.readFile(path.join(folder, piece.head)));
    const source = await fs.promises.open(current, 'r');
    try {
      for (let at = piece.start; at < piece.end; at += CHUNK) {
        // eslint-disable-next-line no-await-in-loop -- the audio, copied a chunk at a time
        const chunk = await readAt(source, at, Math.min(CHUNK, piece.end - at));
        // eslint-disable-next-line no-await-in-loop -- see above
        await out.write(chunk);
      }
    } finally {
      await source.close();
    }
    await out.write(await fs.promises.readFile(path.join(folder, piece.tail)));
    await out.sync();
  } finally {
    await out.close();
  }
};
