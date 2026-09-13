/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Plus given as a gift: an address the admin chose, which counts as paying
 * without paying (premium migration 0021). What the server keeps is the rule;
 * this is only its shape on the way to the admin's page.
 */

export interface IPlusGift {
  /** Lowercased, as the server keeps it. */
  email: string;
  note?: string;
  /** Epoch ms when it ends; absent for a gift that runs until taken back. */
  until?: number;
  createdAt: number;
  /** An account has confirmed this address, so the gift has reached it. */
  hasAccount: boolean;
  /** Still running: no end, or an end still to come. */
  active: boolean;
}

/** Longest note the server accepts. */
export const PLUS_GIFT_NOTE_MAX = 200;

/** The server's own test of an address, so the page refuses what it would. */
export const isGiftEmail = (value: string) => {
  const email = value.trim().toLowerCase();
  return (
    email.length > 0 &&
    email.length <= 254 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const timeOf = (value: unknown) =>
  typeof value === 'string' ? Date.parse(value) : Number.NaN;

/** One row of `admin_plus_gifts`, or nothing when it is not one. */
export const parsePlusGiftRow = (row: unknown): IPlusGift | undefined => {
  if (
    !isRecord(row) ||
    typeof row.email !== 'string' ||
    !isGiftEmail(row.email)
  ) {
    return undefined;
  }
  const createdAt = timeOf(row.created_at);
  const until = row.until === null ? undefined : timeOf(row.until);
  if (
    !Number.isFinite(createdAt) ||
    (until !== undefined && !Number.isFinite(until)) ||
    typeof row.has_account !== 'boolean' ||
    typeof row.active !== 'boolean'
  ) {
    return undefined;
  }
  const note =
    typeof row.note === 'string' && row.note.length <= PLUS_GIFT_NOTE_MAX
      ? row.note
      : undefined;
  return {
    email: row.email.toLowerCase(),
    ...(note ? { note } : {}),
    ...(until !== undefined ? { until } : {}),
    createdAt,
    hasAccount: row.has_account,
    active: row.active,
  };
};

/** The plan an entitlement row carries when a gift, not a payment, is behind it. */
export const GIFT_PLAN = 'gift';

/**
 * Past this, a gift's end is the server's stand-in for "until taken back"
 * (`plus_gift_forever`, 2999-12-31), not a date anyone chose.
 */
export const GIFT_FOREVER_AFTER = Date.UTC(2900, 0, 1);
