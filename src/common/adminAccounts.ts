/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseAccountRow, type IAccountToDelete } from './accountDeletion';

/**
 * Every account, for the admin (`admin_list_accounts` and
 * `admin_account_totals`, premium migration 0032): the row the address search
 * answers, a page at a time and newest first, with how many accounts the
 * search matches and how many of those have Plus. Who may ask is the server's
 * to say; this is only the shape on its way to the page.
 */

/** Every account, only those with Plus now, or only those without. */
export const ACCOUNT_PLAN_FILTERS = ['all', 'plus', 'free'] as const;
export type TAccountPlanFilter = (typeof ACCOUNT_PLAN_FILTERS)[number];

/** Accounts asked for at a time. */
export const ACCOUNT_LIST_PAGE = 50;

/** The longest search the server takes. */
export const MAX_ACCOUNT_QUERY = 100;

export interface IAccountListRequest {
  query: string;
  plan: TAccountPlanFilter;
  offset: number;
}

export interface IAccountListPage {
  accounts: IAccountToDelete[];
  /** Accounts the search matches, whatever the filter. */
  matched: number;
  /** Of those, how many have Plus now. */
  paying: number;
  /** Accounts the filter leaves in all, so the page knows what is still to show. */
  listed: number;
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
  const { query, plan, offset } = value;
  if (
    typeof query !== 'string' ||
    query.length > MAX_ACCOUNT_QUERY ||
    !isAccountPlanFilter(plan) ||
    countOf(offset) === undefined
  ) {
    return undefined;
  }
  return { query: query.trim(), plan, offset: offset as number };
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
  const [counted] = totals;
  const matched = isRecord(counted) ? countOf(counted.matched) : undefined;
  const paying = isRecord(counted) ? countOf(counted.paying) : undefined;
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
  return { accounts, matched, paying, listed };
};
