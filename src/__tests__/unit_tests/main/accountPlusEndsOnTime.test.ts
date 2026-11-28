/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import {
  createEntitlement,
  resolveEntitlementState,
  type IEntitlementRecord,
  type IEntitlementStatus,
  type TEntitlementRead,
} from '../../../main/account/entitlement';
import type { IAccountSession } from '../../../main/account/session';

// Plus cancelled to end with its period stops exactly then, on the record
// alone, and the server is asked again the moment it does. Rows of the old
// membership (Buy Me a Coffee, trials, gifts, earned months) read as no
// Plus, whatever they say.

const NOW = 1789819200000;
const END = NOW + 60_000;
const record = (
  over: Partial<IEntitlementRecord> = {},
): IEntitlementRecord => ({
  userId: 'account-a',
  plan: 'library-monthly',
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
};
const row = (over: Record<string, unknown> = {}) => [
  {
    status: 'active',
    plan: 'library-monthly',
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
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

let clock: number;
let account: string | undefined;
let stored: IEntitlementRecord | undefined;
let changes: IEntitlementStatus[];
let fetchImpl: jest.Mock<Promise<Response>, [string, RequestInit?]>;
let accessToken: jest.Mock<Promise<string>, []>;

const build = () =>
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

it('ends Plus cancelled to end with its period exactly then, with no grace', () => {
  const cancelled = record();
  expect(resolveEntitlementState(cancelled, END - 1)).toMatchObject({
    state: 'active',
    renewing: false,
  });
  expect(resolveEntitlementState(cancelled, END)).toEqual({ state: 'none' });
  // The control: the same row still renewing goes into its grace instead.
  expect(
    resolveEntitlementState({ ...cancelled, cancelAtPeriodEnd: false }, END),
  ).toMatchObject({ state: 'grace', renewing: true });
});

it.each(['plus', 'trial', 'maker', 'gift'])(
  'reads the old membership’s %p row as no Plus, fresh from the server',
  async (plan) => {
    fetchImpl.mockImplementation(async () =>
      reply(row({ plan, cancel_at_period_end: false })),
    );
    const entitlement = build();
    expect(await entitlement.checkNow()).toEqual({ state: 'none' });
    // Kept as the server said it: what it means is decided on every read.
    expect(stored?.plan).toBe(plan);
  },
);

it('reads a row that names no plan as no Plus', async () => {
  fetchImpl.mockImplementation(async () => reply(row({ plan: null })));
  expect(await build().checkNow()).toEqual({ state: 'none' });
  expect(stored?.plan).toBe('');
});

it('asks the server the moment access ends, even at an ordinary launch', async () => {
  // The launch that matters: the stored record already agrees with the
  // server, so nothing is announced and nothing is learned from announcing.
  // Plus taken again in FluidWallpapers is on the other side of that
  // question.
  stored = record();
  // A fresh answer each time: one Response can only be read once, and a
  // shared one makes the second read look like a server that said nothing.
  fetchImpl.mockImplementation(async () => reply(row()));
  const entitlement = build();
  expect(entitlement.status().state).toBe('active');
  await entitlement.checkIfDue('window focused');
  expect(fetchImpl).toHaveBeenCalledTimes(1);

  // The period runs out with the window open. The check is fresh, and the
  // staleness rule must not be what decides here.
  clock = END;
  await entitlement.checkIfDue('window focused');
  expect(changes).toEqual([{ state: 'none' }]);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  // And only once: a server with nothing more to give is not asked again at
  // every focus for the rest of the sitting.
  await entitlement.checkIfDue('window focused');
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

it('keeps asking until the server has actually answered since access ended', async () => {
  // The chance was spent on the asking rather than on the answer: a server
  // that refused at the boundary left the app waiting out the whole four
  // hours, which is the wall this exists to skip.
  stored = record();
  fetchImpl.mockImplementation(async () => reply(row()));
  const entitlement = build();
  await entitlement.checkIfDue('window focused');
  expect(fetchImpl).toHaveBeenCalledTimes(1);

  clock = END;
  fetchImpl.mockImplementation(
    async () => new Response('busy', { status: 503 }),
  );
  await entitlement.checkIfDue('window focused');
  expect(fetchImpl).toHaveBeenCalledTimes(2);

  // Refused, so nothing has been heard since the period ended: the next
  // event asks again rather than waiting four hours.
  await entitlement.checkIfDue('window focused');
  expect(fetchImpl).toHaveBeenCalledTimes(3);

  // Answered: the question is settled and the staleness rule holds again.
  fetchImpl.mockImplementation(async () => reply([]));
  await entitlement.checkIfDue('window focused');
  expect(fetchImpl).toHaveBeenCalledTimes(4);
  await entitlement.checkIfDue('window focused');
  expect(fetchImpl).toHaveBeenCalledTimes(4);
});

it('announces the exact end on focus even when the server check is still fresh', async () => {
  const entitlement = build();
  await entitlement.checkNow();
  expect(changes).toHaveLength(1);
  clock = END;
  await entitlement.checkIfDue('window focused');
  expect(changes).toEqual([
    {
      state: 'active',
      plan: 'library-monthly',
      periodEndsAt: END,
      renewing: false,
    },
    { state: 'none' },
  ]);
  // The end is announced from the record alone. The server is then asked
  // once, despite the check being fresh; once only.
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  await entitlement.checkIfDue('window focused');
  expect(changes).toHaveLength(2);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

it('publishes an elapsed end on an offline refresh without deleting the record', async () => {
  stored = record();
  fetchImpl.mockRejectedValue(new Error('offline'));
  const entitlement = build();
  expect(entitlement.status().state).toBe('active');
  clock = END;
  expect(await entitlement.checkNow()).toEqual({ state: 'none' });
  expect(changes).toEqual([{ state: 'none' }]);
  expect(stored?.plan).toBe('library-monthly');
});

it('publishes the end when the token cannot refresh offline', async () => {
  stored = record();
  accessToken.mockRejectedValue(new Error('offline'));
  const entitlement = build();
  expect(entitlement.status().state).toBe('active');
  clock = END;
  await entitlement.checkIfDue('resume');
  expect(changes).toEqual([{ state: 'none' }]);
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('publishes an end that occurs while a network reply is pending', async () => {
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

describe('what each read of the row is heard as', () => {
  const heard = () => {
    const reads: TEntitlementRead[] = [];
    const entitlement = build();
    entitlement.onRead((read) => reads.push(read));
    return { entitlement, reads };
  };

  it('hears an answer with the row it gave, after the row is kept', async () => {
    const { entitlement, reads } = heard();
    let statusWhenHeard: string | undefined;
    entitlement.onRead(() => {
      statusWhenHeard = entitlement.status().state;
    });
    await entitlement.checkNow();
    expect(reads).toEqual([
      {
        kind: 'answered',
        accountId: 'account-a',
        record: record(),
        at: NOW,
      },
    ]);
    expect(statusWhenHeard).toBe('active');
    expect(entitlement.record()).toEqual(record());
  });

  it('hears an answer with no row as one with nothing in it', async () => {
    fetchImpl.mockImplementation(async () => reply([]));
    const { entitlement, reads } = heard();
    await entitlement.checkNow();
    expect(reads).toEqual([
      { kind: 'answered', accountId: 'account-a', record: undefined, at: NOW },
    ]);
  });

  it.each([
    [
      'no network',
      async () => {
        throw new TypeError('fetch failed');
      },
    ],
    ['a server failing', async () => reply({ message: 'down' }, 503)],
  ])('hears %s as the server unreachable', async (_label, answer) => {
    fetchImpl.mockImplementation(answer);
    const { entitlement, reads } = heard();
    await entitlement.checkNow();
    expect(reads).toEqual([
      { kind: 'unreachable', accountId: 'account-a', at: NOW },
    ]);
  });

  it('hears nothing for a refusal, a token that could not be had or an unreadable body', async () => {
    const { entitlement, reads } = heard();
    fetchImpl.mockImplementation(async () => reply({ message: 'no' }, 401));
    await entitlement.checkNow();
    accessToken.mockRejectedValueOnce(new Error('offline'));
    await entitlement.checkNow();
    fetchImpl.mockImplementation(async () => new Response('<html>'));
    await entitlement.checkNow();
    expect(reads).toEqual([]);
    // The control: the same entitlement hears an answer.
    fetchImpl.mockImplementation(async () => reply(row()));
    await entitlement.checkNow();
    expect(reads.map((read) => read.kind)).toEqual(['answered']);
  });

  it('hears nothing for an account that changed while it was asked', async () => {
    const pending = deferred<Response>();
    const asked = deferred<void>();
    fetchImpl.mockImplementationOnce(() => {
      asked.complete();
      return pending.promise;
    });
    const { entitlement, reads } = heard();
    const checking = entitlement.checkNow();
    await asked.promise;
    account = 'account-b';
    pending.complete(reply(row()));
    await checking;
    expect(reads).toEqual([]);
  });

  it('stops hearing once let go of, and a listener that throws harms nothing', async () => {
    const { entitlement, reads } = heard();
    let thrown = 0;
    const off = entitlement.onRead(() => {
      thrown += 1;
      throw new Error('listener');
    });
    await expect(entitlement.checkNow()).resolves.toMatchObject({
      state: 'active',
    });
    off();
    await entitlement.checkNow();
    expect(thrown).toBe(1);
    expect(reads).toHaveLength(2);
  });
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

it('does not overwrite the new account when the old access read finishes late', async () => {
  const asked = deferred<void>();
  const oldReply = deferred<Response>();
  fetchImpl.mockImplementationOnce(() => {
    asked.complete();
    return oldReply.promise;
  });
  const entitlement = build();
  const checking = entitlement.checkNow();
  await asked.promise;
  account = 'account-b';
  accessToken.mockResolvedValue('account-b-token');
  await entitlement.checkNow();
  oldReply.complete(reply([]));
  await checking;
  expect(stored?.userId).toBe('account-b');
  expect(entitlement.status()).toMatchObject({
    state: 'active',
    plan: 'library-monthly',
  });
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

it('a payment requests a fresh entitlement instead of reusing the one asked before it', async () => {
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
  expect(await freshCheck).toMatchObject({
    state: 'active',
    plan: 'library-monthly',
  });
  oldReply.complete(reply([]));
  await oldCheck;
  expect(entitlement.status()).toMatchObject({
    state: 'active',
    plan: 'library-monthly',
  });
  expect(changes.map((status) => status.state)).toEqual(['active']);
});
