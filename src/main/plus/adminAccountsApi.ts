import {
  ACCOUNT_LIST_PAGE,
  parseAccountListPage,
  type IAccountListPage,
  type IAccountListRequest,
} from '../../common/adminAccounts';
import { parseTrialExitCounts } from '../../common/trialExit';
import type { IGalleryAuth } from './galleryAccess';
import { rpc, type TGalleryFailure } from './galleryApi';

/**
 * Every account, for the admin, spoken to with the account's own token.
 * Whether the caller is the admin is the server's to say on every call
 * (`require_admin`, premium migration 0032); nothing here decides it.
 */

export type TAccountListFailure =
  | TGalleryFailure
  | 'forbidden'
  | 'invalid'
  /** The server is older than this app and has no account list yet. */
  | 'not-deployed';

export type TAccountListOutcome =
  | { ok: true; page: IAccountListPage }
  | { ok: false; reason: TAccountListFailure };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * What an admin call's refusal means, for every admin page: the account list,
 * the scenes and the announcements all answer the same way.
 */
export const adminFailureOf = async (
  response: Response,
): Promise<TAccountListFailure> => {
  if (response.status === 401) {
    return 'signed-out';
  }
  // `admin_required` is insufficient_privilege, answered 403; a search or
  // filter it will not take is invalid_parameter_value, answered 400.
  if (response.status === 403) {
    return 'forbidden';
  }
  if (response.status === 400) {
    return 'invalid';
  }
  // PostgREST answers a function it does not have with PGRST202: the app has
  // arrived before its migration.
  if (response.status === 404) {
    const body: unknown = await response.json().catch(() => undefined);
    return isRecord(body) && body.code === 'PGRST202'
      ? 'not-deployed'
      : 'server';
  }
  return 'server';
};

export const listAccounts = async (
  auth: IGalleryAuth,
  request: IAccountListRequest,
): Promise<TAccountListOutcome> => {
  const query = request.query || null;
  // Sent only when there is a window, so a server before 0054 — which has no
  // such argument — still answers every list that does not ask for one.
  const window =
    request.since === undefined
      ? {}
      : { p_joined_since: new Date(request.since).toISOString() };
  // The reasons are the lapsed list's own: no other filter shows them.
  const wantsReasons = request.plan === 'lapsed' && request.offset === 0;
  let list: Response;
  let totals: Response;
  let reasons: Response | undefined;
  try {
    [list, totals, reasons] = await Promise.all([
      rpc(auth, 'admin_list_accounts', {
        p_query: query,
        p_plan: request.plan,
        p_limit: ACCOUNT_LIST_PAGE,
        p_offset: request.offset,
        ...window,
      }),
      rpc(auth, 'admin_account_totals', { p_query: query, ...window }),
      wantsReasons
        ? rpc(auth, 'admin_trial_exit_reasons', { p_query: query, ...window })
        : Promise.resolve(undefined),
    ]);
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!list.ok) {
    return { ok: false, reason: await adminFailureOf(list) };
  }
  if (!totals.ok) {
    return { ok: false, reason: await adminFailureOf(totals) };
  }
  if (reasons && !reasons.ok) {
    return { ok: false, reason: await adminFailureOf(reasons) };
  }
  try {
    const page = parseAccountListPage(await list.json(), await totals.json());
    if (!page) {
      return { ok: false, reason: 'server' };
    }
    if (!reasons) {
      return { ok: true, page };
    }
    const exitReasons = parseTrialExitCounts(await reasons.json());
    return exitReasons
      ? { ok: true, page: { ...page, exitReasons } }
      : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'server' };
  }
};
