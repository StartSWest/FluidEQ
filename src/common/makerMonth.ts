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
  /**
   * When the month that was started runs out. A moment in the past is a
   * month that has ended — the server reports it so the app can say so
   * rather than showing nothing, which reads as "you never had one".
   */
  until?: string;
  /**
   * Whether that moment is still ahead, by the SERVER's clock. Which is the
   * one that decides: the entitlement is written against it, and a computer
   * whose clock is a day out would otherwise be told its month ended while
   * Plus was still on, or the reverse.
   */
  running: boolean;
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
  | {
      ok: true;
      month: IMakerMonth;
      /**
       * The server answered something this could not read, and the month
       * below is the app's own stand-in for "nothing to say" rather than
       * anything the server said. Safe to show; never to act on — taken as
       * an answer it says this account is not a maker, which would shut the
       * Studio on one mid-scene.
       */
      guessed?: true;
    }
  | { ok: false; reason: TMakerMonthFailure };

/**
 * What the entitlement's `plan` says when the access is an earned month
 * (server migration 0041). Like a trial and unlike a subscription: nothing
 * renews it, there is no merchant page for it, and the app must never offer
 * to manage it.
 */
export const MAKER_PLAN = 'maker';

/** A week's notice, which is also what the account panel counts down. */
export const MAKER_MONTH_WARNING_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;

/**
 * An instant, spelled the one way the server spells it. `Date.parse` alone
 * takes "December 17, 1995" and "2026-09-20" — one of them local midnight,
 * the other implementation's choice — and every date shown here would then
 * depend on which the server happened to send.
 */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})$/;

const moment = (value: unknown): string | undefined =>
  typeof value === 'string' &&
  ISO_INSTANT.test(value) &&
  Number.isFinite(Date.parse(value))
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
    // A server from before this answered no `running` at all, and what it
    // sent was only ever a month still going.
    running: until !== undefined && value.running !== false,
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
  // The server's word on whether it is over; this clock only for how long is
  // left, where being an hour out changes nothing anybody reads.
  if (!month.running || left <= 0) {
    return 'ended';
  }
  return left <= MAKER_MONTH_WARNING_DAYS * DAY_MS ? 'ending' : 'running';
};

/**
 * Whether the month runs out before tonight — this computer's tonight, which
 * is the one the reader is living in. "Tomorrow" on the morning of the last
 * day is a day that does not exist.
 */
export const makerMonthEndsToday = (
  month: IMakerMonth | undefined,
  now: number,
): boolean => {
  if (!month?.until) {
    return false;
  }
  const ends = new Date(Date.parse(month.until));
  const today = new Date(now);
  return (
    ends.getFullYear() === today.getFullYear() &&
    ends.getMonth() === today.getMonth() &&
    ends.getDate() === today.getDate()
  );
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
