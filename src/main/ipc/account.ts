import { app, BrowserWindow, ipcMain, shell } from 'electron';
import {
  loadLocale,
  resolveLocale,
  translate,
  type LocaleCode,
} from '../../common/i18n';
import {
  ACCOUNT_CONFIG,
  isAccountConfigured,
} from '../../common/accountConfig';
import { createAccountCredentialStore } from '../accountCredentials';
import { createEncryptedJsonStore } from '../encryptedJsonStore';
import { setClientAgent } from '../account/clientAgent';
import { appVersion } from '../appVersion';
import {
  createAccountSession,
  type IAccountSession,
  type IAccountState,
} from '../account/session';
import { oauthPage, type IOAuthPages } from '../account/oauthLoopback';
import {
  createEntitlement,
  isEntitlementRecord,
  type IEntitlement,
  type IEntitlementStatus,
} from '../account/entitlement';
import { createBillingClient } from '../account/billingClient';
import {
  CODE_LENGTH,
  EMAIL_SHAPE,
  isCode,
  MIN_PASSWORD_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_NAME_LENGTH,
} from '../../common/accountRules';

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
}

export interface IAccountIpcRegistration {
  session: IAccountSession;
  entitlement: IEntitlement;
  /**
   * Somebody signed in, out, or as somebody else. The entitlement cannot say
   * so: signing out clears the identity before its status is published, so a
   * member signing out reads as "none" before and after, and nothing fired.
   */
  onIdentityChange: (listener: () => void) => () => void;
  dispose: () => void;
}

const CHANNELS = [
  'account-state',
  'account-sign-up',
  'account-sign-in',
  'account-confirm-code',
  'account-resend-code',
  'account-forgot-password',
  'account-reset-password',
  'account-abandon-pending',
  'account-google-available',
  'account-sign-in-google',
  'account-cancel',
  'account-sign-out',
  'entitlement-status',
  'entitlement-refresh',
] as const;

const ENTITLEMENT_FILE = 'entitlement.json';

/** Generous bounds. The server has its own; these stop nonsense earlier. */
const MAX_EMAIL = MAX_EMAIL_LENGTH;
const MAX_PASSWORD = MAX_PASSWORD_LENGTH;
const MAX_NAME = MAX_NAME_LENGTH;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readText = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.length > 0 && value.length <= max
    ? value
    : undefined;

const readEmail = (value: unknown): string | undefined => {
  const text =
    typeof value === 'string' ? readText(value.trim(), MAX_EMAIL) : undefined;
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
}: IAccountIpcDeps): IAccountIpcRegistration => {
  const send = (channel: string, payload: unknown) => {
    getMainWindow()?.webContents.send(channel, payload);
  };

  // Declared ahead of the session so the session's state callback can reach
  // it; the entitlement itself takes the session, which is why both cannot be
  // built in one expression.
  let entitlement: IEntitlement | undefined;

  const identityListeners = new Set<() => void>();
  let identity: string | undefined;

  // Before the first request: the sign-in service stamps the session it makes
  // with whatever the app calls itself, and that stamp is what the admin's
  // account list reads a FluidEQ version out of.
  setClientAgent(appVersion(), process.platform);

  const session = createAccountSession({
    config: ACCOUNT_CONFIG,
    store: createAccountCredentialStore(userDataDir),
    // Google's own page, in the person's own browser: never a web view of
    // ours, where a password typed into Google would pass through FluidEQ.
    openExternal: (url) => shell.openExternal(url),
    onState: (state: IAccountState) => {
      send('account-state-changed', state);
      if (state.status === 'signed-out' || state.status === 'unavailable') {
        entitlement?.forget();
      } else if (state.status === 'signed-in') {
        // A fresh sign-in is the one event where "recent enough" does not
        // apply: whoever just signed in wants to know now.
        entitlement?.checkNow().catch(() => undefined);
      }
      const next = state.identity?.id;
      if (next !== identity) {
        identity = next;
        identityListeners.forEach((listener) => listener());
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
   * Reject invalid input before contacting the service, with a visible error.
   * Renderer validation is helpful feedback, never the security boundary.
   */
  const configured = () => isAccountConfigured();
  const refused = (
    error: NonNullable<IAccountState['error']> = 'rejected',
  ): IAccountState => ({
    ...session.state(),
    error,
  });

  ipcMain.handle('account-state', () => session.state());

  ipcMain.handle('account-sign-up', (_event, details: unknown) => {
    if (!configured() || !isRecord(details)) {
      return refused();
    }
    const email = readEmail(details.email);
    const password = readPassword(details.password);
    const name =
      details.name === undefined || details.name === ''
        ? undefined
        : readText(details.name, MAX_NAME);
    if (!email) {
      return refused('invalid_email');
    }
    if (!password) {
      return refused('weak_password');
    }
    if (
      details.name !== undefined &&
      details.name !== '' &&
      name === undefined
    ) {
      return refused();
    }
    return session.signUp({ email, password, name });
  });

  ipcMain.handle('account-sign-in', (_event, credentials: unknown) => {
    if (!configured() || !isRecord(credentials)) {
      return refused();
    }
    const email = readEmail(credentials.email);
    const password = readText(credentials.password, MAX_PASSWORD);
    if (!email) {
      return refused('invalid_email');
    }
    if (!password) {
      return refused('wrong_credentials');
    }
    return session.signIn({ email, password });
  });

  ipcMain.handle('account-confirm-code', (_event, code: unknown) => {
    const digits = readCode(code);
    return configured() && digits
      ? session.confirmCode(digits)
      : refused('bad_code');
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
      return refused();
    }
    const code = readCode(details.code);
    const password = readPassword(details.password);
    return code && password
      ? session.resetPassword(code, password)
      : session.state();
  });

  ipcMain.handle('account-abandon-pending', () => session.abandonPending());

  ipcMain.handle('account-google-available', () =>
    configured() ? session.googleAvailable() : false,
  );

  // The browser tab's last page, in the window's language.
  const googlePages = async (tag: unknown): Promise<IOAuthPages> => {
    const locale: LocaleCode = resolveLocale(
      typeof tag === 'string' ? tag : undefined,
    );
    await loadLocale(locale).catch(() => undefined);
    const say = (key: Parameters<typeof translate>[1]) =>
      translate(locale, key);
    return {
      done: oauthPage(
        locale,
        say('account.google.doneTitle'),
        say('account.google.doneBody'),
      ),
      failed: oauthPage(
        locale,
        say('account.google.failedTitle'),
        say('account.google.failedBody'),
      ),
    };
  };

  ipcMain.handle('account-sign-in-google', async (_event, locale: unknown) =>
    configured()
      ? session.signInWithGoogle(await googlePages(locale))
      : refused(),
  );

  ipcMain.handle('account-cancel', () => session.cancel());

  ipcMain.handle('account-sign-out', () => session.signOut());

  ipcMain.handle('entitlement-status', () => entitled.status());

  ipcMain.handle('entitlement-refresh', () => entitled.checkNow());

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
    onIdentityChange: (listener) => {
      identityListeners.add(listener);
      return () => {
        identityListeners.delete(listener);
      };
    },
    dispose: () => {
      identityListeners.clear();
      session.dispose();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
