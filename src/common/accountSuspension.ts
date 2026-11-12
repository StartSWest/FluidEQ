/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An account FluidEQ's maker suspended for breaking the terms (premium
 * 0105). From that moment it buys, shares and plays nothing; the app covers
 * the window with what is happening while it is signed in, and signing out
 * leaves FluidEQ as it is for anyone without an account. It may ask, once,
 * for the money of the packs it paid for in the days before; the account is
 * deleted on `deletesAt` and the refund is paid then.
 */
export interface IAccountSuspension {
  /** The day the account is deleted, and the refund paid. */
  deletesAt: string;
  /** The days whose packs are refunded: from, and up to the suspension. */
  windowFrom: string;
  windowTo: string;
  /** What a refund pays back, in cents; 0 when nothing was paid then. */
  refundCents: number;
  /** When the refund was asked for; absent until it is. */
  refundRequestedAt?: string;
  /** The account published scenes: they are out of the gallery now. */
  maker: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isInstant = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= 64 &&
  Number.isFinite(Date.parse(value));

/**
 * The server's `suspension`: undefined for an account not suspended (null,
 * or absent from a server before 0105), and `false` for one that does not
 * read — which the store treats as a store that does not read, because a
 * suspension shown wrong is a refund offered wrong.
 */
export const parseAccountSuspension = (
  value: unknown,
): IAccountSuspension | undefined | false => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (
    !isRecord(value) ||
    !isInstant(value.deletesAt) ||
    !isInstant(value.windowFrom) ||
    !isInstant(value.windowTo) ||
    typeof value.refundCents !== 'number' ||
    !Number.isSafeInteger(value.refundCents) ||
    value.refundCents < 0 ||
    typeof value.maker !== 'boolean' ||
    (value.refundRequestedAt !== undefined &&
      value.refundRequestedAt !== null &&
      !isInstant(value.refundRequestedAt))
  ) {
    return false;
  }
  return {
    deletesAt: value.deletesAt,
    windowFrom: value.windowFrom,
    windowTo: value.windowTo,
    refundCents: value.refundCents,
    ...(isInstant(value.refundRequestedAt)
      ? { refundRequestedAt: value.refundRequestedAt }
      : {}),
    maker: value.maker,
  };
};

/** As this app wrote it: the same checks, so a stored store reads whole. */
export const isAccountSuspension = (
  value: unknown,
): value is IAccountSuspension => {
  const read = parseAccountSuspension(value);
  return read !== undefined && read !== false;
};
