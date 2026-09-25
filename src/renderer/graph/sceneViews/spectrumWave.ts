/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  clampUnit,
  figureInk,
  levelAtX,
  type ISceneDrawn,
  type ISceneFrame,
  type ISceneSpan,
} from './sceneFrame';
import { createPeakHold, holdPeaks, type IPeakHold } from './scenePieces';

/**
 * SPECTRUM WAVE: the spectrum as one smooth line of light over a glowing
 * fill, with its own recent past trailing behind it.
 *
 * The line is drawn three times — a wide soft glow, the line itself, a thin
 * white-hot core — and swells on the kick. Under it the fill fades from the
 * line down to nothing at the floor. Two echoes of the line follow it a beat
 * behind, fainter each, so a moving spectrum leaves a wake. With Lit peaks a
 * dashed line holds the spectrum's recent top and settles back.
 *
 * Colour by runs the light across bass to treble, up from the floor, or in
 * one colour (heat reads as height: the wave is one figure); Outline drops
 * the fill and leaves the lines, at the line width; Opacity is how solid the
 * fill is; Glow is how wide the line's glow spreads. The wave is not made of
 * pieces, so Pieces and Gap have nothing here to move.
 */

/** Points along the line. */
const SAMPLES = 120;
/** How often the wake takes a copy of the line, and how many it keeps. */
const ECHO_EVERY_MS = 45;
const ECHOES = 6;
/** Which of the kept copies are drawn, oldest last, and how faint. */
const DRAWN_ECHOES: readonly [number, number][] = [
  [2, 0.34],
  [5, 0.16],
];

export interface ISpectrumWaveState {
  line: Float64Array;
  /** The line as it was, newest first, one copy per `ECHO_EVERY_MS`. */
  echoes: Float64Array[];
  sinceEcho: number;
  peaks: IPeakHold;
}

export const createSpectrumWaveState = (): ISpectrumWaveState => ({
  line: new Float64Array(SAMPLES + 1),
  echoes: [],
  sinceEcho: 0,
  peaks: createPeakHold(),
});

/** A smooth path through the samples, by the midpoints between them. */
const traceLine = (
  path: Path2D,
  frame: ISceneFrame,
  values: Float64Array,
  floor: number,
  up: number,
  reach: number,
): void => {
  const { plot } = frame;
  const width = plot.right - plot.left;
  const xAt = (step: number) => plot.left + (step / SAMPLES) * width;
  const yAt = (step: number) => floor + up * values[step] * reach;
  path.moveTo(xAt(0), yAt(0));
  for (let step = 1; step < SAMPLES; step += 1) {
    path.quadraticCurveTo(
      xAt(step),
      yAt(step),
      (xAt(step) + xAt(step + 1)) / 2,
      (yAt(step) + yAt(step + 1)) / 2,
    );
  }
  path.lineTo(xAt(SAMPLES), yAt(SAMPLES));
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: ISpectrumWaveState,
  body: Path2D | undefined,
): void => {
  const { context, plot, music, look } = frame;
  const up = band.flipped ? 1 : -1;
  const floor = band.flipped ? band.top : band.bottom;
  const reach = (band.bottom - band.top) * 0.92;
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: floor + up * reach,
  };
  const line = new Path2D();
  traceLine(line, frame, state.line, floor, up, reach);

  if (look.filled) {
    const fill = new Path2D(line);
    fill.lineTo(plot.right, floor);
    fill.lineTo(plot.left, floor);
    fill.closePath();
    context.save();
    context.globalAlpha = look.opacity * 0.74;
    context.fillStyle = figureInk(context, frame, span, 1);
    context.fill(fill);
    // Fading from the line to nothing at the floor: taken out of the fill
    // itself, so whatever colour it runs in keeps its hue as it fades.
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'destination-out';
    const fade = context.createLinearGradient(0, span.head, 0, floor);
    fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fade.addColorStop(0.45, 'rgba(0, 0, 0, 0.35)');
    fade.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    context.fillStyle = fade;
    context.fill(fill);
    context.restore();
    body?.addPath(fill);
  }

  // The wake: older copies of the line, fainter each — after the fill,
  // whose fade would otherwise take them out with it.
  context.save();
  context.lineJoin = 'round';
  DRAWN_ECHOES.forEach(([age, alpha]) => {
    const echo = state.echoes[age];
    if (!echo) {
      return;
    }
    const path = new Path2D();
    traceLine(path, frame, echo, floor, up, reach);
    context.strokeStyle = figureInk(context, frame, span, alpha, 0.1);
    context.lineWidth = Math.max(1, look.lineWidth * 0.6);
    context.stroke(path);
  });
  context.restore();

  // The line: a wide soft glow, the line, and its white-hot core.
  const weight = look.lineWidth * (1 + music.pulse * 0.5);
  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.strokeStyle = figureInk(
    context,
    frame,
    span,
    clampUnit(0.24 + music.pulse * 0.14 + frame.glow * 0.2),
  );
  context.lineWidth = weight * (4 + frame.glow * 4);
  context.stroke(line);
  context.strokeStyle = figureInk(context, frame, span, 1, 0.1);
  context.lineWidth = weight;
  context.stroke(line);
  context.strokeStyle = figureInk(context, frame, span, 0.85, 0.75);
  context.lineWidth = Math.max(0.6, weight * 0.35);
  context.stroke(line);

  if (look.accents) {
    const held = new Path2D();
    traceLine(held, frame, state.peaks.held, floor, up, reach);
    context.setLineDash([3, 5]);
    context.strokeStyle = figureInk(context, frame, span, 0.7, 0.5);
    context.lineWidth = 1.2;
    context.stroke(held);
  }
  context.restore();
};

export const drawSpectrumWave = (
  frame: ISceneFrame,
  state: ISpectrumWaveState,
): ISceneDrawn => {
  const { plot, xs, levels } = frame;
  const width = plot.right - plot.left;
  for (let step = 0; step <= SAMPLES; step += 1) {
    state.line[step] = clampUnit(
      levelAtX(xs, levels, plot.left + (step / SAMPLES) * width),
    );
  }
  // The wake keeps a copy every so often of the line as drawn, counted in
  // the frames' own time so it trails by the same distance at any rate.
  state.sinceEcho += frame.deltaMs;
  if (state.sinceEcho >= ECHO_EVERY_MS || state.echoes.length === 0) {
    state.sinceEcho = 0;
    const recycled =
      state.echoes.length >= ECHOES ? state.echoes.pop() : undefined;
    const copy = recycled ?? new Float64Array(SAMPLES + 1);
    copy.set(state.line);
    state.echoes.unshift(copy);
  }
  const falling = holdPeaks(
    state.peaks,
    state.line,
    SAMPLES + 1,
    frame.deltaMs,
  );
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, body));
  // While a wake is still catching up with a line at rest, keep drawing.
  const oldest = state.echoes[state.echoes.length - 1];
  let settling = false;
  if (oldest) {
    for (let step = 0; step <= SAMPLES && !settling; step += 1) {
      settling = Math.abs(oldest[step] - state.line[step]) > 0.002;
    }
  }
  return {
    moving: settling || (falling && frame.look.accents),
    body,
  };
};
