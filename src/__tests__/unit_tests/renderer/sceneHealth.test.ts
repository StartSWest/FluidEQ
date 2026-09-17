/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createCostLadder,
  isSceneRenderingAvailable,
  ladderScales,
  SCENE_BOUNCE_MS,
  SCENE_CEILING_MS,
  SCENE_CLIMB_MS,
  SCENE_FINISH_SHARE,
  SCENE_HOLD_MS,
  SCENE_OVER_SHARE,
  SCENE_RENDER_SCALES,
  SCENE_SLOW_FRAME_FACTOR,
  SCENE_SLOW_FRAMES_TO_STEP,
  SCENE_STEP_DOWN_FRAMES,
  SCENE_TARGET_SHARE,
  setSceneRenderingAvailableForTesting,
  type ICostLadder,
} from '../../../renderer/graph/sceneHealth';

/** A hundred-hertz display. */
const INTERVAL = 10;

const framesOf = (ms: number) => Math.ceil(ms / INTERVAL);

const cost = (ladder: ICostLadder, costMs: number, count = 1) => {
  let last: 'ok' | 'degraded' = 'ok';
  for (let i = 0; i < count; i += 1) {
    last = ladder.frame({ costMs, behind: 0 }, INTERVAL, false);
  }
  return last;
};

const behind = (ladder: ICostLadder, frames: number, count = 1) => {
  let last: 'ok' | 'degraded' = 'ok';
  for (let i = 0; i < count; i += 1) {
    last = ladder.frame({ behind: frames }, INTERVAL, false);
  }
  return last;
};

describe('whether a scene can run here', () => {
  afterEach(() => setSceneRenderingAvailableForTesting(undefined));

  /**
   * jsdom answers null for every context, which is exactly what a machine with
   * no usable GPU does — and the right answer for both is "no premium rows".
   */
  it('answers no where the canvas cannot make a WebGL2 context', () => {
    expect(isSceneRenderingAvailable()).toBe(false);
  });

  it('probes once and remembers', () => {
    const spy = jest.spyOn(document, 'createElement');
    isSceneRenderingAvailable();
    isSceneRenderingAvailable();
    expect(
      spy.mock.calls.filter(([tag]) => String(tag) === 'canvas'),
    ).toHaveLength(1);
    spy.mockRestore();
  });
});

