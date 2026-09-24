/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  STILL_ENOUGH,
  advanceHold,
  placeLevel,
  rampRgba,
  type IAnalysisFrame,
  type IAnalysisState,
} from './analysisFrame';
import {
  paintHalo,
  paintSpectrum,
  spectrumEnergy,
  spectrumLine,
} from './spectrumPaint';
import { asMate, paintLegend } from './channelInk';

/**
 * The Analyzer: the spectrum of what is playing, with a peak hold over it.
 *
 * The one drawing on this graph that somebody would act on. Three readings,
 * each doing a different job and each told apart without a legend:
 *
 *  - the BODY is the moment, filled and textured, falling with the look's own
 *    release so a kick reads as a step rather than a flicker;
 *  - the PEAK HOLD is a hairline that jumps to every peak, hangs for a second
 *    and then slides down at about seven decibels a second, so the shape of a
 *    passage stays readable after the passage has gone;
 *  - where the two MEET the curve blooms, which is what makes a peak findable
 *    on a screen somebody is not staring at.
 *
 * With Left & right chosen the body is drawn twice, the right channel behind
 * the left and dimmer, each keeping its own peak hold: two figures in one
 * picture, which is how a stereo analyser shows a mix that is not centred.
 */

/** How long a peak hangs before it starts to fall. */
const HOLD_HANG_MS = 900;

/**
 * How fast it falls afterwards, in plot depths per second. The plot is eighty
 * decibels deep, so this is a shade under seven decibels a second — the rate
 * a studio analyser uses, chosen because a mark that outruns the eye teaches
 * nobody anything and one that lingers turns the display into a smear.
 */
const HOLD_FALL = 0.085;

/** Within this much of the hold, the curve is touching its own high water. */
const BLOOM_REACH = 0.012;

/**
 * The mark is white, on every palette.
 *
 * Drawn in the look's own hot end it disappeared exactly where it matters —
 * over the top of a level ramp, red on red — and shouted over the bass, where
 * the body is green. A mark's job is to be found, and nothing else on this
 * plot is white: the RTA's caps and the stereo meters' peaks are the same
 * decision, so the three views speak one language.
 */
const MARK_INK = '255, 255, 255';

const paintHold = (
  frame: IAnalysisFrame,
  hold: Float64Array,
  alpha: number,
): void => {
  const { context, xs, band } = frame;
  const line = spectrumLine(frame, hold);
  context.globalAlpha = alpha;
  context.lineWidth = 1.25;
  context.lineJoin = 'round';
  context.strokeStyle = `rgba(${MARK_INK}, 0.9)`;
  context.stroke(line);
  context.globalAlpha = 1;
  // The high-water marks themselves: where the reading is still at its hold,
  // a bright pip. Drawn as one path so the whole row costs a single fill.
  const pips = new Path2D();
  let found = false;
  for (let index = 0; index < hold.length; index += 1) {
    if (hold[index] - frame.levels[index] < BLOOM_REACH && hold[index] > 0.02) {
      const y = placeLevel(band, hold[index]);
      // Started on the arc's own first point: a `moveTo` to the centre would
      // leave a radius across every pip once the path is stroked anywhere.
      pips.moveTo(xs[index] + 1.6, y);
      pips.arc(xs[index], y, 1.6, 0, Math.PI * 2);
      found = true;
    }
  }
  if (found) {
    context.globalAlpha = alpha * 0.8;
    context.fillStyle = `rgba(${MARK_INK}, 1)`;
    context.fill(pips);
    context.globalAlpha = 1;
  }
};

/**
 * One channel's peak hold, kept where the joined one is kept.
 *
 * Grown on demand rather than in `resetAnalysisState`, because the stereo
 * split is a setting: allocating two more arrays of three hundred and twenty
 * doubles for every look that will never show them is waste, and allocating
 * them per frame is worse.
 */
const splitHolds = (
  state: IAnalysisState,
  size: number,
): [Float64Array, Float64Array, Float64Array, Float64Array] => {
  if (state.bands.length !== size * 4) {
    state.bands = new Float64Array(size * 4);
  }
  return [
    state.bands.subarray(0, size),
    state.bands.subarray(size, size * 2),
    state.bands.subarray(size * 2, size * 3),
    state.bands.subarray(size * 3, size * 4),
  ];
};

const drawAnalyzerView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const { context, tuning, levels, split, deltaMs, band } = frame;
  const fillAlpha = tuning.fillOpacity;

  if (split) {
    const size = levels.length;
    const [leftHold, leftHang, rightHold, rightHang] = splitHolds(state, size);
    const highest = Math.max(
      advanceHold(
        rightHold,
        rightHang,
        split[1],
        deltaMs,
        HOLD_HANG_MS,
        HOLD_FALL,
      ),
      advanceHold(
        leftHold,
        leftHang,
        split[0],
        deltaMs,
        HOLD_HANG_MS,
        HOLD_FALL,
      ),
    );
    // The right channel behind, in its own turned copy of the look's
    // colours, so the two are told apart by hue as well as by depth — and
    // named by the legend the caller paints over both.
    const behind = asMate(frame);
    context.globalAlpha = band.opacity * 0.72;
    paintSpectrum(behind, split[1], {
      fillAlpha: fillAlpha * 0.55,
      edgeAlpha: 0.55,
      edgeWidth: Math.max(1, frame.edge.width - 0.6),
      textured: false,
    });
    paintHold(behind, rightHold, 0.32);
    context.globalAlpha = band.opacity;
    paintSpectrum(frame, split[0], { fillAlpha, edgeAlpha: 0.95 });
    paintHold(frame, leftHold, 0.55);
    context.globalAlpha = 1;
    return highest > STILL_ENOUGH;
  }

  const highest = advanceHold(
    state.hold,
    state.holdMs,
    levels,
    deltaMs,
    HOLD_HANG_MS,
    HOLD_FALL,
  );
  context.globalAlpha = band.opacity;
  if (frame.glow > 0) {
    paintHalo(
      frame,
      spectrumLine(frame, levels),
      frame.glow * (0.35 + spectrumEnergy(levels) * 0.65),
    );
  }
  paintSpectrum(frame, levels, { fillAlpha, edgeAlpha: 1 });
  paintHold(frame, state.hold, 0.5);
  context.globalAlpha = 1;
  paintLegend(frame, [
    { label: frame.legend.live, ink: rampRgba(frame.colours, 0.75, 1) },
    { label: frame.legend.peak, ink: 'rgba(255, 255, 255, 0.95)' },
  ]);
  // The hold is still sliding long after the body has settled, so the loop
  // keeps running while any mark is above the floor it would rest on.
  return highest > STILL_ENOUGH;
};

export default drawAnalyzerView;
