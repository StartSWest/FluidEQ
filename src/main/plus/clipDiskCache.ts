import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { MAX_PREVIEW_BYTES } from '../../common/scenePreviewMedia';
import { asGalleryClip } from './galleryClip';

/** Clips belong to an immutable scene version, not its mutable catalogue
 * date. Keep current versions across sessions without picture-cache eviction.
 * Replace older versions only after the new, validated file is safely on disk. */
export default function createClipDiskCache(dir: string) {
  const prefixOf = (scene: string) =>
    createHash('sha256').update(scene).digest('hex');
  const fileOf = (scene: string, version: number) =>
    path.join(dir, `${prefixOf(scene)}.${version}.clip`);
  let writing = Promise.resolve();
  return {
    read: async (scene: string, version: number) => {
      const file = fileOf(scene, version);
      try {
        const stat = await fs.promises.stat(file);
        if (stat.size > MAX_PREVIEW_BYTES) {
          throw new Error('Oversized cached clip');
        }
        const bytes = new Uint8Array(await fs.promises.readFile(file));
        if (!asGalleryClip(bytes)) {
          throw new Error('Invalid cached clip');
        }
        return bytes;
      } catch {
        await fs.promises.rm(file, { force: true }).catch(() => undefined);
        return undefined;
      }
    },
    write: (scene: string, version: number, bytes: Uint8Array) => {
      const commit = async () => {
        if (!asGalleryClip(bytes)) {
          throw new Error('Invalid clip');
        }
        const file = fileOf(scene, version);
        const temporary = `${file}.${randomUUID()}.tmp`;
        await fs.promises.mkdir(dir, { recursive: true });
        const prefix = `${prefixOf(scene)}.`;
        const existing = await fs.promises.readdir(dir);
        // An older download finishing late may play for its old page, but must
        // never resurrect an obsolete file after a newer version was committed.
        if (
          existing.some(
            (name) =>
              name.startsWith(prefix) &&
              name.endsWith('.clip') &&
              Number(name.slice(prefix.length, -5)) > version,
          )
        ) {
          return;
        }
        try {
          await fs.promises.writeFile(temporary, bytes, { flag: 'wx' });
          await fs.promises.rename(temporary, file);
        } finally {
          await fs.promises
            .rm(temporary, { force: true })
            .catch(() => undefined);
        }
        const names = await fs.promises.readdir(dir);
        await Promise.all(
          names
            .filter((name) => {
              if (!name.startsWith(prefix) || !name.endsWith('.clip')) {
                return false;
              }
              const older = Number(name.slice(prefix.length, -5));
              return Number.isSafeInteger(older) && older < version;
            })
            .map((name) =>
              fs.promises.rm(path.join(dir, name), { force: true }),
            ),
        );
      };
      const result = writing.then(commit, commit);
      writing = result.catch(() => undefined);
      return result;
    },
  };
}
