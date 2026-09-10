import type { IAccountConfig } from 'common/accountConfig';
import type { IAccountCredentialStore } from '../accountCredentials';
import {
  AuthError,
  refreshSession,
  requestRecovery,
  resendSignUpCode,
  revokeSession,
  signInWithPassword,
  signUp,
  updatePassword,
  verifyCode,
  type IAccountIdentity,
  type IAuthSession,
  type TAuthFailure,
  type TCodePurpose,
} from './authClient';

/**
 * The signed-in account, and the one place that knows whether there is one.
 *
 * Signing in is optional everywhere in this app, so every method here has to
 * have a sensible answer for "nobody is signed in" that is not an error. The
 * status is what callers branch on; exceptions are reserved for a caller that
 * asked for a token it cannot have.
 *
 * NOTHING HERE COUNTS DOWN. An access token lasts about an hour, and the
 * obvious way to keep one fresh is a timer set to just before it expires. That
 * is wrong twice over on a machine that sleeps: the timer does not run while
 * the lid is shut, so it fires late by however long that was, and it fires with
 * nobody at the keyboard for a token nothing is about to use. Instead the token
 * is refreshed at the moment somebody asks for one and the stored expiry has
 * passed. Work happens when it is needed, which is also the only time anyone
 * would notice it.
 *
 * NOTHING HERE IS DECIDED AT CONSTRUCTION EITHER. This is built while Electron
 * is still starting, and on Windows the credential cipher answers "not
 * available" until the app's `ready` event — so a session that read the disk
 * and settled its status in the constructor came up "unavailable" on every
 * launch, and stayed there, with the panel telling a Windows machine it had no
 * secure storage. The disk is read, and availability judged, the first time
 * somebody asks; by then the window exists and the answer is the true one.
 */

export type TAccountStatus =
  | 'unavailable'
  | 'signed-out'
  /** A request is in flight; the form is disabled and shows it. */
  | 'busy'
  | 'signed-in';

/**
 * An address that has been sent a code and is waiting for it to be typed.
 *
 * Kept here rather than in the form so the step survives the panel being
 * closed and reopened: the email takes a minute to arrive, and losing the
 * step in between would send the person round the sign-up again.
 */
export interface IPendingCode {
  email: string;
  purpose: TCodePurpose;
}

export interface IAccountState {
  status: TAccountStatus;
  identity?: IAccountIdentity;
  pending?: IPendingCode;
  /** Set only when the last attempt failed, and cleared by the next one. */
  error?: TAuthFailure;
}

export interface IAccountSession {
  state(): IAccountState;
  signUp(details: {
    email: string;
    password: string;
    name?: string;
  }): Promise<IAccountState>;
  signIn(credentials: {
    email: string;
    password: string;
  }): Promise<IAccountState>;
  /** The six digits from the email, for whichever purpose is pending. */
  confirmCode(code: string): Promise<IAccountState>;
  /** Send the pending sign-up code again. */
  resendCode(): Promise<IAccountState>;
  /** Start a password reset: a code goes to the address. */
  forgotPassword(email: string): Promise<IAccountState>;
  /** Redeem the recovery code and set the new password in one motion. */
  resetPassword(code: string, password: string): Promise<IAccountState>;
  /** Leave the code step without finishing it. */
  abandonPending(): IAccountState;
  signOut(): Promise<void>;
  /** A usable access token, refreshed if the stored one has aged out. */
  accessToken(): Promise<string>;
  dispose(): void;
}

export interface IAccountSessionOptions {
  config: IAccountConfig;
  store: IAccountCredentialStore;
  onState: (state: IAccountState) => void;
  now?: () => number;
}

/**
 * Refresh this long before the server would refuse the token.
 *
 * A token that expires while a request carrying it is still in flight fails for
 * a reason the user cannot act on. A minute covers the round trip and the
 * ordinary disagreement between this machine's clock and the server's.
 */
const REFRESH_SKEW_MS = 60_000;

const normaliseEmail = (email: string) => email.trim().toLowerCase();

