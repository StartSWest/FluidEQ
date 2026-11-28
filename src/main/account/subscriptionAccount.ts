/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  libraryPlanOfRow,
  type ILibraryPlan,
  type ISubscriptionStatus,
  type TLibraryMembershipRead,
} from '../../common/subscription';
import type { IAccountPush } from '../plus/accountPush';
import type { ISceneOwnership, IStoreAnswer } from '../plus/sceneOwnership';
import {
  ENTITLEMENT_GRACE_MS,
  resolveEntitlementState,
  type IEntitlement,
  type IEntitlementRecord,
  type TEntitlementRead,
  type TEntitlementState,
} from './entitlement';

/**
 * Plus as the account knows it (premium 0122): whether the account plays
 * through it now, how it stands, and whether the server has said it ended.
 * Ported from FluidWallpapers, which reads the same server through FluidEQ's
 * own clients; here those clients say what they heard (`onRead`,
 * `onAnswer`) instead of being listened to from outside.
 *
 * - **What plays is the entitlement row** (`entitlementRecord.ts`), with its
 *   14-day grace and none for a subscription cancelled to end with its
 *   period; a suspended account plays nothing.
 * - **`my_store`'s `library` and `libraryPlans`** give the plans, their
 *   prices and the status line. A server from before 0122 sends neither:
 *   then nothing about Plus is known, and nothing changes. When the two
 *   disagree, the row is read again, and it decides what plays.
 *
 * `endConfirmed` is the word an ending is acted on by
 * (`subscriptionLapse.ts`: Plus's downloads deleted). Only the server
 * confirms an end, never a missing, late or failed answer:
 *
 * - **It said so twice, a day apart, and the row agrees.** A fresh
 *   `my_store` answer with no `library`, made after the last period this
 *   computer saw paid for had ended, or one the row read after it shows
 *   ended early: a status Stripe no longer counts as paid (`canceled`,
 *   `unpaid`...), as a refund, a dispute or the account's deletion leave
 *   it. Then another at least a day (`END_CONFIRMED_AFTER_MS`) later, in
 *   this run, with none between them that had one; and the row, read after
 *   that one, plays nothing. At a renewal the row's status is still a paid
 *   one (`active`, `past_due` while the card is retried), and its grace
 *   keeps it on.
 * - **Or the offline grace ran out with the server unreachable.** The row
 *   on this computer would still be in its grace had it been confirmed now,
 *   a read of it tried in this run after the grace ended failed, and the
 *   server has answered nothing since. Never at a start-up before that.
 *
 * When the first of those answers came, and the last period seen paid for,
 * are kept on disk per account (`subscriptionRecord.ts`): the second answer
 * may come in a later run.
 *
 * Paying and cancelling happen in the browser (`expectChange`): every event
 * reads the row until it moves (the entitlement's own `expectChange`), and
 * the server's `entitlement` push on the account's private topic is
 * listened to until then, so the change shows with the window behind the
 * browser.
 */

/** How long after the server first said it ended a second answer confirms it. */
export const END_CONFIRMED_AFTER_MS = 24 * 60 * 60 * 1000;

/** What one fresh `my_store` answer said of Plus. */
export interface ILibraryAnswer {
  /** The server knows Plus (0122 on: `libraryPlans` sent). */
  aware: boolean;
  /** The plans on sale, month first; empty when not `aware`. */
  plans: ILibraryPlan[];
  membership: TLibraryMembershipRead;
  /** The account is suspended (`my_store`'s `suspension`). */
  suspended: boolean;
}

/** How this computer watches an account's Plus for its ending. */
export interface ISubscriptionWatch {
  /** The end (epoch ms) of the latest period seen paid for. */
  paidUntil?: number;
  /**
   * When a fresh answer first said there is none, after that period ended,
   * in a run of such answers no answer with one has broken.
   */
  absentSince?: number;
}

/** Where the watch is kept (`subscriptionRecord.ts`, on disk). */
export interface ISubscriptionWatchStore {
  watch(accountId: string): ISubscriptionWatch | undefined;
  setWatch(accountId: string, watch: ISubscriptionWatch): void;
  /** This computer still has downloads Plus brought this account. */
  hasDownloads(accountId: string): boolean;
  /**
   * The plans the last answer that could say so had on sale (a server that
   * sells Plus, to an account not suspended), for the whole computer: what
   * the window offers before an account's own answer is read, signed out
   * included. Empty when none was heard.
   */
  knownPlans(): ILibraryPlan[];
  setKnownPlans(plans: readonly ILibraryPlan[]): void;
}

