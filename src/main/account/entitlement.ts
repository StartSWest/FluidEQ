import type { IAccountConfig } from 'common/accountConfig';
import type { IEncryptedJsonStore } from '../encryptedJsonStore';
import type { IAccountSession } from './session';
import {
  readEntitlementRow,
  resolveEntitlementState,
  type IEntitlementRecord,
  type IEntitlementStatus,
  type TEntitlementState,
} from './entitlementRecord';

// Re-exported so nothing that asks about membership has to know that what a
// record means (`entitlementRecord.ts`) lives apart from when it is asked.
export {
  ENTITLEMENT_GRACE_MS,
  isEntitlementRecord,
  resolveEntitlementState,
} from './entitlementRecord';
export type {
  IEntitlementRecord,
  IEntitlementStatus,
  TEntitlementState,
} from './entitlementRecord';

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
 * How stale the last check has to be before an event triggers another.
 *
 * Four hours, the same as the update checker: a resume and an unlock usually
 * land together and the window is shown right after, and one request answers
 * all three.
 */
export const ENTITLEMENT_STALE_AFTER_MS = 4 * 60 * 60 * 1000;

export interface IEntitlement {
  status(): IEntitlementStatus;
  /** Hear about changes. Returns the unsubscribe. */
  subscribe(listener: (status: IEntitlementStatus) => void): () => void;
  /** Announce that something happened; a check follows only if one is due. */
  checkIfDue(reason: string): Promise<void>;
  /** A check regardless of when the last one was — for a Refresh button. */
  checkNow(): Promise<IEntitlementStatus>;
  /**
   * Somebody has been sent to the merchant's own page to pay or to cancel.
   * Until the answer moves, every event checks: staleness is the wrong
   * question at the one moment the answer is known to be about to change.
   */
  expectChange(): void;
  /** The account is gone; there is nothing to be entitled through. */
  forget(): void;
  /**
   * DEVELOPMENT ONLY: drop the fixed answer and follow the server from here
   * on. The pretend membership calls this — pressing it is asking to see the
   * real path, and a pin that kept Plus on over it made "pretend a
   * cancellation" look broken while the server had in fact cancelled.
   */
  releaseDevelopmentOverride(): void;
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
  let lastCheckedAccountId: string | undefined;
  let generation = 0;
  let inFlight:
    | {
        accountId: string | undefined;
        generation: number;
        promise: Promise<IEntitlementStatus>;
      }
    | undefined;
  /**
   * The status as it read when somebody was sent to the merchant, while that
   * answer is still owed.
   *
   * Paying is the one event this app cannot hear about. The merchant's notice
   * reaches the server, not the machine, so the only moment the app can learn
   * of it is the person coming back to the window — and that is exactly when
   * the four-hour staleness test refused to ask, because the check made
   * minutes earlier, before they paid, still counted as recent. Plus stayed
   * off until the app was started again, over a message promising it would
   * turn on. So while an answer is owed, every event asks, and the wait ends
   * the moment the answer differs from the one they left with.
   */
  let awaiting: string | undefined;

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

  // The development pin holds until the pretend membership releases it.
  let override = options.developmentOverride;

  let lastAnnounced: string | undefined;
  /**
   * The state last seen here, which is not the same as the last ANNOUNCED
   * one: at an ordinary launch the stored record already agrees with the
   * server, so nothing is announced all sitting. Seeded with the first read
   * for exactly that reason — tracked only inside `announce`, this was
   * `undefined` on the one path the flag below exists for.
   */
  let lastState: TEntitlementState | undefined;
  /**
   * When access ended, while nothing has been heard from the server since.
   * Until then every event asks, whatever the staleness rule says: that
   * moment is when the server's answer is most likely to have changed — a
   * maker's next banked month starts the moment the old one stops, a trial
   * that ended may have been paid for, and a subscription may have renewed
   * while this app was not listening.
   *
   * A moment rather than a flag, and cleared where an answer is ADOPTED
   * rather than where one is asked for. Cleared on the ask, a server that
   * refused — or a request that was already in the air before the ending,
   * and so answers with the row from before it — spent the one chance and
   * the wait became the four hours this exists to skip.
   */
  let accessEndedAt: number | undefined;
  const status = (): IEntitlementStatus => {
    const current = override ?? resolveEntitlementState(ownRecord(), now());
    lastAnnounced ??= JSON.stringify(current);
    lastState ??= current.state;
    return current;
  };

