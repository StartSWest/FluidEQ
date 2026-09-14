import {
  parseAccountRow,
  type IAccountToDelete,
} from '../../common/accountDeletion';
import type { IGalleryAuth } from './galleryAccess';
import { rpc, type TGalleryFailure } from './galleryApi';

/**
 * The admin's account deletion, spoken to with the account's own token.
 * Whether the caller is the admin, and whether the account found may be
 * deleted, is the server's to say on every call (`require_admin` and
 * `admin_begin_account_deletion`, premium migration 0031); nothing here
 * decides it.
 */

export type TAccountDeletionFailure =
  | TGalleryFailure
  | 'forbidden'
  /** The server refused the address. */
  | 'invalid';

export type TDeleteAccountFailure =
  | TAccountDeletionFailure
  /** The account is an admin one, which is never deleted from the app. */
  | 'admin-account'
  /** No account has the address, and no deletion of it is unfinished. */
  | 'no-account'
  /** A step failed part way; deleting the same address again finishes it. */
  | 'unfinished';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const failureOf = (status: number): TAccountDeletionFailure => {
  if (status === 401) {
    return 'signed-out';
  }
  // `admin_required` is insufficient_privilege, answered 403; a malformed
  // address is invalid_parameter_value, answered 400.
  if (status === 403) {
    return 'forbidden';
  }
  return status === 400 ? 'invalid' : 'server';
};

export const findAccounts = async (
  auth: IGalleryAuth,
  email: string,
): Promise<
  | { ok: true; accounts: IAccountToDelete[] }
  | { ok: false; reason: TAccountDeletionFailure }
> => {
  let response: Response;
  try {
    response = await rpc(auth, 'admin_find_account', { p_email: email });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: failureOf(response.status) };
  }
  try {
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) {
      return { ok: false, reason: 'server' };
    }
    const accounts = rows
      .map(parseAccountRow)
      .filter((account): account is IAccountToDelete => account !== undefined);
    // A row that does not read is not skipped: the page would then show
    // fewer accounts than the address has, and "nothing found" is the one
    // answer that must never be wrong before a deletion.
    return accounts.length === rows.length
      ? { ok: true, accounts }
      : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

const refusalOf = async (
  response: Response,
): Promise<TDeleteAccountFailure> => {
  if (response.status === 404) {
    return 'no-account';
  }
  if (response.status === 502) {
    return 'unfinished';
  }
  if (response.status === 422) {
    const body: unknown = await response.json().catch(() => undefined);
    return isRecord(body) && body.reason === 'admin_account'
      ? 'admin-account'
      : 'server';
  }
  return failureOf(response.status);
};

/**
 * Deletes the account behind an address for good, with everything the Plus
 * terms list, through the `delete-account` function. Answers how many files
 * went with it.
 */
export const deleteAccount = async (
  auth: IGalleryAuth,
  email: string,
): Promise<
  { ok: true; files: number } | { ok: false; reason: TDeleteAccountFailure }
> => {
  let response: Response;
  try {
    response = await (auth.fetchImpl ?? fetch)(
      `${auth.config.apiUrl}/delete-account`,
      {
        method: 'POST',
        headers: {
          apikey: auth.config.supabaseAnonKey,
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email }),
      },
    );
  } catch {
    // The request may have reached the server; a deletion it began is
    // written down there and finished by asking again.
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: await refusalOf(response) };
  }
  const body: unknown = await response.json().catch(() => undefined);
  return isRecord(body) &&
    body.deleted === true &&
    typeof body.files === 'number' &&
    Number.isInteger(body.files) &&
    body.files >= 0
    ? { ok: true, files: body.files }
    : { ok: false, reason: 'server' };
};
