/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import type { IEncryptedJsonStore } from '../../../main/encryptedJsonStore';
import { createForumSession } from '../../../main/forum/forumSession';
import {
  buildAuthorizeUrl,
  createPkce,
  exchangeCode,
  openCallbackServer,
} from '../../../main/forum/githubOAuth';

/**
 * Signing in to GitHub from the app: the one-shot loopback server GitHub
 * sends the browser back to, the token exchange, and the session that keeps
 * and renews what comes out of it. Driven the way a browser and GitHub would
 * drive them, with nothing on a clock.
 */

const PAGES = {
  success: 'OK-PAGE',
  failure: 'FAIL-PAGE',
  cancelled: 'CANCEL-PAGE',
};

const get = async (url: string) => {
  const response = await fetch(url);
  return { status: response.status, body: await response.text() };
};

describe('the loopback server GitHub redirects to', () => {
  it('takes the code for its own state and answers the tab when told', async () => {
    const pkce = createPkce();
    const server = await openCallbackServer(
      pkce,
      PAGES,
      new AbortController().signal,
    );
    expect(server.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);

    const base = server.redirectUri.replace('/callback', '');
    expect((await get(`${base}/favicon.ico`)).status).toBe(404);
    expect(
      await get(`${server.redirectUri}?state=someone-else&code=x`),
    ).toEqual({
      status: 400,
      body: 'FAIL-PAGE',
    });

    const browser = get(
      `${server.redirectUri}?state=${pkce.state}&code=abc123`,
    );
    await expect(server.code).resolves.toBe('abc123');
    server.finish(PAGES.success);
    expect(await browser).toEqual({ status: 200, body: 'OK-PAGE' });
    await expect(get(server.redirectUri)).rejects.toThrow();
  });

  it('tells the tab and the app when the person declines on GitHub', async () => {
    const pkce = createPkce();
    const server = await openCallbackServer(
      pkce,
      PAGES,
      new AbortController().signal,
    );
    const browser = get(
      `${server.redirectUri}?state=${pkce.state}&error=access_denied`,
    );
    await expect(server.code).rejects.toMatchObject({ failure: 'cancelled' });
    expect((await browser).body).toBe('CANCEL-PAGE');
    server.finish(PAGES.cancelled);
  });

  it('closes when the sign-in is cancelled from the app', async () => {
    const controller = new AbortController();
    const server = await openCallbackServer(
      createPkce(),
      PAGES,
      controller.signal,
    );
    controller.abort();
    await expect(server.code).rejects.toMatchObject({ failure: 'cancelled' });
    await expect(get(server.redirectUri)).rejects.toThrow();
  });

  it('asks GitHub with a PKCE challenge, never with the verifier', () => {
    const pkce = createPkce();
    const url = new URL(
      buildAuthorizeUrl(
        'Iv23liEXAMPLE',
        'http://127.0.0.1:5555/callback',
        pkce,
      ),
    );
    expect(url.origin + url.pathname).toBe(
      'https://github.com/login/oauth/authorize',
    );
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(pkce.challenge);
    expect(url.toString()).not.toContain(pkce.verifier);
  });
});

describe('the token exchange', () => {
  const client = { clientId: 'Iv23liEXAMPLE', clientSecret: 'a'.repeat(40) };

  it('reads a token set with its expiries', async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          access_token: 'ghu_x',
          expires_in: 28800,
          refresh_token: 'ghr_y',
          refresh_token_expires_in: 15811200,
        }),
      )) as typeof fetch;
    const before = Date.now();
    const tokens = await exchangeCode(
      fetchImpl,
      client,
      'c',
      'http://127.0.0.1:1/callback',
      'v',
    );
    expect(tokens.accessToken).toBe('ghu_x');
    expect(tokens.refreshToken).toBe('ghr_y');
    expect(tokens.accessExpiresAt).toBeGreaterThanOrEqual(
      before + 28800 * 1000,
    );
  });

  it('reads GitHub’s refusal from a 200 answer', async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ error: 'bad_verification_code' }),
      )) as typeof fetch;
    await expect(
      exchangeCode(fetchImpl, client, 'c', 'http://127.0.0.1:1/callback', 'v'),
    ).rejects.toMatchObject({ failure: 'signed_out' });
  });
});

