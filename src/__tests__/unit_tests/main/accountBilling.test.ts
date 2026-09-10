/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import {
  createBillingClient,
  readBillingUrl,
} from '../../../main/account/billingClient';

const CONFIG = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: `sb_publishable_${'a'.repeat(40)}`,
  apiUrl: 'https://fluideq.com/api',
  plusPrice: '$3.99 / month',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('what the billing server may hand to the browser', () => {
  it('is an https URL and nothing else', () => {
    expect(
      readBillingUrl({ url: 'https://checkout.stripe.com/c/pay/cs_1' }),
    ).toBe('https://checkout.stripe.com/c/pay/cs_1');
    expect(
      readBillingUrl({ url: 'http://checkout.stripe.com/x' }),
    ).toBeUndefined();
    // The literal IS the test: the value that must never reach `openExternal`.
    // eslint-disable-next-line no-script-url
    expect(readBillingUrl({ url: 'javascript:alert(1)' })).toBeUndefined();
    expect(readBillingUrl({ url: 'not a url' })).toBeUndefined();
    expect(readBillingUrl({})).toBeUndefined();
    expect(readBillingUrl('https://x')).toBeUndefined();
  });
});

describe('the billing client', () => {
  let fetchImpl: jest.Mock;
  const build = () => createBillingClient(CONFIG, fetchImpl);

  beforeEach(() => {
    fetchImpl = jest.fn();
  });

  it('asks the configured API for a checkout with the token, and returns its URL', async () => {
    fetchImpl.mockResolvedValue(
      json({ url: 'https://checkout.stripe.com/c/1' }),
    );
    expect(await build().checkoutUrl('access-1')).toBe(
      'https://checkout.stripe.com/c/1',
    );
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://fluideq.com/api/create-checkout');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer access-1');
    expect(headers.apikey).toBe(CONFIG.supabaseAnonKey);
  });

  it('asks for the portal at its own address', async () => {
    fetchImpl.mockResolvedValue(
      json({ url: 'https://billing.stripe.com/p/1' }),
    );
    await build().portalUrl('access-1');
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://fluideq.com/api/create-portal',
    );
  });

  it('names a refused token so the app can sign the person out', async () => {
    fetchImpl.mockResolvedValue(json({ error: 'unauthorized' }, 401));
    await expect(build().checkoutUrl('stale')).rejects.toMatchObject({
      failure: 'signed_out',
    });
  });

  it('names a server refusal and a dead network apart', async () => {
    fetchImpl.mockResolvedValue(json({ error: 'stripe' }, 502));
    await expect(build().checkoutUrl('a')).rejects.toMatchObject({
      failure: 'rejected',
    });
    fetchImpl.mockRejectedValue(new TypeError('offline'));
    await expect(build().checkoutUrl('a')).rejects.toMatchObject({
      failure: 'network',
    });
  });

  it('asks the server to match the account at the merchant, and reads the answer', async () => {
    fetchImpl.mockResolvedValue(json({ synced: true }));
    expect(await build().syncMembership('access-1')).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://fluideq.com/api/sync-membership');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer access-1',
    );
    fetchImpl.mockResolvedValue(json({ synced: false }));
    expect(await build().syncMembership('access-1')).toBe(false);
  });

  it('refuses an answer without a usable URL', async () => {
    fetchImpl.mockResolvedValue(json({ url: 'http://plain.example' }));
    await expect(build().portalUrl('a')).rejects.toMatchObject({
      failure: 'rejected',
    });
  });
});
