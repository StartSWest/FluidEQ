/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  STILL_ENOUGH,
  clamp01,
  easeFactor,
  placeLevel,
  rampRgba,
  scratch,
  type IAnalysisFrame,
  type IAnalysisReading,
  type IAnalysisState,
} from './analysisFrame';
import { beamPaint } from './spectrumPaint';
import { readStereoBlock } from './stereoReading';

/**
 * Phase history: the stereo image of the last twenty seconds, as a strip.
 *
 * The stereo panel says what the image is doing NOW, and a mix that falls
 * out of phase for one bar of one chorus shows there as a twitch nobody
 * catches. This view is the same two numbers written down: correlation as a
 * line up the plot, width as a band behind it, and time running left to
 * right with now at the right-hand edge.
 *
 * So a passage that cancels leaves a dip you can point at and scrub back to,
 * and a record whose chorus suddenly widens leaves a step. It is the one
 * reading here that is about a SPAN of music rather than a moment.
 *
 * The middle rule is correlation zero; above it the channels agree, below it
 * they fight, and the whole lower half is tinted for the same reason the
 * stereo panel's scale is: "out of phase" should be a place on the picture
 * rather than the sign of a number somebody has to remember.
 *
 * Laid out here for both painters: this file's canvas drawing, and the
 * engine's (`engineLooks/phaseLook.ts`).
 */

/** How much music the strip holds, and therefore how often it takes a step. */
const SPAN_MS = 20_000;

/** How many columns that span is cut into. */
export const PHASE_STEPS = 240;

/** The needle's own smoothing before it is written down. */
const SMOOTH_MS = 180;

/** The half that cancels, the rules across the strip, and the zero rule. */
export const PHASE_TROUBLE_INK = 'rgba(255, 96, 112, 0.1)';
export const PHASE_RULE_INK = 'rgba(255, 255, 255, 0.1)';
export const PHASE_ZERO_INK = 'rgba(255, 255, 255, 0.28)';
export const PHASE_RULES = [-1, -0.5, 0, 0.5, 1] as const;

/** How far the width band hangs off the line at full width, of the band. */
export const PHASE_SPREAD = 0.22;
/** The width band: its share of the look's fill, and its ramp position. */
export const PHASE_BAND_FILL = 0.45;
export const PHASE_BAND_RAMP = 0.7;
/** The line's least width, and the pip at now's radius. */
export const PHASE_LINE_WIDTH = 1.4;
export const PHASE_PIP_RADIUS = 2.4;

const sizeHistory = (state: IAnalysisState) => {
  if (state.history.length === PHASE_STEPS * 2) {
    return;
  }
  state.history = new Float64Array(PHASE_STEPS * 2);
  state.historyHead = 0;
  state.historyAgeMs = 0;
  // Nothing measured yet reads as perfectly centred rather than as a mix
  // that cancels: an empty strip must not accuse anybody of anything.
  for (let index = 0; index < PHASE_STEPS; index += 1) {
    state.history[index] = 1;
  }
};

/**
 * The needle eased toward this block and written down when a step is due;
 * answers whether the strip is still moving.
 */
export const advancePhase = (
  reading: IAnalysisReading,
  state: IAnalysisState,
): boolean => {
  const { deltaMs, scope } = reading;
  sizeHistory(state);
  if (scope) {
    const block = readStereoBlock(scope[0], scope[1]);
    const toward = easeFactor(deltaMs, SMOOTH_MS);
    state.correlation += (block.correlation - state.correlation) * toward;
    state.loudness += (block.width - state.loudness) * toward;
  }
  const stepMs = SPAN_MS / PHASE_STEPS;
  state.historyAgeMs += deltaMs;
  let taken = 0;
  while (state.historyAgeMs >= stepMs && taken < 4) {
    state.historyAgeMs -= stepMs;
    state.historyHead = (state.historyHead + 1) % PHASE_STEPS;
    state.history[state.historyHead] = state.correlation;
    state.history[PHASE_STEPS + state.historyHead] = state.loudness;
    taken += 1;
  }
  if (state.historyAgeMs > stepMs * 4) {
    state.historyAgeMs = 0;
  }
  // The strip travels while the capture runs; it stops with it, holding
  // whatever it has written down.
  return reading.playing || Math.abs(state.correlation) > STILL_ENOUGH;
};

