import type { IAccountConfig } from 'common/accountConfig';
import type { IEncryptedJsonStore } from '../encryptedJsonStore';
import type { IAccountSession } from './session';

/**
 * Whether the signed-in account is paying for Plus, and since when we knew.
 *
 * The server is asked at EVENTS, never on a clock. The machine waking, the
 * screen unlocking, the window coming back, the account signing in, a person
 * pressing Refresh — each of those means somebody is at the machine, which is
 * both when an answer is worth having and the only time a change to it could
 * be seen. `checkIfDue` compares the clock against the last completed check and
 * declines when that was recent; nothing here counts down. The update checker
 * in `signedAutoUpdates.ts` reached the same design for the same reason: a timer
 * does not run while a laptop sleeps, so the schedule drifts by however long the
 * lid was shut and fires with nobody there.
 *
 * OFFLINE IS NOT "NOT ENTITLED". Every path that cannot reach the server leaves
 * the last confirmed answer standing. Being on a plane, or on a studio machine
 * that never sees the internet, must not take away something somebody paid for
 * — so a confirmed subscription keeps working for a grace window after the last
 * time the server was heard from, and nothing is deleted when that window ends.
 * Reconnecting restores it at once.
 */

/**
 * Fourteen days from the last confirmation.
 *
 * Long enough for a fortnight away from the internet, or a payment provider
 * having a very bad weekend, with room to spare. Short enough that a cancelled
 * monthly subscription stops inside one billing cycle. Measured from when the
 * server last CONFIRMED the subscription, not from when the period ends — a
 * token that expires while the machine is offline is precisely the case this
 * exists to cover.
 */
export const ENTITLEMENT_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * How stale the last check has to be before an event triggers another.
 *
 * Four hours, the same as the update checker: a resume and an unlock usually
 * land together and the window is shown right after, and one request answers
 * all three.
 */
export const ENTITLEMENT_STALE_AFTER_MS = 4 * 60 * 60 * 1000;

/**
 * The merchant's statuses under which the current period has been paid for.
 *
 * The merchant's words, stored as received. `past_due` is on the list because
 * the card is still being retried; it becomes `unpaid` or `canceled` when the
 * merchant gives up. A subscription somebody has decided not to renew is NOT
 * a status here — it stays `active` and carries `cancel_at_period_end`,
 * which is carried separately below. The period already paid for runs to its
 * end, and cutting somebody off the moment they decide not to continue is the
 * kind of thing that earns a chargeback. Anything not listed — `canceled`,
 * `unpaid`, `incomplete`, `incomplete_expired`, `paused` — is not paid for.
 */
const PAID_STATUSES = new Set(['trialing', 'active', 'past_due']);

export interface IEntitlementRecord {
  /** Which account this belongs to, so a different sign-in cannot inherit it. */
  userId: string;
  /** The merchant's status word, stored as received. */
  status: string;
  /** Epoch ms when the paid period runs out. */
  periodEndsAt: number;
  /** Epoch ms when the server last confirmed this. */
  verifiedAt: number;
  plan: string;
  /** The person has asked for it to end when the paid period does. */
  cancelAtPeriodEnd: boolean;
}

/** The shape check the encrypted store runs on every read. */
export const isEntitlementRecord = (
  value: unknown,
): value is IEntitlementRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<IEntitlementRecord>;
  return (
    typeof candidate.userId === 'string' &&
    candidate.userId.length > 0 &&
    typeof candidate.status === 'string' &&
    candidate.status.length <= 64 &&
    typeof candidate.periodEndsAt === 'number' &&
    Number.isFinite(candidate.periodEndsAt) &&
    typeof candidate.verifiedAt === 'number' &&
    Number.isFinite(candidate.verifiedAt) &&
    typeof candidate.plan === 'string' &&
    candidate.plan.length <= 64 &&
    typeof candidate.cancelAtPeriodEnd === 'boolean'
  );
};

export type TEntitlementState = 'active' | 'grace' | 'none';

