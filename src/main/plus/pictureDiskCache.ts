import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { isCardPicture, MAX_PICTURE_BYTES } from './galleryApi';

/**
 * Gallery pictures kept on disk between sessions.
 *
 * A picture is named by its scene, its version and when that version was
 * published, so a file here is never out of date: a scene republished with a
 * new picture has a new name and is simply fetched. Without this every
 * session downloaded every card it showed again — a dozen or more 100-400KB
 * files a page, each one a storage request that runs the bucket's access
 * check — for pictures that had not changed, which is the part of opening the
 * gallery that grows with every member.
 *
 * Bounded by bytes: once over, the pictures looked at longest ago go first.
 * Reading one marks it looked at. A file that does not read back as a WebP of
 * a size the gallery accepts is not returned — and is deleted, so a torn
 * write is fetched again rather than kept.
 */

export interface IPictureDiskCache {
  read(key: string): Promise<Uint8Array | undefined>;
  write(key: string, bytes: Uint8Array): Promise<void>;
}

const fileOf = (dir: string, key: string) =>
  path.join(dir, `${createHash('sha256').update(key).digest('hex')}.webp`);

export const createPictureDiskCache = ({
  dir,
  maxBytes,
}: {
  dir: string;
  maxBytes: number;
}): IPictureDiskCache => {
  // Evictions run one at a time, so two writes finishing together cannot
  // both decide to delete the same oldest files.
  let trimming = Promise.resolve();

  const trim = async () => {
    const names = await fs.promises.readdir(dir).catch(() => []);
    const files = (
      await Promise.all(
        names
          .filter((name) => name.endsWith('.webp'))
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
      const file = fileOf(dir, key);
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await fs.promises.readFile(file));
      } catch {
        // Not kept, or not readable: the network is asked, as it always was.
        return undefined;
      }
      if (bytes.length > MAX_PICTURE_BYTES || !isCardPicture(bytes)) {
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
      const file = fileOf(dir, key);
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