describe('the forum session', () => {
  const CONFIG = {
    owner: 'o',
    name: 'r',
    feedUrl: 'https://example.test/feed.json',
    clientId: 'Iv23liEXAMPLE',
    clientSecret: 'a'.repeat(40),
  };
  const viewer = { login: 'me', avatarUrl: null, url: null };

  type TStored = Parameters<IEncryptedJsonStore<never>['write']>[0];
  const memoryStore = (initial?: unknown) => {
    let value = initial;
    return {
      available: () => true,
      clear: () => {
        value = undefined;
      },
      read: () => value as TStored,
      write: (next: unknown) => {
        value = next;
      },
      peek: () => value,
    };
  };

  it('is read-only in a build with no GitHub App', () => {
    const session = createForumSession({
      config: { ...CONFIG, clientId: '', clientSecret: '' },
      userDataDir: '',
      fetchViewer: () => Promise.resolve(viewer),
      onState: () => undefined,
      store: memoryStore(),
    });
    expect(session.state()).toEqual({ status: 'unconfigured' });
  });

  it('renews a token about to lapse, once, however many ask', async () => {
    const now = 1_000_000;
    const store = memoryStore({
      accessToken: 'old',
      accessExpiresAt: now + 30_000,
      refreshToken: 'ghr_1',
      refreshExpiresAt: now + 10_000_000,
      viewer,
    });
    let refreshes = 0;
    const fetchImpl = (async () => {
      refreshes += 1;
      return new Response(
        JSON.stringify({
          access_token: 'new',
          expires_in: 28800,
          refresh_token: 'ghr_2',
        }),
      );
    }) as typeof fetch;
    const session = createForumSession({
      config: CONFIG,
      userDataDir: '',
      fetchViewer: () => Promise.resolve(viewer),
      onState: () => undefined,
      store,
      fetchImpl,
      now: () => now,
    });
    const tokens = await Promise.all([
      session.accessToken(),
      session.accessToken(),
    ]);
    expect(tokens).toEqual(['new', 'new']);
    expect(refreshes).toBe(1);
    expect(store.peek()).toMatchObject({ refreshToken: 'ghr_2', viewer });
  });

  it('signs out when GitHub refuses the refresh token', async () => {
    const states: string[] = [];
    const session = createForumSession({
      config: CONFIG,
      userDataDir: '',
      fetchViewer: () => Promise.resolve(viewer),
      onState: (state) => states.push(state.status),
      store: memoryStore({
        accessToken: 'old',
        accessExpiresAt: 1,
        refreshToken: 'ghr_1',
        refreshExpiresAt: 0,
        viewer,
      }),
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({ error: 'bad_refresh_token' }),
        )) as typeof fetch,
    });
    await expect(session.accessToken()).rejects.toMatchObject({
      failure: 'signed_out',
    });
    expect(session.state()).toEqual({ status: 'signed-out' });
    expect(states).toContain('signed-out');
  });

  it('forgets a token GitHub no longer accepts', () => {
    const store = memoryStore({
      accessToken: 't',
      accessExpiresAt: 0,
      refreshToken: '',
      refreshExpiresAt: 0,
      viewer,
    });
    const session = createForumSession({
      config: CONFIG,
      userDataDir: '',
      fetchViewer: () => Promise.resolve(viewer),
      onState: () => undefined,
      store,
    });
    expect(session.state()).toEqual({ status: 'signed-in', viewer });
    session.invalidate();
    expect(session.state()).toEqual({ status: 'signed-out' });
    expect(store.peek()).toBeUndefined();
  });
});
