/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TLocalizedName } from './scenePacks';

/**
 * Plus, the scene subscription (Ivan, 2026-11-28: "the sub is called Plus"):
 * one Stripe subscription, monthly or yearly, that plays every scene in
 * Scenes, FluidEQ's own and members', in FluidEQ and FluidWallpapers on the
 * same account. Scenes got with credits stay the account's for good; scenes
 * it had only through Plus stop when Plus ends, and their downloads are
 * deleted from this computer. It covers scenes only, never sound: nothing
 * here may gate a preset, a dial, the Room or the EQ.
 *
 * Types and pure rules only, so the window may import this file: the
 * requests, the token and the payment pages' addresses stay in main
 * (`main/account/subscriptionService.ts`). Ported from FluidWallpapers,
 * which built it first against the same server.
 *
 * What the server answers (premium 0122), all of it additive to `my_store`:
 * - `libraryPlans: [{ id, interval, priceCents, currency }]`, month first,
 *   always present from 0122 on (`[]` for a suspended account, while
 *   nothing is on sale, and for accounts outside the test list while Stripe
 *   is in test mode). A server before 0122 sends no such key: nothing about
 *   Plus shows then, anywhere.
 * - `library: { until, renewing, plan }`, present only while the account is
 *   subscribed. The words on screen only: what plays is the entitlement row
 *   (`main/account/entitlementRecord.ts`), through `mayPlayLook`.
 *
 * Prices are Stripe's own amounts, in the smallest unit of their currency
 * (`priceCents` is Stripe's `unit_amount`), and nothing here names one.
 */

export type TLibraryPlanId = 'monthly' | 'yearly';
export type TLibraryInterval = 'month' | 'year';

/** One plan on sale, as `my_store`'s `libraryPlans` lists it. */
export interface ILibraryPlan {
  id: TLibraryPlanId;
  interval: TLibraryInterval;
  /** Stripe's `unit_amount`: the smallest unit of `currency`. */
  priceCents: number;
  /** ISO 4217, upper case. */
  currency: string;
}

/** The subscription the account has now, as `my_store`'s `library` says. */
export interface ILibraryMembership {
  /** ISO instant the paid period (or a set cancellation) ends. */
  until: string;
  /** Stripe renews it at `until`; false once it is cancelled to end then. */
  renewing: boolean;
  plan: TLibraryPlanId;
}

/**
 * What an answer said of `library`: nothing (not subscribed), a
 * subscription, or something this build cannot read, which must never be
 * taken for "not subscribed": that is the word an ending is acted on by.
 */
export type TLibraryMembershipRead =
  | { kind: 'absent' }
  | { kind: 'present'; membership: ILibraryMembership }
  | { kind: 'unreadable' };

/** What one `my_store` answer said of Plus, beside the store itself. */
export interface ILibraryFields {
  /** Undefined from a server that knows no subscription (no `libraryPlans`). */
  plans: ILibraryPlan[] | undefined;
  membership: TLibraryMembershipRead;
}

const PLAN_INTERVAL: Readonly<Record<TLibraryPlanId, TLibraryInterval>> = {
  monthly: 'month',
  yearly: 'year',
};

/** The plans in the order every screen lists them. */
export const LIBRARY_PLAN_IDS: readonly TLibraryPlanId[] = [
  'monthly',
  'yearly',
];

export const isLibraryPlanId = (value: unknown): value is TLibraryPlanId =>
  value === 'monthly' || value === 'yearly';

/**
 * The `plan` an entitlement row carries for Plus (0122's `is_library_plan`).
 * Every other plan an old row may still carry — the Buy Me a Coffee
 * membership, a trial, a gift, a month earned by publishing — is not Plus:
 * nobody holds one (Ivan, 2026-11-27: "No hay nadie con plus viejo"), and
 * the server writes every such row ended.
 */
const ROW_PLANS: ReadonlyMap<string, TLibraryPlanId> = new Map<
  string,
  TLibraryPlanId
>([
  ['library-monthly', 'monthly'],
  ['library-yearly', 'yearly'],
]);

