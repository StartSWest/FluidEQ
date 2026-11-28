/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PLUS_OFFLINE_GRACE_DAYS } from '../../common/plusTerms';
import { libraryPlanOfRow } from '../../common/subscription';

/**
 * What a Plus record means, whenever it is asked: the record's shape, the
 * server's row read into one, and the grace rule. Nothing here keeps state
 * or reaches a network, so a test can walk the clock across every boundary
 * without a server or a store; when to ask, and what to keep, is
 * `entitlement.ts`.
 *
 * Plus is the scene subscription (premium 0122), and a row is Plus only
 * under its two plans (`libraryPlanOfRow`). The membership that carried the
 * name before it — Buy Me a Coffee, trials, gifts, months earned by
 * publishing — is gone and nobody holds it (Ivan, 2026-11-27), so no other
 * plan is read as anything: an old row still on the server, like the one an
 * admin account kept from 2026-10-20, reads as no Plus at all.
 */

/**
 * Fourteen days from the last confirmation.
 *
 * Long enough for a fortnight away from the internet, or a payment provider
 * having a very bad weekend, with room to spare. Short enough that a cancelled
 * monthly subscription stops inside one billing cycle. Measured from when the
 * server last CONFIRMED the subscription — a token that expires while the
 * machine is offline is precisely the case this exists to cover — and never
 * from later than the period's end (`resolveEntitlementState`). The number
 * is the one the Plus terms promise, from the same constant.
 */
export const ENTITLEMENT_GRACE_MS =
  PLUS_OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000;

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

/** What a stored record means at this moment. */
export const resolveEntitlementState = (
  record: IEntitlementRecord | undefined,
  now: number,
): IEntitlementStatus => {
  if (
    !record ||
    !PAID_STATUSES.has(record.status) ||
    libraryPlanOfRow(record.plan) === undefined
  ) {
    return NONE;
  }
  const shared = {
    plan: record.plan,
    periodEndsAt: record.periodEndsAt,
    renewing: !record.cancelAtPeriodEnd,
  };
  if (record.periodEndsAt > now) {
    return { state: 'active', ...shared };
  }
  // A subscription cancelled to end with this period ended with it. The
  // grace below is for a renewal the app may have missed, and this one was
  // never going to renew.
  if (record.cancelAtPeriodEnd) {
    return NONE;
  }
  // The period we last saw has ended. If the server was heard from recently
  // enough, the likeliest explanation is that it renewed while we were not
  // listening — so it stays on, with a visible end to that assumption.
  //
  // Counted from the confirmation, but never from later than the period's
  // end. A read made after the period ended confirms nothing paid: the row
  // simply has not moved. Counted from such a read, the grace started again
  // at every answer, so a row the server never moved past its period — an
  // old membership's, ended 2026-10-20 and still `active`, read on
  // 2026-11-27 — stayed "in grace" for as long as the server could be
  // reached, which read as already subscribed. Stripe moves the period at
  // the renewal itself, card retries included (`past_due`), so the only
  // renewal a period's end can still be hiding is a notice on its way, and
  // fourteen days from that end is long past any delivery Stripe retries.
  // The same bound keeps a clock set backwards from buying another
  // fortnight: the period ended no later than now.
  const graceEndsAt =
    Math.min(record.verifiedAt, record.periodEndsAt) + ENTITLEMENT_GRACE_MS;
  return graceEndsAt > now ? { state: 'grace', graceEndsAt, ...shared } : NONE;
};

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
export const readEntitlementRow = (
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
    // A row without a plan names none, so it is not Plus.
    plan: typeof row.plan === 'string' ? row.plan : '',
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
  };
};
