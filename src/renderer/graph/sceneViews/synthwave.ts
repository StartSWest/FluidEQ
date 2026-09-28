/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand, IAnalysisPlot } from '../analysis/analysisFrame';
import {
  clampUnit,
  hash01,
  inkAt,
  levelAtX,
  lightInkAt,
  rampAlong,
  type ISceneDrawn,
  type ISceneFrame,
  type ISceneMusic,
  type ISceneReading,
} from './sceneFrame';
import { createPeakHold, holdPeaks, type IPeakHold } from './scenePieces';
import { floorInk } from '../../utils/windowInk';

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

/**
 * Where the horizon sits, as a share of the band from its top. The numbers
 * and functions exported here are the layout the look's GPU painting
 * (`engineLooks/synthwaveLook.ts`) is drawn from as well.
 */
const HORIZON = 0.56;
/** The sun's radius against the band's depth and the plot's width. */
const SUN_DEPTH = 0.34;
const SUN_WIDTH = 0.15;
/** Rails across the floor, and rungs between the horizon and the viewer. */
export const RAILS = 26;
export const RUNGS = 14;
/** Stars in the sky, and points along each half of the range. */
const STARS = 90;
export const RANGE_POINTS = 64;

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

/** How far the floor's rails fan out, against the window's width. */
export const railSpread = (windowWidth: number): number => windowWidth * 1.6;
/** Where a rail meets the horizon and the viewer's edge, `at` -0.5..0.5. */
export const RAIL_FAR = 0.04;
export const RAIL_NEAR = 2.2;
/** How bright the grid flashes on the beat. */
export const gridFlash = (pulse: number): number => pulse * 0.4;

