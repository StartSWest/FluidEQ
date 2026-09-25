/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  clampUnit,
  hash01,
  inkAt,
  levelAtX,
  lightInkAt,
  rampAlong,
  type ISceneDrawn,
  type ISceneFrame,
} from './sceneFrame';
import { createPeakHold, holdPeaks, type IPeakHold } from './scenePieces';

/**
 * SYNTHWAVE: a neon grid running to a horizon under a striped sun.
 *
 * The floor is a grid in perspective that rolls toward the viewer at the
 * music's pace and flashes on the beat. On the horizon the spectrum stands as
 * a range of mountains, mirrored from the middle — bass in the centre, treble
 * at the edges — dark inside and edged in neon, in front of a setting sun cut
 * by the bands every synthwave sun is cut by. The sun swells a little on the
 * kick; the stars above twinkle with the treble.
 *
 * The grid and the stars are scenery and reach the edges of the window at any
 * height setting; the mountains are the figure and answer the slider.
 *
 * The style editor: Colour by edges the range out from the middle bass to
 * treble, up from the horizon, or in one colour; Outline leaves the range as
 * its neon ridge alone at the line width; Opacity is how solid the rock is;
 * Lit peaks leaves the ridge of a moment ago dotted over it; Glow opens the
 * sun's and the ridge's light. The range is one figure, so Pieces and Gap
 * have nothing here to move.
 *
 * Grid lines are two paths (the rails and the rungs), each stroked twice —
 * wide and faint, then thin and bright — for the neon; the stars are one path.
 */

/** Where the horizon sits, as a share of the band from its top. */
const HORIZON = 0.56;
/** The sun's radius against the band's depth and the plot's width. */
const SUN_DEPTH = 0.34;
const SUN_WIDTH = 0.15;
/** Rails across the floor, and rungs between the horizon and the viewer. */
const RAILS = 26;
const RUNGS = 14;
/** Stars in the sky, and points along each half of the range. */
const STARS = 90;
const RANGE_POINTS = 64;

export interface ISynthwaveState {
  /** How far the floor has rolled, in rungs. */
  roll: number;
  /** The range's height out from the middle, and the ridge held over it. */
  ridge: Float64Array;
  peaks: IPeakHold;
}

export const createSynthwaveState = (): ISynthwaveState => ({
  roll: 0,
  ridge: new Float64Array(RANGE_POINTS + 1),
  peaks: createPeakHold(),
});

const drawGrid = (
  frame: ISceneFrame,
  horizon: number,
  bottom: number,
  cx: number,
  roll: number,
) => {
  const { context, window, colours, music } = frame;
  const rails = new Path2D();
  const spread = window.width * 1.6;
  for (let rail = 0; rail <= RAILS; rail += 1) {
    const at = rail / RAILS - 0.5;
    rails.moveTo(cx + at * spread * 0.04, horizon);
    rails.lineTo(cx + at * spread * 2.2, bottom);
  }
  const rungs = new Path2D();
  const depth = bottom - horizon;
  for (let rung = 0; rung < RUNGS; rung += 1) {
    // Evenly spaced in depth, projected: close together at the horizon,
    // wide apart at the viewer's feet.
    const along = (rung + (roll % 1)) / RUNGS;
    const y = horizon + depth * along * along;
    rungs.moveTo(0, y);
    rungs.lineTo(window.width, y);
  }
  const flash = music.pulse * 0.4;
  // Fading toward the horizon, so the far grid dissolves into the haze.
  const ink = context.createLinearGradient(0, horizon, 0, bottom);
  ink.addColorStop(0, inkAt(colours, 0.15, 0));
  ink.addColorStop(0.35, inkAt(colours, 0.15, 0.35 + flash));
  ink.addColorStop(1, inkAt(colours, 0.15, 0.8 + flash));
  context.save();
  context.lineCap = 'round';
  context.strokeStyle = ink;
  context.globalAlpha = 0.25;
  context.lineWidth = 5;
  context.stroke(rails);
  context.stroke(rungs);
  context.globalAlpha = 1;
  context.lineWidth = 1.2;
  context.stroke(rails);
  context.stroke(rungs);
  context.restore();
};

