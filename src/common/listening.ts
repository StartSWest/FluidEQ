/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TFavouritePeriod } from './sceneTaste';

/**
 * How long people listen, for the admin (premium migration 0068).
 *
 * The leaderboard went on 2026-10-21 and its numbers stayed as statistics
 * only the admin reads (Ivan: "so I can see how long people uses the app").
 * Every signed-in account that has been told and has not switched it off
 * sends one number a day per computer — the whole minutes music played —
 * and the admin sees totals per day, never a person.
 */

/**
 * How many days a computer keeps and the server still takes, and the most a
 * day may count — a computer left playing overnight is not somebody
 * listening. The server holds the same two numbers (0010, 0068).
 */
export const LISTENING_WINDOW_DAYS = 14;
// Literals, so the site's terms importer can read them.
export const LISTENING_DAY_CAP_HOURS = 16;
export const LISTENING_DAY_CAP_MINUTES = LISTENING_DAY_CAP_HOURS * 60;

/**
 * Where an account stands, as the window draws it.
 *
 * `unasked` is the one that puts the notice up: the server has no answer on
 * record, and nothing is counted until there is one. `unknown` is the server
 * not reached yet — nothing is asked on screen then either, because asking
 * an account that already answered on another computer would be wrong.
 */
export type TListeningChoice = 'unknown' | 'unasked' | 'sharing' | 'off';

export interface IListeningStatus {
  signedIn: boolean;
  choice: TListeningChoice;
  /** Whole minutes counted today on this computer, for this account. */
  todayMinutes: number;
}

export const SIGNED_OUT_LISTENING: IListeningStatus = {
  signedIn: false,
  choice: 'unknown',
  todayMinutes: 0,
};

export type TListeningFailure = 'offline' | 'signed-out' | 'server';

export type TListeningOutcome =
  | { ok: true; status: IListeningStatus }
  | { ok: false; reason: TListeningFailure; status: IListeningStatus };

export interface IListeningDay {
  /** The listener's own calendar day, `YYYY-MM-DD`. */
  day: string;
  listeners: number;
  minutes: number;
}

export interface IAdminListening {
  /** Only the days somebody listened, oldest first. */
  days: IListeningDay[];
  /** Different accounts that listened in the period. */
  listeners: number;
  minutes: number;
  /** Account-days with listening: what an average day is taken over. */
  listenerDays: number;
  /** Every account but the admin's and the banned ones. */
  accounts: number;
  /** Of those, how many said yes and how many switched it off. */
  sharing: number;
  declined: number;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined;

const readDay = (value: unknown): IListeningDay | undefined => {
  if (!isRecord(value) || typeof value.day !== 'string') {
    return undefined;
  }
  const listeners = count(value.listeners);
  const minutes = count(value.minutes);
  return DAY_KEY.test(value.day) &&
    listeners !== undefined &&
    minutes !== undefined
    ? { day: value.day, listeners, minutes }
    : undefined;
};

/** The server's answer to `admin_listening`, or undefined for one that does not read. */
export const parseAdminListening = (
  json: unknown,
): IAdminListening | undefined => {
  if (!isRecord(json) || !Array.isArray(json.days)) {
    return undefined;
  }
  const days = json.days.map(readDay);
  const totals = [
    count(json.listeners),
    count(json.minutes),
    count(json.listenerDays),
    count(json.accounts),
    count(json.sharing),
    count(json.declined),
  ];
  if (
    days.some((day) => day === undefined) ||
    totals.some((total) => total === undefined)
  ) {
    return undefined;
  }
  const [listeners, minutes, listenerDays, accounts, sharing, declined] =
    totals as number[];
  return {
    // `YYYY-MM-DD` sorts as text in calendar order.
    days: (days as IListeningDay[]).sort((a, b) => a.day.localeCompare(b.day)),
    listeners,
    minutes,
    listenerDays,
    accounts,
    sharing,
    declined,
  };
};

/** `YYYY-MM-DD` for a calendar date in UTC arithmetic, which has no DST. */
const keyOfUtc = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Every day of the chart, the quiet ones too, oldest first: a gap drawn as
 * nothing reads as a day that never happened, and a run of them is exactly
 * what the admin is looking for.
 *
 * The period's days end at `today`; "all time" starts at the first day
 * anybody listened, so it is not a decade of empty columns.
 */
export const chartDays = (
  listening: IAdminListening,
  period: TFavouritePeriod,
  today: string,
): IListeningDay[] => {
  if (!DAY_KEY.test(today)) {
    return listening.days;
  }
  const end = new Date(`${today}T00:00:00Z`);
  const first = listening.days[0]?.day;
  const start = new Date(end);
  if (period > 365) {
    if (first) {
      start.setTime(
        Math.min(new Date(`${first}T00:00:00Z`).getTime(), end.getTime()),
      );
    }
  } else {
    start.setUTCDate(start.getUTCDate() - (period - 1));
  }
  const byDay = new Map(listening.days.map((day) => [day.day, day]));
  const filled: IListeningDay[] = [];
  for (
    const cursor = new Date(start);
    cursor.getTime() <= end.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const key = keyOfUtc(cursor);
    filled.push(byDay.get(key) ?? { day: key, listeners: 0, minutes: 0 });
  }
  return filled;
};

/** Minutes per listener on a day they listened: the figure that says "a lot". */
export const averageMinutes = (listening: IAdminListening): number =>
  listening.listenerDays > 0 ? listening.minutes / listening.listenerDays : 0;

/** Steps a minutes axis reads in: a few minutes up to whole days of hours. */
const STEPS = [
  1, 2, 5, 10, 15, 30, 60, 120, 180, 300, 600, 1200, 1800, 3000, 6000, 12000,
  30000, 60000,
];

/** Four or so gridlines over the busiest day, on a step a person reads. */
export const minutesAxis = (most: number): number[] => {
  const step =
    STEPS.find((candidate) => candidate * 4 >= most) ?? STEPS[STEPS.length - 1];
  const top = Math.max(step, Math.ceil(most / step) * step);
  const ticks: number[] = [];
  for (let value = step; value <= top; value += step) {
    ticks.push(value);
  }
  return ticks;
};
