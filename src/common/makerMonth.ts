/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The month a maker earns by publishing.
 *
 * One scene approved in a calendar month earns one month of Plus (server
 * migration 0041). Months are counted rather than dated: somebody who is
 * already paying keeps paying and their earned months wait, so this can never
 * collide with a live subscription. Nothing renews a month that has started,
 * so the app says when it ends rather than letting it stop silently — a week
 * before, and on the day.
 *
 * The server is the only clock that matters here. Everything in this file
 * reads its answer.
 */

export interface IMakerMonth {
  /** When the month now running runs out. Absent while none is running. */
  until?: string;
  /** Months earned and not started yet, because something else covers them. */
  waiting: number;
  /** Whether this calendar month already has its approved scene. */
  earnedThisMonth: boolean;
  /** The scene that earned it, when one has. */
  scene?: string;
  /** Sent for review this month, and how many the month allows. */
  submissions: number;
  allowed: number;
  /** Refused this month, and how many refusals cost the month its reward. */
  rejections: number;
  refusalsAllowed: number;
  /**
   * Whether a scene of theirs has ever been approved. It is what keeps the
   * way back in open: a maker whose months have run out may still make and
   * send the next one.
   */
  maker: boolean;
}

export type TMakerMonthFailure = 'signed-out' | 'offline' | 'server';

export type TMakerMonthOutcome =
  { ok: true; month: IMakerMonth } | { ok: false; reason: TMakerMonthFailure };

/** A week's notice, which is also what the account panel counts down. */
export const MAKER_MONTH_WARNING_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;

const moment = (value: unknown): string | undefined =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : undefined;

/**
 * The server's answer, rebuilt from only the parts that make sense. A server
 * from before the earned month answers nothing, which reads as a member who
 * has never published — which is what it was.
 */
export const parseMakerMonth = (value: unknown): IMakerMonth | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const scene =
    typeof value.scene === 'string' &&
    /^[a-z][a-z0-9-]{1,47}$/.test(value.scene)
      ? value.scene
      : undefined;
  const until = moment(value.until);
  return {
    ...(until ? { until } : {}),
    waiting: count(value.waiting),
    earnedThisMonth: value.earnedThisMonth === true,
    ...(scene ? { scene } : {}),
    submissions: count(value.submissions),
    allowed: Math.max(1, count(value.allowed) || 2),
    rejections: count(value.rejections),
    refusalsAllowed: Math.max(1, count(value.refusalsAllowed) || 2),
    maker: value.maker === true,
  };
};

/**
 * How the earned month reads at this moment:
 * - `none`: nothing earned, so nothing to say.
 * - `running`: earned, and more than a week left.
 * - `ending`: a week or less. This is what the notice is for.
 * - `ended`: it ran out; publishing again brings it back.
 */
export type TMakerMonthState = 'none' | 'running' | 'ending' | 'ended';

export const makerMonthState = (
  month: IMakerMonth | undefined,
  now: number,
): TMakerMonthState => {
  if (!month?.until) {
    return 'none';
  }
  const left = Date.parse(month.until) - now;
  if (left <= 0) {
    return 'ended';
  }
  return left <= MAKER_MONTH_WARNING_DAYS * DAY_MS ? 'ending' : 'running';
};

/**
 * Whole days left, rounded up: eighteen hours is "1 day", not "0". Nobody is
 * told their month ends today while it still has a night to run.
 */
export const makerMonthDaysLeft = (
  month: IMakerMonth | undefined,
  now: number,
): number => {
  if (!month?.until) {
    return 0;
  }
  return Math.max(0, Math.ceil((Date.parse(month.until) - now) / DAY_MS));
};

/** Submissions left before the month's allowance is spent. */
export const makerMonthLeft = (month: IMakerMonth): number =>
  Math.max(0, month.allowed - month.submissions);

/**
 * Whether this month can still earn the next one. Two refusals cost the
 * month its reward — the rule that stops the queue being used as a lottery.
 */
export const makerMonthCanEarn = (month: IMakerMonth): boolean =>
  !month.earnedThisMonth &&
  month.rejections < month.refusalsAllowed &&
  makerMonthLeft(month) > 0;
