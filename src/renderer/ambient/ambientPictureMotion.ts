/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAmbientElement } from 'common/sceneAmbient';
import type { IAmbientParticle } from './ambientField';

/**
 * How a `picture` element moves that an outline does not: which of its own
 * poses it shows, and which way it looks. Plain numbers, like the field.
 */

const TAU = Math.PI * 2;

/** The motions that go somewhere, and so have a way for a picture to face. */
const HEADED_MOTIONS: ReadonlySet<IAmbientElement['motion']> = new Set([
  'fly',
  'drift',
  'wander',
]);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * The poses of `count` frames at `phase`, with their shares, `glide` of the
 * whole given to the resting pose `rest`. The frames play through once per
 * turn of the phase — one wingbeat for a flier — each dissolving into the
 * next over the middle of its turn, the way Alpine's own shader blends its
 * bird sprites.
 */
export const wingbeatPoses = (
  count: number,
  phase: number,
  rest?: number,
  glide = 0,
): (readonly [number, number])[] => {
  if (count === 0) {
    return [];
  }
  const turn = phase / TAU;
  const cycle = (turn - Math.floor(turn)) * count;
  const at = Math.floor(cycle) % count;
  const blend = smoothstep(0.15, 0.85, cycle - Math.floor(cycle));
  const held = rest === undefined ? 0 : glide;
  const shares = new Map<number, number>();
  const add = (index: number, share: number) => {
    if (share > 0.01) {
      shares.set(index, (shares.get(index) ?? 0) + share);
    }
  };
  add(at, (1 - blend) * (1 - held));
  add((at + 1) % count, blend * (1 - held));
  if (rest !== undefined) {
    add(rest, held);
  }
  return [...shares];
};

/**
 * A picture's poses this frame, with their shares: its wingbeat, and, for
 * one with a resting pose, a settle into it every few seconds to glide, on
 * the same slow wave that holds an outline bird's wings out.
 */
export const picturePoses = (
  element: IAmbientElement,
  particle: Pick<IAmbientParticle, 'phase' | 'seed'>,
  time: number,
): (readonly [number, number])[] =>
  wingbeatPoses(
    element.frames?.length ?? 0,
    particle.phase,
    element.rest,
    smoothstep(-0.1, 0.35, Math.sin(time * 0.45 + particle.seed * 9)),
  );

/**
 * Which way a picture faces and leans. One that looks one way turns to face
 * where it travels; a flier, or anything that looks one way, leans into its
 * climb and never rolls over; the rest turn as the outlines do. `wave` is
 * the particle's flap, 0..1, which a twinkling picture shimmers with.
 */
export const pictureBearing = (
  element: IAmbientElement,
  particle: Pick<IAmbientParticle, 'heading' | 'spin'>,
  wave: number,
): { scaleX: number; rotation: number; shimmer: number } => {
  const travels = HEADED_MOTIONS.has(element.motion);
  const east = Math.cos(particle.heading) >= 0;
  const looks = element.facing !== undefined && element.facing !== 'none';
  let scaleX = 1;
  let rotation = 0;
  if (travels && looks) {
    scaleX = east === (element.facing === 'right') ? 1 : -1;
  }
  if (element.motion === 'fly' || (travels && looks)) {
    rotation =
      clamp(Math.sin(particle.heading), -0.4, 0.4) * (east ? 0.7 : -0.7);
  } else if (!looks) {
    rotation = particle.spin;
  }
  const shimmer =
    element.motion === 'twinkle' ? 1 - element.flap * 0.75 * wave : 1;
  return { scaleX, rotation, shimmer };
};
