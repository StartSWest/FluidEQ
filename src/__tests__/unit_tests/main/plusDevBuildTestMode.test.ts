/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import { PLUS_TERMS_VERSION } from '../../../common/plusTerms';
import type { ILibraryPlan } from '../../../common/subscription';
import { createSubscriptionService } from '../../../main/account/subscriptionService';
import {
  ACCOUNT_ID,
  CONFIG,
  fakeBackend,
  library,
  liveRow,
  NOW,
  startPlus,
  type IDisk,
} from '../../utils/plusSubscriptionKit';

/**
 * A development build, the whole of Plus's main side as `pnpm dev` runs it:
 * `NODE_ENV` is `development` there, so the build buys in Stripe's test mode
 * (`common/billingMode.ts`). Ivan, 2026-11-28: "dev needs to behave like
 * normal, just point to the testing Stripe". The release half of the same
 * rule is in `plusSubscriptionService.test.ts`, where the build is Jest's
 * and so live.
 */
jest.mock('../../../common/billingMode', () => ({
  ...jest.requireActual<object>('../../../common/billingMode'),
  BILLING_MODE: 'test',
}));

const CHECKOUT = 'POST /functions/v1/create-subscription-checkout';
const PORTAL = 'POST /functions/v1/create-billing-portal';

/** The live prices, as the fake server sends them to everybody. */
const LIVE_PLANS: ILibraryPlan[] = [
  { id: 'monthly', interval: 'month', priceCents: 799, currency: 'USD' },
  { id: 'yearly', interval: 'year', priceCents: 5999, currency: 'USD' },
];
/** Stripe's test prices, told apart from the live ones by their amounts. */
const TEST_PLANS: ILibraryPlan[] = [
  { id: 'monthly', interval: 'month', priceCents: 100, currency: 'USD' },
  { id: 'yearly', interval: 'year', priceCents: 900, currency: 'USD' },
];

const setup = async ({
  testSold,
  subscribed = false,
  disk = {},
}: {
  testSold: boolean;
  subscribed?: boolean;
  disk?: IDisk;
}) => {
  const backend = fakeBackend();
  backend.state.aware = true;
  // Live plans go to everybody; the test plans to whoever the server sells
  // test mode to.
  backend.state.testPlans = testSold ? TEST_PLANS : undefined;
  if (subscribed) {
    backend.state.row = liveRow();
    backend.state.library = library();
  }
  const app = startPlus({ backend, disk, clock: { now: NOW } });
  await app.signIn();
  const service = createSubscriptionService({
    configured: () => true,
    accountId: () => ACCOUNT_ID,
    subscription: app.account,
    ownership: app.ownership,
    records: app.records,
    auth: async () => ({
      config: CONFIG,
      accessToken: `access-${ACCOUNT_ID}`,
      fetchImpl: backend.fetchImpl,
    }),
    openExternal: () => true,
  });
  return { backend, disk, app, service };
};

describe('Plus in a development build', () => {
  it('offers Stripe’s test prices, never the live ones sent beside them', async () => {
    const { service } = await setup({ testSold: true });
    expect(service.state().plans).toEqual(TEST_PLANS);
  });

  it('asks for a test checkout', async () => {
    const { service, backend } = await setup({ testSold: true });
    await expect(
      service.subscribe('yearly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('opened');
    expect(backend.bodies.find((each) => each.call === CHECKOUT)?.body).toEqual(
      {
        plan: 'yearly',
        app: 'fluideq',
        termsVersion: PLUS_TERMS_VERSION,
        locale: 'en',
        mode: 'test',
      },
    );
  });

  // The server opens the portal in the mode of the account's own
  // subscription, so the window never names one.
  it('opens the portal as a release does, naming no mode', async () => {
    const { service, backend } = await setup({
      testSold: true,
      subscribed: true,
    });
    await expect(service.manage('en')).resolves.toBe('opened');
    expect(backend.bodies.find((each) => each.call === PORTAL)?.body).toEqual({
      app: 'fluideq',
      locale: 'en',
    });
  });

  it('has nothing on sale when the server sends no test prices, and sends no checkout', async () => {
    const { service, backend } = await setup({ testSold: false });
    expect(service.state().plans).toEqual([]);
    await expect(
      service.subscribe('monthly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('not-on-sale');
    expect(backend.count(CHECKOUT)).toBe(0);
  });

  it('remembers the test prices apart, and leaves a release’s live ones as they were', async () => {
    // A release on this computer heard the live prices first.
    const disk: IDisk = {
      plus: { version: 1, plans: LIVE_PLANS, accounts: {} },
    };
    const { app } = await setup({ testSold: true, disk });
    await app.idle();
    expect(disk.plus?.testPlans).toEqual(TEST_PLANS);
    expect(disk.plus?.plans).toEqual(LIVE_PLANS);
    expect(app.records.knownPlans()).toEqual(TEST_PLANS);
  });
});
