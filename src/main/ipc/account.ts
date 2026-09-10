import { app, BrowserWindow, ipcMain } from 'electron';
import {
  ACCOUNT_CONFIG,
  isAccountConfigured,
  isCheckoutConfigured,
} from '../../common/accountConfig';
import { createAccountCredentialStore } from '../accountCredentials';
import { createEncryptedJsonStore } from '../encryptedJsonStore';
import openExternalIfSafe from '../safeExternal';
import {
  createAccountSession,
  type IAccountSession,
  type IAccountState,
} from '../account/session';
import {
  createEntitlement,
  isEntitlementRecord,
  type IEntitlement,
  type IEntitlementStatus,
} from '../account/entitlement';
import {
  BillingError,
  createBillingClient,
  type TBillingFailure,
} from '../account/billingClient';
import {
  CODE_LENGTH,
  EMAIL_SHAPE,
  isCode,
  MIN_PASSWORD_LENGTH,
} from '../../common/accountRules';
import {
  createMembershipSimulator,
  type IMembershipSimulator,
} from '../account/membershipSimulator';

/**
 * The account and its subscription, as the renderer sees them.
 *
 * The renderer never reaches the network and never holds a token. It sends
 * what was typed into the form, it asks for the checkout or the subscription
 * page to be opened, and it is told when anything changes. Everything else —
 * the requests, the encrypted stores, the entitlement lookup — stays on this
 * side, which is what keeps the content security policy at its current
 * strictness with no origin added to it.
 *
 * Every value that arrives here is shape-checked before it is used. A caller
 * inside this app is trusted, but a string reaching a request body unbounded
 * is the kind of thing that stops being true after one refactor.
 */

export interface IAccountIpcDeps {
  /** Resolved per call: the window outlives none of these handlers. */
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  logger?: { info(message: string): void; warn(message: string): void };
  /** Development only; see `IEntitlementOptions.developmentOverride`. */
  developmentEntitlement?: IEntitlementStatus;
  /**
   * Development only: lets the Account panel ask the server to send the
   * merchant's own events for this account. See `membershipSimulator.ts`.
   * Never true in a packaged build.
   */
  developmentSimulator?: boolean;
}

export interface IAccountIpcRegistration {
  session: IAccountSession;
  entitlement: IEntitlement;
  dispose: () => void;
}

/** What opening a billing page came to. `false` is "nothing to open". */
export type TBillingOutcome =
  { ok: true } | { ok: false; failure: TBillingFailure };

const CHANNELS = [
  'account-state',
  'account-sign-up',
  'account-sign-in',
  'account-confirm-code',
  'account-resend-code',
  'account-forgot-password',
  'account-reset-password',
  'account-abandon-pending',
  'account-sign-out',
  'entitlement-status',
  'entitlement-refresh',
  'entitlement-open-checkout',
  'entitlement-open-portal',
  'dev-membership-available',
  'dev-membership-simulate',
] as const;

const ENTITLEMENT_FILE = 'entitlement.json';

/** Generous bounds. The server has its own; these stop nonsense earlier. */
const MAX_EMAIL = 254;
const MAX_PASSWORD = 128;
const MAX_NAME = 80;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readText = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.length > 0 && value.length <= max
    ? value
    : undefined;

const readEmail = (value: unknown): string | undefined => {
  const text = readText(value, MAX_EMAIL)?.trim();
  return text && EMAIL_SHAPE.test(text) ? text : undefined;
};

const readPassword = (value: unknown): string | undefined => {
  const text = readText(value, MAX_PASSWORD);
  return text && text.length >= MIN_PASSWORD_LENGTH ? text : undefined;
};

const readCode = (value: unknown): string | undefined => {
  const text = readText(value, CODE_LENGTH + 2)?.trim();
  return text && isCode(text) ? text : undefined;
};