const drawStars = (frame: ISceneFrame, top: number, horizon: number) => {
  const { context, window, music } = frame;
  const stars = new Path2D();
  for (let star = 0; star < STARS; star += 1) {
    const x = hash01(star * 3.7) * window.width;
    const y = top + hash01(star * 9.1) * (horizon - top) * 0.9;
    const twinkle =
      0.4 +
      0.6 * Math.abs(Math.sin(music.clock * (1.5 + hash01(star) * 3) + star));
    const size =
      0.6 + twinkle * (0.6 + music.treble * 1.2) * hash01(star * 1.9);
    stars.rect(x - size / 2, y - size / 2, size, size);
  }
  context.fillStyle = `rgba(255, 255, 255, ${(0.35 + music.treble * 0.5).toFixed(3)})`;
  context.fill(stars);
};

const drawSun = (
  frame: ISceneFrame,
  cx: number,
  horizon: number,
  radius: number,
) => {
  const { context, colours, music } = frame;
  const centreY = horizon - radius * 0.3;
  context.save();
  // The bands the sun is cut by: thin at the top of the cut, thicker toward
  // the horizon, and none on the upper half.
  const clip = new Path2D();
  clip.rect(cx - radius, centreY - radius, radius * 2, radius * 1.02);
  let y = centreY + radius * 0.02;
  let gap = 2;
  let bar = radius * 0.16;
  while (y < horizon) {
    clip.rect(cx - radius, y + gap, radius * 2, bar);
    y += gap + bar;
    gap += 1.4;
    bar = Math.max(2, bar * 0.8);
  }
  context.clip(clip);
  const face = context.createLinearGradient(0, centreY - radius, 0, horizon);
  face.addColorStop(0, lightInkAt(colours, 1, 0.35, 1));
  face.addColorStop(1, inkAt(colours, 0.75, 1));
  context.fillStyle = face;
  context.beginPath();
  context.arc(cx, centreY, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
  // Its glow, which the beat opens a little.
  const glow = context.createRadialGradient(
    cx,
    centreY,
    radius * 0.8,
    cx,
    centreY,
    radius * (1.6 + music.pulse * 0.3),
  );
  glow.addColorStop(
    0,
    inkAt(colours, 0.85, 0.22 + music.pulse * 0.15 + frame.glow * 0.2),
  );
  glow.addColorStop(1, inkAt(colours, 0.85, 0));
  context.fillStyle = glow;
  context.beginPath();
  context.arc(cx, centreY, radius * (1.6 + music.pulse * 0.3), 0, Math.PI * 2);
  context.fill();
};

/**
 * The ridge's paint, as Colour by says: out from the middle bass to treble
 * (the range is the spectrum read outward), up from the horizon, or one
 * colour. Heat reads as height here: the range is one figure, not pieces.
 */
const ridgeInk = (
  frame: ISceneFrame,
  horizon: number,
  top: number,
  whiten: number,
  alpha: number,
): string | CanvasGradient => {
  const { context, colours, look, plot } = frame;
  if (look.ink === 'flat') {
    return lightInkAt(colours, 0.5, whiten, alpha);
  }
  if (look.ink === 'frequency') {
    const out = context.createLinearGradient(plot.left, 0, plot.right, 0);
    const stops = 16;
    for (let stop = 0; stop <= stops; stop += 1) {
      const at = stop / stops;
      out.addColorStop(
        at,
        lightInkAt(colours, Math.abs(at * 2 - 1), whiten, alpha),
      );
    }
    return out;
  }
  return rampAlong(context, colours, [0, horizon], [0, top], whiten, alpha);
};

/** The spectrum as a range, mirrored from the middle. */
const drawRange = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  horizon: number,
  cx: number,
  state: ISynthwaveState,
  body: Path2D | undefined,
) => {
  const { context, plot, music, look } = frame;
  const width = plot.right - plot.left;
  const tall = (band.bottom - band.top) * 0.38;
  const up = band.flipped ? 1 : -1;
  const ridge: [number, number][] = [];
  const held = new Path2D();
  for (let point = RANGE_POINTS; point >= -RANGE_POINTS; point -= 1) {
    const out = Math.abs(point);
    // A little jaggedness of its own, so the range reads as rock.
    const rough = 0.85 + 0.15 * hash01(Math.round(point * 1.3) + 11);
    const x = cx + (point / RANGE_POINTS) * (width / 2);
    ridge.push([x, horizon + up * state.ridge[out] * tall * rough]);
    // The ridge a moment ago, left as a dotted line over the rock.
    if (look.accents && state.peaks.held[out] - state.ridge[out] > 0.03) {
      const heldY = horizon + up * state.peaks.held[out] * tall * rough;
      held.rect(x - 1, heldY - 1, 2, 2);
    }
  }
  const mountains = new Path2D();
  mountains.moveTo(ridge[0][0], horizon);
  ridge.forEach(([x, y]) => mountains.lineTo(x, y));
  mountains.lineTo(ridge[ridge.length - 1][0], horizon);
  mountains.closePath();
  const top = horizon + up * tall;
  if (look.filled) {
    // Dark inside, so the range stands in front of the sun.
    const rock = context.createLinearGradient(0, top, 0, horizon);
    rock.addColorStop(0, inkAt(frame.colours, 0.35, 0.55 * look.opacity));
    rock.addColorStop(1, `rgba(6, 4, 18, ${(0.92 * look.opacity).toFixed(3)})`);
    context.fillStyle = rock;
    context.fill(mountains);
    body?.addPath(mountains);
  }
  const edge = new Path2D();
  ridge.forEach(([x, y], index) => {
    if (index === 0) {
      edge.moveTo(x, y);
    } else {
      edge.lineTo(x, y);
    }
  });
  context.save();
  context.lineJoin = 'round';
  const line = look.filled ? 1.5 : look.lineWidth;
  context.strokeStyle = ridgeInk(
    frame,
    horizon,
    top,
    0,
    0.25 + music.pulse * 0.2 + frame.glow * 0.25,
  );
  context.lineWidth = line + 3.5;
  context.stroke(edge);
  context.strokeStyle = ridgeInk(frame, horizon, top, 0.25, 0.95);
  context.lineWidth = line;
  context.stroke(edge);
  context.fillStyle = ridgeInk(frame, horizon, top, 0.5, 0.85);
  context.fill(held);
  // The horizon line.
  context.strokeStyle = inkAt(frame.colours, 0.9, 0.6 + music.pulse * 0.3);
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, horizon);
  context.lineTo(frame.window.width, horizon);
  context.stroke();
  context.restore();
};

