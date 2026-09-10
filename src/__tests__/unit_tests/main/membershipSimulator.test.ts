/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import { createMembershipSimulator } from '../../../main/account/membershipSimulator';

const CONFIG = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: `sb_publishable_${'a'.repeat(40)}`,
  apiUrl: 'https://project.supabase.co/functions/v1',
  plusPrice: '$5 / month',
};

describe('the pretend membership', () => {
  let fetchImpl: jest.Mock;

  beforeEach(() => {
    fetchImpl = jest.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, answer: 'ok' }), {
          status: 200,
        }),
      ),
    );
  });

  const build = () => createMembershipSimulator({ config: CONFIG, fetchImpl });

  it('asks the server for the event with the account token, never with a secret of its own', async () => {
    await build().send('access-1', 'started');
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://project.supabase.co/functions/v1/dev-membership');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer access-1');
    expect(Object.keys(headers)).not.toContain('x-signature-sha256');
    expect(JSON.parse(init.body as string)).toEqual({ simulation: 'started' });
  });

  it('names a signed-out token, a refusal and an unreachable server differently', async () => {
    fetchImpl.mockResolvedValue(new Response('unauthorized', { status: 401 }));
    await expect(build().send('stale', 'started')).rejects.toMatchObject({
      failure: 'signed_out',
    });
    fetchImpl.mockResolvedValue(new Response('admins only', { status: 403 }));
    await expect(build().send('access-1', 'cancelled')).rejects.toMatchObject({
      failure: 'rejected',
    });
    fetchImpl.mockRejectedValue(new Error('offline'));
    await expect(build().send('access-1', 'started')).rejects.toMatchObject({
      failure: 'network',
    });
  });
});