/** The Plus plan an entitlement row's `plan` names, or undefined for any other. */
export const libraryPlanOfRow = (
  plan: string | undefined,
): TLibraryPlanId | undefined =>
  plan === undefined ? undefined : ROW_PLANS.get(plan);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const CURRENCY = /^[A-Z]{3}$/;

const readPlan = (row: unknown): ILibraryPlan | undefined => {
  if (
    !isRecord(row) ||
    !isLibraryPlanId(row.id) ||
    row.interval !== PLAN_INTERVAL[row.id] ||
    typeof row.priceCents !== 'number' ||
    !Number.isSafeInteger(row.priceCents) ||
    row.priceCents <= 0 ||
    typeof row.currency !== 'string' ||
    !CURRENCY.test(row.currency)
  ) {
    return undefined;
  }
  return {
    id: row.id,
    interval: PLAN_INTERVAL[row.id],
    priceCents: row.priceCents,
    currency: row.currency,
  };
};

/**
 * `my_store`'s `libraryPlans`: undefined when the server sent none (it knows
 * no subscription), else every plan that reads, month first. A row that does
 * not read is left out: a price half-read is never shown.
 */
export const parseLibraryPlans = (
  value: unknown,
): ILibraryPlan[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const plans = new Map<TLibraryPlanId, ILibraryPlan>();
  value.forEach((row: unknown) => {
    const plan = readPlan(row);
    if (plan && !plans.has(plan.id)) {
      plans.set(plan.id, plan);
    }
  });
  return LIBRARY_PLAN_IDS.flatMap((id) => {
    const plan = plans.get(id);
    return plan ? [plan] : [];
  });
};

/** `my_store`'s `library`, as `TLibraryMembershipRead` tells it. */
export const parseLibraryMembership = (
  value: unknown,
): TLibraryMembershipRead => {
  if (value === undefined) {
    return { kind: 'absent' };
  }
  if (
    !isRecord(value) ||
    typeof value.until !== 'string' ||
    !Number.isFinite(Date.parse(value.until)) ||
    typeof value.renewing !== 'boolean' ||
    !isLibraryPlanId(value.plan)
  ) {
    return { kind: 'unreadable' };
  }
  return {
    kind: 'present',
    membership: {
      until: new Date(Date.parse(value.until)).toISOString(),
      renewing: value.renewing,
      plan: value.plan,
    },
  };
};

/** Both of Plus's fields from one `my_store` body. */
export const parseLibraryFields = (body: unknown): ILibraryFields => {
  const raw = isRecord(body) ? body : {};
  return {
    plans: parseLibraryPlans(raw.libraryPlans),
    membership: parseLibraryMembership(raw.library),
  };
};

/**
 * Stripe's zero-decimal currencies: their amounts are whole units
 * (https://docs.stripe.com/currencies#zero-decimal).
 */
const ZERO_DECIMAL = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

/** Stripe's three-decimal currencies (https://docs.stripe.com/currencies#three-decimal). */
const THREE_DECIMAL = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

/** How many digits of a Stripe amount in `currency` are its minor unit. */
export const minorUnitDigits = (currency: string): number => {
  if (ZERO_DECIMAL.has(currency)) {
    return 0;
  }
  return THREE_DECIMAL.has(currency) ? 3 : 2;
};

/** A Stripe amount as the reader's money: 799 USD → "$7.99". */
export const formatPlanPrice = (
  amount: number,
  currency: string,
  locale: string,
): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount / 10 ** minorUnitDigits(currency));

/** What a plan costs per month, in its currency's smallest unit. */
export const planMonthlyCents = (plan: ILibraryPlan): number =>
  plan.interval === 'year' ? plan.priceCents / 12 : plan.priceCents;

/**
 * What a year saves against twelve months, worked out from the two prices
 * the server gives, rounded down so it never promises more than it saves.
 * Nothing when either plan is missing, they are in different money, or the
 * year saves less than 1%.
 */
export const yearlySaving = (
  plans: readonly ILibraryPlan[],
): { percent: number } | undefined => {
  const monthly = plans.find((plan) => plan.id === 'monthly');
  const yearly = plans.find((plan) => plan.id === 'yearly');
  if (!monthly || !yearly || monthly.currency !== yearly.currency) {
    return undefined;
  }
  const twelve = monthly.priceCents * 12;
  const percent = Math.floor(((twelve - yearly.priceCents) / twelve) * 100);
  return percent >= 1 ? { percent } : undefined;
};

