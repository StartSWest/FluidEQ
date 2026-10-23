/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * The admin's listening figures as the server sends them (premium 0068), and
 * the chart's days and axis drawn from them.
 */

import {
  averageMinutes,
  chartDays,
  minutesAxis,
  parseAdminListening,
  type IAdminListening,
} from '../../../common/listening';

const answer = {
  days: [
    { day: '2026-10-20', listeners: 2, minutes: 150 },
    { day: '2026-10-19', listeners: 1, minutes: 30 },
  ],
  listeners: 2,
  minutes: 180,
  listenerDays: 3,
  accounts: 9,
  sharing: 4,
  declined: 1,
};

describe('what the server says about listening', () => {
  it('reads an answer, oldest day first', () => {
    const read = parseAdminListening(answer);
    expect(read?.days.map((day) => day.day)).toEqual([
      '2026-10-19',
      '2026-10-20',
    ]);
    expect(read).toMatchObject({ minutes: 180, sharing: 4, declined: 1 });
  });

  it('refuses an answer that does not read, rather than drawing zeros', () => {
    expect(parseAdminListening(null)).toBeUndefined();
    expect(
      parseAdminListening({ ...answer, sharing: undefined }),
    ).toBeUndefined();
    expect(parseAdminListening({ ...answer, minutes: -1 })).toBeUndefined();
    expect(
      parseAdminListening({
        ...answer,
        days: [{ day: 'yesterday', listeners: 1, minutes: 1 }],
      }),
    ).toBeUndefined();
  });

  it('takes an ordinary day over the days people listened', () => {
    expect(averageMinutes(parseAdminListening(answer) as IAdminListening)).toBe(
      60,
    );
    expect(
      averageMinutes({ ...(answer as IAdminListening), listenerDays: 0 }),
    ).toBe(0);
  });
});

describe('the chart', () => {
  const listening = parseAdminListening(answer) as IAdminListening;

  it('draws every day of the period, the quiet ones as nothing, ending today', () => {
    const days = chartDays(listening, 7, '2026-10-21');
    expect(days).toHaveLength(7);
    expect(days[0].day).toBe('2026-10-15');
    expect(days[6]).toEqual({ day: '2026-10-21', listeners: 0, minutes: 0 });
    expect(days[5]).toEqual(answer.days[0]);
  });

  it('crosses a month and a year', () => {
    const days = chartDays(listening, 30, '2026-01-02');
    expect(days[0].day).toBe('2025-12-04');
    expect(days).toHaveLength(30);
  });

  it('starts "all time" at the first day anybody listened, not a decade back', () => {
    const days = chartDays(listening, 3650, '2026-10-21');
    expect(days.map((day) => day.day)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
    ]);
    expect(
      chartDays({ ...listening, days: [] }, 3650, '2026-10-21'),
    ).toHaveLength(1);
  });

  it('puts four or so gridlines on a step a person reads', () => {
    expect(minutesAxis(150)).toEqual([60, 120, 180]);
    expect(minutesAxis(7)).toEqual([2, 4, 6, 8]);
    expect(minutesAxis(1)).toEqual([1]);
    const big = minutesAxis(5000);
    expect(big.length).toBeLessThanOrEqual(5);
    expect(big[big.length - 1]).toBeGreaterThanOrEqual(5000);
  });
});
