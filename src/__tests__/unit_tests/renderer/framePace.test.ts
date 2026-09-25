/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { EUPHORIA_FRAME_MS, SMOOTH_FRAME_MS } from '../../../common/smoothing';
import { displayTickMs, isFrameDue } from '../../../renderer/utils/framePace';

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

  it('holds ordinary use to thirty a second, and lets euphoria run free', () => {
    const tick = 1000 / 60;
    expect(isFrameDue(tick, SMOOTH_FRAME_MS, tick)).toBe(false);
    expect(isFrameDue(2 * tick - 0.3, SMOOTH_FRAME_MS, tick)).toBe(true);
    // Zero is a floor on the interval, not a target rate — so a 144Hz screen
    // is not held down to 60 during the one moment that is meant to look
    // expensive.
    expect(isFrameDue(0, EUPHORIA_FRAME_MS, 1000 / 144)).toBe(true);
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
