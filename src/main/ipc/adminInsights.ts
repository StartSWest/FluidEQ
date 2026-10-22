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
import type { IServerUsage, TRequestUsage } from '../../common/serverUsage';
import type { IAdminListening } from '../../common/listening';
import {
  accountScenes,
  adminAnnouncements,
  adminListening,
  cancelAnnouncement,
  favouriteScenes,
  requestUsage,
  saveAnnouncement,
  serverUsage,
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
export type TServerUsageOutcome = TAdminOutcome<IServerUsage>;
export type TRequestUsageOutcome = TAdminOutcome<TRequestUsage>;
export type TAdminListeningOutcome = TAdminOutcome<IAdminListening>;

const CHANNELS = [
  'admin-account-scenes',
  'admin-scene-favourites',
  'admin-listening',
  'admin-announcements',
  'admin-announcement-save',
  'admin-announcement-cancel',
  'admin-trial-ends',
  'admin-server-usage',
  'admin-request-usage',
] as const;

const ACCOUNT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The project's page on supabase.com, from the address the app talks to:
 * `https://<ref>.supabase.co` is project `<ref>`. Nothing for an address that
 * is not one, such as a local development server.
 */
export const dashboardOf = (supabaseUrl: string): string | undefined => {
  const match = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(supabaseUrl);
  return match
    ? `https://supabase.com/dashboard/project/${match[1]}`
    : undefined;
};

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
    'admin-listening',
    (_event, days: unknown): Promise<TAdminListeningOutcome> =>
      isFavouritePeriod(days)
        ? asMe((auth) => adminListening(auth, days))
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

  // How full the server is, with where Supabase shows the rest (the data
  // sent each month, which no API reports): this project's own dashboard.
  ipcMain.handle('admin-server-usage', (): Promise<TServerUsageOutcome> =>
    asMe(async (auth) => {
      const outcome = await serverUsage(auth);
      return outcome.ok
        ? {
            ok: true,
            value: {
              ...outcome.value,
              dashboardUrl: dashboardOf(auth.config.supabaseUrl),
            },
          }
        : outcome;
    }),
  );

  ipcMain.handle('admin-request-usage', (): Promise<TRequestUsageOutcome> =>
    asMe(requestUsage),
  );

  return {
    dispose: () => {
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
