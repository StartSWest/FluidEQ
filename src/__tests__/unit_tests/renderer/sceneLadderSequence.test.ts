/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  SCENE_AUTO_FLOOR,
  SCENE_BALANCED_FLOOR,
} from '../../../common/scenePerformance';
import {
  SCENE_CLIMB_MS,
  SCENE_HOLD_MS,
  SCENE_OVER_SHARE,
  SCENE_STEP_DOWN_FRAMES,
} from '../../../renderer/graph/sceneHealth';
import {
  createCostLadder,
  createWarmupLadder,
  type ICostLadder,
  type TLadderFrame,
} from '../../../renderer/graph/sceneLadder';

/**
 * Auto, as a viewer meets it: a scene played through a passage that is too
 * heavy for the GPU and back out of it, frame by frame, its cost following
 * its pixels the way a fragment shader's does (Ivan, 2026-11-27: "fast or
 * best automatically depending on the fps ... always trying to display its
 * best quality"). Every wait is in frames, so a clock is a frame count.
 */

/** A sixty-hertz display. */
const INTERVAL = 1000 / 60;
const framesOf = (ms: number) => Math.ceil(ms / INTERVAL);

/** Auto's top at 1080p: twice the panel each way. */
const SUPERSAMPLED = 2;

/**
 * A deterministic wobble of up to `amount` either way: a real GPU's frame
 * times are never flat, and a ladder that only holds still on a flat line
 * would pulse on a real one.
 */
const wobble = (frame: number, amount: number) =>
  1 + amount * Math.sin(frame * 1.7) * Math.cos(frame * 0.37);

interface IPassage {
  /** What a frame costs at the panel's own size, in milliseconds. */
  native: number;
  seconds: number;
  jitter?: number;
  interval?: number;
  seen?: TLadderFrame;
}

/** Plays passages through a ladder; the size every frame was drawn at. */
const play = (ladder: ICostLadder, ...passages: IPassage[]) => {
  const sizes: number[] = [];
  let frame = 0;
  passages.forEach(
    ({ native, seconds, jitter = 0, interval = INTERVAL, seen = 'shown' }) => {
      const count = Math.ceil((seconds * 1000) / interval);
      for (let index = 0; index < count; index += 1) {
        const scale = ladder.scale();
        sizes.push(scale);
        ladder.frame(
          { costMs: native * scale ** 2 * wobble(frame, jitter), behind: 0 },
          interval,
          seen,
        );
        frame += 1;
      }
    },
  );
  return sizes;
};

/** How many times the picture changed size. */
const changes = (sizes: number[]) =>
  sizes.filter((size, index) => index > 0 && size !== sizes[index - 1]).length;

/** How many times it was made smaller. */
const downs = (sizes: number[]) =>
  sizes.filter((size, index) => index > 0 && size < sizes[index - 1]).length;

const LIGHT = INTERVAL * 0.1;
const HEAVY = INTERVAL * 1.8;

describe('Auto through a heavy passage', () => {
  it('steps down under load once, and climbs back with room without stepping down again', () => {
    const ladder = createCostLadder(SUPERSAMPLED, SCENE_AUTO_FLOOR);
    const calm = play(ladder, { native: LIGHT, seconds: 5, jitter: 0.1 });
    // The best it can hold: drawn larger than the panel the whole time.
    expect(changes(calm)).toBe(0);
    expect(calm[calm.length - 1]).toBe(SUPERSAMPLED);

    const heavy = play(ladder, { native: HEAVY, seconds: 10, jitter: 0.1 });
    // Down within a tenth of a second, in one step, to a size that keeps up.
    const lowered = heavy[heavy.length - 1];
    expect(lowered).toBeLessThan(1);
    expect(heavy.indexOf(lowered)).toBeLessThanOrEqual(
      SCENE_STEP_DOWN_FRAMES + 1,
    );
    expect(changes(heavy)).toBe(1);
    expect(HEAVY * lowered ** 2 * 1.1).toBeLessThan(
      INTERVAL * SCENE_OVER_SHARE,
    );

    const after = play(ladder, { native: LIGHT, seconds: 10, jitter: 0.1 });
    // Back to its best, only ever upwards, within two climbs: one jump
    // where the measured cost has settled, two where the first climb comes
    // while the heavy frames are still in its average.
    expect(after[after.length - 1]).toBe(SUPERSAMPLED);
    expect(downs(after)).toBe(0);
    expect(changes(after)).toBeLessThanOrEqual(2);
    expect(after.indexOf(SUPERSAMPLED)).toBeLessThanOrEqual(
      framesOf(SCENE_HOLD_MS + SCENE_CLIMB_MS * 2) + 2,
    );
  });

  /**
   * The boundary: full size costs 0.95 of the interval, so it does not keep
   * up there, and the next size down does with room to spare. The way up is
   * only taken where the size above is predicted under 0.63 of the interval,
   * the way down past 0.9 of it; between the two it holds still.
   */
  it('settles under the boundary and never pulses across it', () => {
    const ladder = createCostLadder(1, SCENE_AUTO_FLOOR);
    const sizes = play(ladder, {
      native: INTERVAL * 0.95,
      seconds: 60,
      jitter: 0.06,
    });
    expect(changes(sizes)).toBe(1);
    expect(sizes[sizes.length - 1]).toBe(0.85);
  });

  it('holds where a passage fits only just, through a minute of wobble', () => {
    const ladder = createCostLadder(SUPERSAMPLED, SCENE_AUTO_FLOOR);
    // Fits at full size, at 0.8 of the interval; four times that above it.
    const sizes = play(ladder, {
      native: INTERVAL * 0.8,
      seconds: 60,
      jitter: 0.08,
    });
    expect(changes(sizes)).toBeLessThanOrEqual(1);
    expect(sizes[sizes.length - 1]).toBeGreaterThanOrEqual(0.85);
  });

  /** The members' ladder used to keep the size it fell to for good. */
  it('takes a scene nobody here has watched down and back up the same way', () => {
    const ladder = createWarmupLadder(SUPERSAMPLED, SCENE_AUTO_FLOOR);
    const warm = play(ladder, { native: LIGHT, seconds: 10, jitter: 0.1 });
    expect(warm[warm.length - 1]).toBe(SUPERSAMPLED);
    const heavy = play(ladder, { native: HEAVY, seconds: 10, jitter: 0.1 });
    expect(heavy[heavy.length - 1]).toBeLessThan(1);
    expect(changes(heavy)).toBe(1);
    const after = play(ladder, { native: LIGHT, seconds: 10, jitter: 0.1 });
    expect(after[after.length - 1]).toBe(SUPERSAMPLED);
    expect(downs(after)).toBe(0);
    // Each climb at most four times the pixels it had just drawn.
    const widest = Math.max(
      ...after.slice(1).map((size, index) => size / after[index]),
    );
    expect(widest).toBeLessThanOrEqual(2);
  });
});

