/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { THIRTY_A_SECOND_MS } from '../../../common/smoothing';
import {
  createPaceSchedule,
  displayTickMs,
  isFrameDue,
} from '../../../renderer/utils/framePace';

/**
 * When a loop held to a pace draws (`framePace.ts`): the page's loop and the
 * scene worker's, on the same rule. Held to thirty frames a second, the
 * Studio's stage - and the meters it fed - ran anywhere from 18 to 30 on a
 * 60 Hz screen, and flickered between 33 and 25 on a 100 Hz one.
 */

/** Animation frames on a `hz` display for `seconds`, each a little early or late. */
const frames = (hz: number, seconds: number) => {
  const tick = 1000 / hz;
  let seed = 11;
  const jitter = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647 - 0.5) * 0.8;
  };
  return Array.from(
    { length: Math.floor(seconds * hz) },
    (_, at) => at * tick + jitter(),
  );
};

/** The display frames a loop held to `paceMs` draws on, by the rule. */
const drawn = (hz: number, paceMs: number) => {
  let lastTickAt: number | undefined;
  let tickMs = 1000 / 60;
  let drewAt: number | undefined;
  const draws: number[] = [];
  frames(hz, 10).forEach((now) => {
    tickMs = displayTickMs(now, lastTickAt, tickMs);
    lastTickAt = now;
    if (drewAt === undefined || isFrameDue(now - drewAt, paceMs, tickMs)) {
      drewAt = now;
      draws.push(now);
    }
  });
  return draws;
};

describe('the frame pace', () => {
  it.each([
    [60, 30],
    [100, 25],
    [120, 30],
    [144, 29],
  ])(
    'settles on one rate on a %i Hz display, held to thirty frames a second',
    (hz, rate) => {
      const draws = drawn(hz, 1000 / 30);
      expect(draws.length / 10).toBeCloseTo(rate, 0);
      // One rate: every gap is the same count of the display's frames, never
      // a frame longer now and a frame shorter the next.
      const tick = 1000 / hz;
      const gaps = new Set(
        draws
          .slice(1)
          .map((at, index) => Math.round((at - draws[index]) / tick)),
      );
      expect(gaps.size).toBe(1);
    },
  );

  it('draws every frame the display offers at a pace of nothing', () => {
    expect(drawn(144, 0)).toHaveLength(1440);
  });

  it('holds a pace of thirty a second to thirty, and a pace of nothing to none', () => {
    const tick = 1000 / 60;
    expect(isFrameDue(tick, THIRTY_A_SECOND_MS, tick)).toBe(false);
    expect(isFrameDue(2 * tick - 0.3, THIRTY_A_SECOND_MS, tick)).toBe(true);
    // Zero is a floor on the interval, not a target rate — so a 144Hz screen
    // is not held down to 60.
    expect(isFrameDue(0, 0, 1000 / 144)).toBe(true);
  });

  it('never runs faster than its pace', () => {
    [60, 75, 100, 120, 144, 165, 240].forEach((hz) => {
      expect(drawn(hz, 1000 / 30).length / 10).toBeLessThanOrEqual(30.1);
    });
  });

  it('measures the display from the frames themselves, within reason', () => {
    expect(displayTickMs(100, undefined, 16)).toBe(16);
    expect(displayTickMs(116.7, 100, 16)).toBeCloseTo(16.7, 6);
    // A frame 1 ms after the last, or a second after it, is not a display.
    expect(displayTickMs(101, 100, 16)).toBe(4);
    expect(displayTickMs(1100, 100, 16)).toBe(100);
  });
});

/**
 * A rate somebody chose (`createPaceSchedule`): the Studio's stage at
 * "60 a second" read fifty on a 100 Hz display once the cap held at all,
 * because counting from the last frame rounds sixty down to every second
 * refresh. Kept on a schedule, it is sixty on every display.
 */
