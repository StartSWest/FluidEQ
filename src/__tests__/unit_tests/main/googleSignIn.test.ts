/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import type {
  IAccountCredentialStore,
  IAccountRecord,
} from '../../../main/accountCredentials';
import {
  AuthError,
  googleSignInAvailable,
} from '../../../main/account/authClient';
import { runGoogleSignIn } from '../../../main/account/googleSignIn';
import {
  OAUTH_CALLBACK_PATH,
  oauthPage,
  startOAuthLoopback,
  type TOAuthAnswer,
} from '../../../main/account/oauthLoopback';
import { challengeOf, createPkcePair } from '../../../main/account/pkce';
import {
  createAccountSession,
  type IAccountState,
} from '../../../main/account/session';

const CONFIG = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: `sb_publishable_${'a'.repeat(40)}`,
  apiUrl: 'https://project.supabase.co/functions/v1',
};

const PAGES = { done: '<p>done</p>', failed: '<p>failed</p>' };

const tokenReply = {
  access_token: 'access-g',
  refresh_token: 'refresh-g',
  expires_in: 3_600,
  user: {
    id: 'user-g',
    email: 'someone@gmail.com',
    user_metadata: { full_name: 'Some One' },
  },
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** A loopback the test answers by hand, where the real one waits on a port. */
const handLoopback = () => {
  let answer: (value: TOAuthAnswer) => void = () => undefined;
  const pending = new Promise<TOAuthAnswer>((resolve) => {
    answer = resolve;
  });
  const start = jest.fn(async () => ({
    redirectTo: `http://127.0.0.1:50123${OAUTH_CALLBACK_PATH}`,
    answer: pending,
  }));
  return { start, answer: (value: TOAuthAnswer) => answer(value) };
};

/** The microtasks a step of the flow takes, without a clock. */
const settle = async () => {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask turn each, in order
    await Promise.resolve();
  }
};

describe('the PKCE secret', () => {
  it('hashes the verifier as RFC 7636 says (its own worked example)', () => {
    expect(challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('makes a new 43-character verifier each time, with its own challenge', () => {
    const first = createPkcePair();
    const second = createPkcePair();
    expect(first.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.verifier).not.toBe(second.verifier);
    expect(first.challenge).toBe(challengeOf(first.verifier));
  });
});

describe('the answer coming back to this computer', () => {
  it('takes one code at the callback, shows the done page, and stops listening', async () => {
    const loopback = await startOAuthLoopback(
      new AbortController().signal,
      PAGES,
    );
    expect(loopback.redirectTo).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/,
    );
    const page = await fetch(`${loopback.redirectTo}?code=abc123`);
    expect(page.status).toBe(200);
    expect(page.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await page.text()).toBe(PAGES.done);
    await expect(loopback.answer).resolves.toEqual({
      kind: 'code',
      code: 'abc123',
    });
    await expect(fetch(`${loopback.redirectTo}?code=again`)).rejects.toThrow();
  });

  it('brings back why, when Google or the person said no', async () => {
    const loopback = await startOAuthLoopback(
      new AbortController().signal,
      PAGES,
    );
    const page = await fetch(
      `${loopback.redirectTo}?error=access_denied&error_description=The+user+denied`,
    );
    expect(await page.text()).toBe(PAGES.failed);
    await expect(loopback.answer).resolves.toEqual({
      kind: 'error',
      reason: 'The user denied',
    });
  });

  it('turns away anything but the callback and keeps waiting', async () => {
    const loopback = await startOAuthLoopback(
      new AbortController().signal,
      PAGES,
    );
    const { origin } = new URL(loopback.redirectTo);
    expect((await fetch(`${origin}/favicon.ico`)).status).toBe(404);
    expect((await fetch(loopback.redirectTo)).status).toBe(400);
    await fetch(`${loopback.redirectTo}?code=late`);
    await expect(loopback.answer).resolves.toEqual({
      kind: 'code',
      code: 'late',
    });
  });

  it('ends the wait and the port when cancelled', async () => {
    const controller = new AbortController();
    const loopback = await startOAuthLoopback(controller.signal, PAGES);
    controller.abort();
    await expect(loopback.answer).rejects.toThrow('cancelled');
    await expect(fetch(`${loopback.redirectTo}?code=x`)).rejects.toThrow();
  });

  it('never opens a port for a sign-in already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(startOAuthLoopback(controller.signal, PAGES)).rejects.toThrow(
      'cancelled',
    );
  });

  it('writes its page as text, never as markup', () => {
    const page = oauthPage('en', '<b>title</b>', 'body & "quotes"');
    expect(page).toContain('&lt;b&gt;title&lt;/b&gt;');
    expect(page).toContain('body &amp; &quot;quotes&quot;');
    expect(page).not.toContain('<b>title');
  });
});

