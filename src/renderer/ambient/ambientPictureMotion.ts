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
 * A picture's poses this frame, with their shares. Its frames play through
 * once per turn of the particle's phase — one wingbeat for a flier — each
 * dissolving into the next over the middle of its turn, the way Alpine's own
 * shader blends its bird sprites. One with a resting pose settles into it
 * every few seconds and glides, on the same slow wave that holds an outline
 * bird's wings out.
 */
export const picturePoses = (
  element: IAmbientElement,
  particle: IAmbientParticle,
  time: number,
): (readonly [number, number])[] => {
  const count = element.frames?.length ?? 0;
  if (count === 0) {
    return [];
  }
  const turn = particle.phase / TAU;
  const cycle = (turn - Math.floor(turn)) * count;
  const at = Math.floor(cycle) % count;
  const blend = smoothstep(0.15, 0.85, cycle - Math.floor(cycle));
  const glide =
    element.rest === undefined
      ? 0
      : smoothstep(-0.1, 0.35, Math.sin(time * 0.45 + particle.seed * 9));
  const shares = new Map<number, number>();
  const add = (index: number, share: number) => {
    if (share > 0.01) {
      shares.set(index, (shares.get(index) ?? 0) + share);
    }
  };
  add(at, (1 - blend) * (1 - glide));
  add((at + 1) % count, blend * (1 - glide));
  if (element.rest !== undefined) {
    add(element.rest, glide);
  }
  return [...shares];
};

/**
 * Which way a picture faces and leans. One that looks one way turns to face
 * where it travels; a flier, or anything that looks one way, leans into its
 * climb and never rolls over; the rest turn as the outlines do. `wave` is
 * the particle's flap, 0..1, which a twinkling picture shimmers with.
 */
export const pictureBearing = (
  element: IAmbientElement,
  particle: IAmbientParticle,
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
