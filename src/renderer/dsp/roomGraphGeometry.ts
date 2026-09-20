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
 * How much of the frame the scene fills, by how far the scene itself reaches
 * — the room's own half-side, or a speaker standing further out than that.
 * A scene that reaches further is drawn larger overall, so both dials always
 * move something: Size grows the walls, and Distance walks the speakers out
 * until they are the furthest thing there, after which they keep going and
 * the room shrinks behind them. Square-root rather than straight, so the
 * small rooms, which are the ones people sit in, keep enough of the frame to
 * hold seven speakers and their names.
 */
const REACH_MIN_PX = 96;
const REACH_MAX_PX = 168;
const REACH_MIN_M = 1;
const REACH_MAX_M = 6;
/** The size's dimension line and its number, under the bottom wall. */
const WALL_ROOM = 26;
/** The wall the listener and the sub keep their full drawn size down to. */
const GLYPH_WALL = 104;

/** A speaker's cabinet and the name above it, beyond its own radius. */
const SPEAKER_ROOM = 38;
/** The strip the compass caption keeps at the top of the frame. */
const FRONT_ROOM = 16;
/** The ring is a guide line with nothing written outside it. */
const RING_ROOM = 6;
/**
 * The closest ring the picture will draw: the head's own half-depth, a
 * cabinet's, and enough between two of them that the front three do not fuse
 * into one shape — they stand 30° apart, which is a quarter of the radius
 * between their centres. This is the one place the picture stops being to
 * scale, and it is reached only where the room dwarfs the ring: speakers half
 * a metre out in a room 12 m across.
 */
const RING_MIN = 54;
/**
 * The listener and the sub keep their drawn size until the walls come in
 * closer than any room used to be drawn, and shrink with them after that: a
 * room 2 m across with its speakers 6 m outside it is drawn 50 px to a side,
 * and a head that kept its size would be wider than the room it sits in.
 */
const GLYPH_SCALE_MIN = 0.5;

export const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const drawnReachOf = (metresOut: number) =>
  REACH_MIN_PX +
  (REACH_MAX_PX - REACH_MIN_PX) *
    Math.sqrt(
      clamp((metresOut - REACH_MIN_M) / (REACH_MAX_M - REACH_MIN_M), 0, 1),
    );

/**
 * How far from the listener a speaker at this angle may be drawn and still be
 * read: the frame, less the room its cabinet and name take, less the strip the
 * compass caption holds — which only costs the speakers pointing at it.
 */
const reachAt = (angleDeg: number) =>
  ROOM_GRAPH_CENTRE -
  SPEAKER_ROOM -
  FRONT_ROOM * Math.max(0, Math.cos((angleDeg * Math.PI) / 180));

export interface IRoomScale {
  /**
   * Pixels to the metre. The walls, the ring and every speaker share it, so a
   * speaker standing 3 m out of a 2 m room is drawn 3 m out of it.
   */
  perMetre: number;
  /** Half the room's side, drawn. */
  wallHalf: number;
  /** What the listener and the sub are drawn at; 1 in an ordinary room. */
  glyph: number;
}

/**
 * One scale for the whole picture — as large as the scene earns and never
 * larger than the frame holds, so that the walls, the ring, every speaker and
 * every name are inside it whatever the dials say.
 *
 * There used to be two. The walls grew with Size while each speaker was
 * clamped to a ring just inside them, so a room 2 m across with its speakers
 * 2.2 m out drew them standing against its own walls, and turning Distance up
 * from there moved nothing at all. Speakers outside the room are a real
 * arrangement and the engine renders one, so the picture now takes the scale
 * the furthest speaker needs and draws the walls in it: the room shrinks in
 * the frame and the speakers stand outside it, which is what the settings say.
 */
export const roomScaleOf = (room: IRoomSettings): IRoomScale => {
  const half = room.sizeM / 2;
  const out = (distanceM: number) => Math.max(distanceM, 0.5);
  const reachM = room.distances.reduce(
    (furthest, distanceM) => Math.max(furthest, out(distanceM)),
    Math.max(half, out(room.distanceM)),
  );
  // What the scene is drawn at, then trimmed until every speaker's name and
  // the room's own dimension line are inside the frame. The trim is what
  // keeps the biggest thing in an unusual room — a speaker at the front,
  // which has the compass caption above it — from running off the edge.
  const fitted = room.distances.reduce(
    (perMetre, distanceM, at) =>
      Math.min(perMetre, reachAt(room.angles[at]) / out(distanceM)),
    Math.min(
      drawnReachOf(reachM) / reachM,
      (ROOM_GRAPH_CENTRE - RING_ROOM) / out(room.distanceM),
      (ROOM_GRAPH_CENTRE - WALL_ROOM) / half,
    ),
  );
  const wallHalf = fitted * half;
  return {
    perMetre: fitted,
    wallHalf,
    glyph: clamp(wallHalf / GLYPH_WALL, GLYPH_SCALE_MIN, 1),
  };
};

export const metres = (value: number) => `${value.toFixed(1)} m`;

/** -180 to 180, the range the angles are stored in. */
export const wrapAngle = (angle: number) =>
  ((((angle + 180) % 360) + 360) % 360) - 180;

/** A distance in metres to a radius in the picture, in the room's own scale. */
export const radiusOf = (scale: IRoomScale, distanceM: number) =>
  Math.max(distanceM * scale.perMetre, RING_MIN * scale.glyph);

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
