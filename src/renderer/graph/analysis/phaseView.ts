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
  type IAnalysisFrame,
  type IAnalysisState,
} from './analysisFrame';
import { paintLegend } from './channelInk';
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
 */

/** How much music the strip holds, and therefore how often it takes a step. */
const SPAN_MS = 20_000;

/** How many columns that span is cut into. */
const STEPS = 240;

/** The needle's own smoothing before it is written down. */
const SMOOTH_MS = 180;

const sizeHistory = (state: IAnalysisState) => {
  if (state.history.length === STEPS * 2) {
    return;
  }
  state.history = new Float64Array(STEPS * 2);
  state.historyHead = 0;
  state.historyAgeMs = 0;
  // Nothing measured yet reads as perfectly centred rather than as a mix
  // that cancels: an empty strip must not accuse anybody of anything.
  for (let index = 0; index < STEPS; index += 1) {
    state.history[index] = 1;
  }
};

const drawPhaseView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const { context, band, plot, deltaMs, scope, colours, tuning } = frame;
  sizeHistory(state);

  if (scope) {
    const reading = readStereoBlock(scope[0], scope[1]);
    const toward = easeFactor(deltaMs, SMOOTH_MS);
    state.correlation += (reading.correlation - state.correlation) * toward;
    state.loudness += (reading.width - state.loudness) * toward;
  }

  const stepMs = SPAN_MS / STEPS;
  state.historyAgeMs += deltaMs;
  let taken = 0;
  while (state.historyAgeMs >= stepMs && taken < 4) {
    state.historyAgeMs -= stepMs;
    state.historyHead = (state.historyHead + 1) % STEPS;
    state.history[state.historyHead] = state.correlation;
    state.history[STEPS + state.historyHead] = state.loudness;
    taken += 1;
  }
  if (state.historyAgeMs > stepMs * 4) {
    state.historyAgeMs = 0;
  }

  const { left } = plot;
  const width = plot.right - plot.left;
  const columnAt = (age: number) =>
    left + ((STEPS - 1 - age) / (STEPS - 1)) * width;
  // Correlation runs from the floor at −1 to the ceiling at +1, so the
  // middle row is zero and the tinted half below it is the half that cancels.
  const rowOf = (value: number) => placeLevel(band, clamp01((value + 1) / 2));

  context.globalAlpha = band.opacity;
  // The half that means trouble, marked out rather than left to be read off
  // a sign — the same decision the stereo panel's own scale makes.
  const zero = rowOf(0);
  const foot = band.flipped ? band.top : band.bottom;
  context.fillStyle = 'rgba(255, 96, 112, 0.1)';
  context.fillRect(left, Math.min(zero, foot), width, Math.abs(foot - zero));
  const rules = new Path2D();
  [-1, -0.5, 0, 0.5, 1].forEach((value) => {
    const y = rowOf(value);
    rules.moveTo(left, y);
    rules.lineTo(plot.right, y);
  });
  context.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  context.lineWidth = 1;
  context.stroke(rules);
  context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  const middle = new Path2D();
  middle.moveTo(left, zero);
  middle.lineTo(plot.right, zero);
  context.stroke(middle);

  /**
   * The width, as a band hanging off the correlation line rather than as a
   * second trace: two lines in one box would be two readings competing, and
   * width is context for the correlation rather than a rival to it.
   */
  const widthBand = new Path2D();
  const depth = Math.abs(band.bottom - band.top);
  for (let age = STEPS - 1; age >= 0; age -= 1) {
    const at = (state.historyHead - age + STEPS * 2) % STEPS;
    const y = rowOf(state.history[at]);
    const x = columnAt(age);
    if (age === STEPS - 1) {
      widthBand.moveTo(x, y);
    } else {
      widthBand.lineTo(x, y);
    }
  }
  for (let age = 0; age < STEPS; age += 1) {
    const at = (state.historyHead - age + STEPS * 2) % STEPS;
    const spread = clamp01(state.history[STEPS + at]) * depth * 0.22;
    widthBand.lineTo(
      columnAt(age),
      rowOf(state.history[at]) + (band.flipped ? -spread : spread),
    );
  }
  widthBand.closePath();
  context.globalAlpha = band.opacity * tuning.fillOpacity * 0.45;
  context.fillStyle = rampRgba(colours, 0.7, 1);
  context.fill(widthBand);

  const line = new Path2D();
  for (let age = STEPS - 1; age >= 0; age -= 1) {
    const at = (state.historyHead - age + STEPS * 2) % STEPS;
    const x = columnAt(age);
    const y = rowOf(state.history[at]);
    if (age === STEPS - 1) {
      line.moveTo(x, y);
    } else {
      line.lineTo(x, y);
    }
  }
  context.globalAlpha = band.opacity;
  context.lineJoin = 'round';
  context.lineWidth = Math.max(1.4, frame.edge.width);
  context.strokeStyle = beamPaint(frame, colours, 1);
  context.stroke(line);

  // Now, at the right-hand edge: a pip, so the eye knows which end is the
  // moment it is listening to.
  const nowY = rowOf(state.history[state.historyHead]);
  context.fillStyle = '#fff';
  context.beginPath();
  context.arc(plot.right - 1, nowY, 2.4, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
  paintLegend(frame, [
    { label: frame.legend.phase, ink: rampRgba(colours, 1, 1) },
    { label: frame.legend.width, ink: rampRgba(colours, 0.7, 1) },
  ]);
  // The strip travels while the capture runs; it stops with it, holding
  // whatever it has written down.
  return frame.playing || Math.abs(state.correlation) > STILL_ENOUGH;
};

export default drawPhaseView;
