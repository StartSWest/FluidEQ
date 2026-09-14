/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The size the lamps draw a scene at. The rule replaced giving a scene up:
 * that turned Alpine — six milliseconds a frame once warmed — into bars on
 * the desk one load in three, for the rest of the session.
 */

import {
  CLIMB_WINDOW,
  createLampPacing,
  FIRST_REST,
  HOPELESS_FRAME_MS,
  LAMP_FRAME_MS,
  LAMP_SIZES,
  LATE_RUN,
  type TLampPace,
} from '../../../renderer/lighting/lampPacing';

const smallest = LAMP_SIZES[LAMP_SIZES.length - 1];

/** Frames at the pacing's own size, each taking what `cost` says. */
const run = (
  pacing: ReturnType<typeof createLampPacing>,
  frames: number,
  cost: (size: readonly [number, number]) => number,
) => {
  const paces: TLampPace[] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    paces.push(pacing.record(cost(pacing.size())));
  }
  return paces;
};

/** A scene whose drawing costs `msPerPixel`, plus the wait for it. */
const scene =
  (msPerPixel: number, waitMs = 3) =>
  ([width, height]: readonly [number, number]) =>
    width * height * msPerPixel + waitMs;

it('starts small and climbs to the largest size for a scene the GPU draws in time', () => {
  const pacing = createLampPacing();
  expect(pacing.size()).toEqual(smallest);
  // Alpine on this machine: six milliseconds at the largest size.
  const alpine = scene(3 / (768 * 432));
  const paces = run(pacing, 40, alpine);
  expect(pacing.size()).toEqual(LAMP_SIZES[0]);
  // Each size is warmed once and timed a few frames before the next.
  expect(paces.filter((pace) => pace === 'larger')).toHaveLength(
    LAMP_SIZES.length - 1,
  );
  expect(paces.indexOf('larger')).toBe(CLIMB_WINDOW);
  expect(paces).not.toContain('give-up');
});

it('does not count the first frame at a size, which carries its warm-up', () => {
  const pacing = createLampPacing();
  // The first draw of a program just linked took 114 ms on Alpine.
  expect(pacing.record(114)).toBe('same');
  expect(run(pacing, CLIMB_WINDOW, () => 5)).toEqual([
    'same',
    'same',
    'larger',
  ]);
});

it('stops climbing where the next size would not be in time', () => {
  const pacing = createLampPacing();
  // Heavy: 20 ms at 384 by 216, 80 at the largest.
  run(pacing, 200, scene(80 / (768 * 432)));
  expect(pacing.size()).toEqual(LAMP_SIZES[1]);
});

it('draws smaller through a spell the GPU is busy, and larger again after it', () => {
  const pacing = createLampPacing();
  run(pacing, 40, () => 6);
  expect(pacing.size()).toEqual(LAMP_SIZES[0]);
  // Another window's heavy frames: every lamp frame waits behind them.
  const busy = run(pacing, LATE_RUN, () => LAMP_FRAME_MS + 20);
  expect(busy[LATE_RUN - 1]).toBe('smaller');
  expect(pacing.size()).toEqual(LAMP_SIZES[1]);
  // The size it came down from rests first, then is tried again.
  const calm = run(pacing, FIRST_REST + 1, () => 5);
  expect(calm.slice(0, FIRST_REST - 1)).not.toContain('larger');
  expect(calm).toContain('larger');
  expect(pacing.size()).toEqual(LAMP_SIZES[0]);
});

it('climbs a scene heavy at every size a step at a time, and rests longer after each late try', () => {
  const pacing = createLampPacing();
  // All pixels, no fixed cost: 20 ms at the smallest size looks like fixed
  // cost there, so the next size is tried — and is 80 ms.
  const heavy = scene(20 / (96 * 54), 0);
  const paces = run(pacing, 2000, heavy);
  expect(paces).not.toContain('give-up');
  const tries = paces.filter((pace) => pace === 'larger').length;
  // Tried at frame ~3, then after 150, 300, 600 and 1200 frames of rest.
  expect(tries).toBeGreaterThanOrEqual(3);
  expect(tries).toBeLessThanOrEqual(5);
  expect(pacing.size()).toEqual(smallest);
});

it('climbs a member’s scene whose frames are mostly the flash limiter’s fixed passes', () => {
  const pacing = createLampPacing();
  // Ten milliseconds whatever the size, and a light scene on top.
  const guarded = scene(2 / (768 * 432), 10);
  run(pacing, 40, guarded);
  expect(pacing.size()).toEqual(LAMP_SIZES[0]);
});

it('does not grow into a size where every other frame would be late', () => {
  const pacing = createLampPacing();
  let frame = 0;
  run(pacing, 300, () => {
    frame += 1;
    return frame % 2 ? 2 : LAMP_FRAME_MS - 1;
  });
  expect(pacing.size()).toEqual(smallest);
});

it('keeps a slow scene on the lamps at the smallest size rather than giving it up', () => {
  const pacing = createLampPacing();
  const paces = run(pacing, 300, () => LAMP_FRAME_MS * 3);
  expect(pacing.size()).toEqual(smallest);
  expect(paces).not.toContain('give-up');
});

it('gives up only a scene that holds the GPU at the smallest size, twice running', () => {
  const pacing = createLampPacing();
  pacing.record(5);
  expect(pacing.record(HOPELESS_FRAME_MS + 1)).toBe('same');
  expect(pacing.record(5)).toBe('same');
  expect(pacing.record(HOPELESS_FRAME_MS + 1)).toBe('same');
  expect(pacing.record(HOPELESS_FRAME_MS + 1)).toBe('give-up');
});
