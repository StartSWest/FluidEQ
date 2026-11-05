import { ipcMain } from 'electron';
import { MAX_PREVIEW_BYTES } from '../../common/scenePreviewMedia';
import {
  createBoundedDiskCache,
  type IDiskCache,
} from '../plus/boundedDiskCache';
import { sceneRefOf, type IGalleryAccess } from '../plus/galleryAccess';
import {
  asGalleryClip,
  fetchGalleryClip,
  type IGalleryClip,
} from '../plus/galleryClip';

/**
 * A published scene's clip, for its page (`plus-gallery-clip`). Anybody
 * signed in may watch it: the bucket's own rule (premium 0087) says the same,
 * and a member's page never asks for the scene's code to show it.
 *
 * Kept on disk by the scene's version and when it was published, like the
 * pictures: a published version is bound to exactly one clip, so a clip once
 * watched is never downloaded again — each view of a page would otherwise be
 * a whole file from the bucket. Asked twice at once, it is fetched once.
 */

/** About a hundred clips of 0.6 MB, more than a member watches between releases. */
export const CLIP_DISK_BYTES = 64 * 1024 * 1024;

const readRevision = (value: unknown) =>
  typeof value === 'string' &&
  value.length <= 40 &&
  Number.isFinite(Date.parse(value))
    ? value
    : '';

export interface IGalleryClipIpcDeps {
  access: IGalleryAccess;
  /** The block list this computer holds; a blocked scene's clip is not kept. */
  isBlocked: (authorId: string, sceneId: string) => boolean;
  /** Where clips are kept between sessions. Without one, nothing is kept. */
  clipDir?: string;
  logger?: { warn(message: string): void };
}

export const registerGalleryClipIpc = ({
  access,
  isBlocked,
  clipDir,
  logger,
}: IGalleryClipIpcDeps): { dispose(): void } => {
  const kept: IDiskCache | undefined = clipDir
    ? createBoundedDiskCache({
        dir: clipDir,
        maxBytes: CLIP_DISK_BYTES,
        extension: '.clip',
        accepts: (bytes) =>
          bytes.length <= MAX_PREVIEW_BYTES &&
          asGalleryClip(bytes) !== undefined,
      })
    : undefined;
  const inFlight = new Map<string, Promise<IGalleryClip | undefined>>();

  const clip = async (
    authorId: string,
    sceneId: string,
    version: number,
    revision: string,
  ): Promise<IGalleryClip | undefined> => {
    if (isBlocked(authorId, sceneId)) {
      return undefined;
    }
    const key = `${authorId}/${sceneId}@${version}:${revision}`;
    // From disk only with a revision to name it by: without one the file
    // could be an earlier version's clip.
    const fromDisk = revision ? await kept?.read(key) : undefined;
    if (fromDisk) {
      return asGalleryClip(fromDisk);
    }
    const auth = await access.auth();
    const fetched = auth
      ? await fetchGalleryClip(auth, authorId, sceneId)
      : undefined;
    if (fetched && revision) {
      // A disk that will not take it costs only that: the clip still plays.
      await kept
        ?.write(key, fetched.bytes)
        .catch((error) =>
          logger?.warn(`Could not keep a gallery clip: ${String(error)}`),
        );
    }
    return fetched;
  };

  ipcMain.handle(
    'plus-gallery-clip',
    (
      _event,
      authorId: unknown,
      sceneId: unknown,
      version: unknown,
      rawRevision: unknown,
    ): Promise<IGalleryClip | undefined> | undefined => {
      const ref = sceneRefOf(authorId, sceneId);
      if (
        !ref ||
        access.accountId() === undefined ||
        typeof version !== 'number' ||
        !Number.isInteger(version) ||
        version < 1
      ) {
        return undefined;
      }
      const revision = readRevision(rawRevision);
      const key = `${ref.authorId}/${ref.packId}@${version}:${revision}`;
      const pending = inFlight.get(key);
      if (pending) {
        return pending;
      }
      const request = clip(ref.authorId, ref.packId, version, revision).finally(
        () => inFlight.delete(key),
      );
      inFlight.set(key, request);
      return request;
    },
  );

  return {
    dispose: () => ipcMain.removeHandler('plus-gallery-clip'),
  };
};