export interface IEntitlementStatus {
  state: TEntitlementState;
  plan?: string;
  periodEndsAt?: number;
  /** Set only in the grace state: when the unconfirmed subscription lapses. */
  graceEndsAt?: number;
  /** Whether the merchant expects to renew it, or to let it end. */
  renewing?: boolean;
}

const NONE: IEntitlementStatus = { state: 'none' };

/**
 * What a stored record means at this moment. Pure, so a test can walk the
 * clock across every boundary without a server or a store.
 */
export const resolveEntitlementState = (
  record: IEntitlementRecord | undefined,
  now: number,
): IEntitlementStatus => {
  if (!record || !PAID_STATUSES.has(record.status)) {
    return NONE;
  }
  // A clock set backwards would otherwise buy another fortnight of grace for
  // free. The confirmation cannot have happened later than now.
  const verifiedAt = Math.min(record.verifiedAt, now);
  const shared = {
    plan: record.plan,
    periodEndsAt: record.periodEndsAt,
    renewing: !record.cancelAtPeriodEnd,
  };
  if (record.periodEndsAt > now) {
    return { state: 'active', ...shared };
  }
  // The period we last saw has ended. If the server was heard from recently
  // enough, the likeliest explanation is that it renewed while we were not
  // listening — so it stays on, with a visible end to that assumption.
  const graceEndsAt = verifiedAt + ENTITLEMENT_GRACE_MS;
  return graceEndsAt > now ? { state: 'grace', graceEndsAt, ...shared } : NONE;
};

export interface IEntitlement {
  status(): IEntitlementStatus;
  /** Hear about changes. Returns the unsubscribe. */
  subscribe(listener: (status: IEntitlementStatus) => void): () => void;
  /** Announce that something happened; a check follows only if one is due. */
  checkIfDue(reason: string): Promise<void>;
  /** A check regardless of when the last one was — for a Refresh button. */
  checkNow(): Promise<IEntitlementStatus>;
  /** The account is gone; there is nothing to be entitled through. */
  forget(): void;
}

