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
  createAccountSession,
  type IAccountState,
} from '../../../main/account/session';

const CONFIG = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: `sb_publishable_${'a'.repeat(40)}`,
  apiUrl: 'https://project.supabase.co/functions/v1',
  plusPrice: '',
  plusYearlyPrice: '',
};

const CREDENTIALS = {
  email: 'Someone@Example.com ',
  password: 'correct horse',
};

/** In memory, so nothing here needs Electron's cipher or a temp directory. */
const fakeStore = (seed?: IAccountRecord) => {
  let record = seed;
  const store: IAccountCredentialStore & { current: () => unknown } = {
    available: () => true,
    clear: () => {
      record = undefined;
    },
    read: () => record,
    write: (next) => {
      record = next;
    },
    current: () => record,
  };
  return store;
};

const tokenReply = (over: Record<string, unknown> = {}) => ({
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  expires_in: 3_600,
  user: {
    id: 'user-1',
    email: 'someone@example.com',
    user_metadata: { display_name: 'Someone' },
  },
  ...over,
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const requestOf = (spy: jest.SpiedFunction<typeof fetch>, index = 0) => {
  const [url, init] = spy.mock.calls[index];
  return {
    url: String(url),
    method: init?.method,
    headers: (init?.headers ?? {}) as Record<string, string>,
    body: JSON.parse(String(init?.body)) as Record<string, unknown>,
  };
};

describe('the account session', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let timeoutSpy: jest.SpiedFunction<typeof setTimeout>;
  let intervalSpy: jest.SpiedFunction<typeof setInterval>;
  let states: IAccountState[];

  beforeEach(() => {
    states = [];
    fetchSpy = jest.spyOn(global, 'fetch');
    timeoutSpy = jest.spyOn(global, 'setTimeout');
    intervalSpy = jest.spyOn(global, 'setInterval');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const build = (
    store: ReturnType<typeof fakeStore>,
    now: () => number = () => 1_000_000,
  ) =>
    createAccountSession({
      config: CONFIG,
      store,
      now,
      onState: (state) => states.push(state),
    });

  it('starts signed out with nothing on disk', () => {
    const session = build(fakeStore());
    expect(session.state()).toEqual({
      status: 'signed-out',
      identity: undefined,
      pending: undefined,
      error: undefined,
    });
  });

  it('restores the identity from disk without contacting anything', () => {
    const store = fakeStore({
      refreshToken: 'refresh-0',
      identity: { id: 'user-1', name: 'Someone' },
    });
    const session = build(store);

    expect(session.state().status).toBe('signed-in');
    expect(session.state().identity).toEqual({ id: 'user-1', name: 'Someone' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports unavailable where the platform cannot store a credential', () => {
    const store = { ...fakeStore(), available: () => false };
    expect(build(store).state().status).toBe('unavailable');
  });

  /**
   * The session is built before Electron's `ready`, and on Windows the cipher
   * says "unavailable" until then. The first launch of the sign-in panel came
   * up telling a Windows machine it had no secure storage, because the answer
   * had been taken once, too early, and frozen.
   */
  it('judges availability and reads the disk when asked, not when built', () => {
    let ready = false;
    const store = {
      ...fakeStore({
        refreshToken: 'refresh-0',
        identity: { id: 'user-1', name: 'Someone' },
      }),
      available: () => ready,
    };
    const session = build(store);
    expect(session.state().status).toBe('unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();

    ready = true;
    expect(session.state()).toMatchObject({
      status: 'signed-in',
      identity: { id: 'user-1', name: 'Someone' },
    });
  });

  it('signs in with the address lower-cased and trimmed, and keeps the refresh token', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(tokenReply()));
    const store = fakeStore();
    const session = build(store);

    const final = await session.signIn(CREDENTIALS);

    expect(final.status).toBe('signed-in');
    expect(final.identity).toEqual({
      id: 'user-1',
      email: 'someone@example.com',
      name: 'Someone',
    });
    expect(store.current()).toEqual({
      refreshToken: 'refresh-1',
      identity: final.identity,
    });
    const sent = requestOf(fetchSpy);
    expect(sent.url).toBe(
      'https://project.supabase.co/auth/v1/token?grant_type=password',
    );
    expect(sent.body).toEqual({
      email: 'someone@example.com',
      password: 'correct horse',
    });
    expect(sent.headers.apikey).toBe(CONFIG.supabaseAnonKey);
    // The busy state is published before the request, so the form can show
    // it rather than looking as though the button did nothing.
    expect(states.map((state) => state.status)).toEqual(['busy', 'signed-in']);
  });

  it('names a wrong password as such, and stays signed out', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error_code: 'invalid_credentials', msg: 'no' }, 400),
    );
    const final = await build(fakeStore()).signIn(CREDENTIALS);
    expect(final.status).toBe('signed-out');
    expect(final.error).toBe('wrong_credentials');
    expect(final.pending).toBeUndefined();
  });

  it('reads the older refusal shape from the token endpoint too', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error: 'invalid_grant', error_description: 'x' }, 400),
    );
    expect((await build(fakeStore()).signIn(CREDENTIALS)).error).toBe(
      'wrong_credentials',
    );
  });

  /**
   * Somebody who signed up and never typed the code can still get in: the
   * refusal opens the code step for that address instead of a dead end.
   */
  it('offers the code step when the account was never confirmed', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error_code: 'email_not_confirmed', msg: 'no' }, 400),
    );
    const final = await build(fakeStore()).signIn(CREDENTIALS);
    expect(final.error).toBe('unconfirmed');
    expect(final.pending).toEqual({
      email: 'someone@example.com',
      purpose: 'signup',
    });
  });

  it('creates an account and waits for its code', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ id: 'user-1' }));
    const session = build(fakeStore());

    const afterSignUp = await session.signUp({
      ...CREDENTIALS,
      name: '  Someone ',
    });
    expect(afterSignUp.status).toBe('signed-out');
    expect(afterSignUp.pending).toEqual({
      email: 'someone@example.com',
      purpose: 'signup',
    });
    const sent = requestOf(fetchSpy);
    expect(sent.url).toBe('https://project.supabase.co/auth/v1/signup');
    expect(sent.body).toEqual({
      email: 'someone@example.com',
      password: 'correct horse',
      data: { display_name: 'Someone' },
    });

    fetchSpy.mockResolvedValue(jsonResponse(tokenReply()));
    const final = await session.confirmCode(' 123456 ');
    expect(final.status).toBe('signed-in');
    expect(final.pending).toBeUndefined();
    const verify = requestOf(fetchSpy, 1);
    expect(verify.url).toBe('https://project.supabase.co/auth/v1/verify');
    expect(verify.body).toEqual({
      type: 'signup',
      email: 'someone@example.com',
      token: '123456',
    });
  });

  it('names a wrong code and keeps the step open for another try', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 'user-1' }));
    const session = build(fakeStore());
    await session.signUp(CREDENTIALS);

    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ error_code: 'otp_expired', msg: 'no' }, 403),
    );
    const final = await session.confirmCode('000000');
    expect(final.error).toBe('bad_code');
    expect(final.pending?.purpose).toBe('signup');
    expect(final.status).toBe('signed-out');
  });

  it('sends the sign-up code again, to the pending address only', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({}));
    const session = build(fakeStore());
    await session.signUp(CREDENTIALS);
    await session.resendCode();
    const resend = requestOf(fetchSpy, 1);
    expect(resend.url).toBe('https://project.supabase.co/auth/v1/resend');
    expect(resend.body).toEqual({
      type: 'signup',
      email: 'someone@example.com',
    });
  });

  it('refuses a code when none was asked for, without a request', async () => {
    const final = await build(fakeStore()).confirmCode('123456');
    expect(final.error).toBe('bad_code');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resets a password in one motion: code, new password, signed in', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({}));
    const session = build(fakeStore());

    const waiting = await session.forgotPassword('Someone@Example.com');
    expect(waiting.pending).toEqual({
      email: 'someone@example.com',
      purpose: 'recovery',
    });
    expect(requestOf(fetchSpy).url).toBe(
      'https://project.supabase.co/auth/v1/recover',
    );

    fetchSpy
      .mockResolvedValueOnce(jsonResponse(tokenReply()))
      .mockResolvedValueOnce(jsonResponse({ id: 'user-1' }));
    const final = await session.resetPassword('654321', 'new password!');
    expect(final.status).toBe('signed-in');

    const verify = requestOf(fetchSpy, 1);
    expect(verify.body).toEqual({
      type: 'recovery',
      email: 'someone@example.com',
      token: '654321',
    });
    const update = requestOf(fetchSpy, 2);
    expect(update.url).toBe('https://project.supabase.co/auth/v1/user');
    expect(update.method).toBe('PUT');
    expect(update.headers.Authorization).toBe('Bearer access-1');
    expect(update.body).toEqual({ password: 'new password!' });
  });

  it('does not sign in when the new password is refused', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({}));
    const session = build(fakeStore());
    await session.forgotPassword(CREDENTIALS.email);
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(tokenReply()))
      .mockResolvedValueOnce(
        jsonResponse({ error_code: 'weak_password', msg: 'no' }, 422),
      );
    const final = await session.resetPassword('654321', 'password');
    expect(final.status).toBe('signed-out');
    expect(final.error).toBe('weak_password');
    expect(final.pending?.purpose).toBe('recovery');
  });

  it('lets the code step be abandoned', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ id: 'user-1' }));
    const session = build(fakeStore());
    await session.signUp(CREDENTIALS);
    expect(session.abandonPending().pending).toBeUndefined();
  });

  it('answers a second action during the first with the current state', async () => {
    let release: (value: Response) => void = () => {};
    fetchSpy.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
    );
    const session = build(fakeStore());
    const first = session.signIn(CREDENTIALS);
    const second = await session.signUp(CREDENTIALS);
    expect(second.status).toBe('busy');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    release(jsonResponse(tokenReply()));
    expect((await first).status).toBe('signed-in');
  });

  it('treats a network failure as such', async () => {
    fetchSpy.mockRejectedValue(new TypeError('offline'));
    const final = await build(fakeStore()).signIn(CREDENTIALS);
    expect(final.status).toBe('signed-out');
    expect(final.error).toBe('network');
  });

  it('rejects an incomplete token reply as malformed', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(tokenReply({ refresh_token: undefined })),
    );
    const final = await build(fakeStore()).signIn(CREDENTIALS);
    expect(final.error).toBe('malformed');
  });

  it('maps a rate limit whatever the server calls it', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ msg: 'slow down' }, 429));
    expect((await build(fakeStore()).signIn(CREDENTIALS)).error).toBe(
      'rate_limited',
    );
  });

  describe('the access token', () => {
    it('is served from memory while it is fresh', async () => {
      fetchSpy.mockResolvedValue(jsonResponse(tokenReply()));
      const session = build(fakeStore());
      await session.signIn(CREDENTIALS);
      fetchSpy.mockClear();

      expect(await session.accessToken()).toBe('access-1');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('is refreshed from the stored refresh token after a restart', async () => {
      const store = fakeStore({
        refreshToken: 'refresh-0',
        identity: { id: 'user-1' },
      });
      fetchSpy.mockResolvedValue(
        jsonResponse(tokenReply({ access_token: 'access-2' })),
      );
      const session = build(store);

      expect(await session.accessToken()).toBe('access-2');
      const sent = requestOf(fetchSpy);
      expect(sent.url).toBe(
        'https://project.supabase.co/auth/v1/token?grant_type=refresh_token',
      );
      expect(sent.body).toEqual({ refresh_token: 'refresh-0' });
      // The rotated token replaces the old one on disk.
      expect(store.current()).toEqual({
        refreshToken: 'refresh-1',
        identity: {
          id: 'user-1',
          email: 'someone@example.com',
          name: 'Someone',
        },
      });
    });

    it('is refreshed a minute before it would expire, not after', async () => {
      let clock = 1_000_000;
      fetchSpy.mockResolvedValue(jsonResponse(tokenReply()));
      const session = build(fakeStore(), () => clock);
      await session.signIn(CREDENTIALS);
      fetchSpy.mockClear();
      fetchSpy.mockResolvedValue(
        jsonResponse(tokenReply({ access_token: 'access-2' })),
      );

      clock += 3_600_000 - 61_000;
      expect(await session.accessToken()).toBe('access-1');
      clock += 2_000;
      expect(await session.accessToken()).toBe('access-2');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('collapses concurrent refreshes into one request', async () => {
      const store = fakeStore({
        refreshToken: 'refresh-0',
        identity: { id: 'user-1' },
      });
      fetchSpy.mockResolvedValue(jsonResponse(tokenReply()));
      const session = build(store);

      await Promise.all([session.accessToken(), session.accessToken()]);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('signs out when the refresh token is refused, and keeps it when the network fails', async () => {
      const store = fakeStore({
        refreshToken: 'refresh-0',
        identity: { id: 'user-1' },
      });
      fetchSpy.mockRejectedValueOnce(new TypeError('offline'));
      const session = build(store);

      await expect(session.accessToken()).rejects.toMatchObject({
        failure: 'network',
      });
      expect(session.state().status).toBe('signed-in');
      expect(store.current()).toBeDefined();

      fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'bad' }, 400));
      await expect(session.accessToken()).rejects.toMatchObject({
        failure: 'expired',
      });
      expect(session.state().status).toBe('signed-out');
      expect(session.state().error).toBe('expired');
      expect(store.current()).toBeUndefined();
    });

    /**
     * The server ends the least recently used session when the account signs
     * in on a sixth computer. The computer it ended says so, rather than
     * calling its sign-in simply "no longer valid".
     */
    it('says so when this computer was signed out by the account signing in elsewhere', async () => {
      const store = fakeStore({
        refreshToken: 'refresh-0',
        identity: { id: 'user-1' },
      });
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(
          {
            code: 400,
            error_code: 'refresh_token_not_found',
            msg: 'Invalid Refresh Token: Refresh Token Not Found',
          },
          400,
        ),
      );
      const session = build(store);

      await expect(session.accessToken()).rejects.toMatchObject({
        failure: 'signed_out_elsewhere',
      });
      expect(session.state().status).toBe('signed-out');
      expect(session.state().error).toBe('signed_out_elsewhere');
      expect(store.current()).toBeUndefined();
    });

    it('is refused outright when nobody is signed in', async () => {
      await expect(build(fakeStore()).accessToken()).rejects.toMatchObject({
        failure: 'expired',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it('signs out locally first, then tells the server', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(tokenReply()));
    const store = fakeStore();
    const session = build(store);
    await session.signIn(CREDENTIALS);
    fetchSpy.mockClear();
    fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));

    await session.signOut();

    expect(session.state().status).toBe('signed-out');
    expect(store.current()).toBeUndefined();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(
      'https://project.supabase.co/auth/v1/logout?scope=local',
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer access-1',
    );
  });

  it('signs out cleanly even when the server cannot be reached', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(tokenReply()));
    const session = build(fakeStore());
    await session.signIn(CREDENTIALS);
    fetchSpy.mockRejectedValue(new TypeError('offline'));

    await expect(session.signOut()).resolves.toBeUndefined();
    expect(session.state().status).toBe('signed-out');
  });

  it('never sets a timer', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(tokenReply()));
    const session = build(fakeStore());
    await session.signIn(CREDENTIALS);
    await session.accessToken();
    await session.signOut();
    expect(timeoutSpy).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
  });
});
