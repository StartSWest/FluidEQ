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
    const me = access.accountId();
    const auth = me ? await access.auth() : undefined;
    if (!auth || access.accountId() !== me) {
      return { ok: false, reason: 'signed-out' };
    }
    const outcome = await listPublished(auth);
    return access.accountId() === me
      ? outcome
      : { ok: false, reason: 'signed-out' };
  });

  ipcMain.handle(
    'plus-gallery-unpublish',
    async (_event, sceneId: unknown): Promise<TUnpublishOutcome> => {
      const me = access.accountId();
      const official =
        typeof sceneId === 'string' && sceneId.startsWith('premium:');
      const id = official ? (sceneId as string).slice(8) : sceneId;
      const ref = me ? sceneRefOf(me, id) : undefined;
      const auth = ref ? await access.auth() : undefined;
      if (!ref || !auth || access.accountId() !== me) {
        return { ok: false, reason: 'signed-out' };
      }
      // The prefix selects a namespace, never grants permission. The server
      // checks the caller's official publishing capability before deletion.
      return unpublishScene(
        auth,
        official ? `premium:${ref.packId}` : ref.packId,
      );
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
      // Capture the author before any await: switching accounts during the
      // project read must not publish this member's work under the next one.
      const me = access.accountId();
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
      // The account the server will record the agreement for is the one this
      // token belongs to, so the two are taken together.
      const auth = await access.auth();
      if (!auth || !me || access.accountId() !== me) {
        return { ok: false, reason: 'signed-out' };
      }
      if (!access.entitled()) {
        return { ok: false, reason: 'not-entitled' };
      }
      if (activeFolder() !== folder) {
        return { ok: false, reason: 'no-build' };
      }
      const published = await publishScene(auth, {
        termsVersion,
        category,
        pack: build.pack,
        picture: Buffer.from(picture).toString('base64'),
      });
      if (published.ok) {
        // The server recorded the agreement with the publication, for this
        // account; so is this.
        writeAgreedTerms(userDataDir, me, termsVersion);
        // The completion belongs to the original author; a new account must
        // not adopt its agreement through the current-account callback.
        if (access.accountId() === me) {
          onTermsAgreed?.(termsVersion);
        }
      }
      return published;
    },
  );

  return {
    dispose: () =>
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel)),
  };
};
