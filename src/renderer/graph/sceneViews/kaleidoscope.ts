/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  clampUnit,
  hash01,
  levelAtX,
  lightInkAt,
  type ISceneDrawn,
  type ISceneFrame,
} from './sceneFrame';
import { roundInk } from './sceneInks';

/**
 * KALEIDOSCOPE: the spectrum folded into a mandala.
 *
 * The spectrum is laid along one mirrored slice — bass at the slice's
 * edges, treble in its middle — and the slice repeated round the centre, so
 * the music draws a flower with eight petals that grows where the sound is
 * loud. A second, smaller flower inside it turns the other way and breathes
 * with the bass; spokes of light divide the slices; the kick flashes the
 * whole figure and the treble lights sparks on the petals' tips (Lit peaks).
 *
 * Colour by runs the colours out from the middle, round each slice from
 * bass to treble, in one colour, or by the music's loudness; Outline leaves
 * the petals as lines at the line width; Opacity is how strong they are;
 * Glow how bright the flash. The mandala is one figure, so Pieces and Gap
 * have nothing here to move.
 */

/** Slices round the mandala, and points along each half-slice. */
const SLICES = 8;
const SAMPLES = 28;
/** The mandala's radius against the smaller side. */
const RADIUS = 0.48;

export interface IKaleidoscopeState {
  /** The spectrum along a half-slice, bass first. */
  line: Float64Array;
  turn: number;
}

export const createKaleidoscopeState = (): IKaleidoscopeState => ({
  line: new Float64Array(SAMPLES + 1),
  turn: 0,
});

/**
 * The flower: every slice the half-slice and its mirror, radius `inner`
 * plus `reach` times the value along it.
 */
const flower = (
  cx: number,
  cy: number,
  values: Float64Array,
  inner: number,
  reach: number,
  turn: number,
): { path: Path2D; tips: [number, number][] } => {
  const path = new Path2D();
  const tips: [number, number][] = [];
  const slice = (Math.PI * 2) / SLICES;
  let isFirst = true;
  for (let piece = 0; piece < SLICES; piece += 1) {
    for (let step = 0; step <= SAMPLES * 2; step += 1) {
      // Out along the half-slice and back along its mirror.
      const along = step <= SAMPLES ? step / SAMPLES : 2 - step / SAMPLES;
      const value = values[Math.round(along * SAMPLES)];
      const angle = turn + piece * slice + (step / (SAMPLES * 2)) * slice;
      const radius = inner + reach * value;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (isFirst) {
        path.moveTo(x, y);
        isFirst = false;
      } else {
        path.lineTo(x, y);
      }
      if (step === SAMPLES) {
        tips.push([x, y]);
      }
    }
  }
  path.closePath();
  return { path, tips };
};

/**
 * The colours round the mandala for frequency: every slice runs bass at its
 * edges to treble at its middle, so the ramp repeats slice by slice.
 */
const sliceInk = (
  frame: ISceneFrame,
  cx: number,
  cy: number,
  turn: number,
  whiten: number,
  alpha: number,
): CanvasGradient => {
  const round = frame.context.createConicGradient(turn, cx, cy);
  const steps = 6;
  for (let piece = 0; piece < SLICES; piece += 1) {
    for (let step = 0; step <= steps; step += 1) {
      const at = (piece + step / steps) / SLICES;
      const along =
        step <= steps / 2 ? (step * 2) / steps : 2 - (step * 2) / steps;
      round.addColorStop(
        Math.min(1, at),
        lightInkAt(frame.colours, along, whiten, alpha),
      );
    }
  }
  return round;
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IKaleidoscopeState,
  body: Path2D | undefined,
): void => {
  const { context, plot, music, look } = frame;
  const side = Math.min(plot.right - plot.left, band.bottom - band.top);
  const cx = (plot.left + plot.right) / 2;
  const cy = (band.top + band.bottom) / 2;
  const size = side * RADIUS * (1 + music.pulse * 0.05);
  const { turn } = state;
  const outer = flower(cx, cy, state.line, size * 0.34, size * 0.66, turn);
  const inner = flower(
    cx,
    cy,
    state.line,
    size * 0.14,
    size * (0.34 + music.bass * 0.3),
    -turn * 1.6 + Math.PI / SLICES,
  );
  const paint = (alpha: number, whiten: number): string | CanvasGradient =>
    look.ink === 'frequency'
      ? sliceInk(frame, cx, cy, turn, whiten, alpha)
      : roundInk(frame, cx, cy, 0, size, turn, whiten, alpha);
  const flash = music.pulse * (0.35 + frame.glow * 0.3);

  context.save();
  context.globalCompositeOperation = 'lighter';
  // The spokes between the slices.
  const spokes = new Path2D();
  for (let piece = 0; piece < SLICES; piece += 1) {
    const angle = turn + (piece * Math.PI * 2) / SLICES;
    spokes.moveTo(cx, cy);
    spokes.lineTo(cx + Math.cos(angle) * size, cy + Math.sin(angle) * size);
  }
  context.strokeStyle = paint(0.16 * look.opacity, 0.5);
  context.lineWidth = 1;
  context.stroke(spokes);
  if (look.filled) {
    context.fillStyle = paint(0.3 * look.opacity, flash);
    context.fill(outer.path);
    context.fillStyle = paint(0.45 * look.opacity, 0.2 + flash);
    context.fill(inner.path);
    body?.addPath(outer.path);
  }
  context.lineJoin = 'round';
  context.strokeStyle = paint(0.95 * look.opacity, 0.3 + flash);
  context.lineWidth = look.filled ? 1.5 : look.lineWidth;
  context.stroke(outer.path);
  context.strokeStyle = paint(0.7 * look.opacity, 0.4 + flash);
  context.lineWidth = look.filled ? 1 : look.lineWidth * 0.7;
  context.stroke(inner.path);
  // A jewel at the centre.
  const jewel = context.createRadialGradient(cx, cy, 0, cx, cy, size * 0.14);
  jewel.addColorStop(
    0,
    `rgba(255, 255, 255, ${(0.6 * look.opacity).toFixed(3)})`,
  );
  jewel.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = jewel;
  context.beginPath();
  context.arc(cx, cy, size * 0.14, 0, Math.PI * 2);
  context.fill();
  // Sparks on the petals' tips, with the treble.
  if (look.accents && music.treble > 0.18) {
    const sparks = new Path2D();
    outer.tips.forEach(([x, y], index) => {
      if (hash01(index * 3.1 + Math.floor(music.clock * 9)) < music.treble) {
        sparks.moveTo(x + 2, y);
        sparks.arc(x, y, 2, 0, Math.PI * 2);
      }
    });
    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    context.fill(sparks);
  }
  context.restore();
};

export const drawKaleidoscope = (
  frame: ISceneFrame,
  state: IKaleidoscopeState,
): ISceneDrawn => {
  const { plot, xs, levels, music } = frame;
  const width = plot.right - plot.left;
  for (let step = 0; step <= SAMPLES; step += 1) {
    state.line[step] = clampUnit(
      levelAtX(xs, levels, plot.left + (step / SAMPLES) * width),
    );
  }
  state.turn =
    (state.turn + music.step * (0.1 + music.mid * 0.35)) % (Math.PI * 2);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, body));
  // It turns on the music's clock; the listener keeps the loop awake while
  // it plays (`hearMusic`).
  return { moving: false, body };
};
