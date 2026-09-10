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

const BUDGET = 1000 / 30;
const FAST = BUDGET * 0.9;
const SLOW = BUDGET * 3.5;
const HOPELESS = BUDGET * 12;

const frames = (
  ladder: ReturnType<typeof createWarmupLadder>,
  count: number,
  delta: number,
  budget = BUDGET,
) => {
  let result: 'ok' | 'degraded' = 'ok';
  for (let index = 0; index < count; index += 1) {
    result = ladder.frame(delta, budget, false);
  }
  return result;
};

describe('the warm-up ladder', () => {
  it('starts at an eighth of the size', () => {
    expect(createWarmupLadder().scale()).toBe(0.125);
  });

  it('climbs one rung for every run of smooth frames, up to full size', () => {
    const ladder = createWarmupLadder();
    const seen = [ladder.scale()];
    WARMUP_RENDER_SCALES.slice(1).forEach(() => {
      frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB, FAST);
      seen.push(ladder.scale());
    });
    expect(seen).toEqual([0.125, 0.25, 0.5, 0.75, 1]);
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 3, FAST);
    expect(ladder.scale()).toBe(1);
  });

  it('never climbs on a run that was not smooth', () => {
    const ladder = createWarmupLadder();
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB - 1, FAST);
    ladder.frame(SLOW, BUDGET, false);
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB - 1, FAST);
    expect(ladder.scale()).toBe(0.125);
  });

  it('steps back from a rung that runs slow, and does not try it again', () => {
    const ladder = createWarmupLadder();
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 2, FAST);
    expect(ladder.scale()).toBe(0.5);
    frames(ladder, 24, SLOW);
    expect(ladder.scale()).toBe(0.25);
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 5, FAST);
    // A scale that oscillates on the boundary is a visibly pulsing picture.
    expect(ladder.scale()).toBe(0.25);
  });

  it('gives up quickly on a scene that is hopeless even at the bottom', () => {
    const ladder = createWarmupLadder();
    expect(frames(ladder, WARMUP_HOPELESS_FRAMES - 1, HOPELESS)).toBe('ok');
    expect(ladder.frame(HOPELESS, BUDGET, false)).toBe('degraded');
  });

  it('gives up on a scene that stays slow at the bottom', () => {
    const ladder = createWarmupLadder();
    expect(frames(ladder, 23, SLOW)).toBe('ok');
    expect(ladder.frame(SLOW, BUDGET, false)).toBe('degraded');
  });

  it('ignores frames from a hidden window', () => {
    const ladder = createWarmupLadder();
    for (let index = 0; index < 100; index += 1) {
      expect(ladder.frame(HOPELESS, BUDGET, true)).toBe('ok');
    }
    expect(ladder.scale()).toBe(0.125);
  });

  it('judges an uncapped frame rate against thirty frames a second', () => {
    const ladder = createWarmupLadder();
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB, FAST, 0);
    expect(ladder.scale()).toBe(0.25);
  });

  it('starts again from the bottom when reset', () => {
    const ladder = createWarmupLadder();
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 4, FAST);
    frames(ladder, 24, SLOW);
    ladder.reset();
    expect(ladder.scale()).toBe(0.125);
    frames(ladder, WARMUP_GOOD_FRAMES_TO_CLIMB * 4, FAST);
    expect(ladder.scale()).toBe(1);
  });
});