export const drawSynthwave = (
  frame: ISceneFrame,
  state: ISynthwaveState,
): ISceneDrawn => {
  const { context, plot, music, window, bands, xs, levels } = frame;
  state.roll = (state.roll + music.step * (1.2 + music.bass * 2.4)) % 1000;
  const cx = (plot.left + plot.right) / 2;
  // The range read once for every copy: bass in the middle, treble at the
  // edges, the spectrum read outward.
  const width = plot.right - plot.left;
  for (let out = 0; out <= RANGE_POINTS; out += 1) {
    state.ridge[out] = clampUnit(
      levelAtX(xs, levels, plot.left + (out / RANGE_POINTS) * width),
    );
  }
  const falling = holdPeaks(
    state.peaks,
    state.ridge,
    RANGE_POINTS + 1,
    frame.deltaMs,
  );
  const body = frame.look.textured ? new Path2D() : undefined;
  bands.forEach((band) => {
    const depth = band.bottom - band.top;
    // Upside down, the whole picture is: drawn the right way up in a mirror
    // about the band's middle, rather than every part learning to hang.
    context.save();
    if (band.flipped) {
      context.translate(0, band.top + band.bottom);
      context.scale(1, -1);
    }
    const upright: IAnalysisBand = { ...band, flipped: false };
    const horizon = band.top + depth * HORIZON;
    // The floor reaches the window's edge on the viewer's side when this is
    // the only copy; a mirrored wave's two copies each keep to their own.
    // So does the sky on the far side, for the stars: in the mirror the
    // window's bottom edge stands where its top would.
    let near = band.bottom;
    let sky = band.top;
    if (bands.length === 1) {
      near = band.flipped ? band.top + band.bottom : window.height;
      sky = band.flipped ? band.top + band.bottom - window.height : 0;
    }
    drawStars(frame, sky, horizon);
    drawGrid(frame, horizon, near, cx, state.roll);
    const radius = Math.min(
      depth * SUN_DEPTH,
      (plot.right - plot.left) * SUN_WIDTH,
    );
    drawSun(frame, cx, horizon, radius * (1 + music.pulse * 0.04));
    // The body is gathered in the mirror's own space, so it is drawn back
    // through the same flip it was built in.
    const copyBody = body ? new Path2D() : undefined;
    drawRange(frame, upright, horizon, cx, state, copyBody);
    context.restore();
    if (body && copyBody) {
      body.addPath(
        copyBody,
        band.flipped
          ? new DOMMatrix([1, 0, 0, -1, 0, band.top + band.bottom])
          : undefined,
      );
    }
  });
  // The floor rolls with the music; the listener keeps the loop awake while
  // it plays (`hearMusic`), and a held ridge still settling does the same.
  return { moving: falling && frame.look.accents, body };
};
