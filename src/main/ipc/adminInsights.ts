import { ipcMain } from 'electron';
import {
  readAnnouncementDraft,
  type IAdminAnnouncement,
} from '../../common/sceneAnnouncements';
import {
  isFavouritePeriod,
  type IAccountScene,
  type IFavouriteScene,
} from '../../common/sceneTaste';
import {
  accountScenes,
  adminAnnouncements,
  cancelAnnouncement,
  favouriteScenes,
  saveAnnouncement,
  trialEnds,
  type TAdminOutcome,
} from '../plus/adminInsightsApi';
import type { IGalleryAccess, IGalleryAuth } from '../plus/galleryAccess';

/**
 * The admin's scene readings and announcements, over IPC. Offering the pages
 * is a courtesy: a rebuilt app without the admin check still gets
 * `admin_required` from the server, where the rule lives. Requests are
 * checked here the way the server checks them, so a mistyped one is said on
 * the page rather than as a server failure.
 */

export type { TAdminOutcome };
export type TAccountScenesOutcome = TAdminOutcome<IAccountScene[]>;
export type TFavouriteScenesOutcome = TAdminOutcome<IFavouriteScene[]>;
export type TAdminAnnouncementsOutcome = TAdminOutcome<IAdminAnnouncement[]>;

const CHANNELS = [
  'admin-account-scenes',
  'admin-scene-favourites',
  'admin-announcements',
  'admin-announcement-save',
  'admin-announcement-cancel',
  'admin-trial-ends',
] as const;

const ACCOUNT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const registerAdminInsightsIpc = ({
  access,
  onAnnouncementsChanged,
}: {
  access: IGalleryAccess;
  /** The admin saved or cancelled one: their own app asks again. */
  onAnnouncementsChanged: () => void;
}) => {
  /**
   * The call, made with this account's token, and its answer only while the
   * same account is still signed in.
   */
  const asMe = async <T>(
    call: (auth: IGalleryAuth) => Promise<TAdminOutcome<T>>,
  ): Promise<TAdminOutcome<T>> => {
    const me = access.accountId();
    const auth = me ? await access.auth() : undefined;
    if (!auth || access.accountId() !== me) {
      return { ok: false, reason: 'signed-out' };
    }
    const outcome = await call(auth);
    return access.accountId() === me
      ? outcome
      : { ok: false, reason: 'signed-out' };
  };

  ipcMain.handle(
    'admin-account-scenes',
    (_event, userId: unknown): Promise<TAccountScenesOutcome> =>
      typeof userId === 'string' && ACCOUNT_ID.test(userId)
        ? asMe((auth) => accountScenes(auth, userId))
        : Promise.resolve({ ok: false, reason: 'invalid' }),
  );

  ipcMain.handle(
    'admin-scene-favourites',
    (_event, days: unknown): Promise<TFavouriteScenesOutcome> =>
      isFavouritePeriod(days)
        ? asMe((auth) => favouriteScenes(auth, days))
        : Promise.resolve({ ok: false, reason: 'invalid' }),
  );

  ipcMain.handle(
    'admin-announcements',
    (): Promise<TAdminAnnouncementsOutcome> => asMe(adminAnnouncements),
  );

  ipcMain.handle(
    'admin-announcement-save',
    async (_event, raw: unknown): Promise<TAdminOutcome<number>> => {
      const draft = readAnnouncementDraft(raw);
      if (!draft) {
        return { ok: false, reason: 'invalid' };
      }
      const outcome = await asMe((auth) => saveAnnouncement(auth, draft));
      if (outcome.ok) {
        onAnnouncementsChanged();
      }
      return outcome;
    },
  );

  ipcMain.handle(
    'admin-announcement-cancel',
    async (_event, id: unknown): Promise<TAdminOutcome<true>> => {
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
        return { ok: false, reason: 'invalid' };
      }
      const outcome = await asMe((auth) => cancelAnnouncement(auth, id));
      if (outcome.ok) {
        onAnnouncementsChanged();
      }
      return outcome;
    },
  );

  ipcMain.handle('admin-trial-ends', (): Promise<TAdminOutcome<number[]>> =>
    asMe(trialEnds),
  );

  return {
    dispose: () => {
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
