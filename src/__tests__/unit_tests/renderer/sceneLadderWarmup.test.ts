/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  SCENE_CEILING_MS,
  SCENE_CLIMB_MS,
  SCENE_HOLD_MS,
  SCENE_OVER_SHARE,
  SCENE_STEP_DOWN_FRAMES,
} from '../../../renderer/graph/sceneHealth';
import {
  createWarmupLadder,
  WARMUP_CLIMB_RATIO,
  WARMUP_GOOD_FRAMES_TO_CLIMB,
  WARMUP_HOPELESS_FRAMES,
  WARMUP_STALL_SCALE,
  type ICostLadder,
} from '../../../renderer/graph/sceneLadder';

/**
 * The ladder of a scene nobody here has watched: a member's, the listener's
 * own. The same rules as FluidEQ's own scenes, from the bottom up, each climb
 * bounded, with the stalled-GPU guard.
 */

const INTERVAL = 1000 / 60;
const framesOf = (ms: number) => Math.ceil(ms / INTERVAL);

/** Frames of a scene whose cost follows its pixels: `native` at full size. */
const scene = (
  ladder: ICostLadder,
  count: number,
  native: number,
  behind = 0,
) => {
  let result: 'ok' | 'degraded' = 'ok';
  const seen: number[] = [];
  for (let index = 0; index < count; index += 1) {
    result = ladder.frame(
      { costMs: native * ladder.scale() ** 2, behind },
      INTERVAL,
      'shown',
    );
    seen.push(ladder.scale());
  }
  return { result, seen };
};

/** Frames that cost the same whatever the size: a stalled or a busy GPU. */
const flat = (ladder: ICostLadder, count: number, costMs: number) => {
  let result: 'ok' | 'degraded' = 'ok';
  for (let index = 0; index < count; index += 1) {
    result = ladder.frame({ costMs, behind: 0 }, INTERVAL, 'shown');
  }
  return result;
};

const pipeline = (ladder: ICostLadder, count: number, behind: number) => {
  for (let index = 0; index < count; index += 1) {
    ladder.frame({ behind }, INTERVAL, 'shown');
  }
};

/** Every size the picture took, in order, each once. */
const steps = (seen: number[]) =>
  seen.filter((scale, index) => index === 0 || scale !== seen[index - 1]);

const LIGHT = INTERVAL * 0.1;
const HEAVY = INTERVAL * 1.8;
const HOPELESS = INTERVAL * 12;

