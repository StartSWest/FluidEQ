/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Why a member whose free trial ended did not take Plus (premium migration
 * 0054): one answer per account, a choice from this list and an optional
 * note. The server holds the same list in `trial_exit_reasons` and
 * `report_trial_exit`; a reason is added to both in one release.
 *
 * Ivan, 2026-10-16: "we need to collect a reason why they didn't join Plus".
 */
export const TRIAL_EXIT_REASONS = [
  'price',
  'not-enough',
  'free-is-enough',
  'no-time',
  'problems',
  'payment',
  'other',
] as const;

export type TTrialExitReason = (typeof TRIAL_EXIT_REASONS)[number];

/** The note's longest, as the server keeps it. */
export const MAX_TRIAL_EXIT_NOTE = 500;

export const isTrialExitReason = (value: unknown): value is TTrialExitReason =>
  typeof value === 'string' &&
  (TRIAL_EXIT_REASONS as readonly string[]).includes(value);

/** What this member is asked: whether at all, and what they already said. */
export interface ITrialExitStatus {
  asked: boolean;
  reason?: TTrialExitReason;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `my_trial_exit`'s one row, or undefined when it is not one. */
export const parseTrialExitStatus = (
  rows: unknown,
): ITrialExitStatus | undefined => {
  const first: unknown = Array.isArray(rows) ? rows[0] : undefined;
  if (!isRecord(first) || typeof first.asked !== 'boolean') {
    return undefined;
  }
  if (first.reason !== null && !isTrialExitReason(first.reason)) {
    return undefined;
  }
  return {
    asked: first.asked,
    ...(isTrialExitReason(first.reason) ? { reason: first.reason } : {}),
  };
};

/** An answer as the server takes it, or undefined for anything else. */
export const readTrialExitAnswer = (
  reason: unknown,
  note: unknown,
): { reason: TTrialExitReason; note?: string } | undefined => {
  if (!isTrialExitReason(reason)) {
    return undefined;
  }
  if (note !== undefined && typeof note !== 'string') {
    return undefined;
  }
  const trimmed = note?.trim();
  if (trimmed && trimmed.length > MAX_TRIAL_EXIT_NOTE) {
    return undefined;
  }
  return { reason, ...(trimmed ? { note: trimmed } : {}) };
};

/** One line of the admin's breakdown: a reason, or nobody having said. */
export interface ITrialExitCount {
  reason: TTrialExitReason | 'none';
  answers: number;
}

/** `admin_trial_exit_reasons`, or undefined when any row does not read. */
export const parseTrialExitCounts = (
  rows: unknown,
): ITrialExitCount[] | undefined => {
  if (!Array.isArray(rows)) {
    return undefined;
  }
  const counts = rows.flatMap((row: unknown): ITrialExitCount[] => {
    if (
      !isRecord(row) ||
      typeof row.answers !== 'number' ||
      !Number.isInteger(row.answers) ||
      row.answers < 0 ||
      !(row.reason === 'none' || isTrialExitReason(row.reason))
    ) {
      return [];
    }
    return [{ reason: row.reason, answers: row.answers }];
  });
  return counts.length === rows.length ? counts : undefined;
};
