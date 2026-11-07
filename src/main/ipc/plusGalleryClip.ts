import { ipcMain } from 'electron';
import createClipDiskCache from '../plus/clipDiskCache';
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
 * Kept on disk by the scene's version: a published version is bound to one
 * immutable clip, so a clip once
 * watched is never downloaded again — each view of a page would otherwise be
 * a whole file from the bucket. Asked twice at once, it is fetched once.
 */

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
  const kept = clipDir ? createClipDiskCache(clipDir) : undefined;
  const inFlight = new Map<string, Promise<IGalleryClip | undefined>>();

  const clip = async (
    authorId: string,
    sceneId: string,
    version: number,
  ): Promise<IGalleryClip | undefined> => {
    const account = access.accountId();
    const allowed = () =>
      account !== undefined &&
      access.accountId() === account &&
      !isBlocked(authorId, sceneId);
    if (isBlocked(authorId, sceneId)) {
      return undefined;
    }
    const scene = `${authorId}/${sceneId}`;
    const fromDisk = await kept?.read(scene, version);
    if (!allowed()) {
      return undefined;
    }
    if (fromDisk) {
      return asGalleryClip(fromDisk);
    }
    const auth = await access.auth();
    if (!allowed()) {
      return undefined;
    }
    const fetched = auth
      ? await fetchGalleryClip(auth, authorId, sceneId, version)
      : undefined;
    if (!allowed()) {
      return undefined;
    }
    if (fetched) {
      // A disk that will not take it costs only that: the clip still plays.
      await kept
        ?.write(scene, version, fetched.bytes)
        .catch((error) =>
          logger?.warn(`Could not keep a gallery clip: ${String(error)}`),
        );
    }
    return allowed() ? fetched : undefined;
  };

  ipcMain.handle(
    'plus-gallery-clip',
    (
      _event,
      authorId: unknown,
      sceneId: unknown,
      version: unknown,
    ): Promise<IGalleryClip | undefined> | undefined => {
      const ref = sceneRefOf(authorId, sceneId);
      if (
        !ref ||
        access.accountId() === undefined ||
        typeof version !== 'number' ||
        !Number.isSafeInteger(version) ||
        version < 1
      ) {
        return undefined;
      }
      const key = `${access.accountId()}:${ref.authorId}/${ref.packId}@${version}`;
      const pending = inFlight.get(key);
      if (pending) {
        return pending;
      }
      const request = clip(ref.authorId, ref.packId, version).finally(() =>
        inFlight.delete(key),
      );
      inFlight.set(key, request);
      return request;
    },
  );

  return {
    dispose: () => ipcMain.removeHandler('plus-gallery-clip'),
  };
};
