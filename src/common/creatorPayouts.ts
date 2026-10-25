/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Creators paid for their scenes (server 0064, `creator-account`): what the
 * app knows about a creator's payouts, read from the server as it answers.
 *
 * Every rule is the server's: the share, the hold, the minimum and the
 * agreement version arrive with each answer (`terms`), and the app only
 * shows them. The countries are the ones Stripe can pay from a US account
 * (cross-border payouts: the US, the UK, the EEA, Canada and Switzerland);
 * the server refuses any other, this list only decides what the app offers.
 */

export const PAYABLE_COUNTRIES = [
  'US',
  'GB',
  'CA',
  'CH',
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
] as const;

export type TPayableCountry = (typeof PAYABLE_COUNTRIES)[number];

export const isPayableCountry = (value: unknown): value is TPayableCountry =>
  typeof value === 'string' &&
  (PAYABLE_COUNTRIES as readonly string[]).includes(value);

/** The creator agreement this app shows; the server refuses an older one. */
export const CREATOR_AGREEMENT_VERSION = 1;

/**
 * Whether this app offers creators money for their scenes at all: the
 * account panel's card, the sign-up before Stripe's pages, and the terms'
 * sections about payouts (`termsLayout`).
 *
 * Off since 2026-10-24: Stripe Connect, which pays creators, needs an
 * identity check FluidEQ's owner cannot pass yet, so FluidEQ sells scenes and
 * creators share theirs for credits (Ivan: "hide all related to pay them ...
 * but lets have it prepared for when we can"). The server has its own switch
 * (premium 0070, `creator_payouts_open`) and refuses a sign-up while it is
 * closed. Turning this on is a release: raise `PLUS_TERMS_VERSION`, because
 * the terms then describe payouts, and open the server's switch.
 */
export const CREATOR_PAYOUTS_OPEN: boolean = false;

export interface ICreatorTerms {
  sharePercent: number;
  holdDays: number;
  minimumCents: number;
  agreementVersion: number;
  /** How often the admin pays creators (Ivan, 2026-10-21: every 15 days). */
  payoutDays: number;
  /** The server's switch (premium 0070); absent before it, read as closed. */
  payoutsOpen: boolean;
}

export interface ICreatorAccount {
  country?: string;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  agreedVersion: number;
}

export interface ICreatorStatus {
  terms: ICreatorTerms;
  /** Absent until the creator has begun signing up. */
  account?: ICreatorAccount;
  heldCents: number;
  readyCents: number;
  paidCents: number;
  sales: number;
}

export type TCreatorFailure =
  | 'signed-out'
  | 'unconfirmed'
  | 'offline'
  | 'unavailable'
  | 'agreement-outdated'
  | 'country'
  | 'banned'
  | 'server';

export type TCreatorOutcome =
  { ok: true; status: ICreatorStatus } | { ok: false; reason: TCreatorFailure };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWholeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

const termsOf = (value: unknown): ICreatorTerms | undefined =>
  isRecord(value) &&
  isWholeNumber(value.sharePercent) &&
  value.sharePercent > 0 &&
  value.sharePercent <= 100 &&
  isWholeNumber(value.holdDays) &&
  value.holdDays >= 0 &&
  isWholeNumber(value.minimumCents) &&
  value.minimumCents >= 0 &&
  isWholeNumber(value.agreementVersion) &&
  value.agreementVersion > 0 &&
  isWholeNumber(value.payoutDays) &&
  value.payoutDays > 0
    ? {
        sharePercent: value.sharePercent,
        holdDays: value.holdDays,
        minimumCents: value.minimumCents,
        agreementVersion: value.agreementVersion,
        payoutDays: value.payoutDays,
        payoutsOpen: value.payoutsOpen === true,
      }
    : undefined;

const accountOf = (value: unknown): ICreatorAccount | undefined | false => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (
    !isRecord(value) ||
    typeof value.detailsSubmitted !== 'boolean' ||
    typeof value.payoutsEnabled !== 'boolean' ||
    !isWholeNumber(value.agreedVersion)
  ) {
    return false;
  }
  return {
    ...(typeof value.country === 'string' && /^[A-Z]{2}$/.test(value.country)
      ? { country: value.country }
      : {}),
    detailsSubmitted: value.detailsSubmitted,
    payoutsEnabled: value.payoutsEnabled,
    agreedVersion: value.agreedVersion,
  };
};

