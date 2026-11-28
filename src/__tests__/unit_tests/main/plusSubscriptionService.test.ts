/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import { FLUIDEQ_CREATOR_ID } from '../../../common/plusGallery';
import { PLUS_TERMS_VERSION } from '../../../common/plusTerms';
import {
  createSubscriptionService,
  type ISubscriptionService,
} from '../../../main/account/subscriptionService';
import {
  ACCOUNT_ID,
  CONFIG,
  DAY,
  DUNE,
  fakeBackend,
  GLOW,
  HOUR,
  library,
  liveRow,
  memoryLogger,
  NOW,
  PLANS,
  startPlus,
  type IDisk,
  type IPlusApp,
  type TFakeBackend,
} from '../../utils/plusSubscriptionKit';

// Plus for the window (premium 0122): the plans, Stripe's checkout and
// portal, and the offer made when it ended, over the real account view and
// a fake of the server as built. The terms the checkout records are the
// terms the window showed.

const CHECKOUT = 'POST /functions/v1/create-subscription-checkout';
const PORTAL = 'POST /functions/v1/create-billing-portal';

const serviceOver = (
  app: IPlusApp,
  backend: TFakeBackend,
  {
    signedIn,
    openExternal = jest.fn<boolean, [string]>(() => true),
  }: {
    signedIn: () => string | undefined;
    openExternal?: jest.Mock<boolean, [string]>;
  },
) => {
  const { lines, logger } = memoryLogger();
  const service: ISubscriptionService = createSubscriptionService({
    configured: () => true,
    accountId: signedIn,
    subscription: app.account,
    ownership: app.ownership,
    records: app.records,
    auth: async () => {
      const id = signedIn();
      return id
        ? {
            config: CONFIG,
            accessToken: `access-${id}`,
            fetchImpl: backend.fetchImpl,
          }
        : undefined;
    },
    openExternal,
    logger,
  });
  return { service, openExternal, lines };
};

const setup = async ({
  aware = true,
  subscribed = false,
  signIn = true,
  end = NOW + 30 * DAY,
  cancelled = false,
}: {
  aware?: boolean;
  subscribed?: boolean;
  signIn?: boolean;
  end?: number;
  cancelled?: boolean;
} = {}) => {
  const backend = fakeBackend();
  const disk: IDisk = {};
  const clock = { now: NOW };
  backend.state.aware = aware;
  if (subscribed) {
    backend.state.row = liveRow(end, cancelled);
    backend.state.library = library(end, { renewing: !cancelled });
  }
  const app = startPlus({ backend, disk, clock });
  if (signIn) {
    await app.signIn();
  }
  let account: string | undefined = signIn ? ACCOUNT_ID : undefined;
  const made = serviceOver(app, backend, { signedIn: () => account });
  return {
    backend,
    disk,
    clock,
    app,
    ...made,
    signOut: () => {
      account = undefined;
      app.signOut();
    },
  };
};