export const createAccountSession = (
  options: IAccountSessionOptions,
): IAccountSession => {
  const { config, store, onState } = options;
  const now = options.now ?? Date.now;

  let session: IAuthSession | undefined;
  let identity: IAccountIdentity | undefined;
  // Whether the disk has been consulted. It is consulted once, the first time
  // the cipher is available to consult it with — see the header.
  let loaded = false;
  let busy = false;
  let pending: IPendingCode | undefined;
  let lastError: TAuthFailure | undefined;
  let inFlight: AbortController | undefined;
  // One refresh in flight at a time. Two callers asking at once would otherwise
  // both redeem the refresh token, and a backend that rotates it on use invalidates
  // whichever reply lands second — signing the person out for being asked twice.
  let refreshing: Promise<IAuthSession> | undefined;

  const load = () => {
    if (!loaded && store.available()) {
      identity = store.read()?.identity;
      loaded = true;
    }
  };

  const status = (): TAccountStatus => {
    load();
    if (busy) {
      return 'busy';
    }
    if (!store.available()) {
      return 'unavailable';
    }
    return identity ? 'signed-in' : 'signed-out';
  };

  const state = (): IAccountState => {
    const current = status();
    return {
      status: current,
      identity: current === 'signed-in' ? identity : undefined,
      pending,
      error: lastError,
    };
  };

  const publish = () => onState(state());

  const forget = () => {
    session = undefined;
    identity = undefined;
    refreshing = undefined;
    loaded = true;
    store.clear();
  };

  const adopt = (next: IAuthSession) => {
    session = next;
    identity = next.identity;
    loaded = true;
    pending = undefined;
    lastError = undefined;
    store.write({ refreshToken: next.refreshToken, identity: next.identity });
  };

  const failureOf = (error: unknown): TAuthFailure =>
    error instanceof AuthError ? error.failure : 'network';

  /**
   * Run one request against the account service, with the state around it.
   *
   * Every action here has the same shape — refuse if the platform cannot keep
   * a login, refuse if something else is already running, publish `busy`,
   * do the thing, publish the outcome. A second action arriving while one is
   * in flight is answered with the current state rather than queued: the form
   * is disabled while busy, so this only happens to a caller that ignored it.
   */
  const attempt = async (
    work: (signal: AbortSignal) => Promise<void>,
  ): Promise<IAccountState> => {
    if (status() === 'unavailable') {
      lastError = 'rejected';
      publish();
      return state();
    }
    if (inFlight) {
      return state();
    }
    const controller = new AbortController();
    inFlight = controller;
    lastError = undefined;
    busy = true;
    publish();
    try {
      await work(controller.signal);
    } catch (error) {
      lastError = controller.signal.aborted ? undefined : failureOf(error);
    } finally {
      if (inFlight === controller) {
        inFlight = undefined;
      }
      busy = false;
    }
    publish();
    return state();
  };

  const renew = async (refreshToken: string): Promise<IAuthSession> => {
    const controller = new AbortController();
    try {
      const next = await refreshSession(
        config,
        refreshToken,
        controller.signal,
        now(),
      );
      adopt(next);
      publish();
      return next;
    } catch (error) {
      // Only a refusal means the credential is dead. A network failure leaves
      // the stored token alone: the machine being offline is not a reason to
      // sign somebody out, and they would have no way to get back in.
      if (failureOf(error) === 'expired') {
        forget();
        lastError = 'expired';
        publish();
      }
      throw error;
    } finally {
      refreshing = undefined;
    }
  };

  return {
    state,

    signUp: (details) =>
      attempt(async (signal) => {
        const email = normaliseEmail(details.email);
        await signUp(
          config,
          { email, password: details.password, name: details.name?.trim() },
          signal,
        );
        pending = { email, purpose: 'signup' };
      }),

    signIn: (credentials) =>
      attempt(async (signal) => {
        const email = normaliseEmail(credentials.email);
        try {
          adopt(
            await signInWithPassword(
              config,
              { email, password: credentials.password },
              signal,
              now(),
            ),
          );
        } catch (error) {
          // An account that never typed its code can still sign in — by
          // typing it now. The step is offered instead of a dead end.
          if (failureOf(error) === 'unconfirmed') {
            pending = { email, purpose: 'signup' };
          }
          throw error;
        }
      }),

    confirmCode: (code) =>
      attempt(async (signal) => {
        if (!pending) {
          throw new AuthError('bad_code', 'No code was expected.');
        }
        adopt(
          await verifyCode(
            config,
            {
              email: pending.email,
              code: code.trim(),
              purpose: pending.purpose,
            },
            signal,
            now(),
          ),
        );
      }),

    resendCode: () =>
      attempt(async (signal) => {
        if (!pending) {
          throw new AuthError('bad_code', 'No code was expected.');
        }
        if (pending.purpose === 'signup') {
          await resendSignUpCode(config, pending.email, signal);
        } else {
          await requestRecovery(config, pending.email, signal);
        }
      }),

    forgotPassword: (email) =>
      attempt(async (signal) => {
        const address = normaliseEmail(email);
        await requestRecovery(config, address, signal);
        pending = { email: address, purpose: 'recovery' };
      }),

    resetPassword: (code, password) =>
      attempt(async (signal) => {
        if (!pending || pending.purpose !== 'recovery') {
          throw new AuthError('bad_code', 'No reset was requested.');
        }
        const next = await verifyCode(
          config,
          { email: pending.email, code: code.trim(), purpose: 'recovery' },
          signal,
          now(),
        );
        // The new password is set on the session the code produced, and the
        // person ends up signed in with it — no second form to fill.
        await updatePassword(config, next.accessToken, password, signal);
        adopt(next);
      }),

    abandonPending: () => {
      pending = undefined;
      lastError = undefined;
      publish();
      return state();
    },

    signOut: async () => {
      const token = session?.accessToken;
      inFlight?.abort();
      inFlight = undefined;
      busy = false;
      forget();
      pending = undefined;
      lastError = undefined;
      publish();
      if (token) {
        // After the local state is already gone, so a server that never answers
        // cannot leave somebody stuck signed in.
        await revokeSession(config, token, new AbortController().signal);
      }
    },

    accessToken: async () => {
      if (session && session.expiresAt - REFRESH_SKEW_MS > now()) {
        return session.accessToken;
      }
      load();
      const refreshToken = session?.refreshToken ?? store.read()?.refreshToken;
      if (!refreshToken) {
        throw new AuthError('expired', 'Nobody is signed in.');
      }
      refreshing = refreshing ?? renew(refreshToken);
      return (await refreshing).accessToken;
    },

    dispose: () => {
      inFlight?.abort();
      inFlight = undefined;
    },
  };
};
