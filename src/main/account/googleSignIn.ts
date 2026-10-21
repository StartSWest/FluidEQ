/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IAccountConfig } from 'common/accountConfig';
import {
  AuthError,
  exchangeAuthCode,
  googleAuthorizeUrl,
  type IAuthSession,
} from './authClient';
import { createPkcePair } from './pkce';
import type { IOAuthPages, startOAuthLoopback } from './oauthLoopback';

export interface IGoogleSignInSteps {
  config: IAccountConfig;
  signal: AbortSignal;
  pages: IOAuthPages;
  openExternal: (url: string) => Promise<void>;
  startLoopback: typeof startOAuthLoopback;
  /** Told when the wait on the browser starts, and when it is over. */
  onWaiting: (isWaiting: boolean) => void;
  now: () => number;
}

/**
 * Signing in with Google, the way a desktop app should (RFC 8252 with PKCE):
 * the person's own browser, where Google already knows them, never a web view
 * inside the app; the answer back to a port on this computer; and a code that
 * is worth nothing without the verifier this process alone holds.
 *
 * Every way it can end without an account — the browser refused to open,
 * Google's page refused or was left, the code refused — is one failure the
 * panel can say plainly, `google_unfinished`. Only a network failure keeps its
 * own name, because what to do about it is different.
 */
export const runGoogleSignIn = async ({
  config,
  signal,
  pages,
  openExternal,
  startLoopback,
  onWaiting,
  now,
}: IGoogleSignInSteps): Promise<IAuthSession> => {
  const pkce = createPkcePair();
  const loopback = await startLoopback(signal, pages);
  onWaiting(true);
  try {
    await openExternal(
      googleAuthorizeUrl(config, loopback.redirectTo, pkce.challenge),
    );
  } catch {
    throw new AuthError(
      'google_unfinished',
      'The browser could not be opened.',
    );
  }
  const answer = await loopback.answer;
  if (answer.kind === 'error') {
    throw new AuthError('google_unfinished', answer.reason);
  }
  // Back from the browser: trading the code is one quick request.
  onWaiting(false);
  try {
    return await exchangeAuthCode(
      config,
      { authCode: answer.code, codeVerifier: pkce.verifier },
      signal,
      now(),
    );
  } catch (error) {
    // A refused code is Google's sign-in not finishing, never "wrong email or
    // password", which is how the token endpoint's refusal reads elsewhere.
    if (error instanceof AuthError && error.failure !== 'network') {
      throw new AuthError('google_unfinished', error.message);
    }
    throw error;
  }
};