/** `my_creator()` as the server answers it, refused whole if any part is off. */
export const parseCreatorStatus = (
  value: unknown,
): ICreatorStatus | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const terms = termsOf(value.terms);
  const account = accountOf(value.account);
  if (
    !terms ||
    account === false ||
    !isWholeNumber(value.heldCents) ||
    !isWholeNumber(value.readyCents) ||
    !isWholeNumber(value.paidCents) ||
    value.paidCents < 0 ||
    !isWholeNumber(value.sales) ||
    value.sales < 0
  ) {
    return undefined;
  }
  return {
    terms,
    ...(account ? { account } : {}),
    heldCents: value.heldCents,
    readyCents: value.readyCents,
    paidCents: value.paidCents,
    sales: value.sales,
  };
};

/** Dollars, in the reader's own way of writing them. */
export const formatDollars = (cents: number, locale: string): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  );

/** A creator a payout run would pay now, for the admin to see first. */
export interface ICreatorPayoutDue {
  creatorId: string;
  readyCents: number;
  /** The creator's name on the board, when they have one. */
  handle?: string;
}

export interface ICreatorPayoutPreview {
  due: ICreatorPayoutDue[];
  totalCents: number;
  /** FluidEQ's dollars available at Stripe; absent when Stripe did not say. */
  availableCents?: number;
  /** Payouts a run left unfinished, finished first by the next. */
  pending: number;
  /** When creators were last paid; absent before the first payout. */
  lastPaidAt?: number;
  /** How often payouts are due, from the creator terms. */
  payoutDays?: number;
  /** When the next automatic run goes (0066: the 1st and the 16th). */
  nextRunAt?: number;
  /** Paid by buyers and not yet settled at Stripe. */
  pendingCents?: number;
  /** Everything owed to creators (0067), whatever its hold or minimum. */
  owed?: ICreatorLiability;
  /** How Stripe sends FluidEQ's own balance to its bank: 'manual' or a schedule. */
  ownPayouts?: string;
  /**
   * Held back from FluidEQ's share (premium 0069): purchases members can
   * still have refunded, and a floor kept for disputes.
   */
  reserveCents?: number;
  /** The last share the server sent to FluidEQ's bank by itself. */
  lastOwnerPayout?: { amountCents: number; at: number };
}

/** What FluidEQ owes its creators right now. */
export interface ICreatorLiability {
  /** Earnings still inside their hold. */
  heldCents: number;
  /** Earnings past it, paid at the next payout once a creator has the minimum. */
  readyCents: number;
  /** Begun by a payout and not yet confirmed by Stripe. */
  sendingCents: number;
}

const liabilityOf = (value: unknown): ICreatorLiability | undefined =>
  isRecord(value) &&
  isWholeNumber(value.heldCents) &&
  isWholeNumber(value.readyCents) &&
  isWholeNumber(value.sendingCents)
    ? {
        heldCents: value.heldCents,
        readyCents: value.readyCents,
        sendingCents: value.sendingCents,
      }
    : undefined;

const dueOf = (value: unknown): ICreatorPayoutDue | undefined =>
  isRecord(value) &&
  typeof value.creatorId === 'string' &&
  isWholeNumber(value.readyCents) &&
  value.readyCents > 0
    ? {
        creatorId: value.creatorId,
        readyCents: value.readyCents,
        ...(typeof value.handle === 'string' ? { handle: value.handle } : {}),
      }
    : undefined;

