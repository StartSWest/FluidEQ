/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  canvasPlan,
  scissorBox,
} from '../../../renderer/graph/sceneCanvasPlan';
import { createSceneDrawClock } from '../../../renderer/graph/sceneDrawClock';
import { SCENE_TIME_WRAP_S } from '../../../common/sceneUniformContract';

describe('the clock a scene is drawn on', () => {
  it('steps its first frame by the page’s own step, then by the worker’s refreshes', () => {
    const clock = createSceneDrawClock();
    expect(clock.drawnAt()).toBeUndefined();
    expect(clock.advance(1000, 16)).toEqual({
      timeSeconds: 0.016,
      deltaMs: 16,
    });
    expect(clock.intervalMs()).toBeUndefined();
    const second = clock.advance(1010, 16);
    expect(second.deltaMs).toBe(10);
    expect(second.timeSeconds).toBeCloseTo(0.026, 9);
    expect(clock.drawnAt()).toBe(1010);
    expect(clock.intervalMs()).toBe(10);
  });

  it('does not catch up a stall longer than a tenth of a second', () => {
    const clock = createSceneDrawClock();
    clock.advance(0, 0);
    expect(clock.advance(5000, 16).deltaMs).toBe(100);
    // A page step past the cap is held to it too.
    const fresh = createSceneDrawClock();
    expect(fresh.advance(0, 900).deltaMs).toBe(100);
  });

  it('keeps its time through a pause and starts again from nothing on restart', () => {
    const clock = createSceneDrawClock();
    clock.advance(0, 50);
    clock.advance(40, 16);
    clock.pause();
    expect(clock.drawnAt()).toBeUndefined();
    expect(clock.intervalMs()).toBeUndefined();
    // After a pause the page's step counts, not the time spent away.
    expect(clock.advance(60_000, 20).timeSeconds).toBeCloseTo(0.11, 9);
    clock.restart();
    expect(clock.advance(61_000, 30).timeSeconds).toBeCloseTo(0.03, 9);
  });

  it('wraps like the page’s clock did', () => {
    const clock = createSceneDrawClock();
    let now = 0;
    clock.advance(now, 0);
    let last = 0;
    for (let i = 0; i < (SCENE_TIME_WRAP_S * 1000) / 100 + 5; i += 1) {
      now += 100;
      last = clock.advance(now, 0).timeSeconds;
    }
    expect(last).toBeLessThan(1);
    expect(last).toBeGreaterThanOrEqual(0);
  });
});

describe('what the canvas shows', () => {
  const output = { width: 1920, height: 1080 };

  it('is the panel’s own pixels when FSR brings a smaller picture up', () => {
    expect(
      canvasPlan(960, 540, output, { fsr: true, fxaa: false }),
    ).toMatchObject({ canvasWidth: 1920, canvasHeight: 1080, fsr: true });
  });

  it('is the drawn size when a smaller picture is left to the compositor', () => {
    expect(
      canvasPlan(960, 540, output, { fsr: false, fxaa: true }),
    ).toMatchObject({ canvasWidth: 960, canvasHeight: 540, fxaa: true });
  });

  it('is the panel’s pixels when a larger picture is averaged down', () => {
    expect(
      canvasPlan(3840, 2160, output, { fsr: false, fxaa: false }),
    ).toMatchObject({
      drawnWidth: 3840,
      drawnHeight: 2160,
      canvasWidth: 1920,
      canvasHeight: 1080,
    });
  });

  it('turns a clip in panel fractions into a scissor box from the bottom', () => {
    expect(scissorBox([0, 0, 1, 1], 200, 100)).toEqual([0, 0, 200, 100]);
    // The top half of the panel is the upper half of the target.
    expect(scissorBox([0, 0, 1, 0.5], 200, 100)).toEqual([0, 50, 200, 50]);
    // Partial pixels round outwards, never losing an edge.
    expect(scissorBox([0.101, 0.2, 0.499, 0.7], 100, 10)).toEqual([
      10, 3, 40, 5,
    ]);
  });
});
