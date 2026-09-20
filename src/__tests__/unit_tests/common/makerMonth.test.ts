/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAKER_MONTH_WARNING_DAYS,
  makerMonthCanEarn,
  makerMonthDaysLeft,
  makerMonthLeft,
  makerMonthState,
  parseMakerMonth,
  type IMakerMonth,
} from '../../../common/makerMonth';

const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const month = (over: Partial<IMakerMonth> = {}): IMakerMonth => ({
  waiting: 0,
  earnedThisMonth: false,
  submissions: 0,
  allowed: 2,
  rejections: 0,
  refusalsAllowed: 2,
  maker: false,
  ...over,
});

describe('the server’s answer', () => {
  it('reads a month as the server sends it', () => {
    expect(
      parseMakerMonth({
        until: '2026-11-01T00:00:00.000Z',
        waiting: 2,
        earnedThisMonth: true,
        scene: 'neon-city',
        submissions: 1,
        rejections: 0,
        allowed: 2,
        refusalsAllowed: 2,
        maker: true,
      }),
    ).toEqual({
      until: '2026-11-01T00:00:00.000Z',
      waiting: 2,
      earnedThisMonth: true,
      scene: 'neon-city',
      submissions: 1,
      rejections: 0,
      allowed: 2,
      refusalsAllowed: 2,
      maker: true,
    });
  });

  it.each([
    ['a date that is not a date', { until: 'soon' }],
    ['a scene id that is not an id', { scene: '../../etc' }],
    ['counts that are not counts', { waiting: -3, submissions: 'two' }],
  ])('drops %s rather than showing it', (_label, over) => {
    const parsed = parseMakerMonth({ earnedThisMonth: false, ...over });
    expect(parsed).toBeDefined();
    expect(parsed).not.toHaveProperty('until');
    expect(parsed).not.toHaveProperty('scene');
    expect(parsed?.waiting).toBe(0);
    expect(parsed?.submissions).toBe(0);
  });

  // The control: a server from before any of this answers something else,
  // and an account that has never published reads exactly the same way.
  it('is nothing at all when the answer is not an object', () => {
    expect(parseMakerMonth('no such function')).toBeUndefined();
    expect(parseMakerMonth(null)).toBeUndefined();
  });

  it('never invents an allowance of zero', () => {
    const parsed = parseMakerMonth({ allowed: 0, refusalsAllowed: 0 });
    expect(parsed?.allowed).toBe(2);
    expect(parsed?.refusalsAllowed).toBe(2);
  });
});

describe('how the month reads', () => {
  it('is nothing when none is running', () => {
    expect(makerMonthState(month(), NOW)).toBe('none');
    expect(makerMonthState(undefined, NOW)).toBe('none');
    expect(makerMonthDaysLeft(month(), NOW)).toBe(0);
  });

  it('is ending only inside the last week, which is when the app says so', () => {
    const inDays = (days: number) =>
      month({ until: new Date(NOW + days * DAY).toISOString() });
    expect(makerMonthState(inDays(20), NOW)).toBe('running');
    expect(makerMonthState(inDays(MAKER_MONTH_WARNING_DAYS + 0.5), NOW)).toBe(
      'running',
    );
    expect(makerMonthState(inDays(MAKER_MONTH_WARNING_DAYS), NOW)).toBe(
      'ending',
    );
    expect(makerMonthState(inDays(1), NOW)).toBe('ending');
    expect(makerMonthState(inDays(-1), NOW)).toBe('ended');
  });

  // Eighteen hours is one more day, not none: nobody is told their month ends
  // today while it still has a night to run.
  it('counts the days up, never down', () => {
    expect(
      makerMonthDaysLeft(
        month({ until: new Date(NOW + 18 * 60 * 60 * 1000).toISOString() }),
        NOW,
      ),
    ).toBe(1);
    expect(
      makerMonthDaysLeft(
        month({ until: new Date(NOW + 6 * DAY + 60_000).toISOString() }),
        NOW,
      ),
    ).toBe(7);
  });
});

describe('what is left of this month', () => {
  it('counts the sends left', () => {
    expect(makerMonthLeft(month({ submissions: 0 }))).toBe(2);
    expect(makerMonthLeft(month({ submissions: 2 }))).toBe(0);
    expect(makerMonthLeft(month({ submissions: 5 }))).toBe(0);
  });

  it('can still earn until the allowance or the refusals are spent', () => {
    expect(makerMonthCanEarn(month())).toBe(true);
    expect(makerMonthCanEarn(month({ submissions: 1 }))).toBe(true);
    expect(makerMonthCanEarn(month({ submissions: 2 }))).toBe(false);
    expect(makerMonthCanEarn(month({ rejections: 2 }))).toBe(false);
    // Already earned: another scene this month adds nothing.
    expect(makerMonthCanEarn(month({ earnedThisMonth: true }))).toBe(false);
  });
});
