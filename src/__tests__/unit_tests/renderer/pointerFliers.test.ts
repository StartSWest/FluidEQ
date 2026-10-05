/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A creature thrown from the hand flies off rather than tumbling: it leaves
 * to one side of the throw, never straight up or down where a picture that
 * looks one way cannot face; it is bigger and quicker thrown low on the
 * scene, where it is near, and smaller and slower high up; it gets faster
 * as it goes, never past its top speed, and dwindles as it flies off.
 */

import type { IAmbientElement } from 'common/sceneAmbient';
import {
  flierAngle,
  flierDepth,
  flierDwindle,
  flierPhase,
  flierStep,
  isFlier,
} from 'renderer/graph/pointerFliers';

const UP = -Math.PI / 2;
/** How far `angle` is from `heading`, the short way round. */
const apart = (angle: number, heading: number) =>
  Math.abs(Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading)));

/** The same numbers every run. */
const dice = () => {
  let seed = 7;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
};

const bird = (overrides: Partial<IAmbientElement> = {}): IAmbientElement => ({
  id: 'gulls',
  shape: 'picture',
  frames: [
    [0, 0, 64, 64],
    [64, 0, 64, 64],
  ],
  facing: 'right',
  colours: [],
  count: 4,
  size: [20, 30],
  opacity: 1,
  motion: 'fly',
  speed: 0.5,
  area: 'top',
  flap: 0.5,
  turn: 0.5,
  music: 'mid',
  react: 0,
  ...overrides,
});

describe('a creature thrown from the hand', () => {
  it('is a picture that flies and looks one way', () => {
    expect(isFlier(bird())).toBe(true);
    expect(isFlier(bird({ facing: 'left' }))).toBe(true);
    expect(isFlier(bird({ facing: 'none' }))).toBe(false);
    expect(isFlier(bird({ motion: 'drift' }))).toBe(false);
    expect(isFlier(bird({ shape: 'bird' }))).toBe(false);
    expect(isFlier(undefined)).toBe(false);
  });

  it('is near at the bottom of the scene and far at the top', () => {
    expect(flierDepth(0, 400)).toBeCloseTo(0.5);
    expect(flierDepth(200, 400)).toBeCloseTo(1.25);
    expect(flierDepth(400, 400)).toBeCloseTo(2);
    // A tap just past the box keeps to the box's ends.
    expect(flierDepth(-8, 400)).toBeCloseTo(0.5);
    expect(flierDepth(408, 400)).toBeCloseTo(2);
  });

  it('takes off to either side of the throw, never straight up or down', () => {
    const random = dice();
    const sides = new Set<number>();
    for (let throwIndex = 0; throwIndex < 400; throwIndex += 1) {
      const angle = flierAngle(UP, 1, random);
      expect(apart(angle, UP)).toBeGreaterThanOrEqual(0.45 - 1e-9);
      expect(apart(angle, -UP)).toBeGreaterThanOrEqual(0.45 - 1e-9);
      sides.add(Math.sign(Math.cos(angle)));
    }
    expect(sides).toEqual(new Set([-1, 1]));
  });

  it('goes as far round as the spread allows, and no further', () => {
    const random = dice();
    let widestHalf = 0;
    let widestWhole = 0;
    for (let throwIndex = 0; throwIndex < 400; throwIndex += 1) {
      widestHalf = Math.max(widestHalf, apart(flierAngle(UP, 0.5, random), UP));
      widestWhole = Math.max(widestWhole, apart(flierAngle(UP, 1, random), UP));
    }
    // Alpine's birds, half a turn of spread: up to level and never below it.
    expect(widestHalf).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
    expect(widestHalf).toBeGreaterThan(Math.PI / 2 - 0.05);
    // Coral's fish, a whole turn: down past level as well.
    expect(widestWhole).toBeGreaterThan(Math.PI / 2 + 0.5);
  });

  it('takes off at least a little to one side however small the spread', () => {
    const random = dice();
    for (let throwIndex = 0; throwIndex < 100; throwIndex += 1) {
      expect(apart(flierAngle(UP, 0, random), UP)).toBeCloseTo(0.45);
    }
  });

  it('gets faster as it goes, up to its top speed, which is its depth’s', () => {
    let near = { vx: 100, vy: 0 };
    let far = { vx: 100, vy: 0 };
    let last = 100;
    for (let frame = 0; frame < 60; frame += 1) {
      near = flierStep(near.vx, near.vy, 0, 2, 1 / 60);
      far = flierStep(far.vx, far.vy, 0, 0.5, 1 / 60);
      expect(near.vx).toBeGreaterThan(last);
      last = near.vx;
    }
    // A second of thrust: e^0.3 times what it left the hand at.
    expect(near.vx).toBeCloseTo(100 * Math.exp(0.3), 0);
    for (let frame = 0; frame < 6000; frame += 1) {
      near = flierStep(near.vx, near.vy, 0, 2, 1 / 60);
      far = flierStep(far.vx, far.vy, 0, 0.5, 1 / 60);
    }
    expect(Math.hypot(near.vx, near.vy)).toBeCloseTo(720);
    expect(Math.hypot(far.vx, far.vy)).toBeCloseTo(180);
  });

  it('is drawn up by the pull, as hard as it is near', () => {
    const near = flierStep(100, 0, -100, 2, 0.1);
    const far = flierStep(100, 0, -100, 0.5, 0.1);
    expect(near.vy).toBeCloseTo(-20);
    expect(far.vy).toBeCloseTo(-5);
  });

  it('beats its wings 3.2 times a second, from its own start', () => {
    const turn = Math.PI * 2;
    expect(flierPhase(0, 1.5)).toBeCloseTo(1.5);
    expect(flierPhase(1, 0)).toBeCloseTo(3.2 * turn);
  });

  it('dwindles as it flies off, to a little over half its size', () => {
    expect(flierDwindle(0, 2)).toBe(1);
    expect(flierDwindle(1, 2)).toBeCloseTo(0.775);
    expect(flierDwindle(2, 2)).toBeCloseTo(0.55);
    expect(flierDwindle(3, 2)).toBeCloseTo(0.55);
  });
});
