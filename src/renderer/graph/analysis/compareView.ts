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
  type IAnalysisState,
} from './analysisFrame';
import { asMate, paintChannelLegend, paintLegend } from './channelInk';
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
 */

/** Below this the two curves are the same line and the band is not drawn. */
const FLAT_ENOUGH = 0.004;

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

const paintChannel = (
  frame: IAnalysisFrame,
  after: Float64Array,
  before: Float64Array,
  widest: number,
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
    paint.addColorStop(0, rampRgba(colours, 0.1, 0.5));
    paint.addColorStop(0.5, rampRgba(colours, 0.5, 0.42));
    paint.addColorStop(1, rampRgba(colours, 1, 0.62));
    context.globalAlpha = band.opacity * strength;
    context.fillStyle = paint;
    context.fill(ribbon);
  }

  // Before: a body of its own, faint, so the shape of the source is readable
  // under the correction rather than only the correction being visible.
  context.globalAlpha = band.opacity * strength;
  paintSpectrum(behind, before, {
    fillAlpha: tuning.fillOpacity * 0.34,
    edgeAlpha: 0.7,
    edgeWidth: Math.max(1, frame.edge.width - 1),
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
  const { levels, eqLift, split } = frame;
  const size = levels.length;
  if (state.slow.length !== size) {
    return false;
  }

  if (split) {
    const [leftBefore, rightBefore] = scratch(state, size, 2);
    const behind = readBefore(split[1], eqLift, rightBefore);
    const front = readBefore(split[0], eqLift, leftBefore);
    paintChannel(asMate(frame), split[1], rightBefore, behind, 0.7);
    paintChannel(frame, split[0], leftBefore, front, 1);
    paintChannelLegend(frame, frame.channelLabels);
    return Math.max(front, behind) > STILL_ENOUGH;
  }

  /**
   * The before-curve, kept in the state's own buffer rather than built fresh:
   * this runs on every frame of every song and three hundred and twenty
   * doubles allocated sixty times a second is a collection nobody asked for.
   */
  const widest = readBefore(levels, eqLift, state.slow);
  /**
   * The before-curve in the turned copy of the look's colours, so the two
   * readings are told apart by hue rather than only by weight, and both
   * named over the drawing (Ivan, 2026-09-23: "on before and after put
   * leyend and colors too").
   */
  paintChannel(frame, levels, state.slow, widest, 1, asMate(frame));
  paintLegend(frame, [
    { label: frame.legend.after, ink: rampRgba(frame.colours, 0.75, 1) },
    { label: frame.legend.before, ink: rampRgba(frame.mate, 0.75, 1) },
  ]);
  // Nothing of this view's own keeps moving after the trace has settled: the
  // before-curve is derived from the reading rather than chasing it. So the
  // loop is asked to keep going only while there is a band to show at all.
  return widest > STILL_ENOUGH;
};

export default drawCompareView;
