/** @jest-environment node */

import type { IAccountRecord } from '../../../main/accountCredentials';
import {
  createAccountSession,
  type IAccountState,
} from '../../../main/account/session';

const CONFIG = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'sb_publishable_public-key',
  apiUrl: 'https://project.supabase.co/functions/v1',
  plusPrice: '',
  plusYearlyPrice: '',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const tokenReply = (id: string, token: string, expiresIn = 3600) =>
  json({
    access_token: `access-${token}`,
    refresh_token: `refresh-${token}`,
    expires_in: expiresIn,
    user: { id, email: `${id}@example.com`, user_metadata: {} },
  });
const deferred = <T>() => {
  let complete: (value: T) => void = () => {
    throw new Error('Promise executor did not run');
  };
  const promise = new Promise<T>((resolve) => {
    complete = resolve;
  });
  return { promise, complete };
};

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let stored: IAccountRecord | undefined;
let states: IAccountState[];

const build = () =>
  createAccountSession({
    config: CONFIG,
    now: () => 1_000_000,
    store: {
      available: () => true,
      read: () => stored,
      write: (value) => {
        stored = value;
      },
      clear: () => {
        stored = undefined;
      },
    },
    onState: (state) => states.push(state),
  });

beforeEach(() => {
  states = [];
  stored = { refreshToken: 'refresh-a-old', identity: { id: 'account-a' } };
  fetchSpy = jest
    .spyOn(global, 'fetch')
    .mockRejectedValue(new Error('Unexpected request'));
});
afterEach(() => jest.restoreAllMocks());

it('does not restore a signed-out account when its old refresh eventually succeeds', async () => {
  const old = deferred<Response>();
  fetchSpy.mockReturnValueOnce(old.promise);
  const session = build();
  const refused = session.accessToken().catch((error: unknown) => error);
  await session.signOut();
  old.complete(tokenReply('account-a', 'a-late'));
  expect(await refused).toMatchObject({ failure: 'expired' });
  expect(session.state().status).toBe('signed-out');
  expect(stored).toBeUndefined();
  expect(states.map((state) => state.status)).toEqual(['signed-out']);
  expect(fetchSpy.mock.calls[0][1]?.signal?.aborted).toBe(true);
});

it('does not replace a newly signed-in account with the previous account refresh', async () => {
  const old = deferred<Response>();
  fetchSpy.mockReturnValueOnce(old.promise);
  const session = build();
  const refused = session.accessToken().catch((error: unknown) => error);
  fetchSpy.mockResolvedValueOnce(tokenReply('account-b', 'b-new'));
  await session.signIn({
    email: 'account-b@example.com',
    password: 'password',
  });
  old.complete(tokenReply('account-a', 'a-late'));
  expect(await refused).toMatchObject({ failure: 'expired' });
  expect(session.state().identity?.id).toBe('account-b');
  expect(stored?.refreshToken).toBe('refresh-b-new');
  expect(await session.accessToken()).toBe('access-b-new');
});

it('does not sign out a new account when an old refresh is refused', async () => {
  const old = deferred<Response>();
  fetchSpy.mockReturnValueOnce(old.promise);
  const session = build();
  const refused = session.accessToken().catch((error: unknown) => error);
  fetchSpy.mockResolvedValueOnce(tokenReply('account-b', 'b-new'));
  await session.signIn({
    email: 'account-b@example.com',
    password: 'password',
  });
  old.complete(json({ error: 'bad' }, 400));
  expect(await refused).toMatchObject({ failure: 'expired' });
  expect(session.state()).toMatchObject({
    status: 'signed-in',
    identity: { id: 'account-b' },
  });
  expect(session.state().error).toBeUndefined();
  expect(stored?.refreshToken).toBe('refresh-b-new');
});

it('rejects stale credentials even after switching A to B and back to A', async () => {
  const old = deferred<Response>();
  fetchSpy.mockReturnValueOnce(old.promise);
  const session = build();
  const refused = session.accessToken().catch((error: unknown) => error);
  await session.signOut();
  fetchSpy.mockResolvedValueOnce(tokenReply('account-b', 'b-new'));
  await session.signIn({
    email: 'account-b@example.com',
    password: 'password',
  });
  fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await session.signOut();
  fetchSpy.mockResolvedValueOnce(tokenReply('account-a', 'a-new'));
  await session.signIn({
    email: 'account-a@example.com',
    password: 'password',
  });
  old.complete(tokenReply('account-a', 'a-late'));
  expect(await refused).toMatchObject({ failure: 'expired' });
  expect(stored?.refreshToken).toBe('refresh-a-new');
  expect(await session.accessToken()).toBe('access-a-new');
});

it('keeps a newer refresh coalesced when an older one settles', async () => {
  const old = deferred<Response>();
  const next = deferred<Response>();
  fetchSpy.mockReturnValueOnce(old.promise);
  const session = build();
  const refused = session.accessToken().catch((error: unknown) => error);
  await session.signOut();
  fetchSpy.mockResolvedValueOnce(tokenReply('account-b', 'b-new', 1));
  await session.signIn({
    email: 'account-b@example.com',
    password: 'password',
  });
  fetchSpy.mockReturnValueOnce(next.promise);
  const newer = session.accessToken();
  old.complete(tokenReply('account-a', 'a-late'));
  expect(await refused).toMatchObject({ failure: 'expired' });
  const shared = session.accessToken();
  next.complete(tokenReply('account-b', 'b-refreshed'));
  expect(await Promise.all([newer, shared])).toEqual([
    'access-b-refreshed',
    'access-b-refreshed',
  ]);
  expect(
    fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes('grant_type=refresh_token'),
    ),
  ).toHaveLength(2);
  expect(stored?.refreshToken).toBe('refresh-b-refreshed');
});

it('cannot finish a refresh after the session owner is disposed', async () => {
  const old = deferred<Response>();
  fetchSpy.mockReturnValueOnce(old.promise);
  const session = build();
  const refused = session.accessToken().catch((error: unknown) => error);
  session.dispose();
  old.complete(tokenReply('account-a', 'a-late'));
  expect(await refused).toMatchObject({ failure: 'expired' });
  expect(stored?.refreshToken).toBe('refresh-a-old');
  expect(states).toEqual([]);
});
