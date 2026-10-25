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

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isWholeNumber = (value: unknown): value is number =>
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
