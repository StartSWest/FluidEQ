/** @jest-environment node */

import {
  createEntitlement,
  resolveEntitlementState,
  type IEntitlementRecord,
  type IEntitlementStatus,
} from '../../../main/account/entitlement';
import type { IAccountSession } from '../../../main/account/session';

const NOW = 1789819200000;
const END = NOW + 60_000;
const record = (
  over: Partial<IEntitlementRecord> = {},
): IEntitlementRecord => ({
  userId: 'account-a',
  plan: 'trial',
  status: 'active',
  periodEndsAt: END,
  verifiedAt: NOW,
  cancelAtPeriodEnd: true,
  ...over,
});
const config = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'public',
  apiUrl: 'https://project.supabase.co/functions/v1',
  plusPrice: '',
  plusYearlyPrice: '',
};
const row = (over: Record<string, unknown> = {}) => [
  {
    status: 'active',
    plan: 'trial',
    current_period_end: new Date(END).toISOString(),
    cancel_at_period_end: true,
    ...over,
  },
];
const deferred = <T>() => {
  let complete: (value: T) => void = () => {
    throw new Error('Promise executor did not run');
  };
  const promise = new Promise<T>((resolve) => {
    complete = resolve;
  });
  return { promise, complete };
};
const reply = (body: unknown) => new Response(JSON.stringify(body));

let clock: number;
let account: string | undefined;
let stored: IEntitlementRecord | undefined;
let changes: IEntitlementStatus[];
let fetchImpl: jest.Mock<Promise<Response>, [string, RequestInit?]>;
let accessToken: jest.Mock<Promise<string>, []>;

const build = (beforeFetch?: (token: string) => Promise<unknown>) =>
  createEntitlement({
    config,
    session: {
      state: () =>
        account
          ? { status: 'signed-in', identity: { id: account } }
          : { status: 'signed-out' },
      accessToken,
    } as unknown as IAccountSession,
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
    onChange: (status) => changes.push(status),
    now: () => clock,
    fetchImpl: fetchImpl as typeof fetch,
    beforeFetch,
  });

beforeEach(() => {
  clock = NOW;
  account = 'account-a';
  stored = undefined;
  changes = [];
  fetchImpl = jest.fn<Promise<Response>, [string, RequestInit?]>(async () =>
    reply(row()),
  );
  accessToken = jest.fn(async () => 'account-a-token');
});

it('never renews a free trial or grants paid grace, even with an incorrect cancellation flag', () => {
  const trial = record({ cancelAtPeriodEnd: false });
  expect(resolveEntitlementState(trial, END - 1)).toMatchObject({
    state: 'active',
    renewing: false,
  });
  expect(resolveEntitlementState(trial, END)).toEqual({ state: 'none' });
  expect(
    resolveEntitlementState({ ...trial, plan: 'plus' }, END),
  ).toMatchObject({ state: 'grace', renewing: true });
});

it('a month earned by publishing ends when it ends, with no paid grace either', () => {
  // The grace window is for a renewal the app may have missed offline. An
  // earned month has no renewal to miss, and a fortnight of it would leave
  // Plus on for two weeks after the app had already said the month ended
  // (server migration 0041).
  const earned = record({ plan: 'maker', cancelAtPeriodEnd: false });
  expect(resolveEntitlementState(earned, END - 1)).toMatchObject({
    state: 'active',
    plan: 'maker',
    renewing: false,
  });
  expect(resolveEntitlementState(earned, END)).toEqual({ state: 'none' });
});

it('announces exact trial expiry on focus even when the server check is still fresh', async () => {
  const entitlement = build();
  await entitlement.checkNow();
  expect(changes).toHaveLength(1);
  clock = END;
  await entitlement.checkIfDue('window focused');
  expect(changes).toEqual([
    { state: 'active', plan: 'trial', periodEndsAt: END, renewing: false },
    { state: 'none' },
  ]);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  await entitlement.checkIfDue('window focused');
  expect(changes).toHaveLength(2);
});

it('publishes elapsed cached trial expiry on an offline refresh without deleting the record', async () => {
  stored = record();
  fetchImpl.mockRejectedValue(new Error('offline'));
  const entitlement = build();
  expect(entitlement.status().state).toBe('active');
  clock = END;
  expect(await entitlement.checkNow()).toEqual({ state: 'none' });
  expect(changes).toEqual([{ state: 'none' }]);
  expect(stored?.plan).toBe('trial');
});

it('publishes expiry when the token cannot refresh offline', async () => {
  stored = record();
  accessToken.mockRejectedValue(new Error('offline'));
  const entitlement = build();
  expect(entitlement.status().state).toBe('active');
  clock = END;
  await entitlement.checkIfDue('resume');
  expect(changes).toEqual([{ state: 'none' }]);
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('publishes expiry that occurs while a network reply is pending', async () => {
  stored = record();
  const pending = deferred<Response>();
  fetchImpl.mockReturnValue(pending.promise);
  const entitlement = build();
  const checking = entitlement.checkNow();
  clock = END;
  pending.complete(new Response('{}', { status: 503 }));
  expect(await checking).toEqual({ state: 'none' });
  expect(changes).toEqual([{ state: 'none' }]);
});

it('forces trial records to stop even if the server cancellation flag is malformed', async () => {
  fetchImpl.mockResolvedValue(reply(row({ cancel_at_period_end: 'no' })));
  const entitlement = build();
  expect(await entitlement.checkNow()).toMatchObject({
    state: 'active',
    renewing: false,
  });
  clock = END;
  await entitlement.checkIfDue('focus');
  expect(entitlement.status()).toEqual({ state: 'none' });
});

it('does not send an entitlement request after the account switches during token refresh', async () => {
  const token = deferred<string>();
  accessToken.mockReturnValue(token.promise);
  const checking = build().checkNow();
  account = 'account-b';
  token.complete('account-b-token');
  await checking;
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(stored).toBeUndefined();
});

it('does not publish an old account after the account switches during merchant sync', async () => {
  const syncing = deferred<void>();
  const synced = deferred<void>();
  const entitlement = build(() => {
    syncing.complete();
    return synced.promise;
  });
  const checking = entitlement.checkNow();
  await syncing.promise;
  account = 'account-b';
  synced.complete();
  await checking;
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(stored).toBeUndefined();
});

it('cannot restore a signed-out account from a pending server reply', async () => {
  const pending = deferred<Response>();
  const asked = deferred<void>();
  fetchImpl.mockImplementation(() => {
    asked.complete();
    return pending.promise;
  });
  const entitlement = build();
  const checking = entitlement.checkNow();
  await asked.promise;
  account = undefined;
  entitlement.forget();
  pending.complete(reply(row()));
  await checking;
  expect(stored).toBeUndefined();
  expect(changes.some((status) => status.state === 'active')).toBe(false);
});

it('a grant requests a fresh entitlement instead of reusing the pre-grant request', async () => {
  const oldReply = deferred<Response>();
  const asked = deferred<void>();
  fetchImpl.mockImplementationOnce(() => {
    asked.complete();
    return oldReply.promise;
  });
  const entitlement = build();
  const oldCheck = entitlement.checkNow();
  await asked.promise;
  entitlement.expectChange();
  const freshCheck = entitlement.checkNow();
  expect(freshCheck).not.toBe(oldCheck);
  expect(await freshCheck).toMatchObject({ state: 'active', plan: 'trial' });
  oldReply.complete(reply([]));
  await oldCheck;
  expect(entitlement.status()).toMatchObject({
    state: 'active',
    plan: 'trial',
  });
  expect(changes.map((status) => status.state)).toEqual(['active']);
});
