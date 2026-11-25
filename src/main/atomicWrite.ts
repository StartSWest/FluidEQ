import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * `contents` written whole to a fresh temporary beside `filePath` - same
 * directory, so the replacement stays on one filesystem - then handed to
 * `publish`, and the temporary removed if anything failed. The cleanup in the
 * failure branch is what keeps a half-written `.tmp` from being mistaken for
 * a real file later.
 */
const viaTemporary = (
  filePath: string,
  contents: string | Uint8Array,
  publish: (temporaryPath: string) => void,
  mode?: number,
): void => {
  // A sibling name independent of the target also preserves long basenames.
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.fluideq-${process.pid}-${randomUUID()}.tmp`,
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // A predictable temporary can be a supplied symlink or hard link. Create
  // exclusively, and never clean up a name this call did not create.
  const handle = fs.openSync(temporaryPath, 'wx', mode);
  try {
    try {
      fs.writeFileSync(handle, contents, { encoding: 'utf8' });
    } finally {
      fs.closeSync(handle);
    }
    publish(temporaryPath);
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Preserve the original error if cleanup also fails.
    }
    throw error;
  }
};

/**
 * Write a file so that a crash mid-write leaves the previous contents intact.
 *
 * Written beside the target and renamed over it. Every store in the main
 * process that keeps a small JSON file does this — the credential stores, the
 * pack cache, the usage ledger — and each had its own copy of these twelve
 * lines until this one.
 */
const writeFileAtomically = (
  filePath: string,
  contents: string | Uint8Array,
  mode?: number,
): void =>
  viaTemporary(
    filePath,
    contents,
    (temporaryPath) => fs.renameSync(temporaryPath, filePath),
    mode,
  );

/**
 * The codes Windows answers a rename with while another program has either
 * file open: EPERM for a reader of the file being replaced, even one sharing
 * delete; EBUSY for one holding the fresh temporary without sharing it, as a
 * virus scanner does the moment a new file closes. Measured on 2026-11-25,
 * each refused at once; the same contents written in place got through every
 * time. `asyncWriter.ts` answers the engine's watcher the same way.
 */
const REPLACE_BLOCKED = new Set(['EPERM', 'EACCES', 'EBUSY']);

const isReplaceBlocked = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  REPLACE_BLOCKED.has(String((error as { code: unknown }).code));

/**
 * `contents` written over `filePath` where it stands, for when the rename
 * was refused: written first and cut to length after, never truncated first,
 * so a reader never meets an empty file. Only a plain file with one name is
 * written through - a link would carry the write to whatever it names, which
 * the rename never does - and only the file that was checked: `refused` is
 * thrown for anything else. A file that is not there is created, never
 * followed.
 */
const overwriteInPlace = (
  filePath: string,
  contents: string,
  refused: unknown,
): void => {
  let held: fs.Stats | undefined;
  try {
    held = fs.lstatSync(filePath);
  } catch {
    held = undefined;
  }
  if (held && (!held.isFile() || held.nlink !== 1)) {
    throw refused;
  }
  const bytes = Buffer.from(contents, 'utf8');
  const handle = fs.openSync(filePath, held ? 'r+' : 'wx');
  try {
    const opened = fs.fstatSync(handle);
    if (held && (opened.ino !== held.ino || opened.dev !== held.dev)) {
      throw refused;
    }
    fs.writeFileSync(handle, bytes);
    fs.ftruncateSync(handle, bytes.length);
  } finally {
    fs.closeSync(handle);
  }
};

/**
 * `writeFileAtomically` for a file other programs read while it is written:
 * one in a folder OneDrive syncs, a virus scanner watches, or the member's AI
 * has open. A plain rename is refused while any of them holds either file,
 * and the write was simply lost - the Studio chat's publish line failed that
 * way on Alpine's OneDrive folder (2026-11-25) and the chat wrote the notes
 * by hand instead. Refused, the same contents go over the file in place.
 */
export const writeFileOverReaders = (
  filePath: string,
  contents: string,
): void =>
  viaTemporary(filePath, contents, (temporaryPath) => {
    try {
      fs.renameSync(temporaryPath, filePath);
    } catch (error) {
      if (!isReplaceBlocked(error)) {
        throw error;
      }
      overwriteInPlace(filePath, contents, error);
      try {
        fs.rmSync(temporaryPath, { force: true });
      } catch {
        // The file is written. A temporary the scanner still holds stays
        // behind as a dot-file nothing reads, never a reason to report the
        // write as failed.
      }
    }
  });

export default writeFileAtomically;
