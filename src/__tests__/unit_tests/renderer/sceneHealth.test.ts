/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createCostLadder,
  isSceneRenderingAvailable,
  SCENE_RENDER_SCALES,
  SCENE_SLOW_FRAME_FACTOR,
  SCENE_SLOW_FRAMES_TO_STEP,
  setSceneRenderingAvailableForTesting,
} from '../../../renderer/graph/sceneHealth';

const BUDGET = 1000 / 30;

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

describe('the cost ladder', () => {
  const slowFrames = (
    ladder: ReturnType<typeof createCostLadder>,
    n: number,
  ) => {
    let last: 'ok' | 'degraded' = 'ok';
    for (let i = 0; i < n; i += 1) {
      last = ladder.frame(BUDGET * SCENE_SLOW_FRAME_FACTOR + 1, BUDGET, false);
    }
    return last;
  };

  it('starts at full resolution and stays there while frames are on time', () => {
    const ladder = createCostLadder();
    for (let i = 0; i < 100; i += 1) {
      expect(ladder.frame(BUDGET, BUDGET, false)).toBe('ok');
    }
    expect(ladder.scale()).toBe(1);
  });

  it('steps down one rung after a run of slow frames', () => {
    const ladder = createCostLadder();
    slowFrames(ladder, SCENE_SLOW_FRAMES_TO_STEP - 1);
    expect(ladder.scale()).toBe(SCENE_RENDER_SCALES[0]);
    slowFrames(ladder, 1);
    expect(ladder.scale()).toBe(SCENE_RENDER_SCALES[1]);
  });

  /** A single pause must not lower the picture for the rest of the session. */
  it('resets its count on a frame that is on time', () => {
    const ladder = createCostLadder();
    slowFrames(ladder, SCENE_SLOW_FRAMES_TO_STEP - 1);
    ladder.frame(BUDGET, BUDGET, false);
    slowFrames(ladder, SCENE_SLOW_FRAMES_TO_STEP - 1);
    expect(ladder.scale()).toBe(1);
  });

  /**
   * `backgroundThrottling` drops an occluded window to about one frame a
   * second. Counting those would ratchet the quality down every minute the
   * window sat minimised.
   */
  it('ignores frames while the window is hidden', () => {
    const ladder = createCostLadder();
    for (let i = 0; i < 100; i += 1) {
      ladder.frame(1000, BUDGET, true);
    }
    expect(ladder.scale()).toBe(1);
  });

  it('never steps back up within a session', () => {
    const ladder = createCostLadder();
    slowFrames(ladder, SCENE_SLOW_FRAMES_TO_STEP);
    for (let i = 0; i < 500; i += 1) {
      ladder.frame(1, BUDGET, false);
    }
    expect(ladder.scale()).toBe(SCENE_RENDER_SCALES[1]);
  });

  it('reports degraded once the floor is reached and it is still too slow', () => {
    const ladder = createCostLadder();
    SCENE_RENDER_SCALES.forEach(() =>
      slowFrames(ladder, SCENE_SLOW_FRAMES_TO_STEP),
    );
    expect(ladder.scale()).toBe(
      SCENE_RENDER_SCALES[SCENE_RENDER_SCALES.length - 1],
    );
    expect(slowFrames(ladder, SCENE_SLOW_FRAMES_TO_STEP)).toBe('degraded');
  });

  it('starts over on reset', () => {
    const ladder = createCostLadder();
    slowFrames(ladder, SCENE_SLOW_FRAMES_TO_STEP * 4);
    ladder.reset();
    expect(ladder.scale()).toBe(1);
    expect(ladder.frame(BUDGET, BUDGET, false)).toBe('ok');
  });
});