export interface ISubscriptionAccount {
  /**
   * What the last `my_store` answer the signed-in account got in this run
   * said of Plus; undefined before one came.
   */
  answer(): ILibraryAnswer | undefined;
  /** What `mayPlayLook` is told: the account plays every scene now. */
  subscribed(): boolean;
  /** The server confirmed the end (see above). Never on a failed or missing read. */
  endConfirmed(): boolean;
  /** The plan and dates for the status line, while subscribed. */
  status(): ISubscriptionStatus | undefined;
  /**
   * Somebody was sent to Stripe's checkout or portal: until the answer
   * moves, every event reads the row, and the server's push is heard.
   */
  expectChange(): void;
  /** Anything `subscribed`, `answer`, `status` or `endConfirmed` reads changed. */
  onChange(listener: () => void): () => void;
  /** Settles once every read this started (a row asked, a store asked) is done. */
  settled(): Promise<void>;
  dispose(): void;
}

export interface ISubscriptionAccountDeps {
  entitlement: Pick<
    IEntitlement,
    'status' | 'record' | 'subscribe' | 'onRead' | 'checkNow' | 'expectChange'
  >;
  ownership: Pick<ISceneOwnership, 'refreshNow' | 'known' | 'onAnswer'>;
  watch: ISubscriptionWatchStore;
  /** The signed-in account's id. */
  accountId: () => string | undefined;
  onIdentityChange: (listener: () => void) => () => void;
  /**
   * The server's word that the account's Plus row changed (0122's
   * `entitlement` event on its private `credits:<account>` topic), built
   * once; none in a build with no backend.
   */
  createPush?: (onEvent: () => void) => IAccountPush;
  now: () => number;
  logger?: { info(message: string): void; warn(message: string): void };
}

const iso = (ms: number | undefined) =>
  ms === undefined ? undefined : new Date(ms).toISOString();

/** Something heard for one account, and when. */
interface IHeard {
  accountId: string;
  at: number;
}

/**
 * The row's status is one Stripe counts as paid: the entitlement's own rule,
 * asked as if its period had not ended (no list of statuses is copied here).
 */
const paidStatus = (record: IEntitlementRecord, at: number): boolean =>
  resolveEntitlementState(
    {
      ...record,
      periodEndsAt: Number.MAX_SAFE_INTEGER,
      cancelAtPeriodEnd: false,
    },
    at,
  ).state !== 'none';

const since = (heard: IHeard | undefined, id: string, at: number) =>
  heard?.accountId === id && heard.at >= at;

