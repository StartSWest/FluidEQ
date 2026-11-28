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
