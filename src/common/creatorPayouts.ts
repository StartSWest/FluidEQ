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

export interface ICreatorTerms {
  sharePercent: number;
  holdDays: number;
  minimumCents: number;
  agreementVersion: number;
  /** How often the admin pays creators (Ivan, 2026-10-21: every 15 days). */
  payoutDays: number;
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
}

/** How a payout run ended: what was sent, and why the rest was not. */
export interface ICreatorPayoutRun {
  paid: number;
  failed: string[];
}

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
  const lastPaidAt =
    typeof value.lastPaidAt === 'string'
      ? Date.parse(value.lastPaidAt)
      : Number.NaN;
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
    ...(isWholeNumber(value.payoutDays) && value.payoutDays > 0
      ? { payoutDays: value.payoutDays }
      : {}),
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the admin owes creators a payout run now: somebody is due, and
 * the last run is the payout interval behind (or there has never been one).
 */
export const payoutRunDue = (
  preview: ICreatorPayoutPreview,
  now: number,
): boolean =>
  preview.due.length > 0 &&
  (preview.lastPaidAt === undefined ||
    preview.payoutDays === undefined ||
    now - preview.lastPaidAt >= preview.payoutDays * DAY_MS);

/** When the next run is due, once there has been one. */
export const nextPayoutAt = (preview: ICreatorPayoutPreview) =>
  preview.lastPaidAt !== undefined && preview.payoutDays !== undefined
    ? preview.lastPaidAt + preview.payoutDays * DAY_MS
    : undefined;

/** `run-creator-payouts`' run: each payout sent, or the reason it was not. */
export const parsePayoutRun = (
  value: unknown,
): ICreatorPayoutRun | undefined => {
  if (!isRecord(value) || !Array.isArray(value.results)) {
    return undefined;
  }
  const results = value.results.filter(isRecord);
  return {
    paid: results.filter((result) => result.ok === true).length,
    failed: results
      .filter((result) => result.ok !== true)
      .map((result) =>
        typeof result.error === 'string' ? result.error : 'unknown',
      ),
  };
};
