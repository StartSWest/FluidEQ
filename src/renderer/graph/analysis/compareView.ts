/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  STILL_ENOUGH,
  clamp01,
  placeLevel,
  rampRgba,
  scratch,
  type IAnalysisFrame,
  type IAnalysisReading,
  type IAnalysisState,
} from './analysisFrame';
import { asMate } from './channelInk';
import {
  paintSpectrum,
  spectrumBody,
  spectrumInk,
  spectrumLine,
} from './spectrumPaint';

/**
 * Before & after: the music as it reached the EQ, and as it leaves it.
 *
 * What is measured is the output — everything this app captures has already
 * been through the chain — so AFTER is the reading and BEFORE is that reading
 * with the EQ's own response taken back out of it, point for point. Both are
 * therefore the real song rather than a test tone, which is the whole value
 * of the view: it does not show what the EQ would do to pink noise, it shows
 * what it is doing to the chorus that is playing.
 *
 * The gap between them is filled, and it is the only thing on this graph that
 * is read by AREA: a wide band is a large correction and a flat one is an EQ
 * doing nothing.
 *
 * With no EQ response to hand — nothing has published one yet, or the chain
 * is bypassed — before and after are the same curve and the view says so by
 * drawing one figure with no band. That is the honest picture of a bypassed
 * EQ, not a failure to draw.
 *
 * Laid out here for both painters: this file's canvas drawing, and the
 * engine's (`engineLooks/compareLook.ts`).
 */

/** Below this the two curves are the same line and the band is not drawn. */
export const FLAT_ENOUGH = 0.004;

/**
 * The band between the two, up from its foot: where on the look's ramp each
 * stop takes its colour, and how solid it is there — hot at the top and cool
 * at the bottom.
 */
export const COMPARE_RIBBON: readonly (readonly [
  at: number,
  ramp: number,
  alpha: number,
])[] = [
  [0, 0.1, 0.5],
  [0.5, 0.5, 0.42],
  [1, 1, 0.62],
];

/**
 * The before-figure: its body's share of the look's fill, its edge's alpha
 * and how much thinner than the look's edge that is.
 */
export const COMPARE_BEFORE = { fill: 0.34, edge: 0.7, thinner: 1 } as const;

/** How present the right channel's pair is, drawn behind the left's. */
export const COMPARE_BEHIND = 0.7;

/** One channel's two curves, and how far apart they are anywhere. */
export interface ICompareCurves {
  after: Float64Array;
  before: Float64Array;
  widest: number;
}

/**
 * One channel's before-curve, written into `before`; answers how far the EQ
 * is moving it anywhere on the plot.
 */
const readBefore = (
  after: Float64Array,
  lift: Float64Array | undefined,
  before: Float64Array,
): number => {
  let widest = 0;
  for (let index = 0; index < after.length; index += 1) {
    /**
     * On the floor there is nothing to undo. The reading bottoms out at
     * eighty decibels down and is clamped there, so subtracting a cut from it
     * would invent a before-curve standing above the floor in silence —
     * "this band would have been six decibels louder" about a band that has
     * no sound in it at all.
     */
    before[index] =
      after[index] <= STILL_ENOUGH
        ? after[index]
        : clamp01(after[index] - (lift ? lift[index] : 0));
    const gap = Math.abs(after[index] - before[index]);
    if (gap > widest) {
      widest = gap;
    }
  }
  return widest;
};

/**
 * This frame's curves: the joined pair, or the left pair in front of the
 * right. The before-curves are kept in the state's own buffers rather than
 * built fresh: this runs on every frame of every song and three hundred and
 * twenty doubles allocated sixty times a second is a collection nobody asked
 * for.
 */
export const readCompare = (
  reading: IAnalysisReading,
  state: IAnalysisState,
): { front: ICompareCurves; behind?: ICompareCurves } | undefined => {
  const { levels, eqLift, split } = reading;
  const size = levels.length;
  if (state.slow.length !== size) {
    return undefined;
  }
  if (split) {
    const [leftBefore, rightBefore] = scratch(state, size, 2);
    return {
      behind: {
        after: split[1],
        before: rightBefore,
        widest: readBefore(split[1], eqLift, rightBefore),
      },
      front: {
        after: split[0],
        before: leftBefore,
        widest: readBefore(split[0], eqLift, leftBefore),
      },
    };
  }
  return {
    front: {
      after: levels,
      before: state.slow,
      widest: readBefore(levels, eqLift, state.slow),
    },
  };
};

