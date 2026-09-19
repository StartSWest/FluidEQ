import { ipcMain } from 'electron';
import {
  heldVersionOf,
  isPlusCategory,
  type IPublishedScene,
  type IVersionFloor,
} from '../../common/plusGallery';
import {
  settingsOfPack,
  type ISceneSettings,
} from '../../common/sceneSettings';
import { readVersionNote } from '../../common/sceneVersionNote';
import { readProject } from '../memberScenes/project';
import { raiseProjectVersion } from '../memberScenes/projectVersion';
import { openMemberEnvelope } from '../memberScenes/sharing';
import { writeAgreedTerms } from '../memberScenes/termsAgreement';
import {
  fetchEnvelope,
  isCardPicture,
  listPublished,
  listVersionFloors,
  MAX_PICTURE_BYTES,
  publishScene,
  unpublishScene,
  type IAuthorised,
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
  | {
      ok: true;
      scenes: IPublishedScene[];
      /**
       * The highest version each of these scenes, and each one unpublished,
       * was ever out at (server migration 0039): what a publication of it
       * has to go out above.
       */
      floors: IVersionFloor[];
    }
  | { ok: false; reason: TGalleryFailure };

export type TPublishOutcome =
  /**
   * `review` when it waits for the admin before anybody else sees it — every
   * member's publication (fluideq-premium 0037). Absent when it went straight
   * out: the admin's own, or FluidEQ's.
   */
  | { ok: true; review?: 'pending' }
  | {
      ok: false;
      reason: TPublishFailure | 'no-build' | 'no-picture' | 'inspect-only';
    };

export type TUnpublishOutcome =
  { ok: true } | { ok: false; reason: TPublishFailure };

/**
 * Where the open project's settings stood when it was last published.
 *
 * `ok` with no `published` is a scene that has never been published, which is
 * a real answer. `ok: false` is "could not ask" — signed out, offline, a file
 * whose signature does not verify — and the Studio then resets to the scene's
 * own settings rather than pretending it was never published.
 */
export type TPublishedSettingsOutcome =
  | { ok: true; published?: { version: number; settings: ISceneSettings } }
  | { ok: false };

export interface IPlusPublishingIpcDeps {
  access: IGalleryAccess;
  userDataDir: string;
  /** The Studio's open project's folder, from its own registration. */
  activeFolder: () => string | undefined;
  /** Whether that project is a FluidEQ scene, opened only to look inside. */
  activeIsInspection: () => boolean;
  /** A publication recorded an agreement to this version of the Plus terms. */
  onTermsAgreed?: (version: number) => void;
  onPublished?: () => void;
}

const CHANNELS = [
  'plus-gallery-mine',
  'plus-gallery-unpublish',
  'studio-publish',
  'studio-published-settings',
] as const;

/**
 * This account's published scenes and its version floors, read together: a
 * publication's number is decided from both, and the dialog shows the number
 * the press will send, so the two can never be asked apart.
 */
const mineOf = async (auth: IAuthorised): Promise<TMineOutcome> => {
  const [listed, floors] = await Promise.all([
    listPublished(auth),
    listVersionFloors(auth),
  ]);
  if (!listed.ok) {
    return listed;
  }
  if (!floors.ok) {
    return floors;
  }
  return { ok: true, scenes: listed.scenes, floors: floors.floors };
};

/** The page's picture as bytes, whether it arrived as a view or a buffer. */
const pictureBytes = (value: unknown): Uint8Array | undefined => {
  let bytes: Uint8Array | undefined;
  if (value instanceof Uint8Array) {
    bytes = value;
  } else if (value instanceof ArrayBuffer) {
    bytes = new Uint8Array(value);
  }
  return bytes && bytes.length <= MAX_PICTURE_BYTES && isCardPicture(bytes)
    ? bytes
    : undefined;
};

export const registerPlusPublishingIpc = ({
  access,
  userDataDir,
  activeFolder,
  activeIsInspection,
  onTermsAgreed,
  onPublished,
}: IPlusPublishingIpcDeps) => {
  ipcMain.handle('plus-gallery-mine', async (): Promise<TMineOutcome> => {
    const me = access.accountId();
    const auth = me ? await access.auth() : undefined;
    if (!auth || access.accountId() !== me) {
      return { ok: false, reason: 'signed-out' };
    }
    const outcome = await mineOf(auth);
    return access.accountId() === me
      ? outcome
      : { ok: false, reason: 'signed-out' };
  });

  /**
   * What the open project looked like when it was last published — the one
   * thing the Studio's Reset goes back to.
   *
   * The pack id comes off the folder on disk rather than from the page, as
   * publishing does: this only ever reads the caller's own published scene,
   * but the two should not disagree about which project is open. The file is
   * opened through the same door as every shared scene, so a settings value
   * only reaches a slider from a signature that verifies.
   */
  ipcMain.handle(
    'studio-published-settings',
    async (): Promise<TPublishedSettingsOutcome> => {
      const me = access.accountId();
      const folder = activeFolder();
      if (!me || !folder || activeIsInspection()) {
        return { ok: false };
      }
      const build = await readProject(folder);
      if (!build.ok) {
        return { ok: false };
      }
      const auth = await access.auth();
      if (!auth || access.accountId() !== me) {
        return { ok: false };
      }
      const mine = await listPublished(auth);
      if (!mine.ok) {
        return { ok: false };
      }
      const scene = mine.scenes.find(
        (entry) => !entry.official && entry.sceneId === build.pack.id,
      );
      if (!scene) {
        return { ok: true };
      }
      const envelope = await fetchEnvelope(auth, me, scene.sceneId);
      const payload = envelope ? openMemberEnvelope(envelope) : null;
      if (!payload || payload.pack.id !== build.pack.id) {
        return { ok: false };
      }
      return {
        ok: true,
        published: {
          version: payload.pack.version,
          settings: settingsOfPack(payload.pack),
        },
      };
    },
  );

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
      category2?: unknown,
      rawNote?: unknown,
    ): Promise<TPublishOutcome> => {
      if (!access.entitled()) {
        return { ok: false, reason: 'not-entitled' };
      }
      // Cleaned here as the server cleans it; one it would refuse is refused
      // before a picture or a pack is sent.
      const note = readVersionNote(rawNote);
      if (note === undefined) {
        return { ok: false, reason: 'refused' };
      }
      // Capture the author before any await: switching accounts during the
      // project read must not publish this member's work under the next one.
      const me = access.accountId();
      const folder = activeFolder();
      if (
        !folder ||
        typeof termsVersion !== 'number' ||
        !Number.isInteger(termsVersion) ||
        !isPlusCategory(category) ||
        // Optional, and never the first again — as the server checks too.
        (category2 !== undefined &&
          (!isPlusCategory(category2) || category2 === category))
      ) {
        return { ok: false, reason: 'no-build' };
      }
      if (activeIsInspection()) {
        return { ok: false, reason: 'inspect-only' };
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
      const sceneId = build.pack.id;
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
      // A scene's content may only change under a higher version, so every
      // publication goes out above the one the gallery holds — written into
      // the project first, then read back, so the pack that gets signed and
      // the file on disk carry the same number. Sending a raised version
      // without writing it would leave the maker's next build one behind and
      // publishing it again would be refused by the server, which is the rule
      // arriving as a wall. Above the floors too: a scene unpublished and
      // published again goes out above what members may still hold.
      const listed = await mineOf(auth);
      if (!listed.ok) {
        return { ok: false, reason: listed.reason };
      }
      const held = heldVersionOf(listed.scenes, sceneId, listed.floors);
      if ((await raiseProjectVersion(folder, held)) === 'failed') {
        return { ok: false, reason: 'no-build' };
      }
      const raised = await readProject(folder);
      if (!raised.ok || raised.pack.id !== sceneId) {
        return { ok: false, reason: 'no-build' };
      }
      // Deliberately NOT re-asking who is signed in here, though three awaits
      // have passed. The token was taken for `me` and everything since uses
      // it: the gallery read is that account's gallery and the publication
      // goes out on that token, whoever signed in meanwhile. A publication
      // that completes belongs to the author who started it, which is the
      // rule the terms agreement below is written under.
      if (activeFolder() !== folder) {
        return { ok: false, reason: 'no-build' };
      }
      const published = await publishScene(auth, {
        termsVersion,
        category,
        ...(category2 !== undefined ? { category2 } : {}),
        pack: raised.pack,
        picture: Buffer.from(picture).toString('base64'),
        ...(note ? { note } : {}),
      });
      if (published.ok) {
        // The server recorded the agreement with the publication, for this
        // account; so is this.
        writeAgreedTerms(userDataDir, me, termsVersion);
        // The completion belongs to the original author; a new account must
        // not adopt its agreement through the current-account callback.
        if (access.accountId() === me) {
          onTermsAgreed?.(termsVersion);
          onPublished?.();
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