describe('signing in with Google', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const run = (
    loopback: ReturnType<typeof handLoopback>,
    openExternal: (url: string) => Promise<void>,
    onWaiting: (isWaiting: boolean) => void = () => undefined,
  ) =>
    runGoogleSignIn({
      config: CONFIG,
      signal: new AbortController().signal,
      pages: PAGES,
      openExternal,
      startLoopback: loopback.start,
      onWaiting,
      now: () => 1_000_000,
    });

  it('sends the browser to Google with the challenge, and trades the code with the verifier', async () => {
    const loopback = handLoopback();
    const opened: string[] = [];
    const waiting: boolean[] = [];
    fetchSpy.mockResolvedValue(jsonResponse(tokenReply));
    const result = run(
      loopback,
      async (url) => {
        opened.push(url);
      },
      (isWaiting) => waiting.push(isWaiting),
    );
    await settle();
    expect(waiting).toEqual([true]);
    const authorize = new URL(opened[0]);
    expect(authorize.origin + authorize.pathname).toBe(
      'https://project.supabase.co/auth/v1/authorize',
    );
    expect(authorize.searchParams.get('provider')).toBe('google');
    expect(authorize.searchParams.get('redirect_to')).toBe(
      `http://127.0.0.1:50123${OAUTH_CALLBACK_PATH}`,
    );
    expect(authorize.searchParams.get('code_challenge_method')).toBe('s256');

    loopback.answer({ kind: 'code', code: 'code-1' });
    const session = await result;
    expect(waiting).toEqual([true, false]);
    expect(session.identity).toEqual({
      id: 'user-g',
      email: 'someone@gmail.com',
      name: 'Some One',
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(
      'https://project.supabase.co/auth/v1/token?grant_type=pkce',
    );
    const body = JSON.parse(String(init?.body)) as Record<string, string>;
    expect(body.auth_code).toBe('code-1');
    // The verifier traded is the one whose hash the browser carried.
    expect(challengeOf(body.code_verifier)).toBe(
      authorize.searchParams.get('code_challenge'),
    );
  });

  it('says it did not finish when Google sends back no code, and trades nothing', async () => {
    const loopback = handLoopback();
    const result = run(loopback, async () => undefined);
    await settle();
    loopback.answer({ kind: 'error', reason: 'access_denied' });
    await expect(result).rejects.toMatchObject({
      failure: 'google_unfinished',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('says it did not finish when no browser would open', async () => {
    const loopback = handLoopback();
    await expect(
      run(loopback, async () => {
        throw new Error('no browser');
      }),
    ).rejects.toMatchObject({ failure: 'google_unfinished' });
  });

  it('reads a refused code as not finished, never as a wrong password', async () => {
    const loopback = handLoopback();
    fetchSpy.mockResolvedValue(
      jsonResponse({ error: 'invalid_grant', error_description: 'bad' }, 400),
    );
    const result = run(loopback, async () => undefined);
    await settle();
    loopback.answer({ kind: 'code', code: 'stale' });
    await expect(result).rejects.toMatchObject({
      failure: 'google_unfinished',
    });
  });

  it('keeps a network failure as one, which is a different thing to do about', async () => {
    const loopback = handLoopback();
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'));
    const result = run(loopback, async () => undefined);
    await settle();
    loopback.answer({ kind: 'code', code: 'code-1' });
    const error = await result.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).failure).toBe('network');
  });
});

describe('whether Google is switched on', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is yes only when the service says so', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ external: { google: true, email: true } }),
    );
    await expect(
      googleSignInAvailable(CONFIG, new AbortController().signal),
    ).resolves.toBe(true);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      'https://project.supabase.co/auth/v1/settings',
    );
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ external: { google: false } }),
    );
    await expect(
      googleSignInAvailable(CONFIG, new AbortController().signal),
    ).resolves.toBe(false);
    fetchSpy.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(
      googleSignInAvailable(CONFIG, new AbortController().signal),
    ).resolves.toBe(false);
    fetchSpy.mockRejectedValueOnce(new TypeError('offline'));
    await expect(
      googleSignInAvailable(CONFIG, new AbortController().signal),
    ).resolves.toBe(false);
  });
});

describe('the session while Google is open in the browser', () => {
  let stored: IAccountRecord | undefined;
  const store: IAccountCredentialStore = {
    available: () => true,
    read: () => stored,
    write: (value) => {
      stored = value;
    },
    clear: () => {
      stored = undefined;
    },
  };

  beforeEach(() => {
    stored = undefined;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('says it is waiting on Google, then signs in with the account Google sent', async () => {
    const loopback = handLoopback();
    jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(tokenReply));
    const states: IAccountState[] = [];
    const session = createAccountSession({
      config: CONFIG,
      store,
      now: () => 1_000_000,
      openExternal: async () => undefined,
      startLoopback: loopback.start,
      onState: (state) => states.push(state),
    });
    const done = session.signInWithGoogle(PAGES);
    await settle();
    expect(session.state()).toMatchObject({
      status: 'busy',
      waiting: 'google',
    });
    loopback.answer({ kind: 'code', code: 'code-1' });
    const final = await done;
    expect(final.status).toBe('signed-in');
    expect(final.waiting).toBeUndefined();
    expect(final.identity?.id).toBe('user-g');
    expect(stored?.refreshToken).toBe('refresh-g');
  });

  it('stops on Cancel with no error, signed out as before', async () => {
    const controllerSeen: AbortSignal[] = [];
    const startLoopback = jest.fn(
      (signal: AbortSignal) =>
        new Promise<never>((_resolve, reject) => {
          controllerSeen.push(signal);
          signal.addEventListener('abort', () => {
            const error = new Error('cancelled');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
    const session = createAccountSession({
      config: CONFIG,
      store,
      openExternal: async () => undefined,
      startLoopback,
      onState: () => undefined,
    });
    const done = session.signInWithGoogle(PAGES);
    await settle();
    expect(session.state().status).toBe('busy');
    session.cancel();
    const final = await done;
    expect(controllerSeen[0].aborted).toBe(true);
    expect(final).toMatchObject({ status: 'signed-out' });
    expect(final.error).toBeUndefined();
    expect(final.waiting).toBeUndefined();
  });
});