// *** What the window sees ***

/** A scene Plus played that stopped when it ended. */
export interface ILapsedScene {
  lookId: string;
  /** Its name in every language its pack gave, as the looks named it then. */
  names: TLocalizedName;
}

/**
 * The last time Plus ended on this computer: which scenes stopped (their
 * downloads deleted), offered to keep with a credit each, or Plus again.
 * Kept until put away, or until the account has Plus again; a scene got
 * with a credit since leaves it.
 */
export interface ILapseOffer {
  /** Names this ending, so putting it away puts away this one only. */
  id: string;
  /** ISO instant the ending was acted on. */
  at: string;
  scenes: ILapsedScene[];
}

/** How the account stands with Plus, for its status line. */
export interface ISubscriptionStatus {
  plan?: TLibraryPlanId;
  /** ISO instant it renews (`renewing`) or ends. */
  until?: string;
  renewing?: boolean;
  /**
   * The server could not be reached since the period ended: it plays on
   * until this ISO instant (the offline grace).
   */
  graceUntil?: string;
}

export interface ISubscriptionState {
  signedIn: boolean;
  /**
   * The plans on sale, monthly first: the account's own answer once it
   * came; signed out, and before that answer, the plans this computer last
   * heard on sale, so Get Plus can show and lead to sign-in (a checkout
   * still waits for the account's own answer). Empty against a server that
   * knows no subscription, or while nothing is on sale: then no Plus shows
   * anywhere.
   */
  plans: ILibraryPlan[];
  /**
   * The plans listed are the ones this computer last heard, not this
   * account's own answer (signed out, or before that answer came): their
   * prices may have changed, and a checkout first reads the account's own.
   */
  plansRemembered?: true;
  /** The account's own answer says it is suspended: it can get nothing now. */
  suspended?: true;
  /** The account plays every scene in Scenes through Plus now. */
  subscribed: boolean;
  /** While subscribed: the plan and the dates the status line says. */
  status?: ISubscriptionStatus;
  /** "Manage Plus" may open Stripe's portal for this account. */
  manageable: boolean;
  /** The scenes that stopped the last time it ended, until put away. */
  lapse?: ILapseOffer;
}

/**
 * Stripe's checkout for a plan: `opened` in the browser; `terms-changed`
 * when the terms the window showed are not the ones in force here (the
 * window shows them again: the agreement recorded is the one it showed);
 * `needs-email` for an unconfirmed address; `needs-update` when the server
 * asks for newer terms than this build carries; `already-subscribed` when
 * the account has Plus already (here or in FluidWallpapers): Manage is the
 * way on; `not-on-sale` for a plan the server stopped selling; `banned` for
 * an account the server will not sell to; `signed-out` when the server no
 * longer took the sign-in; `failed` else (offline included).
 */
export type TSubscribeResult =
  | 'opened'
  | 'terms-changed'
  | 'needs-email'
  | 'needs-update'
  | 'already-subscribed'
  | 'not-on-sale'
  | 'banned'
  | 'signed-out'
  | 'failed';

/**
 * Stripe's portal: `opened`, `no-subscription` (nothing to manage),
 * `signed-out` (sign in again), `failed`.
 */
export type TManageResult =
  'opened' | 'no-subscription' | 'signed-out' | 'failed';

/** How a trip to Stripe ended, as fluideq.com's "Back to FluidEQ" says it. */
export type TPlusReturn = 'subscribed' | 'cancelled' | 'managed';

/** Plus's channels between main (`ipc/plusSubscription.ts`) and the window. */
export const PLUS_SUBSCRIPTION_CHANNELS = {
  state: 'plus-subscription-state',
  subscribe: 'plus-subscription-subscribe',
  manage: 'plus-subscription-manage',
  dismissLapse: 'plus-subscription-dismiss-lapse',
  changed: 'plus-subscription-changed',
  returned: 'plus-subscription-returned',
} as const;
