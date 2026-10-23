/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAmbientElement } from 'common/sceneAmbient';

/**
 * A creature thrown from the hand (`ScenePointerLayer.tsx`): a picture that
 * looks one way and flies - Alpine's birds, Coral's fish. It used to be
 * thrown like a petal: turned to a random angle and spun, squashed by a
 * leaf's flutter, held in one pose and braked by the air where it was
 * thrown, so birds flew on their backs and sideways and hung where they
 * were tapped (Ivan, 2026-10-04: "fix the click to rise birds ... right
 * side and positions to fly out and then disappear"). Now it takes off up
 * and out to one side, faces where it flies and leans into its climb as
 * the window's own fliers do (`pictureBearing`), beats its wings through its
 * poses (`wingbeatPoses`), speeds up as it goes and dwindles as it flies
 * off; and it starts nearer, bigger, the lower on the scene it is thrown
 * ("if click on the bottom of the screen they are bigger than if on the top
 * since they should look more far away").
 */

const TAU = Math.PI * 2;
/** Wingbeats a second: a small bird's laboured take-off, not a hover. */
const BEATS = 3.2;
/**
 * How much faster it flies each second, once off the hand, and the fastest
 * it gets near (CSS pixels a second, times its depth). Alpine's birds, tapped
 * anywhere below the sky, stay in a 1280 x 720 scene for a second and a half
 * on the median before they fade (simulated over 200 throws); at 0.8 and 720
 * the flock was gone in under a second.
 */
const THRUST = 0.3;
const TOP_SPEED = 360;
/** How much of its size it has lost by the end of its life. */
const DWINDLE = 0.45;
/**
 * Never closer than this to straight along the throw, nor to straight back
 * against it, in radians (26 degrees): a creature that looks one way cannot
 * face straight up or down, and one climbing vertically read as flying
 * sideways.
 */
const OFF_THE_THROW = 0.45;

export const isFlier = (element: IAmbientElement | undefined): boolean =>
  element?.shape === 'picture' &&
  element.motion === 'fly' &&
  (element.facing === 'left' || element.facing === 'right');

/**
 * How near the place it is thrown from is, as a share of the emitter's size
 * and speed: half at the top (far), 1.25 halfway down, twice at the bottom
 * (near). A far bird is smaller and crosses fewer pixels a second.
 */
export const flierDepth = (y: number, height: number): number =>
  0.5 + 1.5 * Math.min(1, Math.max(0, y / Math.max(1, height)));

/**
 * The direction it leaves the hand in: to one side of `heading` (up, for a
 * tap), at least `OFF_THE_THROW` off it and as far round as the emitter's
 * spread allows - Alpine's birds (spread 0.5) up to level, Coral's fish
 * (spread 1) all round but straight down.
 */
export const flierAngle = (
  heading: number,
  spread: number,
  random: () => number,
): number => {
  const side = random() < 0.5 ? -1 : 1;
  const widest = Math.min(
    Math.PI - OFF_THE_THROW,
    Math.max(OFF_THE_THROW, spread * Math.PI),
  );
  return heading + side * (OFF_THE_THROW + random() * (widest - OFF_THE_THROW));
};

/**
 * Its velocity after `dt` seconds: faster as it gets going, never past its
 * top speed, and turned by the emitter's own `pull` (pixels a second a
 * second, negative up) - no air braking it, since it flies. The pull and the
 * top speed are its depth's, like its size.
 */
export const flierStep = (
  vx: number,
  vy: number,
  pull: number,
  depth: number,
  dt: number,
): { vx: number; vy: number } => {
  const thrust = Math.exp(THRUST * dt);
  const nextX = vx * thrust;
  const nextY = vy * thrust + pull * depth * dt;
  const speed = Math.hypot(nextX, nextY);
  const top = TOP_SPEED * depth;
  const cap = speed > top ? top / speed : 1;
  return { vx: nextX * cap, vy: nextY * cap };
};

/** Where in its wingbeat it is, `age` seconds after a start at `phase`. */
export const flierPhase = (age: number, phase: number): number =>
  phase + age * BEATS * TAU;

/** Its size now against its size when thrown: it dwindles as it goes. */
export const flierDwindle = (age: number, life: number): number =>
  1 - DWINDLE * Math.min(1, Math.max(0, age / Math.max(1e-6, life)));
