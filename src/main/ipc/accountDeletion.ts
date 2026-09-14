import { ipcMain } from 'electron';
import {
  accountAddress,
  isAccountAddress,
  type IAccountToDelete,
} from '../../common/accountDeletion';
import {
  deleteAccount,
  findAccounts,
  type TAccountDeletionFailure,
  type TDeleteAccountFailure,
} from '../plus/accountDeletionApi';
import type { IGalleryAccess } from '../plus/galleryAccess';

/**
 * The admin's account deletion, over IPC: finding the account behind an
 * address, and deleting it.
 *
 * Offering the page is a courtesy and nothing more: a member who rebuilt the
 * app without the admin check still gets `admin_required` from the server,
 * because that is where the rule lives. The address is checked here the way
 * the server checks it, so a mistyped one is said on the page rather than as
 * a server failure.
 */

export type TFindAccountsOutcome =
  | { ok: true; accounts: IAccountToDelete[] }
  | { ok: false; reason: TAccountDeletionFailure };

export type TDeleteAccountOutcome =
  { ok: true; files: number } | { ok: false; reason: TDeleteAccountFailure };

const CHANNELS = ['account-deletion-find', 'account-deletion-delete'] as const;

export const registerAccountDeletionIpc = ({
  access,
}: {
  access: IGalleryAccess;
}) => {
  /** The token for this account, and nothing once a different one signs in. */
  const authFor = async (me: string | undefined) => {
    const auth = me ? await access.auth() : undefined;
    return auth && access.accountId() === me ? auth : undefined;
  };

  ipcMain.handle(
    'account-deletion-find',
    async (_event, email: unknown): Promise<TFindAccountsOutcome> => {
      if (typeof email !== 'string' || !isAccountAddress(email)) {
        return { ok: false, reason: 'invalid' };
      }
      const me = access.accountId();
      const auth = await authFor(me);
      if (!auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const outcome = await findAccounts(auth, accountAddress(email));
      return access.accountId() === me
        ? outcome
        : { ok: false, reason: 'signed-out' };
    },
  );

  ipcMain.handle(
    'account-deletion-delete',
    async (_event, email: unknown): Promise<TDeleteAccountOutcome> => {
      if (typeof email !== 'string' || !isAccountAddress(email)) {
        return { ok: false, reason: 'invalid' };
      }
      const auth = await authFor(access.accountId());
      return auth
        ? deleteAccount(auth, accountAddress(email))
        : { ok: false, reason: 'signed-out' };
    },
  );

  return {
    dispose: () => {
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