describe('the ladder of a scene nobody here has watched', () => {
  it('starts at the smallest size the quality allows', () => {
    expect(createWarmupLadder(1, 0.35).scale()).toBe(0.35);
    expect(createWarmupLadder(1, 0.5).scale()).toBe(0.5);
    // Full is one rung: the picture starts, and stays, whole.
    expect(createWarmupLadder(2, 2).scale()).toBe(2);
    // A floor raised under a climb lifts the picture to it.
    const ladder = createWarmupLadder(1, 0.35);
    ladder.refloor(0.5);
    expect(ladder.scale()).toBe(0.5);
  });

  it('climbs to its largest size in steps of at most four times the pixels', () => {
    const ladder = createWarmupLadder(2, 0.35);
    const { seen } = scene(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 6, LIGHT);
    const sizes = [0.35, ...steps(seen).filter((scale) => scale !== 0.35)];
    expect(sizes[sizes.length - 1]).toBe(2);
    sizes.slice(1).forEach((scale, index) => {
      expect(scale / sizes[index]).toBeLessThanOrEqual(WARMUP_CLIMB_RATIO);
    });
    // Quickly: a run of smooth frames per climb, not a second each.
    expect(seen.indexOf(2)).toBeLessThan(WARMUP_GOOD_FRAMES_TO_CLIMB * 4);
  });

  it('waits for a run of smooth frames before each climb', () => {
    const ladder = createWarmupLadder(1, 0.35);
    scene(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB - 1, LIGHT);
    expect(ladder.scale()).toBe(0.35);
    // Two frames over budget break the run.
    flat(ladder, 2, INTERVAL);
    scene(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB - 1, LIGHT);
    expect(ladder.scale()).toBe(0.35);
    scene(ladder, 1, LIGHT);
    expect(ladder.scale()).toBeGreaterThan(0.35);
  });

  /**
   * With a clock, a frame still in hand is not held against the scene: in
   * the running window a fence is seen signalled a frame or two late, so one
   * in hand is the ordinary state, and reading it as "not smooth" kept a
   * member's scene at an eighth of the size for good.
   */
  it('climbs on the clock alone while a frame is still in hand', () => {
    const ladder = createWarmupLadder(1, 0.35);
    scene(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB, LIGHT, 1);
    expect(ladder.scale()).toBeGreaterThan(0.35);
  });

  /** Built again for a program that ran whole seconds ago: no second climb. */
  it('starts at the size the program has already proved, never above it', () => {
    const ladder = createWarmupLadder(1, 0.35);
    ladder.resume(0.85);
    expect(ladder.scale()).toBe(0.85);
    scene(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB, LIGHT);
    expect(ladder.scale()).toBe(1);
    const other = createWarmupLadder(1, 0.35);
    // A size between two rungs: the rung under it.
    other.resume(0.6);
    expect(other.scale()).toBe(0.59);
  });

  /**
   * The members' ladder used to step down only at three times the interval,
   * so a member's scene running at half the display's rate stayed there.
   */
  it('steps down as soon as its frames stay over budget', () => {
    const ladder = createWarmupLadder(1, 0.35);
    scene(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 3, LIGHT);
    expect(ladder.scale()).toBe(1);
    // Under twice the interval at full size: under the old three-times line.
    scene(ladder, SCENE_STEP_DOWN_FRAMES, HEAVY);
    expect(ladder.scale()).toBeLessThan(1);
    // Where it lands, it keeps up.
    expect(HEAVY * ladder.scale() ** 2).toBeLessThan(
      INTERVAL * SCENE_OVER_SHARE,
    );
  });

  /** It used to bar the rung it stepped down from for as long as it ran. */
  it('climbs back once the heavy passage is over', () => {
    const ladder = createWarmupLadder(1, 0.35);
    scene(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 3, LIGHT);
    // Long enough after the climb that the step down is not a bounce.
    scene(ladder, framesOf(10000), LIGHT);
    scene(ladder, SCENE_STEP_DOWN_FRAMES, HEAVY);
    const lowered = ladder.scale();
    expect(lowered).toBeLessThan(1);
    const { seen } = scene(
      ladder,
      framesOf(SCENE_HOLD_MS + SCENE_CLIMB_MS) * 3,
      LIGHT,
    );
    expect(ladder.scale()).toBe(1);
    const sizes = [lowered, ...steps(seen).filter((s) => s !== lowered)];
    sizes.slice(1).forEach((scale, index) => {
      expect(scale / sizes[index]).toBeLessThanOrEqual(WARMUP_CLIMB_RATIO);
    });
  });

  it('bars a rung it had to leave right after climbing to it, for a while', () => {
    const ladder = createWarmupLadder(1, 0.35);
    scene(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 3, LIGHT);
    expect(ladder.scale()).toBe(1);
    // Heavy at once: a bounce off full size.
    scene(ladder, SCENE_STEP_DOWN_FRAMES, HEAVY);
    const lowered = ladder.scale();
    scene(ladder, framesOf(SCENE_CEILING_MS) - 10, LIGHT);
    expect(ladder.scale()).toBeLessThan(1);
    expect(ladder.scale()).toBeGreaterThanOrEqual(lowered);
    scene(ladder, framesOf(SCENE_CLIMB_MS) * 3, LIGHT);
    expect(ladder.scale()).toBe(1);
  });

  // Ivan, 2026-11-14: "only the full scene can show, always". A stalled GPU
  // first draws the scene again at an eighth of the panel and the slow rate;
  // only a scene that stalls there too is stopped, because it would reset
  // the display driver for every program on the machine.
  it('draws a stalled scene again, smallest and slowest, before stopping it', () => {
    const ladder = createWarmupLadder(1, 0.35);
    expect(flat(ladder, WARMUP_HOPELESS_FRAMES - 1, HOPELESS)).toBe('ok');
    expect(flat(ladder, 1, HOPELESS)).toBe('ok');
    expect(ladder.scale()).toBe(WARMUP_STALL_SCALE);
    expect(ladder.slowed()).toBe(true);
    expect(flat(ladder, WARMUP_HOPELESS_FRAMES - 1, HOPELESS)).toBe('ok');
    expect(flat(ladder, 1, HOPELESS)).toBe('degraded');
  });

  it('steps a stall down at once from above the bottom, without stopping', () => {
    const ladder = createWarmupLadder(1, 0.35);
    scene(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 3, LIGHT);
    expect(ladder.scale()).toBe(1);
    expect(flat(ladder, WARMUP_HOPELESS_FRAMES, HOPELESS)).toBe('ok');
    expect(ladder.scale()).toBeLessThan(1);
    expect(ladder.scale()).toBeGreaterThan(WARMUP_STALL_SCALE);
  });

  it('plays on at an eighth once stalled, and is never stopped while it keeps up', () => {
    const ladder = createWarmupLadder(1, 0.5);
    expect(flat(ladder, WARMUP_HOPELESS_FRAMES, HOPELESS)).toBe('ok');
    expect(ladder.scale()).toBe(WARMUP_STALL_SCALE);
    expect(ladder.slowed()).toBe(true);
    // The control: smooth there, it plays on and is never stopped.
    expect(scene(ladder, 600, LIGHT).result).toBe('ok');
    expect(ladder.scale()).toBe(WARMUP_STALL_SCALE);
  });

  // Ivan, 2026-11-08: "remove all low performance laptop fallback scenes ...
  // so only the good one display". A slow scene is shown slow, never swapped
  // for the standard look; only a stalled GPU stops it.
  it('keeps a scene that stays slow at the bottom on screen, at the slow rate', () => {
    const ladder = createWarmupLadder(1, 0.35);
    expect(flat(ladder, 2400, INTERVAL * 3.5)).toBe('ok');
    expect(ladder.scale()).toBe(0.35);
    expect(ladder.slowed()).toBe(true);
  });

  it('holds the smallest size at the slow rate, and leaves the slow rate once it fits', () => {
    const ladder = createWarmupLadder(1, 0.5);
    flat(ladder, SCENE_STEP_DOWN_FRAMES, INTERVAL * 3.5);
    expect(ladder.scale()).toBe(0.5);
    expect(ladder.slowed()).toBe(true);
    // Never smaller than allowed however slow it stays.
    expect(flat(ladder, 2400, INTERVAL * 3.5)).toBe('ok');
    expect(ladder.scale()).toBe(0.5);
    // Cheap again: judged at the rate it was slowed from, it leaves.
    for (let index = 0; index < framesOf(SCENE_CLIMB_MS) * 4; index += 1) {
      ladder.frame(
        { costMs: LIGHT * ladder.scale() ** 2, behind: 0 },
        ladder.slowed() ? INTERVAL * 2 : INTERVAL,
        'shown',
      );
    }
    expect(ladder.slowed()).toBe(false);
    expect(ladder.scale()).toBe(1);
  });

  it('ignores frames from a hidden window', () => {
    const ladder = createWarmupLadder(1, 0.35);
    for (let index = 0; index < 100; index += 1) {
      expect(
        ladder.frame({ costMs: HOPELESS, behind: 2 }, INTERVAL, 'hidden'),
      ).toBe('ok');
    }
    expect(ladder.scale()).toBe(0.35);
  });

  /** Without a GPU clock, keeping up with the display is what fitting means. */
  it('climbs and steps back on the pipeline alone when the driver has no clock', () => {
    const ladder = createWarmupLadder(1, 0.35);
    pipeline(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB, 0);
    expect(ladder.scale()).toBe(0.42);
    pipeline(ladder, SCENE_STEP_DOWN_FRAMES, 1);
    expect(ladder.scale()).toBe(0.35);
  });

  it('starts again from the bottom when reset', () => {
    const ladder = createWarmupLadder(1, 0.35);
    scene(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 3, LIGHT);
    flat(ladder, WARMUP_HOPELESS_FRAMES * 3, HOPELESS);
    ladder.reset();
    expect(ladder.scale()).toBe(0.35);
    expect(ladder.slowed()).toBe(false);
    scene(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 3, LIGHT);
    expect(ladder.scale()).toBe(1);
  });
});
