/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where every cover of the Cover Flow row stands, and how large the row is
 * drawn on a stage of a given size — plain numbers, no three.js, so the
 * window's still picture (`LibraryCoverFlowStage`, drawn before the scene
 * has loaded and wherever WebGL cannot start) and the scene itself place the
 * centre cover on the very same pixels, and the hand-over between the two is
 * invisible.
 *
 * World units: a cover is `COVER_EDGE` across. The row is the one Ivan
 * approved in the three.js mockup (2026-11-14, "loved the mockup"): each
 * cover turns through every angle in between as it travels, rather than
 * hinging at the moment it leaves the centre.
 */

/** Covers drawn either side of where the row stands. Each has its own
 * texture while it is inside this window, and gives it back as it leaves. */
export const COVER_FLOW_WINDOW = 10;

/** Covers past the drawn window that keep their picture ready on the side
 * the row is heading for, so the cover that comes in next arrives wearing
 * it rather than as an empty sleeve. */
export const COVER_FLOW_AHEAD = 6;
/** The same on the side the row is leaving: a cover stepping out and back
 * in is not decoded twice. */
export const COVER_FLOW_BEHIND = 2;

/** A run of the row's indices, both ends included; empty when `last` is
 * under `first`. */
export interface ICoverFlowSpan {
  first: number;
  last: number;
}

/**
 * Which covers are drawn and which hold a picture, with the row standing
 * at `position` and last moving towards `heading` (+1 along the row, -1
 * back, 0 never moved, which keeps the short margin on both sides).
 *
 * Bounded whatever the library's length: never more than
 * `2 * COVER_FLOW_WINDOW + 1` drawn and `COVER_FLOW_AHEAD + COVER_FLOW_BEHIND`
 * more kept, so the pictures on the graphics card and in memory are the same
 * for 30 albums as for 5,000.
 */
export const coverFlowSpans = (
  position: number,
  heading: number,
  count: number,
): { drawn: ICoverFlowSpan; kept: ICoverFlowSpan } => {
  const centre = Math.round(position);
  const drawn = {
    first: Math.max(0, centre - COVER_FLOW_WINDOW),
    last: Math.min(count - 1, centre + COVER_FLOW_WINDOW),
  };
  const before = heading < 0 ? COVER_FLOW_AHEAD : COVER_FLOW_BEHIND;
  const after = heading > 0 ? COVER_FLOW_AHEAD : COVER_FLOW_BEHIND;
  return {
    drawn,
    kept: {
      first: Math.max(0, centre - COVER_FLOW_WINDOW - before),
      last: Math.min(count - 1, centre + COVER_FLOW_WINDOW + after),
    },
  };
};

/** A cover's edge, in world units. */
export const COVER_EDGE = 1.6;
/** The floor the covers stand on: just under the bottom edge. */
export const FLOOR_Y = -COVER_EDGE / 2 - 0.02;
/** From the centre cover to its first neighbour. */
const SIDE_GAP = 1.22;
/** From one side cover to the next. */
const STEP = 0.44;
/** How far a turned cover sinks back. */
const DEPTH = 1.15;
/** How far the centre cover stands forward of the row. */
const CENTRE_LIFT = 0.35;
/** How far each cover past the first neighbour sinks further back. */
const STEP_DEPTH = 0.08;
/** How far a side cover is turned, fully out of the centre. */
const ANGLE = (64 * Math.PI) / 180;
/** How far forward the pointer brings a side cover it is over. */
const HOVER_LIFT = 0.1;

/** The camera's vertical field of view, in degrees. */
export const CAMERA_FOV = 30;
/** Where the centre cover's middle sits down the stage, as a share of its
 * height: above the middle, so the reflection and the caption that hang
 * under the cover have the room. The same 41-42% the CSS row was tuned to. */
const CENTRE_ANCHOR = 0.42;

export interface ICoverPlacement {
  x: number;
  z: number;
  /** About the vertical axis; positive turns the cover's face to the left. */
  rotationY: number;
  /** 0 at the centre, 1 once fully turned: the sheen and the colour follow. */
  turn: number;
  /** Signed: which side the cover is on, 0 at the centre. */
  side: number;
  /** How much of its own light a cover keeps: further back is darker. */
  shade: number;
  /** How much of its colour a cover keeps: only the centre has all of it. */
  saturation: number;
  /** Nearer the centre draws later, so its edges always sit over its
   * neighbours'. */
  renderOrder: number;
}

