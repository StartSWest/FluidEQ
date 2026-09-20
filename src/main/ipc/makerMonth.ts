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
  /**
   * What the server says about this account having had a scene approved, so
   * the Studio can keep its single-project bench open to a maker whose
   * earned month has run out — and close it again if the approval is gone.
   * A convenience: the publication itself is the server's to accept or
   * refuse.
   */
  onMaker?: (accountId: string, maker: boolean) => void;
}

export const registerMakerMonthIpc = ({
  access,
  onMaker,
}: IMakerMonthIpcDeps) => {
  ipcMain.handle(CHANNEL, async (): Promise<TMakerMonthOutcome> => {
    const me = access.accountId();
    const auth = me ? await access.auth() : undefined;
    // The token is this account's only while it is still the one signed in.
    if (!auth || access.accountId() !== me) {
      return { ok: false, reason: 'signed-out' };
    }
    const outcome = await myMakerMonth(auth);
    if (access.accountId() !== me) {
      return { ok: false, reason: 'signed-out' };
    }
    // Only what the server actually said. A body this could not read comes
    // back as an empty month so the page has something to draw, and taking
    // that for a "no" would forget a maker the server never mentioned.
    if (me && outcome.ok && !outcome.guessed) {
      onMaker?.(me, outcome.month.maker);
    }
    return outcome;
  });

  return {
    dispose: () => ipcMain.removeHandler(CHANNEL),
  };
};
