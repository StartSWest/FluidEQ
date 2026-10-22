import { ipcMain, type BrowserWindow } from 'electron';
import {
  SIGNED_OUT_LISTENING,
  type IListeningStatus,
  type TListeningChoice,
  type TListeningOutcome,
} from '../../common/listening';
import type { IEntitlement } from '../account/entitlement';
import type { IGalleryAccess } from '../plus/galleryAccess';
import readComputerId from '../usage/computerId';
import {
  readListeningChoice,
  sendListeningDays,
  writeListeningChoice,
} from '../usage/listeningApi';
import { createListeningLedger } from '../usage/listeningLedger';

/**
 * How long people listen, for the admin's statistics (premium 0068), over
 * IPC.
 *
 * The window reports seconds of music as it hears them. Nothing is counted
 * for an account until the server has its answer on record: the window puts
 * a notice up for an account never asked (`unasked`), and its answer — kept
 * on, or switched off — is written to the server, which holds it for every
 * computer the account uses. Switched off, the server deletes every day the
 * account sent and this computer forgets its own.
 *
 * Sent on the same events as everything else about the account — launch, a
 * sign-in, somebody coming back to the computer — and, while music plays, at
 * most once every quarter of an hour as the minutes arrive. Never on a clock.
 */

/** The longest a single report from the window may claim. */
const MAX_REPORT_SECONDS = 15 * 60;
/** While minutes arrive, how stale the last send may get before the next. */
export const LISTENING_SEND_AFTER_MS = 15 * 60 * 1000;

const CHANNELS = [
  'listening-accrue',
  'listening-status',
  'listening-set-sharing',
] as const;

export interface IListeningIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  access: IGalleryAccess;
  /** Signing in and out reach here as a change of membership. */
  entitlement: Pick<IEntitlement, 'subscribe'>;
  logger?: { info(message: string): void; warn(message: string): void };
  now?: () => number;
}

