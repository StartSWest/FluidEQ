/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where things stand in the Room's picture: the numbers the drawing and the
 * pointer both work from, so a speaker is drawn exactly where a press finds it.
 */

import { IRoomSettings } from '../../common/dsp/chain';

export const ROOM_GRAPH_SIZE = 400;
export const ROOM_GRAPH_CENTRE = ROOM_GRAPH_SIZE / 2;

/**
 * The walls grow with the room. A 12 m room fills the frame and a 2 m room
 * stands well inside it, and the ring keeps its true proportion between
 * the head and the walls — so Size and Distance no longer look like the
 * same dial: one moves the walls, the other moves the speakers within them.
 * Square-root rather than straight, so the small rooms, which are the ones
 * people sit in, keep enough wall to hold seven speakers and their names;
 * the margin outside the largest holds the size's dimension line.
 */
const WALL_MAX = ROOM_GRAPH_CENTRE - 26;
const WALL_MIN = 104;
const SIZE_MIN_M = 2;
const SIZE_MAX_M = 12;
const RING_MIN = 58;

export const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export const wallHalfOf = (sizeM: number) =>
  WALL_MIN +
  (WALL_MAX - WALL_MIN) *
    Math.sqrt(clamp((sizeM - SIZE_MIN_M) / (SIZE_MAX_M - SIZE_MIN_M), 0, 1));

export const metres = (value: number) => `${value.toFixed(1)} m`;

/** -180 to 180, the range the angles are stored in. */
export const wrapAngle = (angle: number) =>
  ((((angle + 180) % 360) + 360) % 360) - 180;

/**
 * A distance in metres to a radius in the picture, in the room's own scale,
 * kept between the head and the labels' room inside the wall.
 */
export const radiusOf = (
  room: Pick<IRoomSettings, 'sizeM'>,
  distanceM: number,
) => {
  const wallHalf = wallHalfOf(room.sizeM);
  return clamp(
    (distanceM / (room.sizeM / 2)) * wallHalf,
    RING_MIN,
    Math.max(RING_MIN, wallHalf - 40),
  );
};

/** A point at `angleDeg` clockwise from straight ahead, `radius` out. */
export const polar = (angleDeg: number, radius: number) => {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: ROOM_GRAPH_CENTRE + radius * Math.sin(radians),
    y: ROOM_GRAPH_CENTRE - radius * Math.cos(radians),
  };
};

/**
 * Where the distance is measured: the middle of the widest gap between
 * speakers, so the line never runs under one however they are arranged.
 */
export const emptiestAngle = (angles: readonly number[]): number => {
  const sorted = angles
    .map((angle) => ((angle % 360) + 360) % 360)
    .sort((a, b) => a - b);
  let bestStart = sorted[sorted.length - 1];
  let bestGap = sorted[0] + 360 - bestStart;
  for (let at = 1; at < sorted.length; at += 1) {
    const gap = sorted[at] - sorted[at - 1];
    if (gap > bestGap) {
      bestGap = gap;
      bestStart = sorted[at - 1];
    }
  }
  return bestStart + bestGap / 2;
};
