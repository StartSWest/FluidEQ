import type { TListeningFailure } from '../../common/listening';
import type { IGalleryAuth } from '../plus/galleryAccess';
import { headers, rpc } from '../plus/galleryApi';
import type { IPendingListening } from './listeningLedger';

/**
 * The listening statistics' three calls (premium migration 0068), made with
 * the account's own token: what the account answered, a new answer, and the
 * days this computer counted. Row-level security hands each account its own
 * answer and nobody else's; the server takes the account from the token, not
 * from anything sent here.
 */

export type TListeningCall<T> =
  { ok: true; value: T } | { ok: false; reason: TListeningFailure };

const failureOf = (status: number): TListeningFailure =>
  status === 401 ? 'signed-out' : 'server';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const rest = (auth: IGalleryAuth, pathAndQuery: string) =>
  new URL(`/rest/v1/${pathAndQuery}`, auth.config.supabaseUrl).toString();

/** True or false as answered, undefined for an account never asked. */
export const readListeningChoice = async (
  auth: IGalleryAuth,
): Promise<TListeningCall<boolean | undefined>> => {
  let response: Response;
  try {
    response = await (auth.fetchImpl ?? fetch)(
      rest(auth, 'listening_choices?select=sharing'),
      { method: 'GET', headers: headers(auth) },
    );
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: failureOf(response.status) };
  }
  const rows: unknown = await response.json().catch(() => undefined);
  if (!Array.isArray(rows)) {
    return { ok: false, reason: 'server' };
  }
  const [row] = rows as unknown[];
  if (row === undefined) {
    return { ok: true, value: undefined };
  }
  return isRecord(row) && typeof row.sharing === 'boolean'
    ? { ok: true, value: row.sharing }
    : { ok: false, reason: 'server' };
};

/** The account's answer; a no also deletes every day it ever sent. */
export const writeListeningChoice = async (
  auth: IGalleryAuth,
  sharing: boolean,
): Promise<TListeningCall<boolean>> => {
  let response: Response;
  try {
    response = await rpc(auth, 'set_listening_sharing', {
      p_sharing: sharing,
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: failureOf(response.status) };
  }
  const answer: unknown = await response.json().catch(() => undefined);
  return answer === sharing
    ? { ok: true, value: sharing }
    : { ok: false, reason: 'server' };
};

/**
 * This computer's days, each the whole minutes counted so far.
 *
 * The server keeps one row per account, computer and day and merges the
 * computers into the account's day, holding the sum to the clock, so an
 * office day and a home evening both count while two computers at once count
 * once. A day sent again replaces this computer's row with the larger count.
 */
export const sendListeningDays = async (
  auth: IGalleryAuth,
  accountId: string,
  computerId: string,
  days: readonly IPendingListening[],
): Promise<TListeningCall<true>> => {
  if (days.length === 0) {
    return { ok: true, value: true };
  }
  let response: Response;
  try {
    response = await (auth.fetchImpl ?? fetch)(
      rest(auth, 'usage_device_days?on_conflict=user_id,device,day'),
      {
        method: 'POST',
        headers: {
          ...headers(auth),
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(
          days.map((entry) => ({
            // The server replaces it with the token's own; the conflict
            // target needs it named.
            user_id: accountId,
            device: computerId,
            day: entry.day,
            minutes: entry.minutes,
          })),
        ),
      },
    );
  } catch {
    return { ok: false, reason: 'offline' };
  }
  return response.ok
    ? { ok: true, value: true }
    : { ok: false, reason: failureOf(response.status) };
};
