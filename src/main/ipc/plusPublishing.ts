import { ipcMain } from 'electron';
import { isPlusCategory, type IPublishedScene } from '../../common/plusGallery';
import { readProject } from '../memberScenes/project';
import { writeAgreedTerms } from '../memberScenes/termsAgreement';
import {
  isWebp,
  listPublished,
  MAX_PICTURE_BYTES,
  publishScene,
  unpublishScene,
  type TGalleryFailure,
  type TPublishFailure,
} from '../plus/galleryApi';
import { sceneRefOf, type IGalleryAccess } from '../plus/galleryAccess';

/**
 * The member's own side of the gallery, over IPC: Publish from the Studio,
 * the list of what they have published, and taking a scene down.
 *
 * Publish reads the Studio's open project from disk in this process, never a
 * pack the page holds; the only bytes the page sends are the picture, which
 * must be a small WebP by its own header. The list and unpublishing need only
 * the account, not Plus: a membership that ended must still be able to take
 * its work out of the gallery.
 */

export type TMineOutcome =
  | { ok: true; scenes: IPublishedScene[] }
  | { ok: false; reason: TGalleryFailure };

export type TPublishOutcome =
  | { ok: true }
  | { ok: false; reason: TPublishFailure | 'no-build' | 'no-picture' };

export type TUnpublishOutcome =
  { ok: true } | { ok: false; reason: TPublishFailure };

export interface IPlusPublishingIpcDeps {
  access: IGalleryAccess;
  userDataDir: string;
  /** The Studio's open project's folder, from its own registration. */
  activeFolder: () => string | undefined;
  /** A publication recorded an agreement to this version of the Plus terms. */
  onTermsAgreed?: (version: number) => void;
}

const CHANNELS = [
  'plus-gallery-mine',
  'plus-gallery-unpublish',
  'studio-publish',
] as const;

/** The page's picture as bytes, whether it arrived as a view or a buffer. */
const pictureBytes = (value: unknown): Uint8Array | undefined => {
  let bytes: Uint8Array | undefined;
  if (value instanceof Uint8Array) {
    bytes = value;
  } else if (value instanceof ArrayBuffer) {
    bytes = new Uint8Array(value);
  }
  return bytes && bytes.length <= MAX_PICTURE_BYTES && isWebp(bytes)
    ? bytes
    : undefined;
};

export const registerPlusPublishingIpc = ({
  access,
  userDataDir,
  activeFolder,
  onTermsAgreed,
}: IPlusPublishingIpcDeps) => {
  ipcMain.handle('plus-gallery-mine', async (): Promise<TMineOutcome> => {
    const auth = access.accountId() ? await access.auth() : undefined;
    return auth ? listPublished(auth) : { ok: false, reason: 'signed-out' };
  });

  ipcMain.handle(
    'plus-gallery-unpublish',
    async (_event, sceneId: unknown): Promise<TUnpublishOutcome> => {
      const me = access.accountId();
      const ref = me ? sceneRefOf(me, sceneId) : undefined;
      const auth = ref ? await access.auth() : undefined;
      if (!ref || !auth) {
        return { ok: false, reason: 'signed-out' };
      }
      return unpublishScene(auth, ref.packId);
    },
  );

  ipcMain.handle(
    'studio-publish',
    async (
      _event,
      termsVersion: unknown,
      category: unknown,
      rawPicture: unknown,
    ): Promise<TPublishOutcome> => {
      if (!access.entitled()) {
        return { ok: false, reason: 'not-entitled' };
      }
      const folder = activeFolder();
      if (
        !folder ||
        typeof termsVersion !== 'number' ||
        !Number.isInteger(termsVersion) ||
        !isPlusCategory(category)
      ) {
        return { ok: false, reason: 'no-build' };
      }
      const picture = pictureBytes(rawPicture);
      if (!picture) {
        return { ok: false, reason: 'no-picture' };
      }
      // Read the folder again rather than trusting the last watched build:
      // the press may land between a save and the watcher's rebuild.
      const build = await readProject(folder);
      if (!build.ok) {
        return { ok: false, reason: 'no-build' };
      }
      const auth = await access.auth();
      if (!auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const published = await publishScene(auth, {
        termsVersion,
        category,
        pack: build.pack,
        picture: Buffer.from(picture).toString('base64'),
      });
      if (published.ok) {
        // The server recorded the agreement with the publication.
        writeAgreedTerms(userDataDir, termsVersion);
        onTermsAgreed?.(termsVersion);
      }
      return published;
    },
  );

  return {
    dispose: () =>
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel)),
  };
};