export const createSubscriptionAccount = (
  deps: ISubscriptionAccountDeps,
): ISubscriptionAccount => {
  const {
    entitlement,
    ownership,
    watch: watches,
    accountId,
    now,
    logger,
  } = deps;
  const listeners = new Set<() => void>();
  const readings = new Set<Promise<void>>();
  /** The last fresh `my_store` answer in this run, and when it came. */
  let answered: (IHeard & { answer: ILibraryAnswer }) | undefined;
  /**
   * The last row read answered in this run: what it resolves to, and the
   * merchant's own status word (undefined for no row).
   */
  let rowHeard:
    | (IHeard & { state: TEntitlementState; status: string | undefined })
    | undefined;
  /** The last row read in this run that could not reach the server. */
  let rowFailed: IHeard | undefined;
  /** Whether the row played Plus at its last change. */
  let rowWasLive: boolean | undefined;
  let storeAsked = false;
  let lastView = '';

  const track = (reading: Promise<void>) => {
    readings.add(reading);
    reading.finally(() => readings.delete(reading)).catch(() => undefined);
  };

  const emit = () => {
    [...listeners].forEach((listener) => {
      try {
        listener();
      } catch (error) {
        logger?.warn(`A Plus listener failed: ${String(error)}`);
      }
    });
  };

  const answer = (): ILibraryAnswer | undefined => {
    const id = accountId();
    return id && answered?.accountId === id ? answered.answer : undefined;
  };

  /** The row kept on this computer, if it is this account's. */
  const ownRecord = (id: string): IEntitlementRecord | undefined => {
    const record = entitlement.record();
    return record?.userId === id ? record : undefined;
  };

  /** The latest word on a suspension: this run's answer, else the store kept. */
  const suspended = (): boolean => {
    const last = answer();
    if (last) {
      return last.suspended;
    }
    return ownership.known()?.suspension !== undefined;
  };

  const rowLive = (): boolean =>
    accountId() !== undefined && entitlement.status().state !== 'none';

  const subscribed = (): boolean =>
    accountId() !== undefined && !suspended() && rowLive();

  /** The end of the latest period seen paid for, from the watch or the row. */
  const periodEndOf = (id: string): number | undefined => {
    const ends = [watches.watch(id)?.paidUntil, ownRecord(id)?.periodEndsAt]
      .filter((end): end is number => end !== undefined)
      .filter(Number.isFinite);
    return ends.length > 0 ? Math.max(...ends) : undefined;
  };

  /** The server said it ended twice, a day apart, and the row agrees. */
  const serverSaidEnded = (id: string): boolean => {
    if (answered?.accountId !== id) {
      return false;
    }
    const { answer: last, at } = answered;
    if (!last.aware || last.suspended || last.membership.kind !== 'absent') {
      return false;
    }
    const absentSince = watches.watch(id)?.absentSince;
    return (
      absentSince !== undefined &&
      at - absentSince >= END_CONFIRMED_AFTER_MS &&
      since(rowHeard, id, at) &&
      rowHeard?.state === 'none'
    );
  };

  /** The grace ran out, and the server could not be reached since. */
  const graceRanOutUnreached = (id: string): boolean => {
    const record = ownRecord(id);
    const at = now();
    // Only a row whose grace was all that kept it on: Plus, paid for,
    // renewing, its period over. One cancelled to end with its period, or
    // never paid, stopped for its own reasons, and only the server's word
    // ends it here.
    if (
      !record ||
      resolveEntitlementState(record, at).state !== 'none' ||
      libraryPlanOfRow(record.plan) === undefined ||
      !paidStatus(record, at) ||
      record.cancelAtPeriodEnd ||
      record.periodEndsAt > at
    ) {
      return false;
    }
    // When the grace this record had ran out (`resolveEntitlementState`).
    const graceEnded =
      Math.min(record.verifiedAt, record.periodEndsAt) + ENTITLEMENT_GRACE_MS;
    return (
      since(rowFailed, id, graceEnded) &&
      !since(rowHeard, id, graceEnded) &&
      !since(answered, id, graceEnded)
    );
  };

  const endConfirmed = (): boolean => {
    const id = accountId();
    if (!id || suspended() || rowLive()) {
      return false;
    }
    return serverSaidEnded(id) || graceRanOutUnreached(id);
  };

  const status = (): ISubscriptionStatus | undefined => {
    if (!subscribed()) {
      return undefined;
    }
    const row = entitlement.status();
    const membership = answer()?.membership;
    const graceUntil =
      row.state === 'grace' && row.graceEndsAt !== undefined
        ? { graceUntil: iso(row.graceEndsAt) }
        : {};
    if (membership?.kind === 'present') {
      const { plan, until, renewing } = membership.membership;
      return { plan, until, renewing, ...graceUntil };
    }
    const plan = libraryPlanOfRow(row.plan);
    return {
      ...(plan ? { plan } : {}),
      ...(row.periodEndsAt !== undefined
        ? { until: iso(row.periodEndsAt) }
        : {}),
      ...(row.renewing !== undefined ? { renewing: row.renewing } : {}),
      ...graceUntil,
    };
  };

  /** What a change is measured by: everything the views read. */
  const view = () =>
    JSON.stringify([
      accountId() ?? null,
      subscribed(),
      answer() ?? null,
      status() ?? null,
      endConfirmed(),
    ]);

  /** The view a checkout or portal visit left from, while it is owed. */
  let awaiting: { accountId: string; view: string } | undefined;
  let push: IAccountPush | undefined;

  const changed = () => {
    const current = view();
    if (
      awaiting &&
      (awaiting.accountId !== accountId() || awaiting.view !== current)
    ) {
      // The answer moved (or the account changed): nothing is owed now.
      awaiting = undefined;
      push?.stop();
    }
    if (current !== lastView) {
      lastView = current;
      emit();
    }
  };

  /** The row read again; what it says is heard through `onRead`. */
  const askRow = (why?: string) => {
    if (why) {
      logger?.info(`Reading Plus again: ${why}`);
    }
    track(
      entitlement
        .checkNow()
        .then(
          () => undefined,
          (error: unknown) => {
            logger?.warn(`Plus could not be read again: ${String(error)}`);
          },
        )
        .finally(changed),
    );
  };

  /** `my_store` read again, for an answer the row moved past (one at a time). */
  const askStore = () => {
    if (storeAsked) {
      return;
    }
    storeAsked = true;
    track(
      ownership
        .refreshNow()
        .then(
          () => undefined,
          () => undefined,
        )
        .finally(() => {
          storeAsked = false;
        }),
    );
  };

  push = deps.createPush?.(() => {
    askRow('the server said Plus changed');
    askStore();
  });

  const setWatch = (id: string, next: ISubscriptionWatch) => {
    const before = watches.watch(id);
    if (
      before?.paidUntil !== next.paidUntil ||
      before?.absentSince !== next.absentSince
    ) {
      watches.setWatch(id, next);
    }
  };

  const heardStore = ({ accountId: id, store, library, at }: IStoreAnswer) => {
    const next: ILibraryAnswer = {
      aware: library.plans !== undefined,
      plans: library.plans ?? [],
      membership: library.membership,
      suspended: store.suspension !== undefined,
    };
    answered = { accountId: id, answer: next, at };
    if (!next.suspended) {
      // What is on sale is the same for every account: remembered for the
      // window to offer before an account's own answer (signed out too). A
      // server that no longer knows Plus (sent no libraryPlans) has none on
      // sale. A suspended account's empty list says nothing of what is on
      // sale, so it changes nothing here.
      watches.setKnownPlans(next.aware ? next.plans : []);
    }
    if (next.aware && !next.suspended) {
      const watch = watches.watch(id) ?? {};
      if (next.membership.kind === 'present') {
        const until = Date.parse(next.membership.membership.until);
        setWatch(id, { paidUntil: Math.max(watch.paidUntil ?? until, until) });
        if (!rowLive()) {
          askRow('my_store has Plus and the account row does not show it');
        }
      } else if (next.membership.kind === 'absent') {
        const periodEnd = periodEndOf(id);
        // Only an account this computer saw paying has anything to end.
        if (periodEnd !== undefined) {
          if (watch.absentSince === undefined && at >= periodEnd) {
            setWatch(id, { paidUntil: periodEnd, absentSince: at });
          }
          // The row's own word, read after this answer: what plays, while
          // the row still plays it; else whether it ended (early, or for
          // the second time), while there is anything left here to delete.
          if (rowLive()) {
            askRow('my_store has no Plus and the account row still shows it');
          } else if (watches.hasDownloads(id)) {
            askRow();
          }
        }
      }
    }
    changed();
  };

  const heardRow = (read: TEntitlementRead) => {
    const { accountId: id, at } = read;
    if (read.kind === 'unreachable') {
      rowFailed = { accountId: id, at };
      changed();
      return;
    }
    const { record } = read;
    rowHeard = {
      accountId: id,
      at,
      state: resolveEntitlementState(record, at).state,
      status: record?.status,
    };
    if (record && libraryPlanOfRow(record.plan) !== undefined) {
      const watch = watches.watch(id) ?? {};
      const next: ISubscriptionWatch = { ...watch };
      const paid = paidStatus(record, at);
      if (
        Number.isFinite(record.periodEndsAt) &&
        (watch.paidUntil === undefined || watch.paidUntil < record.periodEndsAt)
      ) {
        next.paidUntil = record.periodEndsAt;
        // A later period paid for: whatever said it ended came before it,
        // and the wait starts again after it. An unpaid row's period was
        // never paid for, and changes nothing.
        if (
          paid &&
          next.absentSince !== undefined &&
          next.absentSince < record.periodEndsAt
        ) {
          delete next.absentSince;
        }
      }
      // Ended early: the answer with no library, then this row, read after
      // it, with a status that is not a paid one. The wait for the second
      // answer starts with that answer, not at a period's end that may be
      // months away. A renewal gap never gets here: its row's status is
      // still a paid one.
      const last = answered;
      if (
        !paid &&
        next.absentSince === undefined &&
        last?.accountId === id &&
        last.at <= at &&
        last.answer.aware &&
        !last.answer.suspended &&
        last.answer.membership.kind === 'absent'
      ) {
        next.absentSince = last.at;
        logger?.info(
          `Plus ended early (its row says ${record.status}): a second answer a day from now confirms it`,
        );
      }
      setWatch(id, next);
    }
    changed();
  };

  const offAnswers = ownership.onAnswer(heardStore);
  const offReads = entitlement.onRead(heardRow);

  const offRow = entitlement.subscribe(() => {
    const live = rowLive();
    const flipped = rowWasLive !== undefined && live !== rowWasLive;
    rowWasLive = live;
    const last = answer();
    if (
      flipped &&
      last?.aware &&
      !last.suspended &&
      last.membership.kind !== 'unreadable' &&
      live !== (last.membership.kind === 'present')
    ) {
      // The row started or stopped playing past the last answer: the
      // status line's plan and dates are asked again, once.
      askStore();
    }
    changed();
  });

  const offIdentity = deps.onIdentityChange(() => {
    awaiting = undefined;
    rowWasLive = undefined;
    push?.stop();
    changed();
  });

  rowWasLive = rowLive();
  lastView = view();

  /** Each round waits on the reads the one before it started. */
  const settle = async (): Promise<void> => {
    if (readings.size === 0) {
      return;
    }
    await Promise.allSettled([...readings]);
    await settle();
  };

  return {
    answer,
    subscribed,
    endConfirmed,
    status,
    expectChange: () => {
      const id = accountId();
      entitlement.expectChange();
      if (!id) {
        return;
      }
      awaiting = { accountId: id, view: view() };
      push?.watch();
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    settled: settle,
    dispose: () => {
      push?.stop();
      offAnswers();
      offReads();
      offRow();
      offIdentity();
      listeners.clear();
    },
  };
};
