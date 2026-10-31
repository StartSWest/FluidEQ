import { createBoundedDiskCache, type IDiskCache } from './boundedDiskCache';
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
 * A file that does not read back as a WebP of a size the gallery accepts is
 * not returned, and is deleted (`boundedDiskCache.ts`).
 */

export type IPictureDiskCache = IDiskCache;

export const createPictureDiskCache = ({
  dir,
  maxBytes,
}: {
  dir: string;
  maxBytes: number;
}): IPictureDiskCache =>
  createBoundedDiskCache({
    dir,
    maxBytes,
    extension: '.webp',
    accepts: (bytes) =>
      bytes.length <= MAX_PICTURE_BYTES && isCardPicture(bytes),
  });
