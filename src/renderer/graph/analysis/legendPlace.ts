/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where a measuring view's key stands on its canvas, frame by frame, for
 * the band labels to keep off it: a bass band's label below its dot sat on
 * "Peak · Average · Max" and hid half of it.
 *
 * In the canvas's own coordinates, which are the graph's: the canvas is drawn
 * through the chart's scales and covers the chart's box exactly.
 *
 * Noted rather than computed again: which words a key carries, and how wide
 * they come out in the language on screen, is the painter's business
 * (`paintLegend`), and a second copy of that rule would drift. A frame that
 * clears the canvas says so first (`noteLegendFrame`); one that does not —
 * the engine still taking a look over — leaves what was painted, so it
 * leaves the place too.
 */
export interface ILegendPlace {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface IFrameNote {
  place?: ILegendPlace;
}

const frames = new WeakMap<object, IFrameNote>();

/** This frame cleared `canvas`: nothing painted on it before now still shows. */
export const noteLegendFrame = (canvas: object): void => {
  frames.set(canvas, {});
};

/** A key was painted on `canvas` this frame, at `place`. */
export const noteLegendPlace = (canvas: object, place: ILegendPlace): void => {
  const frame = frames.get(canvas);
  if (frame) {
    frame.place = place;
  }
};

/**
 * What the frame just drawn left on `canvas`: `{ place }` (no place for no
 * key) when it cleared the canvas, undefined when it drew over the last.
 */
export const takeLegendFrame = (canvas: object): IFrameNote | undefined => {
  const frame = frames.get(canvas);
  frames.delete(canvas);
  return frame;
};

/** Whether two places are the same to the pixel. */
export const isSameLegendPlace = (
  one: ILegendPlace | undefined,
  other: ILegendPlace | undefined,
): boolean =>
  one === other ||
  (one !== undefined &&
    other !== undefined &&
    Math.round(one.x) === Math.round(other.x) &&
    Math.round(one.y) === Math.round(other.y) &&
    Math.round(one.width) === Math.round(other.width) &&
    Math.round(one.height) === Math.round(other.height));
