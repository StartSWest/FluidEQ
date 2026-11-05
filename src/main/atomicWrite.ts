import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Write a file so that a crash mid-write leaves the previous contents intact.
 *
 * Written beside the target and renamed over it. Every store in the main
 * process that keeps a small JSON file does this — the credential stores, the
 * pack cache, the usage ledger — and each had its own copy of these twelve
 * lines until this one. The cleanup in the failure branch is what keeps a
 * half-written `.tmp` from being mistaken for a real file later.
 */
const writeFileAtomically = (
  filePath: string,
  contents: string | Uint8Array,
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
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Preserve the original error if cleanup also fails.
    }
    throw error;
  }
};

export default writeFileAtomically;