describe('a chosen rate', () => {
  /** The display frames a schedule held to `paceMs` draws on. */
  const scheduled = (hz: number, paceMs: number, seconds = 10) => {
    const schedule = createPaceSchedule();
    let lastTickAt: number | undefined;
    let tickMs = 1000 / 60;
    const draws: number[] = [];
    frames(hz, seconds).forEach((now) => {
      tickMs = displayTickMs(now, lastTickAt, tickMs);
      lastTickAt = now;
      if (schedule.isDue(now, paceMs, tickMs)) {
        schedule.drawn(now, paceMs);
        draws.push(now);
      }
    });
    return draws;
  };

  it.each([100, 120, 144, 165, 240])(
    'is sixty a second on a %i Hz display',
    (hz) => {
      expect(scheduled(hz, 1000 / 60).length / 10).toBeCloseTo(60, 0);
    },
  );

  it.each([60, 100, 120, 144])(
    'is thirty a second on a %i Hz display',
    (hz) => {
      expect(scheduled(hz, THIRTY_A_SECOND_MS).length / 10).toBeCloseTo(30, 0);
    },
  );

  // The control: the ceiling the window's own drawings keep, counted from
  // the last frame, is the fifty the stage read.
  it('is what counting from the last frame rounds down on a 100 Hz display', () => {
    expect(drawn(100, 1000 / 60).length / 10).toBeCloseTo(50, 0);
  });

  it('never runs faster than its rate in any second', () => {
    [100, 144, 240].forEach((hz) => {
      const draws = scheduled(hz, 1000 / 60);
      draws.forEach((start) => {
        const inSecond = draws.filter(
          (at) => at >= start && at < start + 1000,
        ).length;
        expect(inSecond).toBeLessThanOrEqual(61);
      });
    });
  });

  it('draws one even rate where the display divides it', () => {
    const draws = scheduled(240, 1000 / 60);
    const gaps = new Set(
      draws
        .slice(1)
        .map((at, index) => Math.round((at - draws[index]) / (1000 / 240))),
    );
    expect([...gaps]).toEqual([4]);
  });

  it('draws every frame the display offers at a pace of nothing', () => {
    expect(scheduled(144, 0)).toHaveLength(1440);
  });

  it('tries a frame that did not reach the screen again on the next display frame', () => {
    const schedule = createPaceSchedule();
    const tick = 1000 / 100;
    const pace = 1000 / 60;
    schedule.restart(0);
    expect(schedule.isDue(2 * tick, pace, tick)).toBe(true);
    // Not drawn (the GPU still held two frames): due again a refresh later,
    // never a whole pace later.
    expect(schedule.isDue(3 * tick, pace, tick)).toBe(true);
    schedule.drawn(3 * tick, pace);
    // Late for its slot, so the rate is made up rather than lost: the slots
    // at 33 and 50 ms are drawn at 40 and 50, and nothing at 60.
    expect(schedule.isDue(4 * tick, pace, tick)).toBe(true);
    schedule.drawn(4 * tick, pace);
    expect(schedule.isDue(5 * tick, pace, tick)).toBe(true);
    schedule.drawn(5 * tick, pace);
    expect(schedule.isDue(6 * tick, pace, tick)).toBe(false);
  });

  it('starts again after a stall instead of drawing the missed frames back to back', () => {
    const schedule = createPaceSchedule();
    const tick = 1000 / 240;
    const pace = 1000 / 60;
    schedule.restart(0);
    // Half a second with nothing drawn: the page was away.
    schedule.drawn(500, pace);
    expect(schedule.isDue(500 + tick, pace, tick)).toBe(false);
    expect(schedule.isDue(500 + 3 * tick, pace, tick)).toBe(false);
    expect(schedule.isDue(500 + 4 * tick, pace, tick)).toBe(true);
  });

  it('is due at once with nothing drawn, and a pace after a start it is given', () => {
    const schedule = createPaceSchedule();
    const tick = 1000 / 240;
    const pace = 1000 / 60;
    expect(schedule.isDue(7, pace, tick)).toBe(true);
    schedule.restart(100);
    expect(schedule.isDue(100 + tick, pace, tick)).toBe(false);
    expect(schedule.isDue(100 + pace, pace, tick)).toBe(true);
  });
});
