import { ipcMain } from 'electron';
import { FLUIDEQ_CREATOR_ID } from '../../common/plusGallery';
import {
  isModerationAction,
  isModerationList,
  type IModerationStatus,
  type IReportedScene,
} from '../../common/plusModeration';
import { sceneRefOf, type IGalleryAccess } from '../plus/galleryAccess';
import {
  listReportedScenes,
  moderateScene,
  moderationStatus,
  type TModerationFailure,
} from '../plus/moderationApi';

/**
 * The admin's queue of reported scenes, over IPC: whether this account is the
 * admin, the two lists, and the three answers.
 *
 * Offering it is a courtesy and nothing more: a member who rebuilt the app
 * without this check still gets `admin_required` from the server on every
 * call, because that is where the rule lives. The page names scenes by author
 * and scene id, checked the way a look id is, and never by a path.
 */

export type TModerationStatusOutcome =
  | { ok: true; status: IModerationStatus }
  | { ok: false; reason: Exclude<TModerationFailure, 'forbidden'> };

export type TModerationListOutcome =
  | { ok: true; scenes: IReportedScene[] }
  | { ok: false; reason: TModerationFailure };

export type TModerationActOutcome =
  { ok: true } | { ok: false; reason: TModerationFailure };

export interface IPlusModerationIpcDeps {
  access: IGalleryAccess;
  /**
   * A scene was taken down or restored: the block list this computer holds,
   * and the gallery's own lists, are asked again, so the admin's window
   * agrees with what every member now sees.
   */
  onBlockListChanged: () => Promise<void>;
  logger?: { warn(message: string, ...details: unknown[]): void };
}

const CHANNELS = [
  'plus-moderation-status',
  'plus-moderation-list',
  'plus-moderation-act',
] as const;

export const registerPlusModerationIpc = ({
  access,
  onBlockListChanged,
  logger,
}: IPlusModerationIpcDeps) => {
  /** The token for this account, and nothing once a different one signs in. */
  const authFor = async (me: string | undefined) => {
    const auth = me ? await access.auth() : undefined;
    return auth && access.accountId() === me ? auth : undefined;
  };

  ipcMain.handle(
    'plus-moderation-status',
    async (): Promise<TModerationStatusOutcome> => {
      const me = access.accountId();
      const auth = await authFor(me);
      if (!auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const outcome = await moderationStatus(auth);
      return access.accountId() === me
        ? outcome
        : { ok: false, reason: 'signed-out' };
    },
  );

  ipcMain.handle(
    'plus-moderation-list',
    async (_event, list: unknown): Promise<TModerationListOutcome> => {
      if (!isModerationList(list)) {
        return { ok: false, reason: 'server' };
      }
      const me = access.accountId();
      const auth = await authFor(me);
      if (!auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const outcome = await listReportedScenes(auth, list);
      return access.accountId() === me
        ? outcome
        : { ok: false, reason: 'signed-out' };
    },
  );

  ipcMain.handle(
    'plus-moderation-act',
    async (
      _event,
      action: unknown,
      authorId: unknown,
      sceneId: unknown,
    ): Promise<TModerationActOutcome> => {
      const ref = sceneRefOf(authorId, sceneId);
      if (
        !ref ||
        !isModerationAction(action) ||
        ref.authorId === FLUIDEQ_CREATOR_ID
      ) {
        return { ok: false, reason: 'server' };
      }
      const me = access.accountId();
      const auth = await authFor(me);
      if (!auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const outcome = await moderateScene(
        auth,
        action,
        ref.authorId,
        ref.packId,
      );
      if (outcome.ok && action !== 'dismiss') {
        // The answer already stands on the server; a stale local list only
        // costs the admin's own window a moment, so it is not the reply's.
        onBlockListChanged().catch((error) =>
          logger?.warn('Refreshing after a moderation answer failed', error),
        );
      }
      return outcome;
    },
  );

  return {
    dispose: () => {
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
