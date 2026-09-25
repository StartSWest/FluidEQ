/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { lightInkAt, type ISceneFrame } from './sceneFrame';

/**
 * Colour by, for the figures that are not laid out along the plot's width
 * and height: the round ones, and the ones mirrored about a middle line.
 *
 * `figureInk` answers for a figure standing on a floor. A ring has no floor
 * and no left edge, so there "across the spectrum" is round the ring and "up
 * the height" is out from its middle; a figure mirrored about a line grows
 * both ways, so its height is the distance from that line.
 */

/** Stops sampled round a ring or out along a gradient. */
const STOPS = 16;

/**
 * A round figure's paint: the spectrum round it, bass at the bottom climbing
 * both sides to the treble at the top (turned by `turn`), or the ramp out
 * from `from` to `to` radius, or one colour. Heat reads as height here — a
 * round figure is one figure, not pieces.
 */
export const roundInk = (
  frame: ISceneFrame,
  cx: number,
  cy: number,
  from: number,
  to: number,
  turn: number,
  whiten: number,
  alpha: number,
): string | CanvasGradient => {
  const { context, colours, look } = frame;
  if (look.ink === 'flat') {
    return lightInkAt(colours, 0.5, whiten, alpha);
  }
  if (look.ink === 'frequency') {
    // Clockwise from the bottom is up the left side, and on round to the
    // bottom again down the right: the ramp there and back.
    const round = context.createConicGradient(Math.PI / 2 + turn, cx, cy);
    for (let stop = 0; stop <= STOPS; stop += 1) {
      const at = stop / STOPS;
      const fromBottom = at < 0.5 ? at * 2 : 2 - at * 2;
      round.addColorStop(at, lightInkAt(colours, fromBottom, whiten, alpha));
    }
    return round;
  }
  const out = context.createRadialGradient(cx, cy, from, cx, cy, to);
  for (let stop = 0; stop < STOPS; stop += 1) {
    const at = stop / (STOPS - 1);
    out.addColorStop(at, lightInkAt(colours, at, whiten, alpha));
  }
  return out;
};

/**
 * A mirrored figure's paint: the ramp across the plot, one colour, or — for
 * level and heat — the ramp out from the middle line both ways, the line
 * the floor and `reach` either side of it the top.
 */
export const mirroredInk = (
  frame: ISceneFrame,
  middle: number,
  reach: number,
  whiten: number,
  alpha: number,
): string | CanvasGradient => {
  const { context, colours, look, plot } = frame;
  if (look.ink === 'flat') {
    return lightInkAt(colours, 0.5, whiten, alpha);
  }
  if (look.ink === 'frequency') {
    const across = context.createLinearGradient(plot.left, 0, plot.right, 0);
    for (let stop = 0; stop <= STOPS; stop += 1) {
      const at = stop / STOPS;
      across.addColorStop(at, lightInkAt(colours, at, whiten, alpha));
    }
    return across;
  }
  const out = context.createLinearGradient(
    0,
    middle - reach,
    0,
    middle + reach,
  );
  for (let stop = 0; stop <= STOPS; stop += 1) {
    const at = stop / STOPS;
    out.addColorStop(
      at,
      lightInkAt(colours, Math.abs(at * 2 - 1), whiten, alpha),
    );
  }
  return out;
};