export const registerListeningIpc = ({
  getMainWindow,
  userDataDir,
  access,
  entitlement,
  logger,
  now = Date.now,
}: IListeningIpcDeps) => {
  const ledger = createListeningLedger({ userDataDir, now });
  // The server's answer this session, for the one account it was asked
  // about. `sharing` undefined is an answer too: never asked.
  let known: { accountId: string; sharing: boolean | undefined } | undefined;
  // Read the first time a day is sent, not at startup: an account that never
  // shares never has the file made.
  let computerId: string | undefined;
  let lastSentAt = 0;
  let sending: Promise<void> | undefined;
  let asking: Promise<void> | undefined;
  let sent = JSON.stringify(SIGNED_OUT_LISTENING);

  const choiceOf = (accountId: string): TListeningChoice => {
    const sharing =
      known?.accountId === accountId
        ? known.sharing
        : ledger.sharing(accountId);
    if (sharing === true) {
      return 'sharing';
    }
    if (sharing === false) {
      return 'off';
    }
    return known?.accountId === accountId ? 'unasked' : 'unknown';
  };

  const status = (): IListeningStatus => {
    const accountId = access.accountId();
    return accountId
      ? {
          signedIn: true,
          choice: choiceOf(accountId),
          todayMinutes: ledger.todayMinutes(accountId),
        }
      : SIGNED_OUT_LISTENING;
  };

  // Sent only when it changed: most reports leave the minute where it was.
  const announce = () => {
    const current = status();
    const serialised = JSON.stringify(current);
    if (serialised === sent) {
      return;
    }
    sent = serialised;
    getMainWindow()?.webContents.send('listening-status-changed', current);
  };

  const send = async (reason: string) => {
    const accountId = access.accountId();
    if (!accountId || choiceOf(accountId) !== 'sharing') {
      return;
    }
    const pending = ledger.pending(accountId);
    if (pending.length === 0) {
      lastSentAt = now();
      return;
    }
    const auth = await access.auth();
    if (!auth || access.accountId() !== accountId) {
      return;
    }
    computerId ??= readComputerId(userDataDir);
    const outcome = await sendListeningDays(
      auth,
      accountId,
      computerId,
      pending,
    );
    if (!outcome.ok) {
      // Offline, or a server before 0068. Everything stays pending and the
      // next event tries again.
      logger?.warn(`Listening not sent after ${reason}: ${outcome.reason}.`);
      return;
    }
    // Marked only for the account the days were counted for, and only if it
    // did not switch off while the request was out.
    if (choiceOf(accountId) === 'sharing') {
      pending.forEach((day) => ledger.markUploaded(accountId, day));
    }
    lastSentAt = now();
    logger?.info(`Listening: sent ${pending.length} day(s) after ${reason}.`);
  };

  const sendNow = (reason: string) => {
    sending =
      sending ??
      send(reason).finally(() => {
        sending = undefined;
      });
    return sending;
  };

  const ask = async (reason: string) => {
    const accountId = access.accountId();
    if (!accountId || known?.accountId === accountId) {
      return;
    }
    const auth = await access.auth();
    if (!auth || access.accountId() !== accountId) {
      return;
    }
    const outcome = await readListeningChoice(auth);
    if (!outcome.ok) {
      logger?.warn(
        `Listening choice could not be read after ${reason}: ${outcome.reason}.`,
      );
      return;
    }
    if (access.accountId() !== accountId) {
      return;
    }
    known = { accountId, sharing: outcome.value };
    ledger.setSharing(accountId, outcome.value);
    if (outcome.value !== true) {
      // Switched off on another computer, or never asked: what this one
      // counted under an old yes is not to be sent.
      ledger.clearDays(accountId);
    }
  };

  /** Somebody is at the computer: learn the answer if missing, then send. */
  const refreshIfDue = async (reason: string) => {
    try {
      asking =
        asking ??
        ask(reason).finally(() => {
          asking = undefined;
        });
      await asking;
      announce();
      if (now() - lastSentAt >= LISTENING_SEND_AFTER_MS) {
        await sendNow(reason);
      }
    } catch (error) {
      logger?.warn(`Listening refresh failed after ${reason}: ${error}`);
    }
  };

  ipcMain.handle('listening-accrue', (_event, seconds: unknown) => {
    const accountId = access.accountId();
    if (
      !accountId ||
      typeof seconds !== 'number' ||
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      choiceOf(accountId) !== 'sharing'
    ) {
      return;
    }
    ledger.accrue(accountId, Math.min(MAX_REPORT_SECONDS, seconds));
    announce();
    if (now() - lastSentAt >= LISTENING_SEND_AFTER_MS) {
      sendNow('music playing').catch(() => undefined);
    }
  });

  ipcMain.handle('listening-status', () => status());

  ipcMain.handle(
    'listening-set-sharing',
    async (_event, value: unknown): Promise<TListeningOutcome> => {
      const accountId = access.accountId();
      const auth = accountId ? await access.auth() : undefined;
      if (
        !accountId ||
        !auth ||
        typeof value !== 'boolean' ||
        access.accountId() !== accountId
      ) {
        return { ok: false, reason: 'signed-out', status: status() };
      }
      const outcome = await writeListeningChoice(auth, value);
      if (!outcome.ok) {
        return { ok: false, reason: outcome.reason, status: status() };
      }
      if (access.accountId() === accountId) {
        known = { accountId, sharing: value };
        ledger.setSharing(accountId, value);
        if (!value) {
          ledger.clearDays(accountId);
        }
        logger?.info(`Listening: switched ${value ? 'on' : 'off'}.`);
      }
      announce();
      return { ok: true, status: status() };
    },
  );

  const unsubscribe = entitlement.subscribe(() => {
    refreshIfDue('account changed').catch(() => undefined);
  });

  return {
    refreshIfDue,
    dispose: () => {
      unsubscribe();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