export interface IEntitlementOptions {
  config: IAccountConfig;
  session: IAccountSession;
  store: IEncryptedJsonStore<IEntitlementRecord>;
  onChange: (status: IEntitlementStatus) => void;
  logger?: { info(message: string): void; warn(message: string): void };
  now?: () => number;
  /** Injected so a test never reaches a network. */
  fetchImpl?: typeof fetch;
  /**
   * Runs with the access token right before the row is read, on every check.
   *
   * This is where the server is asked to match the account against the
   * merchant's records, for the case where the merchant's notice of a payment
   * came before the account existed or never came. Its failure is logged and
   * ignored: the row read that follows is the answer, whatever this managed.
   */
  beforeFetch?: (accessToken: string) => Promise<unknown>;
  /**
   * DEVELOPMENT ONLY. A fixed answer in place of the server's, so the premium
   * path can be looked at before a backend exists. `main.ts` supplies this
   * solely when the app is not packaged and an environment variable asks for
   * it; a release build has no way to set it. It grants nothing a copy of the
   * app could not grant itself by being rebuilt — the server still only serves
   * packs to a paying account, and a pack still has to verify.
   */
  developmentOverride?: IEntitlementStatus;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * One row of the entitlements table, or nothing.
 *
 * Row-level security means the server only ever returns the caller's own row,
 * so there is at most one and it needs no matching here. Everything in it is
 * still checked: a column renamed on the server must read as "no subscription",
 * not as a subscription with undefined fields.
 */
const readRow = (
  value: unknown,
  userId: string,
  now: number,
): IEntitlementRecord | undefined => {
  if (!Array.isArray(value) || value.length === 0 || !isRecord(value[0])) {
    return undefined;
  }
  const row = value[0];
  const status = typeof row.status === 'string' ? row.status : undefined;
  const periodEndsAt =
    typeof row.current_period_end === 'string'
      ? Date.parse(row.current_period_end)
      : Number.NaN;
  if (!status || !Number.isFinite(periodEndsAt)) {
    return undefined;
  }
  return {
    userId,
    status,
    periodEndsAt,
    verifiedAt: now,
    plan: typeof row.plan === 'string' ? row.plan : 'plus',
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
  };
};

export const createEntitlement = (
  options: IEntitlementOptions,
): IEntitlement => {
  const { config, session, store, onChange } = options;
  const { logger } = options;
  const now = options.now ?? Date.now;
  const fetchImpl = options.fetchImpl ?? fetch;

  let record: IEntitlementRecord | undefined;
  // The disk is read the first time the cipher can read it, not here: this is
  // built before Electron's `ready`, and on Windows the credential cipher
  // reports itself unavailable until then. Reading in the constructor found
  // nothing on every launch and threw away a fortnight of grace with it.
  let loaded = false;
  // The moment the server was last actually reached, successfully or with a
  // refusal. A network failure does not count, so being offline retries on the
  // next event rather than waiting four hours for one that might work.
  let lastCheckedAt = 0;
  let inFlight: Promise<IEntitlementStatus> | undefined;

  const stored = (): IEntitlementRecord | undefined => {
    if (!loaded && store.available()) {
      record = store.read();
      loaded = true;
    }
    return record;
  };

  const ownRecord = (): IEntitlementRecord | undefined => {
    const current = stored();
    const { identity } = session.state();
    return current && identity && current.userId === identity.id
      ? current
      : undefined;
  };

  const status = (): IEntitlementStatus =>
    options.developmentOverride ?? resolveEntitlementState(ownRecord(), now());

  const listeners = new Set<(status: IEntitlementStatus) => void>();

  const remember = (next: IEntitlementRecord | undefined) => {
    const before = JSON.stringify(status());
    record = next;
    loaded = true;
    if (next) {
      store.write(next);
    } else {
      store.clear();
    }
    if (JSON.stringify(status()) !== before) {
      const current = status();
      onChange(current);
      listeners.forEach((listener) => listener(current));
    }
  };

  const fetchRecord = async (): Promise<IEntitlementStatus> => {
    const { identity } = session.state();
    if (!identity) {
      remember(undefined);
      return status();
    }
    let token: string;
    try {
      token = await session.accessToken();
    } catch {
      // Signed out meanwhile, or the machine is offline. Either way the last
      // answer stands; the session module owns what to do about the account.
      return status();
    }
    if (options.beforeFetch) {
      try {
        await options.beforeFetch(token);
      } catch (error) {
        logger?.warn(`Membership sync did not complete: ${error}`);
      }
    }
    let response: Response;
    try {
      const url = new URL('/rest/v1/entitlements', config.supabaseUrl);
      url.searchParams.set(
        'select',
        'status,current_period_end,plan,cancel_at_period_end',
      );
      url.searchParams.set('limit', '1');
      response = await fetchImpl(url.toString(), {
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
    } catch (error) {
      logger?.warn(`Entitlement check could not reach the server: ${error}`);
      return status();
    }
    lastCheckedAt = now();
    if (!response.ok) {
      // A refusal is the server's to explain and the session's to act on. It
      // is not evidence that the subscription ended.
      logger?.warn(`Entitlement check was answered ${response.status}.`);
      return status();
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return status();
    }
    remember(readRow(body, identity.id, now()));
    return status();
  };

  const checkNow = () => {
    // One request at a time: a resume and an unlock landing together would
    // otherwise both ask, and the second answer would overwrite the first with
    // nothing new.
    inFlight =
      inFlight ??
      fetchRecord().finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  };

  return {
    status,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    checkNow,
    checkIfDue: async (reason) => {
      if (session.state().status !== 'signed-in') {
        return;
      }
      if (now() - lastCheckedAt < ENTITLEMENT_STALE_AFTER_MS) {
        return;
      }
      logger?.info(`Checking the subscription after ${reason}.`);
      await checkNow();
    },
    forget: () => {
      lastCheckedAt = 0;
      remember(undefined);
    },
  };
};