describe('the resolution controller', () => {
  it('starts at full resolution and stays there while frames fit', () => {
    const ladder = createCostLadder();
    expect(cost(ladder, INTERVAL * SCENE_OVER_SHARE, 300)).toBe('ok');
    expect(ladder.scale()).toBe(1);
  });

  it('steps down after a run of frames over budget', () => {
    const ladder = createCostLadder();
    cost(ladder, INTERVAL, SCENE_STEP_DOWN_FRAMES - 1);
    expect(ladder.scale()).toBe(1);
    cost(ladder, INTERVAL);
    expect(ladder.scale()).toBeLessThan(1);
  });

  /** A single pause must not lower the picture for the rest of the session. */
  it('resets its count on a frame that fits', () => {
    const ladder = createCostLadder();
    cost(ladder, INTERVAL, SCENE_STEP_DOWN_FRAMES - 1);
    cost(ladder, INTERVAL * 0.5);
    cost(ladder, INTERVAL, SCENE_STEP_DOWN_FRAMES - 1);
    expect(ladder.scale()).toBe(1);
  });

  /**
   * A shader's cost is per pixel: a scene four times too heavy goes straight
   * to the rung its measured cost predicts will fit, not one rung at a time.
   */
  it('steps straight to the rung the measured cost says will fit', () => {
    const ladder = createCostLadder();
    const heavy = INTERVAL * 2;
    cost(ladder, heavy, SCENE_STEP_DOWN_FRAMES);
    const scale = ladder.scale();
    expect(heavy * scale * scale).toBeLessThanOrEqual(
      INTERVAL * SCENE_TARGET_SHARE,
    );
    // And not further than it had to.
    const above = SCENE_RENDER_SCALES[SCENE_RENDER_SCALES.indexOf(scale) - 1];
    expect(heavy * above * above).toBeGreaterThan(
      INTERVAL * SCENE_TARGET_SHARE,
    );
  });

  it('steps down on the pipeline alone when the driver has no clock', () => {
    const ladder = createCostLadder();
    behind(ladder, 1, SCENE_STEP_DOWN_FRAMES);
    expect(ladder.scale()).toBe(SCENE_RENDER_SCALES[1]);
  });

  /**
   * `backgroundThrottling` drops an occluded window to about one frame a
   * second. Counting those would ratchet the quality down every minute the
   * window sat minimised.
   */
  it('ignores frames while the window is hidden', () => {
    const ladder = createCostLadder();
    for (let i = 0; i < 100; i += 1) {
      ladder.frame({ costMs: 1000, behind: 2 }, INTERVAL, true);
    }
    expect(ladder.scale()).toBe(1);
  });

  it('climbs back in one jump to the largest rung the cost says fits, after a second of clean frames', () => {
    const ladder = createCostLadder();
    cost(ladder, INTERVAL * 1.2, SCENE_STEP_DOWN_FRAMES);
    const lowered = ladder.scale();
    expect(lowered).toBeLessThan(1);
    // Cheap now: full size is predicted to fit easily, and it goes straight there.
    cost(ladder, INTERVAL * 0.2, framesOf(SCENE_HOLD_MS + SCENE_CLIMB_MS) + 2);
    expect(ladder.scale()).toBe(1);
  });

  it('climbs only as far as the cost says fits', () => {
    const ladder = createCostLadder();
    cost(ladder, INTERVAL * 1.2, SCENE_STEP_DOWN_FRAMES);
    expect(ladder.scale()).toBe(0.67);
    // The scene now costs 7.8 ms at full size: 3.5 at 0.67, 5.6 at 0.85 —
    // which fits with room to spare — and 7.8 at full, which does not. One
    // step to 0.85, and no further however long it stays clean there.
    const native = INTERVAL * 0.78;
    for (let i = 0; i < framesOf(SCENE_HOLD_MS + SCENE_CLIMB_MS) + 2; i += 1) {
      cost(ladder, native * ladder.scale() ** 2);
    }
    expect(ladder.scale()).toBe(0.85);
    for (let i = 0; i < framesOf(SCENE_CLIMB_MS) * 3; i += 1) {
      cost(ladder, native * ladder.scale() ** 2);
    }
    expect(ladder.scale()).toBe(0.85);
  });

  it('does not climb while the next rung up is predicted not to fit', () => {
    const ladder = createCostLadder();
    cost(ladder, INTERVAL * 1.2, SCENE_STEP_DOWN_FRAMES);
    const lowered = ladder.scale();
    // Fits at this size, but the rung above would not: just under budget here.
    cost(ladder, INTERVAL * 0.65, framesOf(SCENE_HOLD_MS + SCENE_CLIMB_MS) * 3);
    expect(ladder.scale()).toBe(lowered);
  });

  it('climbs by trying when the driver has no clock', () => {
    const ladder = createCostLadder();
    behind(ladder, 1, SCENE_STEP_DOWN_FRAMES);
    expect(ladder.scale()).toBe(SCENE_RENDER_SCALES[1]);
    behind(ladder, 0, framesOf(SCENE_HOLD_MS + SCENE_CLIMB_MS) + 2);
    expect(ladder.scale()).toBe(1);
  });

  /**
   * A shader's cost follows its pixels. A scene that costs 16 ms at full
   * size is drawn at 0.67 (7.2 ms, inside the budget) — and sits there: the
   * rung above would cost 9.5, over budget, so the exact clock never climbs
   * to it, and a picture that would pulse between two sizes never does.
   */
  it('settles where the measured cost fits and does not climb into a step down', () => {
    const ladder = createCostLadder();
    const native = INTERVAL * 1.6;
    const costAt = () => native * ladder.scale() ** 2;
    for (let i = 0; i < SCENE_STEP_DOWN_FRAMES; i += 1) {
      cost(ladder, costAt());
    }
    const settled = ladder.scale();
    expect(settled).toBeLessThan(1);
    expect(costAt()).toBeLessThanOrEqual(INTERVAL * SCENE_TARGET_SHARE);
    for (let i = 0; i < framesOf(SCENE_CEILING_MS); i += 1) {
      cost(ladder, costAt());
    }
    expect(ladder.scale()).toBe(settled);
  });

  /**
   * Without a clock the controller climbs by trying, and a try that fails at
   * once is a bounce: a picture that pulses between two sizes on the boundary
   * is worse than the smaller one, so that rung is barred for a minute.
   */
  it('bars a rung that had to be undone shortly after climbing to it', () => {
    const ladder = createCostLadder();
    behind(ladder, 1, SCENE_STEP_DOWN_FRAMES);
    const lowered = ladder.scale();
    behind(ladder, 0, framesOf(SCENE_HOLD_MS + SCENE_CLIMB_MS) + 2);
    expect(ladder.scale()).toBe(1);
    // Behind again right away: a bounce.
    behind(ladder, 1, SCENE_STEP_DOWN_FRAMES);
    expect(ladder.scale()).toBe(lowered);
    // Keeping up for a long while, but the rung is barred for a minute.
    behind(ladder, 0, framesOf(SCENE_CEILING_MS) - 10);
    expect(ladder.scale()).toBe(lowered);
    behind(ladder, 0, framesOf(SCENE_CLIMB_MS) + 20);
    expect(ladder.scale()).toBe(1);
  });

  it('does not count a late step down as a bounce', () => {
    const ladder = createCostLadder();
    behind(ladder, 1, SCENE_STEP_DOWN_FRAMES);
    const lowered = ladder.scale();
    behind(ladder, 0, framesOf(SCENE_HOLD_MS + SCENE_CLIMB_MS) + 2);
    expect(ladder.scale()).toBe(1);
    behind(ladder, 0, framesOf(SCENE_BOUNCE_MS) + 1);
    behind(ladder, 1, SCENE_STEP_DOWN_FRAMES);
    expect(ladder.scale()).toBe(lowered);
    // No ceiling: it climbs again after the usual wait.
    behind(ladder, 0, framesOf(SCENE_HOLD_MS + SCENE_CLIMB_MS) + 2);
    expect(ladder.scale()).toBe(1);
  });

  it('reports degraded once the floor is reached and it is still far too slow', () => {
    const ladder = createCostLadder();
    const hopeless = INTERVAL * SCENE_SLOW_FRAME_FACTOR * 4;
    cost(ladder, hopeless, SCENE_STEP_DOWN_FRAMES);
    expect(ladder.scale()).toBe(
      SCENE_RENDER_SCALES[SCENE_RENDER_SCALES.length - 1],
    );
    expect(cost(ladder, hopeless, SCENE_SLOW_FRAMES_TO_STEP)).toBe('degraded');
  });

  it('holds the floor without giving up while frames are merely over budget', () => {
    const ladder = createCostLadder();
    cost(ladder, INTERVAL * 20, SCENE_STEP_DOWN_FRAMES);
    expect(cost(ladder, INTERVAL * 1.5, 500)).toBe('ok');
  });

  /** The listener's floor: the rungs stop there, and the rate goes next. */
  it('stops at the listener’s smallest size and slows the rate below it', () => {
    expect(ladderScales(1, 0.67)).toEqual([1, 0.85, 0.77, 0.67]);
    const ladder = createCostLadder(1, 0.67);
    // 16 ms a frame at full size fits nowhere down to 0.67 (7.2 ms): straight
    // to the smallest allowed picture at the slow rate.
    cost(ladder, INTERVAL * 1.6, SCENE_STEP_DOWN_FRAMES);
    expect(ladder.scale()).toBe(0.67);
    expect(ladder.slowed()).toBe(true);
    // Not slow at thirty a second any more: it stays, and never degrades.
    expect(cost(ladder, INTERVAL * 1.6 * 0.449, 200)).toBe('ok');
    expect(ladder.slowed()).toBe(true);
  });

  it('climbs out of the slow rate once the picture fits at the rate it left', () => {
    const ladder = createCostLadder(1, 0.67);
    cost(ladder, INTERVAL * 1.6, SCENE_STEP_DOWN_FRAMES);
    expect(ladder.slowed()).toBe(true);
    // The scene got cheap: 2 ms at 0.67 is 4.5 at full size, which fits at
    // the hundred hertz it was slowed from — back to full, unslowed, in one.
    const slowInterval = INTERVAL * 3;
    for (let i = 0; i < framesOf(SCENE_HOLD_MS + SCENE_CLIMB_MS); i += 1) {
      ladder.frame({ costMs: INTERVAL * 0.2, behind: 0 }, slowInterval, false);
    }
    expect(ladder.slowed()).toBe(false);
    expect(ladder.scale()).toBe(1);
  });

  it('starts at a size the program has already proved, or full where it proved full', () => {
    const ladder = createCostLadder();
    ladder.resume(0.67);
    expect(ladder.scale()).toBe(0.67);
    ladder.resume(2);
    expect(ladder.scale()).toBe(1);
  });

  it('keeps the picture where it is when the smallest size changes', () => {
    const ladder = createCostLadder();
    cost(ladder, INTERVAL * 1.2, SCENE_STEP_DOWN_FRAMES);
    expect(ladder.scale()).toBe(0.67);
    // The rung is still among the new ones: nothing moves.
    ladder.refloor(0.5);
    expect(ladder.scale()).toBe(0.67);
    // Below the new floor: the smallest allowed, not a fresh start at full.
    ladder.refloor(0.85);
    expect(ladder.scale()).toBe(0.85);
    expect(ladder.slowed()).toBe(false);
  });

  /** A frame still in hand is not late on a driver with a clock. */
  it('does not read a frame still in hand as over budget while the clock says it fits', () => {
    const ladder = createCostLadder();
    for (let i = 0; i < SCENE_STEP_DOWN_FRAMES * 4; i += 1) {
      ladder.frame({ costMs: INTERVAL * 0.2, behind: 1 }, INTERVAL, false);
    }
    expect(ladder.scale()).toBe(1);
  });

  it('has no slow rate to fall back on where frames already arrive at thirty', () => {
    const ladder = createCostLadder(1, 0.67);
    const slow = 40;
    for (let i = 0; i < SCENE_STEP_DOWN_FRAMES; i += 1) {
      ladder.frame({ costMs: slow * 4, behind: 0 }, slow, false);
    }
    expect(ladder.scale()).toBe(0.67);
    expect(ladder.slowed()).toBe(false);
    let last: 'ok' | 'degraded' = 'ok';
    for (let i = 0; i < SCENE_SLOW_FRAMES_TO_STEP; i += 1) {
      last = ladder.frame({ costMs: slow * 4, behind: 0 }, slow, false);
    }
    expect(last).toBe('degraded');
  });

  it('starts over on reset', () => {
    const ladder = createCostLadder();
    cost(ladder, INTERVAL * 20, SCENE_STEP_DOWN_FRAMES * 4);
    ladder.reset();
    expect(ladder.scale()).toBe(1);
    expect(cost(ladder, INTERVAL * 0.5)).toBe('ok');
  });

  /** `best` smoothing draws larger than the panel: one rung above full. */
  it('starts at the supersampled size when given one, and steps down to full first', () => {
    const ladder = createCostLadder(2);
    expect(ladder.scale()).toBe(2);
    expect(ladderScales(2)).toEqual([2, ...SCENE_RENDER_SCALES]);
    expect(ladderScales(1)).toEqual(SCENE_RENDER_SCALES);
    // Four times the pixels: a frame just under 4× the target predicts that
    // full size fits, and nothing smaller is needed.
    cost(
      ladder,
      INTERVAL * SCENE_TARGET_SHARE * 4 * 0.98,
      SCENE_STEP_DOWN_FRAMES,
    );
    expect(ladder.scale()).toBe(1);
  });

  /**
   * The finishing passes cost per pixel of the panel, whatever the scene's
   * size, so on a weak GPU they can be what does not fit: past a run of them
   * the plain scaler is used for the session.
   */
  it('gives up the sharp scaler once finishing alone is too dear, for the session', () => {
    const ladder = createCostLadder();
    expect(ladder.cheapFinish()).toBe(false);
    const dear = INTERVAL * SCENE_FINISH_SHARE * 1.2;
    for (let i = 0; i < SCENE_STEP_DOWN_FRAMES - 1; i += 1) {
      ladder.frame(
        { costMs: dear + 1, postMs: dear, behind: 0 },
        INTERVAL,
        false,
      );
    }
    expect(ladder.cheapFinish()).toBe(false);
    ladder.frame(
      { costMs: dear + 1, postMs: dear, behind: 0 },
      INTERVAL,
      false,
    );
    expect(ladder.cheapFinish()).toBe(true);
    // Cheap frames afterwards do not bring it back within the session.
    cost(ladder, 1, 1000);
    expect(ladder.cheapFinish()).toBe(true);
    ladder.reset();
    expect(ladder.cheapFinish()).toBe(false);
  });

  it('does not count finishing that was never timed as dear', () => {
    const ladder = createCostLadder();
    cost(ladder, INTERVAL * 2, SCENE_STEP_DOWN_FRAMES * 4);
    behind(ladder, 1, SCENE_STEP_DOWN_FRAMES * 4);
    expect(ladder.cheapFinish()).toBe(false);
  });
});
