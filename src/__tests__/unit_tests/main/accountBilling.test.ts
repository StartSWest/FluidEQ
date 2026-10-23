/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import { createBillingClient } from '../../../main/account/billingClient';

const CONFIG = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: `sb_publishable_${'a'.repeat(40)}`,
  apiUrl: 'https://fluideq.com/api',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('the billing client', () => {
  let fetchImpl: jest.Mock;
  const build = () => createBillingClient(CONFIG, fetchImpl);

  beforeEach(() => {
    fetchImpl = jest.fn();
  });

  // Plus is not sold and no subscription is shown (credits replaced it): no
  // checkout to mint, and no page to manage one either.
  it('only looks a membership up', () => {
    expect(Object.keys(build())).toEqual(['syncMembership']);
  });

  it('asks the server to match the account at the merchant, and reads the answer', async () => {
    fetchImpl.mockResolvedValue(json({ synced: true }));
    expect(await build().syncMembership('access-1')).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://fluideq.com/api/sync-membership');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer access-1');
    expect(headers.apikey).toBe(CONFIG.supabaseAnonKey);
    fetchImpl.mockResolvedValue(json({ synced: false }));
    expect(await build().syncMembership('access-1')).toBe(false);
  });

  it('names a refused token so the app can sign the person out', async () => {
    fetchImpl.mockResolvedValue(json({ error: 'unauthorized' }, 401));
    await expect(build().syncMembership('stale')).rejects.toMatchObject({
      failure: 'signed_out',
    });
  });

  it('names a server refusal and a dead network apart', async () => {
    fetchImpl.mockResolvedValue(json({ error: 'merchant' }, 502));
    await expect(build().syncMembership('a')).rejects.toMatchObject({
      failure: 'rejected',
    });
    fetchImpl.mockRejectedValue(new TypeError('offline'));
    await expect(build().syncMembership('a')).rejects.toMatchObject({
      failure: 'network',
    });
  });

  it('reads an answer that is not JSON as nothing written', async () => {
    fetchImpl.mockResolvedValue(new Response('<html>', { status: 200 }));
    expect(await build().syncMembership('a')).toBe(false);
  });
});
