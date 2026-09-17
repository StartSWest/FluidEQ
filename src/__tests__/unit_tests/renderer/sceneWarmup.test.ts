/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createWarmupLadder,
  WARMUP_GOOD_FRAMES_TO_CLIMB,
  WARMUP_HOPELESS_FRAMES,
  WARMUP_RENDER_SCALES,
} from '../../../renderer/graph/sceneWarmup';

const INTERVAL = 1000 / 60;
const FAST = INTERVAL * 0.9;
const SLOW = INTERVAL * 3.5;
const HOPELESS = INTERVAL * 12;

const frames = (
  ladder: ReturnType<typeof createWarmupLadder>,
  count: number,
  costMs: number,
  behind = 0,
) => {
  let result: 'ok' | 'degraded' = 'ok';
  for (let index = 0; index < count; index += 1) {
    result = ladder.frame({ costMs, behind }, INTERVAL, false);
  }
  return result;
};

const pipeline = (
  ladder: ReturnType<typeof createWarmupLadder>,
  count: number,
  behind: number,
) => {
  let result: 'ok' | 'degraded' = 'ok';
  for (let index = 0; index < count; index += 1) {
    result = ladder.frame({ behind }, INTERVAL, false);
  }
  return result;
};

describe('the warm-up ladder', () => {
  it('starts at the listener’s smallest size, an eighth only where nothing smaller is barred', () => {
    expect(createWarmupLadder().scale()).toBe(0.125);
    expect(createWarmupLadder(1, 0.35).scale()).toBe(0.35);
    expect(createWarmupLadder(1, 0.67).scale()).toBe(0.67);
    // Raising the floor lifts a climb still under it.
    const ladder = createWarmupLadder(1, 0.35);
    ladder.refloor(0.5);
    expect(ladder.scale()).toBe(0.5);
  });

  it('climbs one rung for every run of smooth frames, up to full size', () => {
    const ladder = createWarmupLadder();
    const seen = [ladder.scale()];
    WARMUP_RENDER_SCALES.slice(1).forEach(() => {
      frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB, FAST);
      seen.push(ladder.scale());
    });
    expect(seen).toEqual([...WARMUP_RENDER_SCALES]);
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 3, FAST);
    expect(ladder.scale()).toBe(1);
  });

  it('never climbs on a run that was not smooth', () => {
    const ladder = createWarmupLadder();
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB - 1, FAST);
    frames(ladder, 1, SLOW);
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB - 1, FAST);
    expect(ladder.scale()).toBe(0.125);
  });

  /**
   * With a clock, a frame still in hand is not held against the scene: in
   * the running window a fence is seen signalled a frame or two late, so one
   * in hand is the ordinary state, and reading it as "not smooth" kept a
   * member's scene at an eighth of the size for good.
   */
  it('climbs on the clock alone while a frame is still in hand', () => {
    const ladder = createWarmupLadder();
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB, FAST, 1);
    expect(ladder.scale()).toBe(0.25);
  });

  /** Built again for a program that ran whole seconds ago: no second climb from an eighth. */
  it('starts at the size the program has already proved, never above it', () => {
    const ladder = createWarmupLadder();
    ladder.resume(0.85);
    expect(ladder.scale()).toBe(0.85);
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB, FAST);
    expect(ladder.scale()).toBe(1);
    const other = createWarmupLadder();
    // A size between two rungs: the rung under it.
    other.resume(0.6);
    expect(other.scale()).toBe(0.5);
  });

  it('keeps its rung when the smallest size changes, and rests no lower than the new one', () => {
    const ladder = createWarmupLadder();
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 3, FAST);
    expect(ladder.scale()).toBe(0.5);
    ladder.refloor(0.5);
    expect(ladder.scale()).toBe(0.5);
    frames(ladder, 24, SLOW);
    expect(ladder.scale()).toBe(0.5);
    expect(ladder.slowed()).toBe(true);
  });

  it('steps back from a rung that runs slow, and does not try it again', () => {
    const ladder = createWarmupLadder();
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 2, FAST);
    expect(ladder.scale()).toBe(0.35);
    frames(ladder, 24, SLOW);
    expect(ladder.scale()).toBe(0.25);
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 5, FAST);
    // A scale that oscillates on the boundary is a visibly pulsing picture.
    expect(ladder.scale()).toBe(0.25);
  });

  it('gives up quickly on a scene that is hopeless even at the bottom', () => {
    const ladder = createWarmupLadder();
    expect(frames(ladder, WARMUP_HOPELESS_FRAMES - 1, HOPELESS)).toBe('ok');
    expect(frames(ladder, 1, HOPELESS)).toBe('degraded');
  });

  it('gives up on a scene that stays slow at the bottom', () => {
    const ladder = createWarmupLadder();
    expect(frames(ladder, 23, SLOW)).toBe('ok');
    expect(frames(ladder, 1, SLOW)).toBe('degraded');
  });

  /** The listener's smallest size: slow there, the rate goes before the picture. */
  it('holds the listener’s smallest size at the slow rate rather than backing past it', () => {
    const ladder = createWarmupLadder(1, 0.5);
    expect(ladder.scale()).toBe(0.5);
    expect(ladder.slowed()).toBe(false);
    frames(ladder, 24, SLOW);
    expect(ladder.scale()).toBe(0.5);
    expect(ladder.slowed()).toBe(true);
    // Smooth at the slow rate: it rests here, and does not climb again.
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 3, FAST);
    expect(ladder.scale()).toBe(0.5);
    expect(ladder.slowed()).toBe(true);
    // Slow even at that rate: never shown smaller than allowed, so handed over.
    expect(frames(ladder, 24, SLOW)).toBe('degraded');
    expect(ladder.scale()).toBe(0.5);
  });

  it('ignores frames from a hidden window', () => {
    const ladder = createWarmupLadder();
    for (let index = 0; index < 100; index += 1) {
      expect(
        ladder.frame({ costMs: HOPELESS, behind: 2 }, INTERVAL, true),
      ).toBe('ok');
    }
    expect(ladder.scale()).toBe(0.125);
  });

  /** Without a GPU clock, keeping up with the display is what smooth means. */
  it('climbs and steps back on the pipeline alone when the driver has no clock', () => {
    const ladder = createWarmupLadder();
    pipeline(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB, 0);
    expect(ladder.scale()).toBe(0.25);
    pipeline(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 2, 1);
    expect(ladder.scale()).toBe(0.25);
    pipeline(ladder, 24, 2);
    expect(ladder.scale()).toBe(0.125);
  });

  /** The supersampled size is the last rung, reached only after full size ran smooth. */
  it('climbs on to the supersampled size when given one, after full size', () => {
    const ladder = createWarmupLadder(2);
    frames(
      ladder,
      WARMUP_GOOD_FRAMES_TO_CLIMB * (WARMUP_RENDER_SCALES.length - 1),
      FAST,
    );
    expect(ladder.scale()).toBe(1);
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB, FAST);
    expect(ladder.scale()).toBe(2);
  });

  it('starts again from the bottom when reset', () => {
    const ladder = createWarmupLadder();
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 4, FAST);
    frames(ladder, 24, SLOW);
    ladder.reset();
    expect(ladder.scale()).toBe(0.125);
    frames(
      ladder,
      WARMUP_GOOD_FRAMES_TO_CLIMB * WARMUP_RENDER_SCALES.length,
      FAST,
    );
    expect(ladder.scale()).toBe(1);
  });
});
