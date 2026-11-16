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
 * One song's tags written into its file, atomically.
 *
 * Never in place: the file is copied beside itself, the copy is tagged and
 * checked, what Undo needs is kept, and only then is the copy renamed over
 * the original — the one step the filesystem does all at once. A crash, a
 * full disk or a tagger bug in any earlier step leaves the song exactly as
 * it was; the copy is removed.
 *
 * The check is not ceremony. node-taglib-sharp 6.0.3 could read a tag's
 * padding as a frame running to the end of the file and write the whole
 * file into the new tag (its issue #144, patched where it lives in
 * `patches/node-taglib-sharp@6.0.3.patch`); a file that grows by more than
 * its new cover and a little text is refused whatever the cause.
 */

import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import type { TTagFormat } from '../../common/library/tagFields';
import { applyTagEdit, type IValidatedEdit } from './tagApply';
import { openTagFile } from './tagFormats';
import { keepForUndo, rebuildFromUndo, type TUndoPiece } from './tagUndo';
import { readLibraryTags } from './libraryMetadata';

/** Text and padding a write may add beyond its new cover. */
const GROWTH_ALLOWANCE = 2 * 1024 * 1024;

/** How far the length the Library reads may move before the write is
 * called broken: an encoder's delay is read from tags some files carry. */
const DURATION_TOLERANCE_MS = 1500;

export type TFileWriteOutcome =
  | {
      state: 'written';
      piece: TUndoPiece;
      writtenSize: number;
      writtenMtimeMs: number;
    }
  | { state: 'locked' | 'read-only' | 'missing' | 'failed' };

/**
 * Windows answers a rename over a file another program holds open with one
 * of these. EACCES is also read-only's answer, which is asked about first.
 */
