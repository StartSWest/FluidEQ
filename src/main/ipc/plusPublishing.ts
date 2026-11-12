import { ipcMain } from 'electron';
import type { IPublishedScene, IVersionFloor } from '../../common/plusGallery';
import {
  settingsOfPack,
  type ISceneSettings,
} from '../../common/sceneSettings';
import type { IScenePack } from '../../common/scenePacks';
import { readProject } from '../memberScenes/project';
import { openMemberEnvelope } from '../memberScenes/sharing';
import {
  fetchEnvelope,
  listPublished,
  type TGalleryFailure,
} from '../plus/galleryApi';
import {
  authorizeGallery,
  sceneRefOf,
  type IGalleryAccess,
} from '../plus/galleryAccess';
import {
  unpublishScene,
  type TPublishFailure,
} from '../plus/galleryPublishApi';
import {
  mineOf,
  registerStudioPublish,
  STUDIO_PUBLISH_CHANNELS,
} from './studioPublish';

/**
 * The member's own side of the gallery, over IPC: Publish from the Studio,
 * the list of what they have published, and taking a scene down.
 *
 * Publish reads the Studio's open project from disk in this process, never a
 * pack the page holds; the only bytes the page sends are the picture, which
 * must be a small WebP by its own header. It asks what the Studio asks of
 * that project rather than for Plus: a maker keeps one project without Plus
 * because publishing is how they earn it back. The list and unpublishing
 * need only the account: a membership that ended must still be able to take
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
      reason:
        | TPublishFailure
        | 'no-build'
        | 'no-picture'
        | 'inspect-only'
        | 'too-large';
      /** When a block the admin chose ends (`blocked-scene`, `blocked-account`). */
      blockedUntil?: string;
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
  /**
   * Whether that project may be published by who is asking: any with Plus,
   * and without it the one a maker keeps (`projectAccess.ts`). Asked in
   * place of Plus, which refused the one publication that earns a maker's
   * next month — the server takes it (`is_scene_maker`), and says no itself
   * to anybody this lets through by mistake.
   */
  mayPublishActive: () => boolean;
  /** A publication recorded an agreement to this version of the Plus terms. */
  onTermsAgreed?: (version: number) => void;
  /** A publication landed: who published, and the pack exactly as it went out. */
  onPublished?: (author: string, pack: IScenePack) => void;
  /**
   * A version went out from this folder: what the folder holds is it
   * (`publishedRecords.ts`), for the project list's Published mark.
   */
  recordPublished?: (folder: string, sceneId: string, version: number) => void;
  /** This computer's copies fetched now (`studioPublish.ts`). */
  refreshOwnCopy?: (sceneId: string, version: number) => Promise<boolean>;
  logger?: { info(message: string): void; warn(message: string): void };
}

const CHANNELS = [
  'plus-gallery-mine',
  'plus-gallery-unpublish',
  'studio-published-settings',
  ...STUDIO_PUBLISH_CHANNELS,
] as const;

export const registerPlusPublishingIpc = ({
  access,
  userDataDir,
  activeFolder,
  activeIsInspection,
  mayPublishActive,
  onTermsAgreed,
  onPublished,
  recordPublished,
  refreshOwnCopy,
  logger,
}: IPlusPublishingIpcDeps) => {
  // The Studio's Publish, with its timings (`studioPublish.ts`).
  registerStudioPublish({
    access,
    userDataDir,
    activeFolder,
    activeIsInspection,
    mayPublishActive,
    ...(onTermsAgreed ? { onTermsAgreed } : {}),
    ...(onPublished ? { onPublished } : {}),
    ...(recordPublished ? { recordPublished } : {}),
    ...(refreshOwnCopy ? { refreshOwnCopy } : {}),
    ...(logger ? { logger } : {}),
  });
  ipcMain.handle('plus-gallery-mine', async (): Promise<TMineOutcome> => {
    const me = access.accountId();
    const authorization = await authorizeGallery(access, me);
    if (!authorization.ok) {
      return authorization;
    }
    const outcome = await mineOf(authorization.auth);
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
      const envelope = await fetchEnvelope(
        auth,
        me,
        scene.sceneId,
        scene.version,
      );
      const payload = envelope ? openMemberEnvelope(envelope) : null;
      // The file must be the version the gallery lists, or Reset would go
      // back to settings the gallery no longer has.
      if (
        !payload ||
        payload.pack.id !== build.pack.id ||
        payload.pack.version !== scene.version
      ) {
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

  return {
    dispose: () =>
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel)),
  };
};
