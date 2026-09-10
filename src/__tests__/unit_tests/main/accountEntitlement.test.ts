/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import type { IEncryptedJsonStore } from '../../../main/encryptedJsonStore';
import type {
  IAccountSession,
  IAccountState,
} from '../../../main/account/session';
import {
  createEntitlement,
  ENTITLEMENT_GRACE_MS,
  ENTITLEMENT_STALE_AFTER_MS,
  isEntitlementRecord,
  resolveEntitlementState,
  type IEntitlementRecord,
  type IEntitlementStatus,
} from '../../../main/account/entitlement';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

const CONFIG = {
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: `sb_publishable_${'a'.repeat(40)}`,
  apiUrl: 'https://project.supabase.co/functions/v1',
  plusPrice: '',
};

const record = (
  over: Partial<IEntitlementRecord> = {},
): IEntitlementRecord => ({
  userId: 'user-1',
  status: 'active',
  periodEndsAt: NOW + 20 * DAY,
  verifiedAt: NOW - DAY,
  plan: 'plus',
  cancelAtPeriodEnd: false,
  ...over,
});

describe('what a stored subscription means at a given moment', () => {
  it('is nothing when nothing was ever confirmed', () => {
    expect(resolveEntitlementState(undefined, NOW)).toEqual({ state: 'none' });
  });

  // The positive control beside every "none" below.
  it('is active while the paid period is still running', () => {
    expect(resolveEntitlementState(record(), NOW)).toMatchObject({
      state: 'active',
      plan: 'plus',
      renewing: true,
    });
  });

  /**
   * "Will not renew" is a flag beside an `active` status, not a status. The
   * period already paid for runs to its end; cutting somebody off the moment
   * they decide not to continue is what earns a chargeback.
   */
  it('keeps a cancelled subscription on until the period it paid for ends', () => {
    const status = resolveEntitlementState(
      record({ status: 'active', cancelAtPeriodEnd: true }),
      NOW,
    );
    expect(status.state).toBe('active');
    expect(status.renewing).toBe(false);
  });

  it('keeps a trial and a card being retried on', () => {
    expect(
      resolveEntitlementState(record({ status: 'trialing' }), NOW).state,
    ).toBe('active');
    expect(
      resolveEntitlementState(record({ status: 'past_due' }), NOW).state,
    ).toBe('active');
  });

  it.each([
    'canceled',
    'cancelled',
    'unpaid',
    'paused',
    'incomplete',
    'incomplete_expired',
    'anything-else',
  ])('is nothing under the merchant status %s', (status) => {
    expect(resolveEntitlementState(record({ status }), NOW).state).toBe('none');
  });

  /**
   * The period we last saw has ended but the server was heard from recently.
   * The likeliest explanation is that it renewed while we were offline, so it
   * stays on — with a visible end to that assumption.
   */
  it('enters grace when the period ended but the last confirmation is recent', () => {
    const verifiedAt = NOW - 3 * DAY;
    const status = resolveEntitlementState(
      record({ periodEndsAt: NOW - DAY, verifiedAt }),
      NOW,
    );
    expect(status.state).toBe('grace');
    expect(status.graceEndsAt).toBe(verifiedAt + ENTITLEMENT_GRACE_MS);
  });

  it('holds the grace boundary exactly', () => {
    const verifiedAt = NOW - ENTITLEMENT_GRACE_MS;
    const lapsed = record({ periodEndsAt: NOW - DAY, verifiedAt });
    // One millisecond inside the window is still grace; on the boundary it
    // has ended. The rule is "lapses at", not "lapses after".
    expect(resolveEntitlementState(lapsed, NOW - 1).state).toBe('grace');
    expect(resolveEntitlementState(lapsed, NOW).state).toBe('none');
  });

  /**
   * A clock set backwards would otherwise buy another fortnight for free.
   * The confirmation cannot have happened later than now.
   */
  it('clamps a confirmation dated in the future to now', () => {
    const status = resolveEntitlementState(
      record({ periodEndsAt: NOW - DAY, verifiedAt: NOW + 365 * DAY }),
      NOW,
    );
    expect(status.state).toBe('grace');
    expect(status.graceEndsAt).toBe(NOW + ENTITLEMENT_GRACE_MS);
  });

  /**
   * Grace is for a renewal the app may have missed. A membership cancelled
   * to end with its period was never going to renew, so it ends on the day
   * it said it would — the enter-grace case above is the positive control.
   */
  it('ends a cancelled subscription with its period, without grace', () => {
    expect(
      resolveEntitlementState(
        record({
          cancelAtPeriodEnd: true,
          periodEndsAt: NOW - DAY,
          verifiedAt: NOW - 3 * DAY,
        }),
        NOW,
      ).state,
    ).toBe('none');
  });

  it('is nothing once both the period and the grace window are gone', () => {
    expect(
      resolveEntitlementState(
        record({ periodEndsAt: NOW - 30 * DAY, verifiedAt: NOW - 30 * DAY }),
        NOW,
      ).state,
    ).toBe('none');
  });
});

