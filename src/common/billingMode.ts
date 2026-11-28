/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which of Stripe's two modes this build buys in (premium 0124's "test and
 * live at once"). A development build (`pnpm dev`) buys in test mode, so
 * Ivan can try every purchase with Stripe's test cards and nothing is
 * charged; every build that can ship buys in live mode (Ivan, 2026-11-28:
 * "dev needs to behave like normal, just point to the testing Stripe").
 *
 * Decided by `NODE_ENV` alone, which webpack compiles into every bundle:
 * `build:main` and `build:renderer` run under `NODE_ENV=production`
 * (`checkNodeEnv('production')`), so a release folds this to `'live'` and
 * carries no path to test mode. `DEBUG_PROD`, the flag for debugging a
 * production bundle, is deliberately not read: that bundle is a release.
 * FluidWallpapers decides the same thing from `__FW_DEV__`, true under its
 * dev server only.
 *
 * Nothing else differs: a development build shows Plus and credits exactly
 * where and as a release does, with no notice of its own ("no more that
 * crap dev is normal as prod just in test env"). Who may buy in test mode
 * is the server's to decide, never this flag's: FluidEQ is GPL, and anybody
 * can build it with the flag either way.
 */
export type TBillingMode = 'live' | 'test';

export const billingModeOf = (nodeEnv: string | undefined): TBillingMode =>
  nodeEnv === 'development' ? 'test' : 'live';

export const BILLING_MODE: TBillingMode = billingModeOf(process.env.NODE_ENV);

/** Stripe's own checkout, the one place this app sends anybody to pay. */
const STRIPE_CHECKOUT = 'https://checkout.stripe.com';

/**
 * A checkout page the server answered is one to open in `mode`: Stripe's
 * own, over https, with no credentials in it, and in test mode a session
 * Stripe made in test mode - its id says so (`/c/pay/cs_test_...`, against
 * `cs_live_...`). The server is asked for a test checkout, but one that
 * ignored the word (any server before 0126) would answer a live page, and
 * `pnpm dev` would take a real card on it: such a page is refused instead.
 * A release opens any page of Stripe's checkout, as it always did.
 */
export const isCheckoutForMode = (
  url: unknown,
  mode: TBillingMode,
): boolean => {
  if (typeof url !== 'string') {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.origin === STRIPE_CHECKOUT &&
    parsed.username === '' &&
    parsed.password === '' &&
    (mode === 'live' || parsed.pathname.startsWith('/c/pay/cs_test_'))
  );
};