/**
 * The strip's steps as they stand in `reading`'s band, oldest first: each
 * one's column, the correlation line's row, and the width band's far edge.
 * Written into the state's working arrays, which nothing else of this view
 * uses, rather than built fresh sixty times a second.
 */
export const phaseSteps = (
  reading: IAnalysisReading,
  state: IAnalysisState,
): { xs: Float64Array; ys: Float64Array; edges: Float64Array } => {
  const { band, plot } = reading;
  const width = plot.right - plot.left;
  const depth = Math.abs(band.bottom - band.top);
  const [xs, ys, edges] = scratch(state, PHASE_STEPS, 3);
  for (let age = PHASE_STEPS - 1; age >= 0; age -= 1) {
    const at = (state.historyHead - age + PHASE_STEPS * 2) % PHASE_STEPS;
    const step = PHASE_STEPS - 1 - age;
    const y = phaseRow(reading, state.history[at]);
    const spread =
      clamp01(state.history[PHASE_STEPS + at]) * depth * PHASE_SPREAD;
    xs[step] = plot.left + (step / (PHASE_STEPS - 1)) * width;
    ys[step] = y;
    edges[step] = y + (band.flipped ? -spread : spread);
  }
  return { xs, ys, edges };
};

/**
 * Where a correlation is drawn: from the floor at −1 to the ceiling at +1,
 * so the middle row is zero and the tinted half below it is the half that
 * cancels.
 */
export const phaseRow = (reading: IAnalysisReading, value: number): number =>
  placeLevel(reading.band, clamp01((value + 1) / 2));

const drawPhaseView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const { context, band, plot, colours, tuning } = frame;
  const moving = advancePhase(frame, state);
  const { left } = plot;
  const width = plot.right - plot.left;

  context.globalAlpha = band.opacity;
  // The half that means trouble, marked out rather than left to be read off
  // a sign — the same decision the stereo panel's own scale makes.
  const zero = phaseRow(frame, 0);
  const foot = band.flipped ? band.top : band.bottom;
  context.fillStyle = PHASE_TROUBLE_INK;
  context.fillRect(left, Math.min(zero, foot), width, Math.abs(foot - zero));
  const rules = new Path2D();
  PHASE_RULES.forEach((value) => {
    const y = phaseRow(frame, value);
    rules.moveTo(left, y);
    rules.lineTo(plot.right, y);
  });
  context.strokeStyle = PHASE_RULE_INK;
  context.lineWidth = 1;
  context.stroke(rules);
  context.strokeStyle = PHASE_ZERO_INK;
  const middle = new Path2D();
  middle.moveTo(left, zero);
  middle.lineTo(plot.right, zero);
  context.stroke(middle);

  /**
   * The width, as a band hanging off the correlation line rather than as a
   * second trace: two lines in one box would be two readings competing, and
   * width is context for the correlation rather than a rival to it.
   */
  const { xs, ys, edges } = phaseSteps(frame, state);
  const widthBand = new Path2D();
  const line = new Path2D();
  for (let index = 0; index < PHASE_STEPS; index += 1) {
    if (index === 0) {
      widthBand.moveTo(xs[index], ys[index]);
      line.moveTo(xs[index], ys[index]);
    } else {
      widthBand.lineTo(xs[index], ys[index]);
      line.lineTo(xs[index], ys[index]);
    }
  }
  for (let index = PHASE_STEPS - 1; index >= 0; index -= 1) {
    widthBand.lineTo(xs[index], edges[index]);
  }
  widthBand.closePath();
  context.globalAlpha = band.opacity * tuning.fillOpacity * PHASE_BAND_FILL;
  context.fillStyle = rampRgba(colours, PHASE_BAND_RAMP, 1);
  context.fill(widthBand);

  context.globalAlpha = band.opacity;
  context.lineJoin = 'round';
  context.lineWidth = Math.max(PHASE_LINE_WIDTH, frame.edge.width);
  context.strokeStyle = beamPaint(frame, colours, 1);
  context.stroke(line);

  // Now, at the right-hand edge: a pip, so the eye knows which end is the
  // moment it is listening to.
  context.fillStyle = '#fff';
  context.beginPath();
  context.arc(
    plot.right - 1,
    ys[PHASE_STEPS - 1],
    PHASE_PIP_RADIUS,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.globalAlpha = 1;
  return moving;
};

export default drawPhaseView;
