/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { isLightWindow } from '../../utils/windowSide';
import {
  STILL_ENOUGH,
  clamp01,
  placeLevel,
  scratch,
  type IAnalysisFrame,
  type IAnalysisReading,
  type IAnalysisState,
} from './analysisFrame';
import { LIGHT_WINDOW_FILL_SHARE } from './analyzerView';
import { asMate } from './channelInk';
import { paintSpectrum, spectrumInk, spectrumLine } from './spectrumPaint';

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
 * EVERY PIXEL IS ONE THING: the after-figure's body, a band where the EQ
 * lifts, a band where it takes away, or the ground (Ivan, 2026-11-27, Before
 * & after on white: "not good either").
 *
 * The view used to lay a faint before-body under the reading, a band of the
 * look's ramp between the two curves, and the reading's own body over both:
 * three translucent fills stacked in two colours, which on a light window
 * mixed into a grey-mauve with a teal wash over it, and on a dark one into
 * a murk where neither figure stood out. Now the reading's body is painted
 * as the Analyzer paints its own, and the two curves part it into a band
 * where the EQ LIFTS the source (the after-curve above the before-curve), in
 * the reading's colours over its own body, and a band where it CUTS (the
 * before-curve above), in the before colours on the bare ground. Nothing of
 * one colour lies over the other, so neither turns to mud; a lift reads as
 * more of the reading and a cut as the source's colour standing where the
 * reading no longer reaches. The source keeps its own line over everything.
 *
 * How solid each band is, within its copy of the drawing, on each side of
 * the Brightness: lighter on a light window, where the after-body is a wash.
 */
export const COMPARE_BANDS = {
  dark: { lift: 0.4, cut: 0.42 },
  light: { lift: 0.3, cut: 0.34 },
} as const;

/** The before-curve's line: its alpha, and how much thinner than the look's. */
export const COMPARE_BEFORE = { edge: 0.95, thinner: 0.5 } as const;

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

/**
 * The band where `upper` stands over `lower`, as one closed figure: out
 * along `upper`, back along the lower of the two at each point. Where
 * `upper` is the lower curve the figure has no width, so a lift's figure
 * holds only the lifts and a cut's only the cuts.
 */
const bandWhereAbove = (
  frame: IAnalysisFrame,
  upper: Float64Array,
  lower: Float64Array,
): Path2D => {
  const { xs, band } = frame;
  const figure = new Path2D();
  for (let index = 0; index < upper.length; index += 1) {
    const y = placeLevel(band, upper[index]);
    if (index === 0) {
      figure.moveTo(xs[index], y);
    } else {
      figure.lineTo(xs[index], y);
    }
  }
  for (let index = upper.length - 1; index >= 0; index -= 1) {
    figure.lineTo(
      xs[index],
      placeLevel(band, Math.min(upper[index], lower[index])),
    );
  }
  figure.closePath();
  return figure;
};

const paintChannel = (
  frame: IAnalysisFrame,
  { after, before, widest }: ICompareCurves,
  strength: number,
  /** The frame the before-curve is painted in, when it has its own. */
  behind: IAnalysisFrame = frame,
): void => {
  const { context, tuning, band } = frame;
  const onWhite = isLightWindow();
  // After: the reading's body, as the Analyzer paints its own on this side
  // of the Brightness, textured.
  paintSpectrum(frame, after, {
    fillAlpha: tuning.fillOpacity * (onWhite ? LIGHT_WINDOW_FILL_SHARE : 1),
    edgeAlpha: 0,
    flat: onWhite,
  });
  if (widest > FLAT_ENOUGH) {
    const bands = COMPARE_BANDS[onWhite ? 'light' : 'dark'];
    context.globalAlpha = band.opacity * strength * bands.lift;
    context.fillStyle = spectrumInk(frame, after);
    context.fill(bandWhereAbove(frame, after, before));
    context.globalAlpha = band.opacity * strength * bands.cut;
    context.fillStyle = spectrumInk(behind, before);
    context.fill(bandWhereAbove(frame, before, after));
    // Before: the source's own line, over both bands.
    context.globalAlpha = COMPARE_BEFORE.edge;
    context.lineWidth = Math.max(1, frame.edge.width - COMPARE_BEFORE.thinner);
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.strokeStyle = spectrumInk(behind, before);
    context.stroke(spectrumLine(frame, before));
  }
  // After: the reading's edge, at the look's own width, over everything.
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