const drawGrid = (
  frame: ISceneFrame,
  horizon: number,
  bottom: number,
  cx: number,
  roll: number,
) => {
  const { context, window, colours, music } = frame;
  const rails = new Path2D();
  const spread = railSpread(window.width);
  for (let rail = 0; rail <= RAILS; rail += 1) {
    const at = rail / RAILS - 0.5;
    rails.moveTo(cx + at * spread * RAIL_FAR, horizon);
    rails.lineTo(cx + at * spread * RAIL_NEAR, bottom);
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
  const flash = gridFlash(music.pulse);
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

/** Every star of a sky from `top` down to the horizon: where, and how big. */
export const placeStars = (
  music: Pick<ISceneMusic, 'clock' | 'treble'>,
  windowWidth: number,
  top: number,
  horizon: number,
  star: (x: number, y: number, size: number) => void,
): void => {
  for (let index = 0; index < STARS; index += 1) {
    const x = hash01(index * 3.7) * windowWidth;
    const y = top + hash01(index * 9.1) * (horizon - top) * 0.9;
    const twinkle =
      0.4 +
      0.6 * Math.abs(Math.sin(music.clock * (1.5 + hash01(index) * 3) + index));
    const size =
      0.6 + twinkle * (0.6 + music.treble * 1.2) * hash01(index * 1.9);
    star(x, y, size);
  }
};

/** The stars' light, brighter with the treble. */
export const starAlpha = (treble: number): number => 0.35 + treble * 0.5;

const drawStars = (frame: ISceneFrame, top: number, horizon: number) => {
  const { context, window, music } = frame;
  const stars = new Path2D();
  placeStars(music, window.width, top, horizon, (x, y, size) => {
    stars.rect(x - size / 2, y - size / 2, size, size);
  });
  context.fillStyle = `rgba(255, 255, 255, ${starAlpha(music.treble).toFixed(3)})`;
  context.fill(stars);
};

/** The sun's middle, above the horizon by a third of its radius. */
export const sunCentre = (horizon: number, radius: number): number =>
  horizon - radius * 0.3;

/**
 * The bands the sun is cut by, each handed over as its top and height: thin
 * at the top of the cut, thicker toward the horizon, none on the upper half.
 */
export const sunCuts = (
  centreY: number,
  radius: number,
  horizon: number,
  cut: (y: number, height: number) => void,
): void => {
  let y = centreY + radius * 0.02;
  let gap = 2;
  let bar = radius * 0.16;
  while (y < horizon) {
    cut(y + gap, bar);
    y += gap + bar;
    gap += 1.4;
    bar = Math.max(2, bar * 0.8);
  }
};

/** The sun's glow: how far it reaches against the sun, and its light. */
export const sunGlowReach = (pulse: number): number => 1.6 + pulse * 0.3;
export const sunGlowAlpha = (pulse: number, glow: number): number =>
  0.22 + pulse * 0.15 + glow * 0.2;

const drawSun = (
  frame: ISceneFrame,
  cx: number,
  horizon: number,
  radius: number,
) => {
  const { context, colours, music } = frame;
  const centreY = sunCentre(horizon, radius);
  context.save();
  // The upper half whole, and below it the bands the sun is cut by.
  const clip = new Path2D();
  clip.rect(cx - radius, centreY - radius, radius * 2, radius * 1.02);
  sunCuts(centreY, radius, horizon, (y, height) => {
    clip.rect(cx - radius, y, radius * 2, height);
  });
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
  const reach = radius * sunGlowReach(music.pulse);
  const glow = context.createRadialGradient(
    cx,
    centreY,
    radius * 0.8,
    cx,
    centreY,
    reach,
  );
  glow.addColorStop(
    0,
    inkAt(colours, 0.85, sunGlowAlpha(music.pulse, frame.glow)),
  );
  glow.addColorStop(1, inkAt(colours, 0.85, 0));
  context.fillStyle = glow;
  context.beginPath();
  context.arc(cx, centreY, reach, 0, Math.PI * 2);
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

/** The horizon line's light, brighter on the beat. */
export const horizonAlpha = (pulse: number): number => 0.6 + pulse * 0.3;

/** How tall the range may stand in a copy's band. */
export const rangeHeight = (band: IAnalysisBand): number =>
  (band.bottom - band.top) * 0.38;

/** The ridge's wide glow line: brighter on the beat and with the Glow. */
export const ridgeGlowAlpha = (pulse: number, glow: number): number =>
  0.25 + pulse * 0.2 + glow * 0.25;

/**
 * The range's ridge, right to left through the middle: each point's x and
 * y, and where its ridge of a moment ago is held when Lit peaks shows it.
 */
export const traceRange = (
  state: ISynthwaveState,
  accents: boolean,
  plot: IAnalysisPlot,
  cx: number,
  horizon: number,
  up: number,
  tall: number,
  point: (x: number, y: number, heldY: number | undefined) => void,
): void => {
  const width = plot.right - plot.left;
  for (let at = RANGE_POINTS; at >= -RANGE_POINTS; at -= 1) {
    const out = Math.abs(at);
    // A little jaggedness of its own, so the range reads as rock.
    const rough = 0.85 + 0.15 * hash01(Math.round(at * 1.3) + 11);
    const x = cx + (at / RANGE_POINTS) * (width / 2);
    const isHeld = accents && state.peaks.held[out] - state.ridge[out] > 0.03;
    point(
      x,
      horizon + up * state.ridge[out] * tall * rough,
      isHeld ? horizon + up * state.peaks.held[out] * tall * rough : undefined,
    );
  }
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
  const tall = rangeHeight(band);
  const up = band.flipped ? 1 : -1;
  const ridge: [number, number][] = [];
  const held = new Path2D();
  traceRange(
    state,
    look.accents,
    plot,
    cx,
    horizon,
    up,
    tall,
    (x, y, heldY) => {
      ridge.push([x, y]);
      // The ridge a moment ago, left as a dotted line over the rock.
      if (heldY !== undefined) {
        held.rect(x - 1, heldY - 1, 2, 2);
      }
    },
  );
  const mountains = new Path2D();
  mountains.moveTo(ridge[0][0], horizon);
  ridge.forEach(([x, y]) => mountains.lineTo(x, y));
  mountains.lineTo(ridge[ridge.length - 1][0], horizon);
  mountains.closePath();
  const top = horizon + up * tall;
  if (look.filled) {
    // Dark inside — the window's own floor — so the range stands in front
    // of the sun.
    const rock = context.createLinearGradient(0, top, 0, horizon);
    rock.addColorStop(0, inkAt(frame.colours, 0.35, 0.55 * look.opacity));
    rock.addColorStop(1, floorInk(0.92 * look.opacity, 0.35));
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
    ridgeGlowAlpha(music.pulse, frame.glow),
  );
  context.lineWidth = line + 3.5;
  context.stroke(edge);
  context.strokeStyle = ridgeInk(frame, horizon, top, 0.25, 0.95);
  context.lineWidth = line;
  context.stroke(edge);
  context.fillStyle = ridgeInk(frame, horizon, top, 0.5, 0.85);
  context.fill(held);
  // The horizon line.
  context.strokeStyle = inkAt(frame.colours, 0.9, horizonAlpha(music.pulse));
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, horizon);
  context.lineTo(frame.window.width, horizon);
  context.stroke();
  context.restore();
};

/**
 * One frame's reading of the look, once for every copy: the floor rolled on
 * at the music's pace, and the range read bass in the middle, treble at the
 * edges, with its ridge held. Answers whether a held ridge is still falling.
 */
export const readSynthwave = (
  reading: Pick<ISceneReading, 'plot' | 'music' | 'xs' | 'levels' | 'deltaMs'>,
  state: ISynthwaveState,
): boolean => {
  const { plot, music, xs, levels } = reading;
  state.roll = (state.roll + music.step * (1.2 + music.bass * 2.4)) % 1000;
  const width = plot.right - plot.left;
  for (let out = 0; out <= RANGE_POINTS; out += 1) {
    state.ridge[out] = clampUnit(
      levelAtX(xs, levels, plot.left + (out / RANGE_POINTS) * width),
    );
  }
  return holdPeaks(state.peaks, state.ridge, RANGE_POINTS + 1, reading.deltaMs);
};

/**
 * Where one copy's picture stands, drawn the right way up: its horizon, the
 * floor's near edge and the sky's far one — the window's edges when this is
 * the only copy, the band's own when the wave is mirrored (in the mirror the
 * window's bottom edge stands where its top would) — its middle, and its
 * sun's radius, swelling a little on the kick.
 */
export const synthwaveCopy = (
  band: IAnalysisBand,
  copies: number,
  plot: IAnalysisPlot,
  windowHeight: number,
  pulse: number,
) => {
  const depth = band.bottom - band.top;
  let near = band.bottom;
  let sky = band.top;
  if (copies === 1) {
    near = band.flipped ? band.top + band.bottom : windowHeight;
    sky = band.flipped ? band.top + band.bottom - windowHeight : 0;
  }
  const radius = Math.min(
    depth * SUN_DEPTH,
    (plot.right - plot.left) * SUN_WIDTH,
  );
  return {
    horizon: band.top + depth * HORIZON,
    near,
    sky,
    cx: (plot.left + plot.right) / 2,
    sun: radius * (1 + pulse * 0.04),
  };
};

export const drawSynthwave = (
  frame: ISceneFrame,
  state: ISynthwaveState,
): ISceneDrawn => {
  const { context, plot, music, window, bands } = frame;
  const falling = readSynthwave(frame, state);
  const body = frame.look.textured ? new Path2D() : undefined;
  bands.forEach((band) => {
    // Upside down, the whole picture is: drawn the right way up in a mirror
    // about the band's middle, rather than every part learning to hang.
    context.save();
    if (band.flipped) {
      context.translate(0, band.top + band.bottom);
      context.scale(1, -1);
    }
    const upright: IAnalysisBand = { ...band, flipped: false };
    const { horizon, near, sky, cx, sun } = synthwaveCopy(
      band,
      bands.length,
      plot,
      window.height,
      music.pulse,
    );
    drawStars(frame, sky, horizon);
    drawGrid(frame, horizon, near, cx, state.roll);
    drawSun(frame, cx, horizon, sun);
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
