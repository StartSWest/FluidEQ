/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import type { TMakerMonthOutcome } from '../../../common/makerMonth';
import MakerMonthCard from '../../../renderer/account/MakerMonthCard';
import { resetMakerMonthStore } from '../../../renderer/plus/makerMonthStore';

/**
 * The account panel's maker card: the month publishing earned, the week's
 * warning before it ends, and — for somebody who is paying — the months
 * waiting rather than running, which is the line that says their subscription
 * is untouched.
 */

const ME = 'c0ffee00-1111-4222-8333-444455556666';
const DAY = 24 * 60 * 60 * 1000;

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const mockMonth = jest.fn<Promise<TMakerMonthOutcome>, []>();

beforeEach(() => {
  resetMakerMonthStore();
  mockMonth.mockReset();
  Object.assign(window, {
    electron: { ipcRenderer: { getMakerMonth: () => mockMonth() } },
  });
});

const answer = (
  over: Partial<TMakerMonthOutcome & { month: unknown }> = {},
) => {
  mockMonth.mockResolvedValue({
    ok: true,
    month: {
      running: true,
      waiting: 0,
      earnedThisMonth: false,
      submissions: 0,
      allowed: 2,
      rejections: 0,
      refusalsAllowed: 2,
      maker: false,
      ...(over as { month?: Record<string, unknown> }).month,
    },
    ...(over.ok === false ? over : {}),
  } as TMakerMonthOutcome);
};

const show = async () => {
  render(<MakerMonthCard accountId={ME} />);
  await waitFor(() => expect(mockMonth).toHaveBeenCalled());
};

/**
 * A fixed "now" for the tests that turn on this computer's calendar.
 *
 * The card reads the clock when it draws, so a date a test built from the
 * clock a moment earlier can be on the other side of midnight by then. Both
 * ways it has failed: "+12 hours" was still today before local noon, so the
 * tomorrow test passed every afternoon run here and failed the cold build,
 * which starts at 01:00 UTC; and "tonight at 23:59" was already the past for
 * a full run that reached the last-day test at 23:59, so the card said the
 * month had ended (2026-09-24). A pinned noon on a fixed day is as far from
 * either midnight as a day allows, in every time zone, whenever the suite
 * runs.
 */
const NOON = new Date(2026, 8, 25, 12, 0, 0, 0).getTime();
let pinnedClock: jest.SpyInstance<number, []> | undefined;
const pinNow = () => {
  pinnedClock = jest.spyOn(Date, 'now').mockReturnValue(NOON);
};
afterEach(() => {
  pinnedClock?.mockRestore();
  pinnedClock = undefined;
});

test('a running month says when Plus is free until, and nothing about ending', async () => {
  answer({ month: { until: new Date(Date.now() + 20 * DAY).toISOString() } });
  await show();

  await waitFor(() =>
    expect(screen.getByText(/account\.maker\.until:/)).toBeInTheDocument(),
  );
  expect(
    screen.queryByText(/account\.maker\.endsDays/),
  ).not.toBeInTheDocument();
  expect(screen.getByText('account.maker.keep')).toBeInTheDocument();
});

test('the last week counts the days down and asks for a scene', async () => {
  answer({ month: { until: new Date(Date.now() + 3 * DAY).toISOString() } });
  await show();

  await waitFor(() =>
    expect(screen.getByText('account.maker.endsDays:3')).toBeInTheDocument(),
  );
});

test('tomorrow is said as tomorrow, not as one day', async () => {
  // Tomorrow at six in the morning: less than a day away, so the counter
  // rounds up to 1, and not today's date.
  pinNow();
  answer({
    month: { until: new Date(NOON + 18 * 60 * 60 * 1000).toISOString() },
  });
  await show();

  await waitFor(() =>
    expect(screen.getByText('account.maker.endsTomorrow')).toBeInTheDocument(),
  );
});

test('a paying maker is told the months are waiting, not running', async () => {
  answer({ month: { waiting: 2, earnedThisMonth: true } });
  await show();

  await waitFor(() =>
    expect(screen.getByText('account.maker.waitingMany:2')).toBeInTheDocument(),
  );
  // No date, because no month of theirs is running yet.
  expect(screen.queryByText(/account\.maker\.until/)).not.toBeInTheDocument();
  expect(screen.getByText('account.maker.kept')).toBeInTheDocument();
});

test('one waiting month is said in the singular', async () => {
  answer({ month: { waiting: 1 } });
  await show();

  await waitFor(() =>
    expect(screen.getByText('account.maker.waitingOne:1')).toBeInTheDocument(),
  );
});

test('somebody who has never published is invited, and a past maker is asked again', async () => {
  answer({ month: { maker: false } });
  await show();
  await waitFor(() =>
    expect(screen.getByText('account.maker.invite')).toBeInTheDocument(),
  );

  resetMakerMonthStore();
  mockMonth.mockReset();
  answer({ month: { maker: true } });
  render(<MakerMonthCard accountId={ME} />);
  await waitFor(() =>
    expect(screen.getByText('account.maker.again')).toBeInTheDocument(),
  );
});

test('a month that has ended says so, and asks for the next scene', async () => {
  // The server reports a month that is over rather than nothing at all, so
  // the card can tell "your Plus ran out" from "you have never earned one".
  answer({
    month: {
      until: new Date(Date.now() - 2 * DAY).toISOString(),
      running: false,
      maker: true,
    },
  });
  await show();

  await waitFor(() =>
    expect(screen.getByText('account.maker.again')).toBeInTheDocument(),
  );
  // Nothing that would read as still running: no badge, no date, no
  // countdown.
  expect(screen.queryByText('account.maker.badge')).not.toBeInTheDocument();
  expect(screen.queryByText(/account\.maker\.until/)).not.toBeInTheDocument();
  expect(screen.queryByText(/account\.maker\.ends/)).not.toBeInTheDocument();
});

test('a maker who is paying is told the next month joins the queue', async () => {
  // Their subscription is untouched and their months are banked, so "free
  // again" would be describing something that never stopped.
  answer({ month: { waiting: 2, maker: true } });
  await show();

  await waitFor(() =>
    expect(screen.getByText('account.maker.againWaiting')).toBeInTheDocument(),
  );
  expect(screen.queryByText('account.maker.again')).not.toBeInTheDocument();
});

test('the last day is said as today, not as tomorrow', async () => {
  // Tonight at 23:59, seen from noon of the same day: "tomorrow" on the day
  // a month ends is a day that does not exist.
  pinNow();
  const tonight = new Date(NOON);
  tonight.setHours(23, 59, 0, 0);
  answer({ month: { until: tonight.toISOString(), maker: true } });
  await show();

  await waitFor(() =>
    expect(screen.getByText('account.maker.endsToday')).toBeInTheDocument(),
  );
  expect(
    screen.queryByText('account.maker.endsTomorrow'),
  ).not.toBeInTheDocument();
});

test('a failure shows nothing at all rather than a wrong month', async () => {
  mockMonth.mockResolvedValue({ ok: false, reason: 'offline' });
  render(<MakerMonthCard accountId={ME} />);
  await waitFor(() => expect(mockMonth).toHaveBeenCalled());

  expect(screen.queryByText(/account\.maker/)).not.toBeInTheDocument();
});
