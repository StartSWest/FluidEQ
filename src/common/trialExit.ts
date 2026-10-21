/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Why a member whose free trial ended did not take Plus (premium migration
 * 0054): one answer per account, a choice from this list and an optional
 * note. Nobody is asked any more — no trial is offered — and what is here
 * reads the answers already given, for the admin's account list.
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