describe('the stored shape guard', () => {
  it('accepts a complete record, renewing or not', () => {
    expect(isEntitlementRecord(record())).toBe(true);
    expect(isEntitlementRecord(record({ cancelAtPeriodEnd: true }))).toBe(true);
  });

  it.each([
    ['no user', { ...record(), userId: '' }],
    ['a non-numeric period', { ...record(), periodEndsAt: 'soon' }],
    ['an infinite period', { ...record(), periodEndsAt: Infinity }],
    ['a missing plan', { ...record(), plan: undefined }],
    [
      'a renewal flag that is not a boolean',
      { ...record(), cancelAtPeriodEnd: 'no' },
    ],
    [
      'a record from before the flag existed',
      { ...record(), cancelAtPeriodEnd: undefined },
    ],
    ['not an object', 'active'],
  ])('rejects a record with %s', (_label, value) => {
    expect(isEntitlementRecord(value)).toBe(false);
  });
});

describe('the entitlement controller', () => {
  let clock: number;
  let accountState: IAccountState;
  let accessToken: jest.Mock<Promise<string>, []>;
  let stored: IEntitlementRecord | undefined;
  let changes: IEntitlementStatus[];
  let fetchImpl: jest.Mock;
  let timeoutSpy: jest.SpiedFunction<typeof setTimeout>;
  let intervalSpy: jest.SpiedFunction<typeof setInterval>;

  it('answers the development override without asking anyone', async () => {
    const entitlement = createEntitlement({
      config: CONFIG,
      session: session(),
      store: store(),
      onChange: () => undefined,
      now: () => clock,
      fetchImpl,
      developmentOverride: { state: 'active', plan: 'plus (development)' },
    });
    expect(entitlement.status().state).toBe('active');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('lets a second party hear about changes, and stop hearing', async () => {
    fetchImpl.mockResolvedValue(jsonResponse(row()));
    const entitlement = build();
    const heard: string[] = [];
    const stop = entitlement.subscribe((status) => heard.push(status.state));

    await entitlement.checkNow();
    stop();
    entitlement.forget();
    expect(heard).toEqual(['active']);
  });

  const session = (): IAccountSession => ({
    state: () => accountState,
    signUp: jest.fn(),
    signIn: jest.fn(),
    confirmCode: jest.fn(),
    resendCode: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    abandonPending: jest.fn(),
    signOut: jest.fn(),
    accessToken,
    dispose: jest.fn(),
  });

  const store = (): IEncryptedJsonStore<IEntitlementRecord> => ({
    available: () => true,
    clear: () => {
      stored = undefined;
    },
    read: () => stored,
    write: (value) => {
      stored = value;
    },
  });

  const row = (over: Record<string, unknown> = {}) => [
    {
      status: 'active',
      current_period_end: new Date(NOW + 20 * DAY).toISOString(),
      plan: 'plus',
      cancel_at_period_end: false,
      ...over,
    },
  ];

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

  const build = () =>
    createEntitlement({
      config: CONFIG,
      session: session(),
      store: store(),
      onChange: (status) => changes.push(status),
      now: () => clock,
      fetchImpl,
    });

  beforeEach(() => {
    clock = NOW;
    accountState = {
      status: 'signed-in',
      identity: { id: 'user-1', email: 'someone@example.com' },
    };
    accessToken = jest.fn(() => Promise.resolve('access-1'));
    stored = undefined;
    changes = [];
    fetchImpl = jest.fn();
    timeoutSpy = jest.spyOn(global, 'setTimeout');
    intervalSpy = jest.spyOn(global, 'setInterval');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * A window started with the development pin used to keep Plus on over the
   * pretend cancellation, so the button looked broken while the server had
   * cancelled. Releasing the pin hands the window back to the record, and
   * says so even when nothing was fetched.
   */
  it('lets the pretend membership release the development pin, once', () => {
    const entitlement = createEntitlement({
      config: CONFIG,
      session: session(),
      store: store(),
      onChange: (status) => changes.push(status),
      now: () => clock,
      fetchImpl,
      developmentOverride: { state: 'active', plan: 'plus (development)' },
    });
    expect(entitlement.status().state).toBe('active');

    entitlement.releaseDevelopmentOverride();
    expect(entitlement.status()).toEqual({ state: 'none' });
    expect(changes).toEqual([{ state: 'none' }]);

    entitlement.releaseDevelopmentOverride();
    expect(changes).toHaveLength(1);
  });

  it('asks only for the caller’s own row, with both keys, and stores the answer', async () => {
    fetchImpl.mockResolvedValue(jsonResponse(row()));
    const entitlement = build();

    const status = await entitlement.checkNow();

    expect(status.state).toBe('active');
    expect(status.renewing).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/rest/v1/entitlements?');
    expect(url).toContain('limit=1');
    expect((init.headers as Record<string, string>).apikey).toBe(
      CONFIG.supabaseAnonKey,
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer access-1',
    );
    expect(stored).toMatchObject({
      userId: 'user-1',
      status: 'active',
      verifiedAt: NOW,
    });
    expect(changes.map((change) => change.state)).toEqual(['active']);
  });

  it('reads an empty answer as no subscription', async () => {
    stored = record();
    fetchImpl.mockResolvedValue(jsonResponse([]));
    const entitlement = build();

    expect(entitlement.status().state).toBe('active');
    await entitlement.checkNow();
    expect(entitlement.status().state).toBe('none');
    expect(stored).toBeUndefined();
  });

  /** Offline is not "not entitled". Every path that cannot reach the server keeps the last answer. */
  it('keeps the last confirmed answer when the network is down', async () => {
    stored = record();
    fetchImpl.mockRejectedValue(new Error('offline'));
    const entitlement = build();

    const status = await entitlement.checkNow();
    expect(status.state).toBe('active');
    expect(stored).toMatchObject({ status: 'active' });
    expect(changes).toEqual([]);
  });

  it('keeps the last confirmed answer when the server refuses', async () => {
    stored = record();
    fetchImpl.mockResolvedValue(jsonResponse({ message: 'nope' }, 401));
    const entitlement = build();

    expect((await entitlement.checkNow()).state).toBe('active');
    expect(stored).toMatchObject({ status: 'active' });
  });

  it('keeps the last confirmed answer when no token can be had', async () => {
    stored = record();
    accessToken.mockRejectedValue(new Error('offline'));
    const entitlement = build();

    expect((await entitlement.checkNow()).state).toBe('active');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reads a malformed row as no subscription rather than a broken one', async () => {
    fetchImpl.mockResolvedValue(
      jsonResponse(row({ current_period_end: 'sometime' })),
    );
    expect((await build().checkNow()).state).toBe('none');
  });

  it('reads the renewal flag, and only a true one as a cancellation', async () => {
    fetchImpl.mockResolvedValue(
      jsonResponse(row({ cancel_at_period_end: true })),
    );
    expect((await build().checkNow()).renewing).toBe(false);
    fetchImpl.mockResolvedValue(
      jsonResponse(row({ cancel_at_period_end: 'yes' })),
    );
    expect((await build().checkNow()).renewing).toBe(true);
  });

  /** The merchant lookup runs first with the token, and its failure changes nothing. */
  it('runs the pre-read hook with the token, and shrugs off its failure', async () => {
    fetchImpl.mockResolvedValue(jsonResponse(row()));
    const beforeFetch = jest.fn(() =>
      Promise.reject(new Error('merchant down')),
    );
    const entitlement = createEntitlement({
      config: CONFIG,
      session: session(),
      store: store(),
      onChange: (status) => changes.push(status),
      now: () => clock,
      fetchImpl,
      beforeFetch,
    });
    expect((await entitlement.checkNow()).state).toBe('active');
    expect(beforeFetch).toHaveBeenCalledWith('access-1');
    // The hook ran before the row was read, not after.
    expect(beforeFetch.mock.invocationCallOrder[0]).toBeLessThan(
      fetchImpl.mock.invocationCallOrder[0],
    );
  });

  /** Built before `ready`, when the cipher cannot read; the record is read when it can. */
  it('reads the cached subscription once the store becomes available', () => {
    stored = record();
    let ready = false;
    const entitlement = createEntitlement({
      config: CONFIG,
      session: session(),
      store: { ...store(), available: () => ready },
      onChange: (status) => changes.push(status),
      now: () => clock,
      fetchImpl,
    });
    expect(entitlement.status().state).toBe('none');
    ready = true;
    expect(entitlement.status().state).toBe('active');
  });

  /** A different sign-in must not inherit the previous person's subscription. */
  it('does not credit a stored record to a different account', () => {
    stored = record({ userId: 'somebody-else' });
    expect(build().status().state).toBe('none');
  });

  it('forgets everything when told the account is gone', async () => {
    stored = record();
    const entitlement = build();
    entitlement.forget();
    expect(entitlement.status().state).toBe('none');
    expect(stored).toBeUndefined();
    expect(changes.map((change) => change.state)).toEqual(['none']);
  });

  it('does nothing on an event when nobody is signed in', async () => {
    accountState = { status: 'signed-out' };
    await build().checkIfDue('window shown');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  /**
   * NOT AN INTERVAL. Events announce that somebody is at the machine, and a
   * check follows only when the last one is stale — a resume, an unlock and a
   * window shown land together and are answered by one request.
   */
  it('checks on the first event, then declines until the answer is stale', async () => {
    fetchImpl.mockResolvedValue(jsonResponse(row()));
    const entitlement = build();

    await entitlement.checkIfDue('launch');
    await entitlement.checkIfDue('window shown');
    await entitlement.checkIfDue('window focused');
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    clock += ENTITLEMENT_STALE_AFTER_MS - 1;
    await entitlement.checkIfDue('wake from sleep');
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    clock += 1;
    await entitlement.checkIfDue('wake from sleep');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  /**
   * A failed attempt does not count as a check. Being offline should retry on
   * the next event, not wait four hours for one that might have worked.
   */
  it('does not treat a network failure as a completed check', async () => {
    fetchImpl.mockRejectedValueOnce(new Error('offline'));
    fetchImpl.mockResolvedValue(jsonResponse(row()));
    const entitlement = build();

    await entitlement.checkIfDue('launch');
    await entitlement.checkIfDue('window shown');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('collapses concurrent checks into one request', async () => {
    fetchImpl.mockResolvedValue(jsonResponse(row()));
    const entitlement = build();

    await Promise.all([entitlement.checkNow(), entitlement.checkNow()]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('announces a change once, and only when something changed', async () => {
    fetchImpl.mockResolvedValue(jsonResponse(row()));
    const entitlement = build();

    await entitlement.checkNow();
    await entitlement.checkNow();
    expect(changes).toHaveLength(1);
  });

  /** The project's hardest rule, enforced by a test rather than a reviewer. */
  it('never sets a timer', async () => {
    fetchImpl.mockResolvedValue(jsonResponse(row()));
    const entitlement = build();
    await entitlement.checkIfDue('launch');
    await entitlement.checkNow();
    entitlement.forget();

    expect(timeoutSpy).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
  });
});
