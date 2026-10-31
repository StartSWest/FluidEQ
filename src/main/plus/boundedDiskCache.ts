import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Files kept on disk between sessions, bounded by the bytes they take: once
 * over, the files looked at longest ago go first, and reading one marks it
 * looked at. A file is named by a key that never names two different
 * contents, so nothing here is ever out of date — a new content has a new key
 * and is simply fetched.
 *
 * What comes back is checked by `accepts` every time it is read; a file that
 * fails is deleted, so a torn write is fetched again rather than kept. Each
 * write lands in a temporary file beside it and is renamed into place.
 */

export interface IDiskCache {
  read(key: string): Promise<Uint8Array | undefined>;
  write(key: string, bytes: Uint8Array): Promise<void>;
}

export const createBoundedDiskCache = ({
  dir,
  maxBytes,
  extension,
  accepts,
}: {
  dir: string;
  maxBytes: number;
  /** Every file this cache writes ends with it; only those are counted. */
  extension: string;
  /** Whether bytes read back are still what was written. */
  accepts: (bytes: Uint8Array) => boolean;
}): IDiskCache => {
  const fileOf = (key: string) =>
    path.join(
      dir,
      `${createHash('sha256').update(key).digest('hex')}${extension}`,
    );
  // Evictions run one at a time, so two writes finishing together cannot
  // both decide to delete the same oldest files.
  let trimming = Promise.resolve();

  const trim = async () => {
    const names = await fs.promises.readdir(dir).catch(() => []);
    const files = (
      await Promise.all(
        names
          .filter((name) => name.endsWith(extension))
          .map(async (name) => {
            const file = path.join(dir, name);
            const stat = await fs.promises.stat(file).catch(() => undefined);
            return stat ? { file, size: stat.size, used: stat.mtimeMs } : [];
          }),
      )
    ).flat();
    let total = files.reduce((sum, entry) => sum + entry.size, 0);
    const oldestFirst = [...files].sort((a, b) => a.used - b.used);
    // One after another, oldest first, until the rest fit.
    await oldestFirst.reduce(async (previous, entry) => {
      await previous;
      if (total <= maxBytes) {
        return;
      }
      await fs.promises.rm(entry.file, { force: true });
      total -= entry.size;
    }, Promise.resolve());
  };

  return {
    read: async (key) => {
      const file = fileOf(key);
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await fs.promises.readFile(file));
      } catch {
        // Not kept, or not readable: the network is asked, as it always was.
        return undefined;
      }
      if (!accepts(bytes)) {
        await fs.promises.rm(file, { force: true });
        return undefined;
      }
      const now = new Date();
      // Looked at now, for the eviction order. A failure leaves it older than
      // it is, which only means it goes a little sooner.
      await fs.promises.utimes(file, now, now).catch(() => undefined);
      return bytes;
    },
    write: async (key, bytes) => {
      const file = fileOf(key);
      const temporary = `${file}.tmp`;
      await fs.promises.mkdir(dir, { recursive: true });
      try {
        await fs.promises.writeFile(temporary, bytes);
        await fs.promises.rename(temporary, file);
      } catch (error) {
        await fs.promises.rm(temporary, { force: true });
        throw error;
      }
      trimming = trimming.then(trim, trim);
      await trimming;
    },
  };
};
