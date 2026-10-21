import { ipcMain } from 'electron';
import type { TMakerMonthOutcome } from '../../common/makerMonth';
import type { IGalleryAccess } from '../plus/galleryAccess';
import { myMakerMonth } from '../plus/makerMonthApi';

/**
 * The maker's month, over IPC: when the month they earned by publishing runs
 * out, how many are waiting behind a membership they pay for, and what is
 * left of this month's submission allowance.
 *
 * Read-only, and only ever about the account asking. Nothing here grants
 * anything: the server earns the month at the moment the admin approves a
 * scene (migration 0041), and the entitlement the app already reads is where
 * the access itself arrives from.
 */

const CHANNEL = 'maker-month';

export interface IMakerMonthIpcDeps {
  access: IGalleryAccess;
}

export const registerMakerMonthIpc = ({ access }: IMakerMonthIpcDeps) => {
  ipcMain.handle(CHANNEL, async (): Promise<TMakerMonthOutcome> => {
    const me = access.accountId();
    const auth = me ? await access.auth() : undefined;
    // The token is this account's only while it is still the one signed in.
    if (!auth || access.accountId() !== me) {
      return { ok: false, reason: 'signed-out' };
    }
    const outcome = await myMakerMonth(auth);
    return access.accountId() === me
      ? outcome
      : { ok: false, reason: 'signed-out' };
  });

  return {
    dispose: () => ipcMain.removeHandler(CHANNEL),
  };
};
