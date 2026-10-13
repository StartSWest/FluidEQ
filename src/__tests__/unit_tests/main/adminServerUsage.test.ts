/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How main asks for the Server page's two answers: the capacity through the
 * database, the week's requests through the `admin-server-usage` function,
 * and where on supabase.com the rest is read.
 */

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn(), removeHandler: jest.fn() },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import type { IAccountConfig } from '../../../common/accountConfig';
import { dashboardOf } from '../../../main/ipc/adminInsights';
import { requestUsage } from '../../../main/plus/adminInsightsApi';
import type { IGalleryAuth } from '../../../main/plus/galleryAccess';
/* eslint-enable import/first */

const config = {
  supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co',
  supabaseAnonKey: 'anon',
  apiUrl: 'https://abcdefghijklmnopqrst.supabase.co/functions/v1',
} as IAccountConfig;

const answering = (status: number, body: unknown) => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  const auth: IGalleryAuth = { config, accessToken: 'token', fetchImpl };
  return { auth, calls };
};

describe('the week’s requests', () => {
  it('asks the function with the account’s own session', async () => {
    const { auth, calls } = answering(200, { configured: false });
    expect(await requestUsage(auth)).toEqual({
      ok: true,
      value: { state: 'unconfigured' },
    });
    expect(calls[0].url).toBe(`${config.apiUrl}/admin-server-usage`);
    expect(new Headers(calls[0].init?.headers).get('authorization')).toBe(
      'Bearer token',
    );
  });

  it('reads a refused usage key as an answer, not a fault', async () => {
    const { auth } = answering(502, { configured: true, error: 'token' });
    expect(await requestUsage(auth)).toEqual({
      ok: true,
      value: { state: 'token' },
    });
  });

  it('says a function never deployed, the admin refused, and any other fault', async () => {
    expect(await requestUsage(answering(404, {}).auth)).toEqual({
      ok: false,
      reason: 'not-deployed',
    });
    expect(
      await requestUsage(answering(403, { error: 'admin_required' }).auth),
    ).toEqual({ ok: false, reason: 'forbidden' });
    expect(
      await requestUsage(
        answering(502, { configured: true, error: 'usage' }).auth,
      ),
    ).toEqual({ ok: false, reason: 'server' });
  });
});

describe('the project’s page on supabase.com', () => {
  it('is named by the project the app talks to, and by nothing else', () => {
    expect(dashboardOf('https://abcdefghijklmnopqrst.supabase.co')).toBe(
      'https://supabase.com/dashboard/project/abcdefghijklmnopqrst',
    );
    expect(dashboardOf('http://127.0.0.1:54321')).toBeUndefined();
    expect(
      dashboardOf('https://abcdefghijklmnopqrst.supabase.co.evil.example'),
    ).toBeUndefined();
  });
});
