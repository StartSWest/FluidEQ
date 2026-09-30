/**
 * The clock's time of day for a scene (Ivan, 2026-09-29: "an option that
 * follows the time, so when it is on it follows the daytime"): night before
 * 05:30, full day from 08:00 to 17:30, night again from 20:00, eased between.
 */

import { clockDaylight } from '../../../common/sceneDaylight';

const at = (hours: number, minutes = 0) =>
  clockDaylight(new Date(2026, 8, 29, hours, minutes));

describe('the clock’s time of day', () => {
  it('is night at night and full day by day', () => {
    expect(at(0)).toBe(0);
    expect(at(5, 29)).toBe(0);
    expect(at(8)).toBe(100);
    expect(at(12)).toBe(100);
    expect(at(17, 30)).toBe(100);
    expect(at(20)).toBe(0);
    expect(at(23, 59)).toBe(0);
  });

  it('brightens through the morning and dims through the evening, halfway at their middles', () => {
    expect(at(6, 45)).toBeCloseTo(50, 5);
    expect(at(18, 45)).toBeCloseTo(50, 5);
    const through = (hours: number[]) =>
      hours.map((hour) => at(Math.floor(hour), (hour % 1) * 60));
    // Each step of either one a step further than the one before it.
    const steps = (values: number[]) =>
      values.slice(1).map((value, index) => Math.sign(value - values[index]));
    expect(steps(through([5.75, 6.25, 6.75, 7.25, 7.75]))).toEqual([
      1, 1, 1, 1,
    ]);
    expect(steps(through([17.75, 18.25, 18.75, 19.25, 19.75]))).toEqual([
      -1, -1, -1, -1,
    ]);
  });

  // Eased: a minute into the morning moves it by a hair, not by a step.
  it('leaves night and lands on day without a step', () => {
    expect(at(5, 31)).toBeLessThan(0.1);
    expect(at(7, 59)).toBeGreaterThan(99.9);
  });
});
