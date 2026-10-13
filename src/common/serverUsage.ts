/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How full the server is, for the admin's Server page (premium migration
 * 0053 and the `admin-server-usage` function), against what Supabase's free
 * plan allows.
 *
 * The free plan has no end date: what ends it is going past one of its
 * limits — after an email and a grace period, requests are answered with
 * "payment required" until the next billing cycle or an upgrade — or seven
 * days without a single request, which pauses the project. FluidEQ's own
 * traffic keeps it from ever being idle that long.
 */

const MB = 1024 * 1024;
const GB = 1024 * MB;

/**
 * The free plan's limits, as supabase.com/pricing gives them (read
 * 2026-10-12). Requests are unlimited, so the page counts them without a
 * ceiling; data sent (egress) is only on Supabase's own usage page.
 */
export const FREE_PLAN = {
  databaseBytes: 500 * MB,
  storageBytes: 1 * GB,
  activeAccounts: 50_000,
  egressBytes: 5 * GB,
  idleDays: 7,
} as const;

export interface IServerTable {
  /** `schema.table`, as Postgres names it. */
  name: string;
  bytes: number;
}

export interface IServerBucket {
  bucket: string;
  files: number;
  bytes: number;
}

export interface IServerUsage {
  databaseBytes: number;
  /** The largest tables, largest first. */
  tables: IServerTable[];
  /** Every storage bucket, largest first. */
  buckets: IServerBucket[];
  accounts: number;
  /** Accounts the sign-in service saw in the last 30 days. */
  activeAccounts: number;
  measuredAt: number;
  /**
   * The project's page on supabase.com, where the data sent each month is
   * shown; main adds it, the server does not know it.
   */
  dashboardUrl?: string;
}

export type TRequestKind = 'rest' | 'auth' | 'storage' | 'realtime';

export const REQUEST_KINDS: readonly TRequestKind[] = [
  'rest',
  'auth',
  'storage',
  'realtime',
];

export interface IRequestPoint extends Record<TRequestKind, number> {
  at: number;
}

/**
 * The week's requests, or why there are none to show: the server has no
 * usage token yet (`unconfigured`), or the management API refused the one it
 * has (`token`).
 */
export type TRequestUsage =
  | { state: 'ready'; points: IRequestPoint[] }
  | { state: 'unconfigured' }
  | { state: 'token' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;

const listOf = <T>(
  value: unknown,
  read: (entry: unknown) => T | undefined,
): T[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const entries = value.map(read);
  return entries.every((entry) => entry !== undefined)
    ? (entries as T[])
    : undefined;
};

const tableOf = (entry: unknown): IServerTable | undefined => {
  if (!isRecord(entry) || typeof entry.name !== 'string') {
    return undefined;
  }
  const bytes = count(entry.bytes);
  return bytes === undefined ? undefined : { name: entry.name, bytes };
};

const bucketOf = (entry: unknown): IServerBucket | undefined => {
  if (!isRecord(entry) || typeof entry.bucket !== 'string') {
    return undefined;
  }
  const files = count(entry.files);
  const bytes = count(entry.bytes);
  return files === undefined || bytes === undefined
    ? undefined
    : { bucket: entry.bucket, files, bytes };
};

/** `admin_server_usage`'s answer, or nothing for one that does not read. */
export const parseServerUsage = (json: unknown): IServerUsage | undefined => {
  if (!isRecord(json)) {
    return undefined;
  }
  const databaseBytes = count(json.database_bytes);
  const accounts = count(json.accounts);
  const activeAccounts = count(json.active_accounts);
  const measuredAt =
    typeof json.measured_at === 'string'
      ? Date.parse(json.measured_at)
      : Number.NaN;
  const tables = listOf(json.tables, tableOf);
  const buckets = listOf(json.buckets, bucketOf);
  if (
    databaseBytes === undefined ||
    accounts === undefined ||
    activeAccounts === undefined ||
    !Number.isFinite(measuredAt) ||
    !tables ||
    !buckets
  ) {
    return undefined;
  }
  return {
    databaseBytes,
    tables,
    buckets,
    accounts,
    activeAccounts,
    measuredAt,
  };
};

const pointOf = (entry: unknown): IRequestPoint | undefined => {
  if (!isRecord(entry)) {
    return undefined;
  }
  const at = count(entry.at);
  const counts = REQUEST_KINDS.map((kind) => count(entry[kind]));
  if (at === undefined || counts.some((value) => value === undefined)) {
    return undefined;
  }
  const [rest, auth, storage, realtime] = counts as number[];
  return { at, rest, auth, storage, realtime };
};

/** The `admin-server-usage` function's answer, or nothing for one that does not read. */
export const parseRequestUsage = (json: unknown): TRequestUsage | undefined => {
  if (!isRecord(json)) {
    return undefined;
  }
  if (json.configured === false) {
    return { state: 'unconfigured' };
  }
  if (json.configured === true && json.error === 'token') {
    return { state: 'token' };
  }
  if (json.configured !== true || json.error !== undefined) {
    return undefined;
  }
  const points = listOf(json.points, pointOf);
  return points ? { state: 'ready', points } : undefined;
};

/** Every request of the week, of one kind or all of them. */
export const requestTotal = (
  points: readonly IRequestPoint[],
  kind?: TRequestKind,
): number =>
  points.reduce(
    (sum, point) =>
      sum +
      (kind
        ? point[kind]
        : REQUEST_KINDS.reduce((all, each) => all + point[each], 0)),
    0,
  );

/** How full a limit is, from 0 to 1 (and past 1 once it is exceeded). */
export const shareOf = (used: number, limit: number): number =>
  limit > 0 ? used / limit : 0;
