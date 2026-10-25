/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseAccountRow, type IAccountToDelete } from './accountDeletion';
import type { ITrialExitCount } from './trialExit';

/**
 * Every account, for the admin (`admin_list_accounts` and
 * `admin_account_totals`, premium migration 0032): the row the address search
 * answers, a page at a time and newest first, with how many accounts the
 * search matches and how many of those have Plus. Who may ask is the server's
 * to say; this is only the shape on its way to the page.
 */

/**
 * Every account, only those with Plus now, only those without, only those on
 * a free trial — that one ending soonest first (premium migration 0049) — or
 * only those whose trial ended without Plus, the latest ended first (0054).
 */
export const ACCOUNT_PLAN_FILTERS = [
  'all',
  'plus',
  'free',
  'trial',
  'lapsed',
] as const;
export type TAccountPlanFilter = (typeof ACCOUNT_PLAN_FILTERS)[number];

/**
 * Which accounts by when they joined: all of them, or those since the start
 * of the admin's today, week or month (premium migration 0054).
 */
export const ACCOUNT_JOINED_WINDOWS = [
  'ever',
  'today',
  'week',
  'month',
] as const;
export type TAccountJoinedWindow = (typeof ACCOUNT_JOINED_WINDOWS)[number];

/**
 * When a window begins, on the admin's own calendar — the server's days are
 * UTC and his are not, so the instant is worked out here and sent. A week
 * starts on Monday, as ISO weeks do. Nothing for `ever`.
 */
export const joinedSince = (
  window: TAccountJoinedWindow,
  now: Date,
): number | undefined => {
  if (window === 'ever') {
    return undefined;
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (window === 'week') {
    // getDay(): Sunday is 0, so Sunday goes back six days to its Monday.
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (window === 'month') {
    start.setDate(1);
  }
  return start.getTime();
};

/**
 * The earliest window start the server is asked about: FluidEQ accounts began
 * in 2026, and anything before is a clock gone wrong, not a question.
 */
const EARLIEST_SINCE = Date.UTC(2025, 0, 1);

/** Accounts asked for at a time. */
export const ACCOUNT_LIST_PAGE = 50;

/** The longest search the server takes. */
export const MAX_ACCOUNT_QUERY = 100;

export interface IAccountListRequest {
  query: string;
  plan: TAccountPlanFilter;
  offset: number;
  /** Only accounts that joined at or after this instant (`joinedSince`). */
  since?: number;
}

export interface IAccountListPage {
  accounts: IAccountToDelete[];
  /** Accounts the search matches, whatever the filter. */
  matched: number;
  /** Of those, how many have Plus now. */
  paying: number;
  /** Accounts the filter leaves in all, so the page knows what is still to show. */
  listed: number;
  /**
   * Of the matched, how many are on a free trial and how many of those end
   * within a week. Absent from a server before premium migration 0049, which
   * the page says as a dash.
   */
  trialing?: number;
  trialsThisWeek?: number;
  /**
   * Of the matched, how many trials ended without Plus (0054), and — only
   * when that is the filter — what those members answered, reason by reason.
   */
  lapsed?: number;
  exitReasons?: ITrialExitCount[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const countOf = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined;

export const isAccountPlanFilter = (
  value: unknown,
): value is TAccountPlanFilter =>
  typeof value === 'string' &&
  (ACCOUNT_PLAN_FILTERS as readonly string[]).includes(value);

/** A request as the server would take it, or undefined for anything else. */
export const readAccountListRequest = (
  value: unknown,
): IAccountListRequest | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const { query, plan, offset, since } = value;
  if (
    typeof query !== 'string' ||
    query.length > MAX_ACCOUNT_QUERY ||
    !isAccountPlanFilter(plan) ||
    countOf(offset) === undefined
  ) {
    return undefined;
  }
  // A window starts in the past, at the latest a day ahead of this clock (a
  // window computed across a time zone change), and never before accounts.
  if (
    since !== undefined &&
    (typeof since !== 'number' ||
      !Number.isFinite(since) ||
      since < EARLIEST_SINCE ||
      since > Date.now() + 86_400_000)
  ) {
    return undefined;
  }
  return {
    query: query.trim(),
    plan,
    offset: offset as number,
    ...(since === undefined ? {} : { since }),
  };
};

/**
 * A page of `admin_list_accounts` with the totals beside it, or undefined
 * when any row does not read. A row is never skipped: a list quietly shorter
 * than the server's is the one answer this page must not give, because the
 * admin deletes accounts from it.
 */
export const parseAccountListPage = (
  rows: unknown,
  totals: unknown,
): IAccountListPage | undefined => {
  if (!Array.isArray(rows) || !Array.isArray(totals) || totals.length !== 1) {
    return undefined;
  }
  const [firstTotal]: unknown[] = totals;
  const counted = isRecord(firstTotal) ? firstTotal : {};
  const matched = countOf(counted.matched);
  const paying = countOf(counted.paying);
  const accounts = rows
    .map(parseAccountRow)
    .filter((account): account is IAccountToDelete => account !== undefined);
  const [first] = rows;
  const listed = isRecord(first) ? countOf(first.listed_count) : 0;
  if (
    matched === undefined ||
    paying === undefined ||
    listed === undefined ||
    accounts.length !== rows.length
  ) {
    return undefined;
  }
  const trialing = countOf(counted.trialing);
  const trialsThisWeek = countOf(counted.trials_this_week);
  const lapsed = countOf(counted.lapsed);
  return {
    accounts,
    matched,
    paying,
    listed,
    ...(trialing === undefined ? {} : { trialing }),
    ...(trialsThisWeek === undefined ? {} : { trialsThisWeek }),
    ...(lapsed === undefined ? {} : { lapsed }),
  };
};
