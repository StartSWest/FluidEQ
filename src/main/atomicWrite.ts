import fs from 'fs';
import path from 'path';

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
  contents: string,
  mode?: number,
): void => {
  const temporaryPath = `${filePath}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(temporaryPath, contents, { encoding: 'utf8', mode });
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