describe('Plus against a server from before 0122', () => {
  it('offers nothing, and never calls either Stripe function', async () => {
    const { service, backend } = await setup({ aware: false });
    expect(service.state()).toEqual({
      signedIn: true,
      plans: [],
      subscribed: false,
      manageable: false,
    });
    await expect(
      service.subscribe('monthly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('not-on-sale');
    await expect(service.manage('en')).resolves.toBe('no-subscription');
    expect(backend.count(CHECKOUT)).toBe(0);
    expect(backend.count(PORTAL)).toBe(0);
  });

  it('signed out, says so and offers nothing', async () => {
    const { service } = await setup({ aware: false, signIn: false });
    expect(service.state()).toEqual({
      signedIn: false,
      plans: [],
      subscribed: false,
      manageable: false,
    });
  });

  it('a build with no backend offers nothing, even plans remembered', async () => {
    const { app, backend } = await setup();
    const { logger } = memoryLogger();
    const unconfigured = createSubscriptionService({
      configured: () => false,
      accountId: () => ACCOUNT_ID,
      subscription: app.account,
      ownership: app.ownership,
      records: app.records,
      auth: async () => undefined,
      openExternal: () => true,
      logger,
    });
    expect(unconfigured.state()).toEqual({
      signedIn: false,
      plans: [],
      subscribed: false,
      manageable: false,
    });
    expect(backend.count(CHECKOUT)).toBe(0);
  });
});

describe('Plus where the account is not yet read', () => {
  it('signed out, lists the plans this computer last heard on sale, also after a restart', async () => {
    const { app, backend, disk, clock, signOut } = await setup();
    signOut();
    app.stop();
    const again = startPlus({ backend, disk, clock });
    const { service } = serviceOver(again, backend, {
      signedIn: () => undefined,
    });
    expect(service.state()).toEqual({
      signedIn: false,
      plans: PLANS,
      plansRemembered: true,
      subscribed: false,
      manageable: false,
    });
  });

  it('says when the plans it lists are remembered, not the account’s own answer', async () => {
    const { app, backend, disk, clock } = await setup();
    app.stop();
    const again = startPlus({ backend, disk, clock, signedInAs: ACCOUNT_ID });
    const { service } = serviceOver(again, backend, {
      signedIn: () => ACCOUNT_ID,
    });
    expect(service.state()).toMatchObject({
      plans: PLANS,
      plansRemembered: true,
    });
    await again.launch();
    expect(service.state().plansRemembered).toBeUndefined();
    expect(service.state().plans).toEqual(PLANS);
  });

  it('a checkout before the account’s own answer reads it once, then checks out on it', async () => {
    const { app, backend, disk, clock } = await setup();
    app.stop();
    const again = startPlus({ backend, disk, clock, signedInAs: ACCOUNT_ID });
    const { service, openExternal } = serviceOver(again, backend, {
      signedIn: () => ACCOUNT_ID,
    });
    const stores = backend.count('POST /rest/v1/rpc/my_store');
    await expect(
      service.subscribe('yearly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('opened');
    expect(backend.count('POST /rest/v1/rpc/my_store')).toBe(stores + 1);
    expect(openExternal).toHaveBeenCalledTimes(1);
  });

  it('offline, a checkout from remembered plans says it could not connect, one read a press, never "not on sale"', async () => {
    const { app, backend, disk, clock } = await setup();
    app.stop();
    backend.state.offline = true;
    const again = startPlus({ backend, disk, clock, signedInAs: ACCOUNT_ID });
    const { service } = serviceOver(again, backend, {
      signedIn: () => ACCOUNT_ID,
    });
    const stores = () => backend.count('POST /rest/v1/rpc/my_store');
    const before = stores();
    await expect(
      service.subscribe('monthly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('failed');
    expect(stores()).toBe(before + 1);
    await expect(
      service.subscribe('monthly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('failed');
    expect(stores()).toBe(before + 2);
    expect(backend.count(CHECKOUT)).toBe(0);
  });

  it('says when the account is suspended, which says nothing of what is on sale', async () => {
    const { service, backend, app } = await setup();
    backend.state.suspended = true;
    await app.ownership.refreshNow();
    await app.idle();
    expect(service.state()).toMatchObject({
      suspended: true,
      plans: [],
      subscribed: false,
    });
    expect(app.records.knownPlans()).toEqual(PLANS);
  });
});

describe('the checkout', () => {
  it('lists the plans the server sells, month first', async () => {
    const { service } = await setup();
    expect(service.state().plans.map((plan) => plan.id)).toEqual([
      'monthly',
      'yearly',
    ]);
  });

  // A release buys in live mode exactly as before premium 0124: the
  // test plans an answer carries beside the live ones are never offered,
  // and the checkout below names no mode. The development half is
  // `plusDevBuildTestMode.test.ts`.
  it('in a release, offers the live plans even beside test plans', async () => {
    const backend = fakeBackend();
    backend.state.aware = true;
    backend.state.testPlans = PLANS.map((plan) => ({
      ...plan,
      priceCents: 100,
    }));
    const app = startPlus({ backend, disk: {}, clock: { now: NOW } });
    await app.signIn();
    const { service } = serviceOver(app, backend, {
      signedIn: () => ACCOUNT_ID,
    });
    expect(service.state().plans).toEqual(PLANS);
    await app.idle();
    expect(app.records.knownPlans()).toEqual(PLANS);
  });

  it("opens Stripe's checkout in the browser, with the plan, the app, the terms and the language, and logs only the origin", async () => {
    const { service, backend, openExternal, lines, app } = await setup();
    await expect(
      service.subscribe('yearly', 'es', PLUS_TERMS_VERSION),
    ).resolves.toBe('opened');
    const sent = backend.bodies.find((each) => each.call === CHECKOUT);
    expect(sent?.body).toEqual({
      plan: 'yearly',
      app: 'fluideq',
      termsVersion: PLUS_TERMS_VERSION,
      locale: 'es',
    });
    expect(openExternal).toHaveBeenCalledWith(
      'https://checkout.stripe.com/c/pay/cs_test_1',
    );
    expect(lines.join('\n')).toContain(
      'The Plus checkout opened at https://checkout.stripe.com',
    );
    expect(lines.join('\n')).not.toContain('cs_test_1');
    // The change is expected: the server's word is listened for.
    expect(app.pushes[0].watching).toBe(true);
  });

  it('sends a language Stripe has no page for as English', async () => {
    const { service, backend } = await setup();
    await service.subscribe('monthly', 'ko', PLUS_TERMS_VERSION);
    expect(
      backend.bodies.find((each) => each.call === CHECKOUT)?.body?.locale,
    ).toBe('en');
  });

  // The agreement the server records is the one the person read. In
  // development main and the window can carry different terms (main does
  // not hot-reload); a checkout under the other revision is not sent.
  it.each([PLUS_TERMS_VERSION - 1, PLUS_TERMS_VERSION + 1, undefined, '15'])(
    'sends nothing under terms the window showed as %p, and asks for them to be shown again',
    async (shown) => {
      const { service, backend, openExternal } = await setup();
      await expect(service.subscribe('monthly', 'en', shown)).resolves.toBe(
        'terms-changed',
      );
      expect(backend.count(CHECKOUT)).toBe(0);
      expect(openExternal).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['https://evil.example/c/pay/x'],
    ['http://checkout.stripe.com/c/pay/x'],
    ['https://user:pass@checkout.stripe.com/c/pay/x'],
    ['https://checkout.stripe.com.evil.example/c'],
    [42],
  ])('opens nothing but a page on checkout.stripe.com: %p', async (url) => {
    const { service, backend, openExternal } = await setup();
    backend.state.checkout = { status: 200, body: { url } };
    await expect(
      service.subscribe('monthly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('failed');
    expect(openExternal).not.toHaveBeenCalled();
  });

  it.each([
    ['unconfirmed', 403, 'needs-email'],
    ['terms_outdated', 409, 'needs-update'],
    ['plan_not_on_sale', 404, 'not-on-sale'],
    ['banned', 403, 'banned'],
    ['signed_out', 401, 'signed-out'],
    ['invalid_plan', 400, 'failed'],
    ['server', 502, 'failed'],
    ['constructor', 400, 'failed'],
  ])('says the refusal %s as %s', async (error, status, result) => {
    const { service, backend, openExternal } = await setup();
    backend.state.checkout = { status, body: { error } };
    await expect(
      service.subscribe('monthly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe(result);
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('already subscribed elsewhere: reads the store again, and Manage is the way on', async () => {
    const { service, backend } = await setup();
    backend.state.checkout = {
      status: 409,
      body: { error: 'already_subscribed' },
    };
    const stores = backend.count('POST /rest/v1/rpc/my_store');
    const changed = jest.fn();
    service.onChange(changed);
    await expect(
      service.subscribe('monthly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('already-subscribed');
    expect(backend.count('POST /rest/v1/rpc/my_store')).toBe(stores + 1);
    expect(service.state().manageable).toBe(true);
    expect(changed).toHaveBeenCalled();
  });

  it('already subscribed here: no checkout is asked for', async () => {
    const { service, backend } = await setup({ subscribed: true });
    await expect(
      service.subscribe('monthly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('already-subscribed');
    expect(backend.count(CHECKOUT)).toBe(0);
  });

  it('refuses anything that is not a plan, without asking', async () => {
    const { service, backend } = await setup();
    await expect(
      service.subscribe('weekly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('failed');
    await expect(
      service.subscribe(undefined, 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('failed');
    expect(backend.count(CHECKOUT)).toBe(0);
  });

  it('reads the prices again for a plan no longer listed, as the window then says', async () => {
    const { service, backend, app } = await setup();
    backend.state.plans = [PLANS[0]];
    await app.ownership.refreshNow();
    await app.idle();
    const stores = backend.count('POST /rest/v1/rpc/my_store');
    await expect(
      service.subscribe('yearly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('not-on-sale');
    await app.idle();
    expect(backend.count('POST /rest/v1/rpc/my_store')).toBe(stores + 1);
    expect(backend.count(CHECKOUT)).toBe(0);
  });

  it('offline, fails and opens nothing', async () => {
    const { service, backend, openExternal } = await setup();
    backend.state.offline = true;
    await expect(
      service.subscribe('monthly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('failed');
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('a browser that would not open is a failed checkout, and no change is expected', async () => {
    const { backend, app } = await setup();
    const { service } = serviceOver(app, backend, {
      signedIn: () => ACCOUNT_ID,
      openExternal: jest.fn<boolean, [string]>(() => false),
    });
    await expect(
      service.subscribe('monthly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('failed');
    expect(app.pushes[0].watching).toBe(false);
  });

  it('signed out, fails without asking anything', async () => {
    const { service, backend, signOut } = await setup();
    signOut();
    await expect(
      service.subscribe('monthly', 'en', PLUS_TERMS_VERSION),
    ).resolves.toBe('failed');
    expect(backend.count(CHECKOUT)).toBe(0);
  });
});

describe('the portal and the status', () => {
  it('a subscriber sees the plan and its renewal, and Manage opens billing.stripe.com', async () => {
    const { service, backend, openExternal } = await setup({
      subscribed: true,
    });
    expect(service.state()).toMatchObject({
      subscribed: true,
      manageable: true,
      status: {
        plan: 'monthly',
        until: new Date(NOW + 30 * DAY).toISOString(),
        renewing: true,
      },
    });
    await expect(service.manage('de')).resolves.toBe('opened');
    expect(backend.bodies.find((each) => each.call === PORTAL)?.body).toEqual({
      app: 'fluideq',
      locale: 'de',
    });
    expect(openExternal).toHaveBeenCalledWith(
      'https://billing.stripe.com/p/session/test_1',
    );
  });

  it('opens only a page on billing.stripe.com', async () => {
    const { service, backend, openExternal } = await setup({
      subscribed: true,
    });
    backend.state.portal = {
      status: 200,
      body: { url: 'https://checkout.stripe.com/p/x' },
    };
    await expect(service.manage('en')).resolves.toBe('failed');
    expect(openExternal).not.toHaveBeenCalled();
  });

  it.each([
    ['no_subscription', 404, 'no-subscription'],
    ['signed_out', 401, 'signed-out'],
    ['invalid_app', 400, 'failed'],
  ])('says the portal’s refusal %s as %s', async (error, status, result) => {
    const { service, backend } = await setup({ subscribed: true });
    backend.state.portal = { status, body: { error } };
    await expect(service.manage('en')).resolves.toBe(result);
  });

  it('says there is nothing to manage without asking, for an account with no Plus', async () => {
    const { service, backend } = await setup();
    await expect(service.manage('en')).resolves.toBe('no-subscription');
    expect(backend.count(PORTAL)).toBe(0);
  });
});

describe('the offer when Plus ended', () => {
  const ended = async () => {
    const made = await setup({
      subscribed: true,
      end: NOW + DAY,
      cancelled: true,
    });
    const { app, backend, clock } = made;
    app.records.addDownload(ACCOUNT_ID, GLOW);
    app.records.addDownload(ACCOUNT_ID, DUNE);
    clock.now = NOW + DAY + HOUR;
    backend.state.row = { ...liveRow(NOW + DAY, true), status: 'canceled' };
    backend.state.library = undefined;
    await app.comeBack();
    clock.now = NOW + 2 * DAY + 2 * HOUR;
    await app.comeBack();
    return made;
  };

  it('shows the last ending until put away', async () => {
    const { service } = await ended();
    const offer = service.state().lapse;
    expect(offer?.scenes.map((scene) => scene.lookId)).toEqual([GLOW, DUNE]);
    service.dismissLapse('another ending');
    expect(service.state().lapse).toEqual(offer);
    service.dismissLapse(offer?.id);
    expect(service.state().lapse).toBeUndefined();
  });

  it('leaves out a scene got with a credit since, and goes once all are', async () => {
    const { service, backend, app } = await ended();
    backend.state.owned = [{ authorId: GLOW.split(':')[1], sceneId: 'glow' }];
    await app.ownership.refreshNow();
    expect(service.state().lapse?.scenes.map((scene) => scene.lookId)).toEqual([
      DUNE,
    ]);
    // FluidEQ's own scenes are listed under its own account.
    backend.state.owned = [
      ...backend.state.owned,
      { authorId: FLUIDEQ_CREATOR_ID, sceneId: 'dune' },
    ];
    await app.ownership.refreshNow();
    expect(service.state().lapse).toBeUndefined();
  });

  it('is not shown while Plus runs again', async () => {
    const { service, backend, app } = await ended();
    backend.state.row = liveRow(NOW + 40 * DAY);
    backend.state.library = library(NOW + 40 * DAY);
    await app.comeBack();
    expect(service.state().subscribed).toBe(true);
    expect(service.state().lapse).toBeUndefined();
  });
});