describe('each quality’s own reach', () => {
  it('Balanced never draws under half the panel, and slows the rate instead', () => {
    const ladder = createCostLadder(1, SCENE_BALANCED_FLOOR);
    const sizes = play(ladder, { native: INTERVAL * 6, seconds: 10 });
    expect(Math.min(...sizes)).toBe(SCENE_BALANCED_FLOOR);
    expect(ladder.slowed()).toBe(true);
  });

  it('Full keeps its whole picture and lets the rate give, then takes it back', () => {
    const ladder = createCostLadder(SUPERSAMPLED, SUPERSAMPLED);
    const heavy = play(ladder, { native: INTERVAL * 0.5, seconds: 5 });
    expect(new Set(heavy)).toEqual(new Set([SUPERSAMPLED]));
    expect(ladder.slowed()).toBe(true);
    // Cheap again, judged at the rate it was slowed from: back to full rate.
    play(ladder, { native: LIGHT, seconds: 5, interval: INTERVAL * 2 });
    expect(ladder.slowed()).toBe(false);
    expect(ladder.scale()).toBe(SUPERSAMPLED);
  });

  /**
   * FluidWallpapers caps a wallpaper at thirty on battery. Capped, a frame
   * has twice the time, and a scene that would be too heavy at sixty is not
   * slow at all: it must not shrink for a rate it was never asked for.
   */
  it('judges a capped rate against the cap, not against sixty', () => {
    const capped = createCostLadder(1, SCENE_AUTO_FLOOR);
    play(capped, {
      native: INTERVAL * 1.2,
      seconds: 10,
      interval: INTERVAL * 2,
    });
    expect(capped.scale()).toBe(1);
    // The control: the same scene at sixty does not keep up at full size.
    const uncapped = createCostLadder(1, SCENE_AUTO_FLOOR);
    play(uncapped, { native: INTERVAL * 1.2, seconds: 10 });
    expect(uncapped.scale()).toBeLessThan(1);
  });
});

describe('a rest in silence', () => {
  /**
   * Resting at thirty, a frame has twice the time and the picture climbs.
   * The music back, the frames come at sixty again: without going back to
   * the size sixty held, the first beat was drawn too large for a dozen
   * frames before the ladder caught it.
   */
  it('goes back to the size the full rate held at the first frame with sound', () => {
    const ladder = createCostLadder(SUPERSAMPLED, SCENE_AUTO_FLOOR);
    // At sixty, 0.25 of the interval at full size: supersampled is over.
    play(ladder, { native: INTERVAL * 0.25, seconds: 5 });
    expect(ladder.scale()).toBe(1);
    play(ladder, {
      native: INTERVAL * 0.25,
      seconds: 10,
      interval: INTERVAL * 2,
      seen: 'resting',
    });
    expect(ladder.scale()).toBe(SUPERSAMPLED);
    const back = play(ladder, { native: INTERVAL * 0.25, seconds: 5 });
    expect(back.slice(1).every((size) => size <= 1)).toBe(true);
  });

  /** A calm desktop rests for good, and still finds its best size there. */
  it('still steps down and climbs back while it rests for good', () => {
    const ladder = createCostLadder(SUPERSAMPLED, SCENE_AUTO_FLOOR);
    const resting = { interval: INTERVAL * 2, seen: 'resting' as const };
    play(ladder, { native: INTERVAL * 3, seconds: 5, ...resting });
    expect(ladder.scale()).toBeLessThan(1);
    play(ladder, { native: LIGHT, seconds: 10, ...resting });
    expect(ladder.scale()).toBe(SUPERSAMPLED);
  });

  /** A frame-rate cap is not a rest: what it climbs to there, it keeps. */
  it('keeps a climb made under a cap', () => {
    const ladder = createCostLadder(SUPERSAMPLED, SCENE_AUTO_FLOOR);
    play(ladder, { native: INTERVAL * 0.25, seconds: 5 });
    play(ladder, {
      native: INTERVAL * 0.25,
      seconds: 10,
      interval: INTERVAL * 2,
    });
    expect(ladder.scale()).toBe(SUPERSAMPLED);
    play(ladder, {
      native: INTERVAL * 0.25,
      seconds: 1,
      interval: INTERVAL * 2,
    });
    expect(ladder.scale()).toBe(SUPERSAMPLED);
  });
});
