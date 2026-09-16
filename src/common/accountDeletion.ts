/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { validAccountEmail } from './accountRules';

/**
 * An account the admin is about to delete, as the server describes it
 * (`admin_find_account`, premium migration 0031): who it is and how much goes
 * with it, so the account deleted is the one meant and not one a typo found.
 * Deleting is the server's; this is only its shape on the way to the page.
 */
export interface IAccountToDelete {
  userId: string;
  /** As the account keeps it; for an unfinished deletion, the address typed. */
  email: string;
  /** Absent for a deletion whose account is already gone. */
  createdAt?: number;
  confirmed: boolean;
  /** An admin account is never deleted from the page; the server refuses it. */
  admin: boolean;
  handle?: string;
  displayName?: string;
  /** `plus` or `gift`, present only while Plus is running, with its end. */
  plan?: string;
  plusUntil?: number;
  published: number;
  boardDays: number;
  likes: number;
  adds: number;
  reports: number;
  /** A gift of Plus to this address, which stays when the account goes. */
  gifted: boolean;
  /** An earlier Delete stopped part way; Delete again finishes it. */
  deleting: boolean;
  /**
   * The FluidEQ this account's newest computer signed in with, when one of
   * them said. Absent for an account whose every sign-in came from a build
   * too old to name itself, and for a server that does not answer it yet.
   */
  appVersion?: string;
  /**
   * When a computer of this account last asked the sign-in service for
   * anything — signing in, or renewing its hour-long token. "Last used
   * FluidEQ signed in", to within about an hour; nothing reports a heartbeat.
   */
  seenAt?: number;
}

const ACCOUNT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The address as the server compares it. */
export const accountAddress = (value: string) => value.trim().toLowerCase();

export const isAccountAddress = (value: string) =>
  validAccountEmail(accountAddress(value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const countOf = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined;

/** A time, `null` for a column the server left empty, undefined for garbage. */
const timeOf = (value: unknown) => {
  if (value === null) {
    return null;
  }
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};

const textOf = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/** One row of `admin_find_account`, or nothing when it is not one. */
export const parseAccountRow = (row: unknown): IAccountToDelete | undefined => {
  if (
    !isRecord(row) ||
    typeof row.user_id !== 'string' ||
    !ACCOUNT_ID.test(row.user_id) ||
    typeof row.email !== 'string' ||
    typeof row.confirmed !== 'boolean' ||
    typeof row.admin !== 'boolean' ||
    typeof row.gifted !== 'boolean' ||
    typeof row.deleting !== 'boolean'
  ) {
    return undefined;
  }
  const createdAt = timeOf(row.created_at);
  const plusUntil = timeOf(row.plus_until);
  const published = countOf(row.published);
  const boardDays = countOf(row.board_days);
  const likes = countOf(row.likes);
  const adds = countOf(row.adds);
  const reports = countOf(row.reports);
  if (
    createdAt === undefined ||
    plusUntil === undefined ||
    published === undefined ||
    boardDays === undefined ||
    likes === undefined ||
    adds === undefined ||
    reports === undefined
  ) {
    return undefined;
  }
  const handle = textOf(row.handle);
  const displayName = textOf(row.display_name);
  const plan = textOf(row.plan);
  // Both are read leniently on purpose: they arrive only from
  // `admin_list_accounts`, and a server that has not been migrated yet — or a
  // row for an account already gone, which has no session — simply says
  // nothing about either. A row is never dropped for their sake.
  const appVersion = textOf(row.app_version)?.slice(0, 32);
  const seenAt = timeOf(row.seen_at);
  return {
    userId: row.user_id,
    email: row.email,
    ...(createdAt !== null ? { createdAt } : {}),
    confirmed: row.confirmed,
    admin: row.admin,
    ...(handle ? { handle } : {}),
    ...(displayName ? { displayName } : {}),
    ...(plan && plusUntil !== null ? { plan, plusUntil } : {}),
    published,
    boardDays,
    likes,
    adds,
    reports,
    gifted: row.gifted,
    deleting: row.deleting,
    ...(appVersion ? { appVersion } : {}),
    ...(seenAt ? { seenAt } : {}),
  };
};
