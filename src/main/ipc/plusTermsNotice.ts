import { app, ipcMain, type BrowserWindow } from 'electron';
import {
  isCheckoutConfigured,
  type IAccountConfig,
} from '../../common/accountConfig';
import { PLUS_TERMS_VERSION } from '../../common/plusTerms';
import {
  plusTermsNotice,
  shouldAskAgreedTerms,
  type IPlusTermsNotice,
  type IPlusTermsNoticeFacts,
} from '../../common/plusTermsNotice';
import type { IEntitlement } from '../account/entitlement';
import type { IAccountSession } from '../account/session';
import { fetchAgreedTermsVersion } from '../account/termsAcceptances';
import {
  readTermsNoticeSeen,
  writeTermsNoticeSeen,
} from '../account/termsNoticeSeen';

/**
 * The notice that tells a member the Plus terms changed, over IPC.
 *
 * This side gathers the facts — who is signed in, whether Plus is on for
 * them, what the server has on record as their agreement, which notice they
 * have already been shown — and `common/plusTermsNotice.ts` turns them into a
 * notice or nothing. The renderer draws what it is sent and says when it was
 * put away; it decides nothing.
 *
 * The server is asked at events, like everything else about the account:
 * launch, the membership changing, somebody coming back to the machine. And
 * only while the answer is missing — once known for an account it holds for
 * the session, and an agreement made meanwhile, at the Studio's export or
 * publish, is reported here directly instead of being asked for again. So a
 * member who is up to date costs one read per launch, and one who has been
 * told costs none.
 */

export interface IPlusTermsNoticeIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  config: IAccountConfig;
  session: IAccountSession;
  entitlement: IEntitlement;
  logger?: { warn(message: string): void };
  fetchImpl?: typeof fetch;
}

export interface IPlusTermsNoticeRegistration {
  /** Somebody is at the machine: ask the server if the answer is missing. */
  checkIfDue(reason: string): Promise<void>;
  /** The signed-in account just agreed to `version`, on the server's record. */
  agreed(version: number): void;
  dispose(): void;
}

/** What crosses to the renderer: the notice, or null for none. */
export type TPlusTermsNoticeState = IPlusTermsNotice | null;

const CHANNELS = ['plus-terms-notice', 'plus-terms-notice-seen'] as const;

export const registerPlusTermsNoticeIpc = ({
  getMainWindow,
  userDataDir,
  config,
  session,
  entitlement,
  logger,
  fetchImpl = fetch,
}: IPlusTermsNoticeIpcDeps): IPlusTermsNoticeRegistration => {
  // The server's answer, for the one account it was last asked about.
  let known: { accountId: string; agreed: number } | undefined;
  let asking: Promise<void> | undefined;
  // Put away this session. The file is the record that outlives it, but a
  // disk that refuses the write must not leave the notice on screen after
  // somebody closed it.
  const seenNow = new Map<string, number>();
  let sent = JSON.stringify(null);

  const accountId = () => session.state().identity?.id;

  const agreedBy = (id: string) =>
    known?.accountId === id ? known.agreed : undefined;

  const facts = (): IPlusTermsNoticeFacts => {
    const id = accountId();
    return {
      termsOffered: isCheckoutConfigured(config),
      accountId: id,
      member: entitlement.status().state !== 'none',
      agreed: id === undefined ? undefined : agreedBy(id),
      seen:
        id === undefined
          ? 0
          : Math.max(
              readTermsNoticeSeen(userDataDir, id),
              seenNow.get(id) ?? 0,
            ),
      current: PLUS_TERMS_VERSION,
    };
  };

  const state = (): TPlusTermsNoticeState => plusTermsNotice(facts()) ?? null;

  // Sent only when it changed: most of the events that reach here change
  // nothing, and the window has no use for being told so.
  const announce = () => {
    const current = state();
    const serialised = JSON.stringify(current);
    if (serialised === sent) {
      return;
    }
    sent = serialised;
    getMainWindow()?.webContents.send('plus-terms-notice-changed', current);
  };

  const ask = async (reason: string) => {
    const id = accountId();
    if (!id) {
      return;
    }
    let accessToken: string;
    try {
      accessToken = await session.accessToken();
    } catch {
      // Signed out meanwhile, or offline. The next event asks again.
      return;
    }
    const agreed = await fetchAgreedTermsVersion({
      config,
      accessToken,
      fetchImpl,
    });
    if (agreed === undefined) {
      logger?.warn(`Plus terms agreements could not be read after ${reason}.`);
      return;
    }
    // The account can change while the request is out, and an answer about
    // somebody else is no answer at all.
    if (accountId() !== id) {
      return;
    }
    known = { accountId: id, agreed: Math.max(agreed, agreedBy(id) ?? 0) };
  };

  const checkIfDue = async (reason: string) => {
    if (shouldAskAgreedTerms(facts())) {
      // One request at a time: a wake and an unlock land together.
      asking =
        asking ??
        ask(reason).finally(() => {
          asking = undefined;
        });
      await asking;
    }
    announce();
  };

  ipcMain.handle('plus-terms-notice', () => state());

  // The renderer names the version it showed. Anything but the one this
  // build tells about is not a notice this side sent, and is not recorded.
  ipcMain.handle('plus-terms-notice-seen', (_event, version: unknown) => {
    const id = accountId();
    if (id && version === PLUS_TERMS_VERSION) {
      seenNow.set(id, PLUS_TERMS_VERSION);
      try {
        writeTermsNoticeSeen(userDataDir, id, PLUS_TERMS_VERSION);
      } catch (error) {
        logger?.warn(`The Plus terms notice could not be remembered: ${error}`);
      }
    }
    announce();
    return state();
  });

  // Signing in, signing out and a membership starting or ending all reach
  // here as a change of membership.
  const unsubscribe = entitlement.subscribe(() => {
    checkIfDue('membership changed').catch(() => undefined);
  });
  // `ready` rather than now, for the reason `ipc/account.ts` gives: before it
  // the stored session cannot be read, and nobody would seem signed in.
  app
    .whenReady()
    .then(() => checkIfDue('launch'))
    .catch(() => undefined);

  return {
    checkIfDue,
    agreed: (version) => {
      const id = accountId();
      if (!id || !Number.isInteger(version) || version <= 0) {
        return;
      }
      const before = agreedBy(id);
      // Without the server's answer only an agreement to the current text
      // settles anything: an older one may sit below what is on record.
      if (before === undefined && version < PLUS_TERMS_VERSION) {
        return;
      }
      known = { accountId: id, agreed: Math.max(before ?? 0, version) };
      announce();
    },
    dispose: () => {
      unsubscribe();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
