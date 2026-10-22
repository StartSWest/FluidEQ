import {
  parseAdminListening,
  type IAdminListening,
} from '../../common/listening';
import {
  parseAdminAnnouncements,
  type IAdminAnnouncement,
  type IAnnouncementDraft,
} from '../../common/sceneAnnouncements';
import {
  parseAccountScenes,
  parseFavouriteScenes,
  type IAccountScene,
  type IFavouriteScene,
  type TFavouritePeriod,
} from '../../common/sceneTaste';
import {
  parseRequestUsage,
  parseServerUsage,
  type IServerUsage,
  type TRequestUsage,
} from '../../common/serverUsage';
import { adminFailureOf, type TAccountListFailure } from './adminAccountsApi';
import type { IGalleryAuth } from './galleryAccess';
import { rpc } from './galleryApi';

/**
 * The admin's readings of what members watch, and the announcements the
 * admin writes (premium migrations 0047, 0049, 0050), spoken to with the
 * account's own token. Whether the caller is the admin is the server's to say
 * on every call; nothing here decides it.
 */

export type TAdminFailure = TAccountListFailure;

export type TAdminOutcome<T> =
  { ok: true; value: T } | { ok: false; reason: TAdminFailure };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** One call, read by `parse`; a body that does not read is the server's fault. */
const ask = async <T>(
  auth: IGalleryAuth,
  name: string,
  body: Record<string, unknown>,
  parse: (json: unknown) => T | undefined,
): Promise<TAdminOutcome<T>> => {
  let response: Response;
  try {
    response = await rpc(auth, name, body);
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: await adminFailureOf(response) };
  }
  try {
    const value = parse(await response.json());
    return value === undefined
      ? { ok: false, reason: 'server' }
      : { ok: true, value };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

export const accountScenes = (
  auth: IGalleryAuth,
  userId: string,
): Promise<TAdminOutcome<IAccountScene[]>> =>
  ask(auth, 'admin_account_scenes', { p_user: userId }, parseAccountScenes);

export const favouriteScenes = (
  auth: IGalleryAuth,
  days: TFavouritePeriod,
): Promise<TAdminOutcome<IFavouriteScene[]>> =>
  ask(auth, 'admin_scene_favourites', { p_days: days }, parseFavouriteScenes);

/** How long people listened in the period (0068): totals per day, nobody named. */
export const adminListening = (
  auth: IGalleryAuth,
  days: TFavouritePeriod,
): Promise<TAdminOutcome<IAdminListening>> =>
  ask(auth, 'admin_listening', { p_days: days }, parseAdminListening);

export const adminAnnouncements = (
  auth: IGalleryAuth,
): Promise<TAdminOutcome<IAdminAnnouncement[]>> =>
  ask(auth, 'admin_announcements', {}, parseAdminAnnouncements);

/** Saves a draft; the server answers the announcement's id. */
export const saveAnnouncement = (
  auth: IGalleryAuth,
  draft: IAnnouncementDraft,
): Promise<TAdminOutcome<number>> =>
  ask(
    auth,
    'admin_save_announcement',
    {
      p_id: draft.id ?? null,
      p_title: draft.title,
      p_body: draft.body,
      p_scenes: draft.scenes,
      p_starts_at: new Date(draft.startsAt).toISOString(),
      p_audience: draft.audience,
    },
    (json) =>
      typeof json === 'number' && Number.isInteger(json) && json > 0
        ? json
        : undefined,
  );

export const cancelAnnouncement = (
  auth: IGalleryAuth,
  id: number,
): Promise<TAdminOutcome<true>> =>
  ask(auth, 'admin_cancel_announcement', { p_id: id }, () => true);

/** How full the server is: the database, its files and its accounts (0053). */
export const serverUsage = (
  auth: IGalleryAuth,
): Promise<TAdminOutcome<IServerUsage>> =>
  ask(auth, 'admin_server_usage', {}, parseServerUsage);

/**
 * The week's requests, through the `admin-server-usage` function, which
 * holds the management API's token so the app never does. A refused token
 * comes back as 502 with a body that says so, and is an answer, not a fault.
 */
export const requestUsage = async (
  auth: IGalleryAuth,
): Promise<TAdminOutcome<TRequestUsage>> => {
  let response: Response;
  try {
    response = await (auth.fetchImpl ?? fetch)(
      `${auth.config.apiUrl}/admin-server-usage`,
      {
        method: 'POST',
        headers: {
          apikey: auth.config.supabaseAnonKey,
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: '{}',
      },
    );
  } catch {
    return { ok: false, reason: 'offline' };
  }
  // The gateway's answer for a function that was never deployed.
  if (response.status === 404) {
    return { ok: false, reason: 'not-deployed' };
  }
  if (!response.ok && response.status !== 502) {
    return { ok: false, reason: await adminFailureOf(response) };
  }
  const usage = parseRequestUsage(await response.json().catch(() => undefined));
  return usage ? { ok: true, value: usage } : { ok: false, reason: 'server' };
};

/** Every live trial's end, for counting by the admin's own days. */
export const trialEnds = (
  auth: IGalleryAuth,
): Promise<TAdminOutcome<number[]>> =>
  ask(auth, 'admin_trial_ends', {}, (json) => {
    if (!Array.isArray(json)) {
      return undefined;
    }
    const ends = json.map((row: unknown) =>
      isRecord(row) && typeof row.ends_at === 'string'
        ? Date.parse(row.ends_at)
        : Number.NaN,
    );
    return ends.every(Number.isFinite) ? ends : undefined;
  });
