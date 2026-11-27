/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readInk } from '../../utils/theme';
import { isLightWindow } from '../../utils/windowSide';
import {
  STILL_ENOUGH,
  advanceHold,
  placeLevel,
  type IAnalysisFrame,
  type IAnalysisReading,
  type IAnalysisState,
} from './analysisFrame';
import {
  paintHalo,
  paintSpectrum,
  spectrumEnergy,
  spectrumLine,
} from './spectrumPaint';
import { asMate } from './channelInk';
import { HOLD_DASH, HOLD_DASH_GAP, HOLD_LINE_WIDTH } from './holdDashes';

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
 *
 * Laid out here for both painters: this file's canvas drawing, and the
 * engine's (`engineLooks/analyzerLook.ts`), which reads the same holds, the
 * same figures and the same marks.
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
 * The mark is the window's strongest ink, on every palette: white on a dark
 * window, near-black on a light one (`readInk`).
 *
 * Drawn in the look's own hot end it disappeared exactly where it matters —
 * over the top of a level ramp, red on red — and shouted over the bass, where
 * the body is green. A mark's job is to be found, and nothing else on this
 * plot wears that ink: the RTA's caps and the stereo meters' peaks are the
 * same decision, so the three views speak one language.
 */

/**
 * How solid the hold's line is within its figure; its width and dashes are
 * in `holdDashes.ts`, shared with the engine.
 */
export const HOLD_LINE_ALPHA = 0.9;

/**
 * ON A LIGHT WINDOW the analyser is a measurement on paper (Ivan's pick B,
 * "Consola", 2026-11-18): the body a flat wash, the look's fill times this
 * share - the Analyzer's own 0.85 lands at 0.14 - from its peak to the floor.
 *
 * At the dark window's 0.85, faded toward the foot, the body was a solid
 * mountain of colour over half the plot on white, and the fade read as a
 * grey gradient laid across the graph ("a big blot rather than a
 * measurement"). On a dark floor the same fill is light on dark and stays.
 * The GPU copy (`engineLooks/analyzerLook.ts`) does the same, told the side
 * by the window's ink.
 */
export const LIGHT_WINDOW_FILL_SHARE = 0.165;

/** A high-water pip's radius, and how solid it is within its figure. */
export const PIP_RADIUS = 1.6;
export const PIP_ALPHA = 0.8;

/**
 * Whether the point's reading is still at its hold: a pip is drawn there.
 * Against the joined reading on every figure, the behind channel's too.
 */
export const isPip = (hold: number, level: number): boolean =>
  hold - level < BLOOM_REACH && hold > 0.02;

/**
 * How each figure is drawn: its body's share of the look's fill, its edge's
 * alpha, how much thinner than the look's edge that is, and its hold's alpha.
 */
export interface IAnalyzerFigure {
  fill: number;
  edge: number;
  thinner: number;
  hold: number;
}

export const ANALYZER_FIGURES: Readonly<
  Record<'joined' | 'front' | 'behind', IAnalyzerFigure>
> = {
  joined: { fill: 1, edge: 1, thinner: 0, hold: 0.5 },
  front: { fill: 1, edge: 0.95, thinner: 0, hold: 0.55 },
  behind: { fill: 0.55, edge: 0.55, thinner: 0.6, hold: 0.32 },
};

/** How wide a figure's edge is drawn. */
export const figureEdgeWidth = (
  reading: IAnalysisReading,
  figure: IAnalyzerFigure,
): number => Math.max(1, reading.edge.width - figure.thinner);

/** How hard the joined figure's halo burns, 0 for none. */
export const analyzerHalo = (
  reading: IAnalysisReading,
  levels: Float64Array,
): number =>
  reading.glow > 0 ? reading.glow * (0.35 + spectrumEnergy(levels) * 0.65) : 0;

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

export interface IAnalyzerHolds {
  /** The joined reading's hold, or the left channel's. */
  front: Float64Array;
  /** The right channel's, on a split. */
  behind?: Float64Array;
  /** The highest mark anywhere, for the frame loop. */
  highest: number;
}