/** `run-creator-payouts`' preview, refused whole if any part is off. */
export const parsePayoutPreview = (
  value: unknown,
): ICreatorPayoutPreview | undefined => {
  if (
    !isRecord(value) ||
    !Array.isArray(value.due) ||
    !isWholeNumber(value.totalCents) ||
    !isWholeNumber(value.pending)
  ) {
    return undefined;
  }
  const due = value.due.map(dueOf);
  const timeOf = (field: unknown) =>
    typeof field === 'string' ? Date.parse(field) : Number.NaN;
  const lastPaidAt = timeOf(value.lastPaidAt);
  const nextRunAt = timeOf(value.nextRunAt);
  const owed = liabilityOf(value.owed);
  const lastOwner = isRecord(value.lastOwnerPayout)
    ? {
        amountCents: value.lastOwnerPayout.amountCents,
        at: timeOf(value.lastOwnerPayout.at),
      }
    : undefined;
  if (due.some((row) => row === undefined)) {
    return undefined;
  }
  return {
    due: due.filter((row): row is ICreatorPayoutDue => row !== undefined),
    totalCents: value.totalCents,
    ...(isWholeNumber(value.availableCents)
      ? { availableCents: value.availableCents }
      : {}),
    pending: value.pending,
    ...(Number.isFinite(lastPaidAt) ? { lastPaidAt } : {}),
    ...(Number.isFinite(nextRunAt) ? { nextRunAt } : {}),
    ...(isWholeNumber(value.pendingCents)
      ? { pendingCents: value.pendingCents }
      : {}),
    ...(owed ? { owed } : {}),
    ...(typeof value.ownPayouts === 'string'
      ? { ownPayouts: value.ownPayouts }
      : {}),
    ...(isWholeNumber(value.payoutDays) && value.payoutDays > 0
      ? { payoutDays: value.payoutDays }
      : {}),
    ...(isWholeNumber(value.reserveCents)
      ? { reserveCents: value.reserveCents }
      : {}),
    ...(lastOwner &&
    isWholeNumber(lastOwner.amountCents) &&
    Number.isFinite(lastOwner.at)
      ? {
          lastOwnerPayout: {
            amountCents: lastOwner.amountCents,
            at: lastOwner.at,
          },
        }
      : {}),
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long before an automatic payout the admin is told what it will send. */
export const PAYOUT_NOTICE_DAYS = 3;

/**
 * Whether the next automatic payout is close enough to tell the admin about:
 * somebody is due, and the run is no more than three days off. Payouts run by
 * themselves (Ivan, 2026-10-21: "payout should happen auto"); the admin is
 * told the amount, and whether Stripe holds enough for it.
 */
export const payoutSoon = (
  preview: ICreatorPayoutPreview,
  now: number,
): boolean =>
  preview.due.length > 0 &&
  preview.nextRunAt !== undefined &&
  preview.nextRunAt - now <= PAYOUT_NOTICE_DAYS * DAY_MS;

/** Everything owed to creators, in cents, when the server said. */
export const owedTotal = (
  preview: ICreatorPayoutPreview,
): number | undefined =>
  preview.owed
    ? preview.owed.heldCents +
      preview.owed.readyCents +
      preview.owed.sendingCents
    : undefined;

/**
 * What of FluidEQ's available Stripe balance is FluidEQ's own: the balance
 * less everything owed to creators and what is held back for refunds and
 * disputes — what the next run sends to the bank by itself. Never below
 * zero; `owedShortCents` says when the balance does not cover creators.
 */
export const yoursCents = (
  preview: ICreatorPayoutPreview,
): number | undefined => {
  const owed = owedTotal(preview);
  return owed === undefined || preview.availableCents === undefined
    ? undefined
    : Math.max(0, preview.availableCents - owed - (preview.reserveCents ?? 0));
};

/**
 * How far FluidEQ's Stripe balance falls short of what creators are owed:
 * money of theirs that has already left Stripe. Zero when it covers them.
 */
export const owedShortCents = (
  preview: ICreatorPayoutPreview,
): number | undefined => {
  const owed = owedTotal(preview);
  return owed === undefined || preview.availableCents === undefined
    ? undefined
    : Math.max(0, owed - preview.availableCents);
};

/** Whether FluidEQ's Stripe balance is short of what is due. */
export const payoutShort = (preview: ICreatorPayoutPreview): boolean =>
  preview.availableCents !== undefined &&
  preview.availableCents < preview.totalCents;
