/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import type { IGalleryAuth } from '../../../main/plus/galleryAccess';
import { startCreditCheckout } from '../../../main/plus/sceneStoreApi';

/**
 * Ivan, 2026-11-28: "also add sandbox for get more credits too on dev env".
 * Under `pnpm dev` (`common/billingMode.ts`) "Get more credits" asks the
 * server for a page in Stripe's test mode, where a test card buys test
 * credits; every build that ships asks exactly what it always asked.
 */

const LIVE_PAGE =
  'https://checkout.stripe.com/c/pay/cs_live_a1B2c3#fidkdWxOYHwnPyd1blpxYHZxWjA0';
const TEST_PAGE =
  'https://checkout.stripe.com/c/pay/cs_test_a1B2c3#fidkdWxOYHwnPyd1blpxYHZxWjA0';

const answering = (status: number, body: unknown) => {
  const fetchImpl = jest.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  const auth: IGalleryAuth = {
    config: {
      supabaseUrl: 'https://project.example',
      supabaseAnonKey: 'public',
      apiUrl: 'https://project.example/functions/v1',
    },
    accessToken: 'access-1',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  };
  const sent = () => {
    const [, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    return JSON.parse(String(init.body)) as Record<string, unknown>;
  };
  return { auth, sent };
};

describe('Get more credits in the Stripe mode the build buys in', () => {
  it('asks for a test page under pnpm dev, and opens it', async () => {
    const { auth, sent } = answering(200, { url: TEST_PAGE });
    await expect(
      startCreditCheckout(auth, 'pack-5', 'en', 'test'),
    ).resolves.toEqual({
      ok: true,
      url: TEST_PAGE,
    });
    expect(sent()).toMatchObject({
      packId: 'pack-5',
      locale: 'en',
      mode: 'test',
    });
  });

  it('asks a release what it always asked, with no mode, and opens a live page', async () => {
    const { auth, sent } = answering(200, { url: LIVE_PAGE });
    await expect(
      startCreditCheckout(auth, 'pack-5', 'en', 'live'),
    ).resolves.toEqual({
      ok: true,
      url: LIVE_PAGE,
    });
    expect(sent()).not.toHaveProperty('mode');
  });

  it('is live in every build but the development server, Jest included', async () => {
    const { auth, sent } = answering(200, { url: LIVE_PAGE });
    await expect(
      startCreditCheckout(auth, 'pack-5', 'en'),
    ).resolves.toMatchObject({ ok: true });
    expect(sent()).not.toHaveProperty('mode');
  });

  // A server from before premium 0125 ignores the mode and makes a live page:
  // a development build refuses to open it, so no real card is ever taken
  // from pnpm dev. The control is the release opening that same page above.
  it('never opens a live page from a development build', async () => {
    const { auth } = answering(200, { url: LIVE_PAGE });
    await expect(
      startCreditCheckout(auth, 'pack-5', 'en', 'test'),
    ).resolves.toEqual({
      ok: false,
      reason: 'server',
    });
  });

  it('tells an account the server sells no test page to that the pack is not on sale', async () => {
    const { auth } = answering(404, { error: 'pack_not_on_sale' });
    await expect(
      startCreditCheckout(auth, 'pack-5', 'en', 'test'),
    ).resolves.toEqual({
      ok: false,
      reason: 'not-on-sale',
    });
  });
});
