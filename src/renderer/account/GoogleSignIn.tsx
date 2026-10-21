/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useState } from 'react';
import type { IAccountState } from 'main/account/session';
import { useTranslation } from '../utils/I18nContext';
import {
  cancelAccountAttempt,
  isGoogleSignInAvailable,
  signInWithGoogle,
} from './accountStore';

/**
 * Google's mark, in its own four colours, as Google's sign-in branding asks
 * the button to carry it.
 */
const GoogleMark = () => (
  <svg
    className="account-google__mark"
    viewBox="0 0 48 48"
    aria-hidden="true"
    focusable="false"
  >
    <path
      className="account-google__red"
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      className="account-google__blue"
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      className="account-google__yellow"
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      className="account-google__green"
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

/**
 * Sign in with Google, above the email form.
 *
 * Offered only once the sign-in service says Google is switched on, so a
 * FluidEQ whose server has not set it up shows email alone instead of a
 * button that ends on an error page. Pressed, Google opens in the person's
 * own browser, where they are usually already signed in; the panel says so
 * and keeps a Cancel beside it for as long as that takes, because the wait is
 * on the person and not on anything the app can time (Ivan, 2026-10-20: "we
 * need to enable google oauth to the fluid too").
 */
export default function GoogleSignIn({
  account,
  busy,
}: {
  account: IAccountState;
  busy: boolean;
}) {
  const { t, locale } = useTranslation();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let current = true;
    const ask = async () => {
      const answer = await isGoogleSignInAvailable();
      if (current) {
        setAvailable(answer);
      }
    };
    ask().catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);

  if (account.waiting === 'google') {
    return (
      <div className="account-google account-google--waiting" role="status">
        <GoogleMark />
        <span className="account-google__waiting">
          {t('account.google.waiting')}
        </span>
        <button
          type="button"
          className="button small subtle"
          onClick={() => {
            cancelAccountAttempt().catch(() => undefined);
          }}
        >
          {t('account.google.cancel')}
        </button>
      </div>
    );
  }
  if (!available) {
    return null;
  }
  return (
    <div className="account-google">
      <button
        type="button"
        className="button small subtle account-google__button"
        disabled={busy}
        onClick={() => {
          signInWithGoogle(locale).catch(() => undefined);
        }}
      >
        <GoogleMark />
        {t('account.google')}
      </button>
      <span className="account-google__or">{t('account.or')}</span>
    </div>
  );
}