/**
 * The cover `offset` steps from where the row stands — fractional while the
 * row moves. The turn is smoothstepped, so a cover eases into its angle and
 * out of it instead of hinging.
 */
export const coverPlacement = (
  offset: number,
  isHovered = false,
): ICoverPlacement => {
  const near = Math.min(Math.abs(offset), 1);
  const side = Math.sign(offset);
  const beyond = Math.max(Math.abs(offset) - 1, 0);
  const turn = near * near * (3 - 2 * near);
  const shade =
    1 - Math.min(beyond / (COVER_FLOW_WINDOW - 1), 1) * 0.7 - turn * 0.12;
  return {
    x: side * (turn * SIDE_GAP + beyond * STEP),
    z:
      -turn * DEPTH -
      beyond * STEP_DEPTH +
      (1 - turn) * CENTRE_LIFT +
      (isHovered ? HOVER_LIFT : 0),
    rotationY: -side * turn * ANGLE,
    turn,
    side,
    shade: isHovered ? Math.max(shade, 0.96) : shade,
    saturation: isHovered ? 1 : 1 - turn * 0.28,
    renderOrder: 100 - Math.round(Math.abs(offset) * 4),
  };
};

export interface ICoverFlowLayout {
  /** The centre cover's edge on screen, in CSS pixels. */
  coverPx: number;
  /** The centre cover's middle, in CSS pixels from the stage's top. */
  centreY: number;
  /** The camera's distance from the centre cover. */
  distance: number;
  /** The camera's height over the centre cover's middle. */
  height: number;
  /** The lens shift that puts the centre cover at `centreY`, in pixels. */
  shiftY: number;
}

/**
 * How large the row is drawn on a stage `width` by `height` CSS pixels.
 *
 * The centre cover takes six tenths of the height, as long as the width
 * leaves the centre and both first neighbours room to be read (a fan of a
 * centre and its two neighbours spans about 2.6 cover edges, and four of
 * them across leaves the next covers in view as well); never under 110 pixels,
 * where the art stops being recognisable, nor over 400, where one album
 * takes the window and the row stops being a row. The camera stands where a
 * cover of `COVER_EDGE` comes out that size, a touch above the covers so the
 * floor shows, and the lens shift lifts the row to `CENTRE_ANCHOR` without
 * tilting it.
 */
export const coverFlowLayout = (
  width: number,
  height: number,
): ICoverFlowLayout => {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const coverPx = Math.max(110, Math.min(h * 0.6, w / 3.8, 400));
  const halfFov = (CAMERA_FOV * Math.PI) / 360;
  const distance = (COVER_EDGE * h) / (2 * Math.tan(halfFov) * coverPx);
  return {
    coverPx,
    centreY: h * CENTRE_ANCHOR,
    distance,
    height: distance * 0.055,
    shiftY: h * (0.5 - CENTRE_ANCHOR),
  };
};

/** Where the centre cover stands, for the camera to look at. */
export const CENTRE_Z = CENTRE_LIFT;

/**
 * Where a row in motion comes to rest: a jump further than the window is
 * not flown through cover by cover (a letter of the rail can be thousands
 * away, and every cover passed would be decoded and thrown away), so the
 * row starts the last few covers out from the target and travels only
 * those.
 */
export const travelStart = (position: number, target: number): number => {
  const gap = target - position;
  const longest = COVER_FLOW_WINDOW / 2;
  return Math.abs(gap) > COVER_FLOW_WINDOW * 2
    ? target - Math.sign(gap) * longest
    : position;
};

/**
 * One step of the row's glide towards `target`, frame-rate independent:
 * the same distance covered per second at 60 Hz as at 240.
 */
export const glideToward = (
  position: number,
  target: number,
  seconds: number,
  rate = 9,
): number => {
  const next = position + (target - position) * (1 - Math.exp(-seconds * rate));
  return Math.abs(target - next) < 0.0005 ? target : next;
};

/**
 * Where a flick lets the row come to rest: the momentum carries it on for
 * about a third of a second of the speed it was let go at.
 */
export const flickTarget = (
  position: number,
  coversPerSecond: number,
  count: number,
): number =>
  Math.max(
    0,
    Math.min(count - 1, Math.round(position + coversPerSecond * 0.32)),
  );

/** Pixels of drag that move the row by one cover on a stage `width` wide. */
export const dragUnit = (width: number): number => Math.max(60, width / 11);