const isLockError = (error: unknown): boolean =>
  error instanceof Error &&
  'code' in error &&
  (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES');

const temporaryBeside = (filePath: string): string =>
  path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomBytes(4).toString('hex')}.fluideq-tags`,
  );

const removeQuietly = async (filePath: string): Promise<void> => {
  try {
    await fs.promises.rm(filePath, { force: true });
  } catch (error) {
    // eslint-disable-next-line no-console -- context-rich error; a stray temporary is left beside the song
    console.error(`Could not remove ${filePath}`, error);
  }
};

/** Read-only is the attribute's, asked of the mode Node maps it to. */
// eslint-disable-next-line no-bitwise -- the owner-write bit
const isWritableMode = (mode: number): boolean => (mode & 0o200) !== 0;

export interface IFileWriteRequest {
  filePath: string;
  format: TTagFormat;
  edit: IValidatedEdit;
  /** The length the Library holds for the song, for the after-write check. */
  durationMs?: number;
  undoFolder: string;
  undoName: string;
  /** "Make writable and write": clear read-only for this write only. */
  makeWritable: boolean;
}

/**
 * Re-reads the copy as the Library would: it must parse, keep its length,
 * and not have grown past its new cover.
 */
const checkWritten = async (
  request: IFileWriteRequest,
  temporary: string,
  beforeSize: number,
): Promise<boolean> => {
  const afterSize = (await fs.promises.stat(temporary)).size;
  const coverBytes = request.edit.cover ? request.edit.cover.bytes.length : 0;
  if (afterSize - beforeSize > coverBytes + GROWTH_ALLOWANCE) {
    // eslint-disable-next-line no-console -- the one line a report about a refused write needs
    console.error(
      `Refused a tag write that grew ${request.filePath} from ${beforeSize} to ${afterSize} bytes`,
    );
    return false;
  }
  const facts = await readLibraryTags(temporary);
  if (facts.readFailed) {
    return false;
  }
  if (
    request.durationMs !== undefined &&
    facts.durationMs !== undefined &&
    Math.abs(facts.durationMs - request.durationMs) > DURATION_TOLERANCE_MS
  ) {
    // eslint-disable-next-line no-console -- see above
    console.error(
      `Refused a tag write that changed the length of ${request.filePath}`,
    );
    return false;
  }
  return true;
};

export const writeTagsToFile = async (
  request: IFileWriteRequest,
): Promise<TFileWriteOutcome> => {
  const { filePath } = request;
  let stats: fs.Stats;
  try {
    stats = await fs.promises.stat(filePath);
  } catch {
    return { state: 'missing' };
  }
  const wasReadOnly = !isWritableMode(stats.mode);
  if (wasReadOnly && !request.makeWritable) {
    return { state: 'read-only' };
  }
  const temporary = temporaryBeside(filePath);
  try {
    await fs.promises.copyFile(filePath, temporary);
  } catch (error) {
    await removeQuietly(temporary);
    if (isLockError(error)) {
      return { state: 'locked' };
    }
    // eslint-disable-next-line no-console -- context-rich error before the item says it failed
    console.error(`Could not copy ${filePath} to tag it`, error);
    return { state: 'failed' };
  }
  let piece: TUndoPiece | undefined;
  try {
    // The copy carries the read-only attribute with it.
    await fs.promises.chmod(temporary, 0o666);
    const file = openTagFile(temporary, request.format);
    try {
      applyTagEdit(file, request.format, request.edit);
      file.save();
    } finally {
      file.dispose();
    }
    if (!(await checkWritten(request, temporary, stats.size))) {
      await removeQuietly(temporary);
      return { state: 'failed' };
    }
    piece = await keepForUndo(
      filePath,
      temporary,
      request.undoFolder,
      request.undoName,
    );
    if (piece === undefined) {
      await removeQuietly(temporary);
      return { state: 'failed' };
    }
  } catch (error) {
    await removeQuietly(temporary);
    // eslint-disable-next-line no-console -- context-rich error before the item says it failed
    console.error(`Could not write the tags of ${filePath}`, error);
    return { state: 'failed' };
  }
  try {
    if (wasReadOnly) {
      await fs.promises.chmod(filePath, stats.mode | 0o200); // eslint-disable-line no-bitwise -- the owner-write bit
    }
    await fs.promises.rename(temporary, filePath);
  } catch (error) {
    await removeQuietly(temporary);
    if (wasReadOnly) {
      await fs.promises.chmod(filePath, stats.mode).catch(() => undefined);
    }
    if (isLockError(error)) {
      return { state: 'locked' };
    }
    // eslint-disable-next-line no-console -- context-rich error before the item says it failed
    console.error(
      `Could not put the tagged copy of ${filePath} in place`,
      error,
    );
    return { state: 'failed' };
  }
  if (wasReadOnly) {
    // Writable for this write only, as the question said.
    await fs.promises.chmod(filePath, 0o444).catch(() => undefined);
  }
  const written = await fs.promises.stat(filePath);
  return {
    state: 'written',
    piece,
    writtenSize: written.size,
    writtenMtimeMs: written.mtimeMs,
  };
};

export type TFileRestoreOutcome =
  | { state: 'restored' }
  /** Changed since the write, by somebody else: not put back over. */
  | { state: 'changed' }
  | { state: 'locked' | 'read-only' | 'missing' | 'failed' };

/** Puts a written file back as it was before, from what Undo kept. */
export const restoreFromUndo = async (
  filePath: string,
  piece: TUndoPiece,
  undoFolder: string,
  written: { size: number; mtimeMs: number },
): Promise<TFileRestoreOutcome> => {
  let stats: fs.Stats;
  try {
    stats = await fs.promises.stat(filePath);
  } catch {
    return { state: 'missing' };
  }
  if (stats.size !== written.size || stats.mtimeMs !== written.mtimeMs) {
    return { state: 'changed' };
  }
  if (!isWritableMode(stats.mode)) {
    return { state: 'read-only' };
  }
  const temporary = temporaryBeside(filePath);
  try {
    await rebuildFromUndo(piece, undoFolder, filePath, temporary);
    await fs.promises.rename(temporary, filePath);
    return { state: 'restored' };
  } catch (error) {
    await removeQuietly(temporary);
    if (isLockError(error)) {
      return { state: 'locked' };
    }
    // eslint-disable-next-line no-console -- context-rich error before the item says it failed
    console.error(`Could not put back the tags of ${filePath}`, error);
    return { state: 'failed' };
  }
};