  const listeners = new Set<(status: IEntitlementStatus) => void>();

  const announce = (current: IEntitlementStatus) => {
    lastAnnounced = JSON.stringify(current);
    lastState = current.state;
    onChange(current);
    listeners.forEach((listener) => listener(current));
  };

  // Comparing two reads at the same time misses expiry between events: both
  // already say "none" while the window is still showing the previous grant.
  const announceIfChanged = () => {
    const had = lastState === 'active' || lastState === 'grace';
    const current = status();
    if (JSON.stringify(current) === lastAnnounced) {
      return;
    }
    announce(current);
    // Whatever it was. A maker can have another month banked behind the one
    // that just ran out — and behind a SUBSCRIPTION that just ran out, which
    // is the commoner of the two — and the server starts it the moment it is
    // asked. The staleness rule would otherwise sit on "no Plus" for up to
    // four hours with a month of theirs waiting there.
    if (current.state === 'none' && had) {
      accessEndedAt = now();
    }
  };

  const remember = (next: IEntitlementRecord | undefined) => {
    status();
    record = next;
    loaded = true;
    if (next) {
      store.write(next);
    } else {
      store.clear();
    }
    announceIfChanged();
  };

  const fetchRecord = async (
    accountId: string | undefined,
    requestGeneration: number,
  ): Promise<IEntitlementStatus> => {
    // A request begun before access ended answers with the row from before
    // it, and settles nothing about what replaced it.
    const askedAt = now();
    const current = () =>
      generation === requestGeneration &&
      session.state().identity?.id === accountId;
    if (!accountId) {
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
    if (!current()) {
      return status();
    }
    if (options.beforeFetch) {
      try {
        await options.beforeFetch(token);
      } catch (error) {
        logger?.warn(`Membership sync did not complete: ${error}`);
      }
    }
    if (!current()) {
      return status();
    }
    let response: Response;
    try {
      const url = new URL('/rest/v1/entitlements', config.supabaseUrl);
      url.searchParams.set(
        'select',
        'status,current_period_end,plan,cancel_at_period_end',
      );
      // Row security already answers with the caller's row alone; asking by
      // id as well means one mistaken policy on the server can never hand
      // this account somebody else's paid row as its own.
      url.searchParams.set('user_id', `eq.${accountId}`);
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
    if (!current()) {
      return status();
    }
    lastCheckedAt = now();
    lastCheckedAccountId = accountId;
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
    if (!current()) {
      return status();
    }
    remember(readEntitlementRow(body, accountId, now()));
    if (accessEndedAt !== undefined && askedAt >= accessEndedAt) {
      accessEndedAt = undefined;
    }
    if (awaiting !== undefined && JSON.stringify(status()) !== awaiting) {
      awaiting = undefined;
    }
    return status();
  };

  const checkNow = () => {
    announceIfChanged();
    const accountId = session.state().identity?.id;
    if (
      inFlight &&
      inFlight.accountId === accountId &&
      inFlight.generation === generation
    ) {
      return inFlight.promise;
    }
    const promise = fetchRecord(accountId, generation).finally(() => {
      if (inFlight?.promise === promise) {
        inFlight = undefined;
      }
      announceIfChanged();
    });
    inFlight = { accountId, generation, promise };
    return promise;
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
      announceIfChanged();
      if (session.state().status !== 'signed-in') {
        return;
      }
      if (
        accessEndedAt === undefined &&
        awaiting === undefined &&
        lastCheckedAccountId === session.state().identity?.id &&
        now() - lastCheckedAt < ENTITLEMENT_STALE_AFTER_MS
      ) {
        return;
      }
      logger?.info(`Checking the subscription after ${reason}.`);
      await checkNow();
    },
    expectChange: () => {
      awaiting = JSON.stringify(status());
      // A check started before an accepted grant cannot satisfy its refresh,
      // or return later and overwrite the newly confirmed membership.
      generation += 1;
    },
    forget: () => {
      generation += 1;
      lastCheckedAt = 0;
      lastCheckedAccountId = undefined;
      awaiting = undefined;
      remember(undefined);
    },
    releaseDevelopmentOverride: () => {
      if (!override) {
        return;
      }
      override = undefined;
      // Said out loud even when the stored answer happens to match: the
      // window was showing the pin, not the record.
      announce(status());
    },
  };
};