/** This frame's peak holds, advanced by the reading's time. */
export const advanceAnalyzer = (
  reading: IAnalysisReading,
  state: IAnalysisState,
): IAnalyzerHolds => {
  const { levels, split, deltaMs } = reading;
  if (split) {
    const [leftHold, leftHang, rightHold, rightHang] = splitHolds(
      state,
      levels.length,
    );
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
    return { front: leftHold, behind: rightHold, highest };
  }
  const highest = advanceHold(
    state.hold,
    state.holdMs,
    levels,
    deltaMs,
    HOLD_HANG_MS,
    HOLD_FALL,
  );
  return { front: state.hold, highest };
};

const paintHold = (
  frame: IAnalysisFrame,
  hold: Float64Array,
  alpha: number,
): void => {
  const { context, xs, band } = frame;
  const line = spectrumLine(frame, hold);
  context.globalAlpha = alpha;
  context.lineWidth = HOLD_LINE_WIDTH;
  context.lineJoin = 'round';
  // Round ends, said here rather than left to whatever stroke came before:
  // the engine draws the same dashes as capsules (`holdDashes.ts`).
  context.lineCap = 'round';
  context.strokeStyle = readInk(HOLD_LINE_ALPHA);
  // Dashed on both sides of the Brightness, from the line's first point.
  context.setLineDash([HOLD_DASH, HOLD_DASH_GAP]);
  context.lineDashOffset = 0;
  context.stroke(line);
  context.setLineDash([]);
  context.globalAlpha = 1;
  // The high-water marks themselves: where the reading is still at its hold,
  // a bright pip. Drawn as one path so the whole row costs a single fill.
  const pips = new Path2D();
  let found = false;
  for (let index = 0; index < hold.length; index += 1) {
    if (isPip(hold[index], frame.levels[index])) {
      const y = placeLevel(band, hold[index]);
      // Started on the arc's own first point: a `moveTo` to the centre would
      // leave a radius across every pip once the path is stroked anywhere.
      pips.moveTo(xs[index] + PIP_RADIUS, y);
      pips.arc(xs[index], y, PIP_RADIUS, 0, Math.PI * 2);
      found = true;
    }
  }
  if (found) {
    context.globalAlpha = alpha * PIP_ALPHA;
    context.fillStyle = readInk(1);
    context.fill(pips);
    context.globalAlpha = 1;
  }
};

/** One figure: its body and edge, then its hold. */
const paintFigure = (
  frame: IAnalysisFrame,
  levels: Float64Array,
  hold: Float64Array,
  figure: IAnalyzerFigure,
  textured: boolean,
): void => {
  const onWhite = isLightWindow();
  paintSpectrum(frame, levels, {
    fillAlpha:
      frame.tuning.fillOpacity *
      figure.fill *
      (onWhite ? LIGHT_WINDOW_FILL_SHARE : 1),
    edgeAlpha: figure.edge,
    edgeWidth: figureEdgeWidth(frame, figure),
    textured,
    flat: onWhite,
  });
  paintHold(frame, hold, figure.hold);
};

const drawAnalyzerView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const { context, levels, split } = frame;
  const holds = advanceAnalyzer(frame, state);

  if (split && holds.behind) {
    // The right channel behind, in its own turned copy of the look's
    // colours, so the two are told apart by hue as well as by depth — and
    // named by the key the door prints over both.
    paintFigure(
      asMate(frame),
      split[1],
      holds.behind,
      ANALYZER_FIGURES.behind,
      false,
    );
    paintFigure(frame, split[0], holds.front, ANALYZER_FIGURES.front, true);
    context.globalAlpha = 1;
    return holds.highest > STILL_ENOUGH;
  }

  const halo = analyzerHalo(frame, levels);
  if (halo > 0) {
    paintHalo(frame, spectrumLine(frame, levels), halo);
  }
  paintFigure(frame, levels, holds.front, ANALYZER_FIGURES.joined, true);
  context.globalAlpha = 1;
  // The hold is still sliding long after the body has settled, so the loop
  // keeps running while any mark is above the floor it would rest on.
  return holds.highest > STILL_ENOUGH;
};

export default drawAnalyzerView;
