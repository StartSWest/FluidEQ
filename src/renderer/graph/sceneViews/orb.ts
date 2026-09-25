/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  clampUnit,
  levelAtX,
  lightInkAt,
  type ISceneDrawn,
  type ISceneFrame,
} from './sceneFrame';
import { roundInk } from './sceneInks';
import { createPeakHold, holdPeaks, type IPeakHold } from './scenePieces';

/**
 * ORB: a sphere of light that the music shapes from the inside out.
 *
 * Three skins, one inside the other. The outer one is the spectrum wrapped
 * round the orb — the bass at the bottom climbing both sides to the treble
 * at the top, as on the Halo — so every band pushes out its own part of the
 * surface; the middle one ripples with the middle of the music; the core
 * swells with the bass and flashes on the kick. They are added to each other
 * as light, so the orb is brightest where the skins overlap, a highlight
 * sits on its upper left like a real sphere's, and the whole of it turns
 * slowly with the music. With Lit peaks the outer skin of a moment ago stays
 * as a dotted ring and settles back.
 *
 * Colour by runs the colours round the orb, out from its middle, in one
 * colour or by its loudness; Outline leaves the skins as lines at the line
 * width; Opacity is how strong the light is; Glow how far the halo spreads.
 * The orb is one figure, so Pieces and Gap have nothing here to move.
 */

/** Points round the orb, and the orb's radius against the smaller side. */
const POINTS = 120;
const RADIUS = 0.26;

export interface IOrbState {
  /** The spectrum round one side, bass to treble, and its held copy. */
  skin: Float64Array;
  peaks: IPeakHold;
  turn: number;
}

export const createOrbState = (): IOrbState => ({
  skin: new Float64Array(POINTS / 2 + 1),
  peaks: createPeakHold(),
  turn: 0,
});

/** A smooth closed path through radii round a centre. */
const closedBlob = (
  cx: number,
  cy: number,
  radiusAt: (index: number) => number,
  turn: number,
): Path2D => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index < POINTS; index += 1) {
    const angle = Math.PI / 2 + (index / POINTS) * Math.PI * 2 + turn;
    const radius = radiusAt(index);
    xs.push(cx + Math.cos(angle) * radius);
    ys.push(cy + Math.sin(angle) * radius);
  }
  const path = new Path2D();
  path.moveTo((xs[POINTS - 1] + xs[0]) / 2, (ys[POINTS - 1] + ys[0]) / 2);
  for (let index = 0; index < POINTS; index += 1) {
    const next = (index + 1) % POINTS;
    path.quadraticCurveTo(
      xs[index],
      ys[index],
      (xs[index] + xs[next]) / 2,
      (ys[index] + ys[next]) / 2,
    );
  }
  path.closePath();
  return path;
};

/** Round the orb clockwise from the bottom: up one side and down the other. */
const skinAt = (values: Float64Array, index: number): number => {
  const half = POINTS / 2;
  return values[index <= half ? index : POINTS - index];
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IOrbState,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look } = frame;
  const side = Math.min(plot.right - plot.left, band.bottom - band.top);
  const cx = (plot.left + plot.right) / 2;
  const cy = (band.top + band.bottom) / 2;
  const radius = side * RADIUS * (1 + music.pulse * 0.05);
  const { turn } = state;
  const { clock } = music;
  const outer = closedBlob(
    cx,
    cy,
    (index) => radius * (1 + 0.62 * skinAt(state.skin, index)),
    turn,
  );
  const middle = closedBlob(
    cx,
    cy,
    (index) =>
      radius *
      (0.72 +
        0.16 * music.mid +
        0.1 *
          music.mid *
          Math.sin((index / POINTS) * Math.PI * 6 + clock * 2.1)),
    -turn * 1.4,
  );
  const core = closedBlob(
    cx,
    cy,
    (index) =>
      radius *
      (0.36 +
        0.26 * music.bass +
        0.14 * music.pulse +
        0.03 * Math.sin((index / POINTS) * Math.PI * 4 - clock * 1.6)),
    turn * 0.6,
  );
  const reach = radius * 1.7;
  const paint = (alpha: number, whiten = 0) =>
    roundInk(frame, cx, cy, 0, reach, turn, whiten, alpha);

  context.save();
  context.globalCompositeOperation = 'lighter';
  // The halo the orb throws, opened by the bass and the look's Glow.
  const halo = radius * (2.1 + music.bass * 0.5 + frame.glow * 0.6);
  const air = context.createRadialGradient(cx, cy, radius * 0.6, cx, cy, halo);
  air.addColorStop(
    0,
    lightInkAt(colours, 0.5, 0.2, (0.16 + music.bass * 0.14) * look.opacity),
  );
  air.addColorStop(1, lightInkAt(colours, 0.5, 0.2, 0));
  context.fillStyle = air;
  context.beginPath();
  context.arc(cx, cy, halo, 0, Math.PI * 2);
  context.fill();
  if (look.filled) {
    context.fillStyle = paint(0.34 * look.opacity);
    context.fill(outer);
    context.fillStyle = paint(0.4 * look.opacity, 0.1);
    context.fill(middle);
    context.fillStyle = paint(0.62 * look.opacity, 0.35 + music.pulse * 0.4);
    context.fill(core);
    body?.addPath(outer);
  }
  context.lineJoin = 'round';
  context.strokeStyle = paint(0.9 * look.opacity, 0.35);
  context.lineWidth = look.filled ? 1.6 : look.lineWidth;
  context.stroke(outer);
  context.strokeStyle = paint(0.5 * look.opacity, 0.2);
  context.lineWidth = look.filled ? 1 : look.lineWidth * 0.7;
  context.stroke(middle);
  if (!look.filled) {
    context.stroke(core);
  }
  // The highlight a sphere carries on its upper left.
  const shineX = cx - radius * 0.32;
  const shineY = cy - radius * 0.38;
  const shine = context.createRadialGradient(
    shineX,
    shineY,
    0,
    shineX,
    shineY,
    radius * 0.5,
  );
  shine.addColorStop(
    0,
    `rgba(255, 255, 255, ${(0.32 * look.opacity).toFixed(3)})`,
  );
  shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = shine;
  context.beginPath();
  context.arc(shineX, shineY, radius * 0.5, 0, Math.PI * 2);
  context.fill();
  context.restore();

  if (look.accents) {
    const held = new Path2D();
    for (let index = 0; index < POINTS; index += 2) {
      const value = skinAt(state.peaks.held, index);
      if (value - skinAt(state.skin, index) > 0.03) {
        const angle = Math.PI / 2 + (index / POINTS) * Math.PI * 2 + turn;
        const at = radius * (1 + 0.62 * value) + 3;
        const x = cx + Math.cos(angle) * at;
        const y = cy + Math.sin(angle) * at;
        held.moveTo(x + 1.3, y);
        held.arc(x, y, 1.3, 0, Math.PI * 2);
      }
    }
    context.fillStyle = paint(0.85, 0.5);
    context.fill(held);
  }
};

export const drawOrb = (frame: ISceneFrame, state: IOrbState): ISceneDrawn => {
  const { plot, xs, levels, music } = frame;
  const width = plot.right - plot.left;
  const half = POINTS / 2;
  for (let index = 0; index <= half; index += 1) {
    state.skin[index] = clampUnit(
      levelAtX(xs, levels, plot.left + (index / half) * width),
    );
  }
  const falling = holdPeaks(state.peaks, state.skin, half + 1, frame.deltaMs);
  state.turn =
    (state.turn + music.step * (0.12 + music.mid * 0.4)) % (Math.PI * 2);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, body));
  return { moving: falling && frame.look.accents, body };
};