/**
 * Nothing of this view's own keeps moving after the trace has settled: the
 * before-curve is derived from the reading rather than chasing it. So the
 * loop is asked to keep going only while there is a band to show at all.
 */
export const compareMoving = (curves: {
  front: ICompareCurves;
  behind?: ICompareCurves;
}): boolean =>
  Math.max(curves.front.widest, curves.behind?.widest ?? 0) > STILL_ENOUGH;

const paintChannel = (
  frame: IAnalysisFrame,
  { after, before, widest }: ICompareCurves,
  strength: number,
  /** The frame the before-curve is painted in, when it has its own. */
  behind: IAnalysisFrame = frame,
): void => {
  const { context, tuning, xs, band, colours } = frame;
  const size = after.length;
  context.globalAlpha = band.opacity * strength;
  if (widest > FLAT_ENOUGH) {
    /**
     * The band between the two, as one closed figure: the after-curve out and
     * the before-curve back. Two fills — one clipped above the before-curve
     * and one below it — would be the obvious way and it is twice the work
     * for a picture nobody can tell apart from a single gradient that is hot
     * at the top and cool at the bottom.
     */
    const ribbon = new Path2D();
    for (let index = 0; index < size; index += 1) {
      const y = placeLevel(band, after[index]);
      if (index === 0) {
        ribbon.moveTo(xs[index], y);
      } else {
        ribbon.lineTo(xs[index], y);
      }
    }
    for (let index = size - 1; index >= 0; index -= 1) {
      ribbon.lineTo(xs[index], placeLevel(band, before[index]));
    }
    ribbon.closePath();
    const foot = band.flipped ? band.top : band.bottom;
    const head = band.flipped ? band.bottom : band.top;
    const paint = context.createLinearGradient(0, foot, 0, head);
    COMPARE_RIBBON.forEach(([at, ramp, alpha]) =>
      paint.addColorStop(at, rampRgba(colours, ramp, alpha)),
    );
    context.globalAlpha = band.opacity * strength;
    context.fillStyle = paint;
    context.fill(ribbon);
  }

  // Before: a body of its own, faint, so the shape of the source is readable
  // under the correction rather than only the correction being visible.
  context.globalAlpha = band.opacity * strength;
  paintSpectrum(behind, before, {
    fillAlpha: tuning.fillOpacity * COMPARE_BEFORE.fill,
    edgeAlpha: COMPARE_BEFORE.edge,
    edgeWidth: Math.max(1, frame.edge.width - COMPARE_BEFORE.thinner),
    textured: false,
  });
  // After: the reading itself, textured, with the look's full edge.
  if (tuning.filled && tuning.texture !== 'none') {
    // Only the part of the after-figure ABOVE the before-curve carries the
    // pattern: printed across the whole body it would run down through the
    // faint before-figure as well and the two would stop separating.
    const body = spectrumBody(frame, after);
    context.save();
    context.clip(body);
    paintSpectrum(frame, after, {
      fillAlpha: tuning.fillOpacity,
      edgeAlpha: 0,
    });
    context.restore();
  } else {
    paintSpectrum(frame, after, {
      fillAlpha: tuning.fillOpacity,
      edgeAlpha: 0,
      textured: false,
    });
  }
  context.globalAlpha = band.opacity * strength;
  context.lineWidth = frame.edge.width;
  context.lineJoin = 'round';
  context.strokeStyle = spectrumInk(frame, after);
  context.stroke(spectrumLine(frame, after));
  context.globalAlpha = 1;
};

const drawCompareView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const curves = readCompare(frame, state);
  if (!curves) {
    return false;
  }
  const { front, behind } = curves;
  if (behind) {
    paintChannel(asMate(frame), behind, COMPARE_BEHIND);
    paintChannel(frame, front, 1);
  } else {
    /**
     * The before-curve in the turned copy of the look's colours, so the two
     * readings are told apart by hue rather than only by weight, and both
     * named over the drawing (Ivan, 2026-09-23: "on before and after put
     * leyend and colors too").
     */
    paintChannel(frame, front, 1, asMate(frame));
  }
  return compareMoving(curves);
};

export default drawCompareView;