export const registerAccountIpc = ({
  getMainWindow,
  userDataDir,
  logger,
  developmentEntitlement,
  developmentSimulator = false,
}: IAccountIpcDeps): IAccountIpcRegistration => {
  const send = (channel: string, payload: unknown) => {
    getMainWindow()?.webContents.send(channel, payload);
  };

  // Declared ahead of the session so the session's state callback can reach
  // it; the entitlement itself takes the session, which is why both cannot be
  // built in one expression.
  let entitlement: IEntitlement | undefined;

  const session = createAccountSession({
    config: ACCOUNT_CONFIG,
    store: createAccountCredentialStore(userDataDir),
    onState: (state: IAccountState) => {
      send('account-state-changed', state);
      if (state.status === 'signed-out' || state.status === 'unavailable') {
        entitlement?.forget();
      } else if (state.status === 'signed-in') {
        // A fresh sign-in is the one event where "recent enough" does not
        // apply: whoever just signed in wants to know now.
        entitlement?.checkNow().catch(() => undefined);
      }
    },
  });

  const billing = createBillingClient(ACCOUNT_CONFIG);

  entitlement = createEntitlement({
    config: ACCOUNT_CONFIG,
    session,
    store: createEncryptedJsonStore(
      userDataDir,
      ENTITLEMENT_FILE,
      isEntitlementRecord,
    ),
    onChange: (status: IEntitlementStatus) =>
      send('entitlement-changed', status),
    logger,
    // The merchant matches payments by email and its notice can arrive
    // before the account exists: ask the server to look the account up
    // right before every read of the row.
    beforeFetch: (token) => billing.syncMembership(token),
    developmentOverride: developmentEntitlement,
  });
  const entitled = entitlement;

  /**
   * A form that sent something the checks above refuse gets the current state
   * back and nothing happens. The form has the same checks and disables its
   * button until they pass, so this is only reached by a caller that ignored
   * them — and the honest answer to that is silence, not a request.
   */
  const configured = () => isAccountConfigured();

  ipcMain.handle('account-state', () => session.state());

  ipcMain.handle('account-sign-up', (_event, details: unknown) => {
    if (!configured() || !isRecord(details)) {
      return session.state();
    }
    const email = readEmail(details.email);
    const password = readPassword(details.password);
    const name =
      details.name === undefined || details.name === ''
        ? undefined
        : readText(details.name, MAX_NAME);
    if (!email || !password) {
      return session.state();
    }
    return session.signUp({ email, password, name });
  });

  ipcMain.handle('account-sign-in', (_event, credentials: unknown) => {
    if (!configured() || !isRecord(credentials)) {
      return session.state();
    }
    const email = readEmail(credentials.email);
    const password = readText(credentials.password, MAX_PASSWORD);
    if (!email || !password) {
      return session.state();
    }
    return session.signIn({ email, password });
  });

  ipcMain.handle('account-confirm-code', (_event, code: unknown) => {
    const digits = readCode(code);
    return configured() && digits
      ? session.confirmCode(digits)
      : session.state();
  });

  ipcMain.handle('account-resend-code', () =>
    configured() ? session.resendCode() : session.state(),
  );

  ipcMain.handle('account-forgot-password', (_event, email: unknown) => {
    const address = readEmail(email);
    return configured() && address
      ? session.forgotPassword(address)
      : session.state();
  });

  ipcMain.handle('account-reset-password', (_event, details: unknown) => {
    if (!configured() || !isRecord(details)) {
      return session.state();
    }
    const code = readCode(details.code);
    const password = readPassword(details.password);
    return code && password
      ? session.resetPassword(code, password)
      : session.state();
  });

  ipcMain.handle('account-abandon-pending', () => session.abandonPending());

  ipcMain.handle('account-sign-out', () => session.signOut());

  ipcMain.handle('entitlement-status', () => entitled.status());

  ipcMain.handle('entitlement-refresh', () => entitled.checkNow());

  /**
   * Both billing pages are minted by the server for this account and opened
   * in the system browser. The renderer never sees the URL — there is money
   * on the other end of it.
   */
  const openBillingPage = async (
    mint: (accessToken: string) => Promise<string>,
  ): Promise<TBillingOutcome> => {
    let token: string;
    try {
      token = await session.accessToken();
    } catch {
      return { ok: false, failure: 'signed_out' };
    }
    try {
      const url = await mint(token);
      return openExternalIfSafe(url)
        ? { ok: true }
        : { ok: false, failure: 'rejected' };
    } catch (error) {
      logger?.warn(`Billing page could not be opened: ${error}`);
      return {
        ok: false,
        failure: error instanceof BillingError ? error.failure : 'network',
      };
    }
  };

  ipcMain.handle('entitlement-open-checkout', (): Promise<TBillingOutcome> => {
    if (!isCheckoutConfigured() || session.state().status !== 'signed-in') {
      return Promise.resolve({ ok: false, failure: 'signed_out' });
    }
    return openBillingPage((token) => billing.checkoutUrl(token));
  });

  ipcMain.handle('entitlement-open-portal', (): Promise<TBillingOutcome> => {
    if (session.state().status !== 'signed-in') {
      return Promise.resolve({ ok: false, failure: 'signed_out' });
    }
    return openBillingPage((token) => billing.portalUrl(token));
  });

  /**
   * The pretend membership, development only. Exists as a handler in every
   * build so the renderer can ask; answers "not available" in every packaged
   * build and in every checkout without a backend.
   */
  const simulator: IMembershipSimulator | undefined =
    developmentSimulator && isAccountConfigured()
      ? createMembershipSimulator({ config: ACCOUNT_CONFIG, logger })
      : undefined;

  ipcMain.handle('dev-membership-available', () => simulator !== undefined);

  ipcMain.handle(
    'dev-membership-simulate',
    async (_event, simulation: unknown): Promise<TBillingOutcome> => {
      if (
        !simulator ||
        (simulation !== 'started' && simulation !== 'cancelled') ||
        session.state().status !== 'signed-in'
      ) {
        return { ok: false, failure: 'signed_out' };
      }
      let token: string;
      try {
        token = await session.accessToken();
      } catch {
        return { ok: false, failure: 'signed_out' };
      }
      try {
        await simulator.send(token, simulation);
      } catch (error) {
        logger?.warn(`Pretend membership failed: ${error}`);
        return {
          ok: false,
          failure: error instanceof BillingError ? error.failure : 'network',
        };
      }
      // The webhook has written the row; read it back the way a real payment
      // is read back, through the same check every other event triggers.
      await entitled.checkNow();
      return { ok: true };
    },
  );

  // Launch counts as an event: a session restored from disk is a person who
  // will open the app and expect the answer to already be there. "Launch" is
  // `ready`, not this line — before it the credential cipher cannot read the
  // stored session, so a check here would find nobody signed in and skip.
  app
    .whenReady()
    .then(() => entitled.checkIfDue('launch'))
    .catch(() => undefined);

  return {
    session,
    entitlement: entitled,
    dispose: () => {
      session.dispose();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
