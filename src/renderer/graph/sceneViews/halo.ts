/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  HEAT_STEPS,
  clampUnit,
  hash01,
  heatInk,
  heatStep,
  inkAt,
  lightInkAt,
  type ISceneDrawn,
  type ISceneFrame,
} from './sceneFrame';
import {
  createPeakHold,
  createPieceRow,
  holdPeaks,
  layPieces,
  type IPeakHold,
  type IPieceRow,
} from './scenePieces';

/**
 * HALO: the spectrum as a ring of light.
 *
 * Rays stand out from a circle, the bass at the bottom climbing both sides
 * to the treble at the top, mirrored so the ring is whole. Inside, a core of
 * light breathes with the bass and flashes on the beat; the ring turns
 * slowly with the middle of the music; on a beat a burst of motes flies out
 * from the tips of the rays; the treble lights sparks at the tips of the
 * rays that carry it; and with Lit peaks a ring of dots holds each ray's
 * recent reach and settles back.
 *
 * The style editor: Pieces is the rays up one side of the ring (the other
 * side is its mirror) and Gap the space between them; Colour by runs the
 * colours round the ring bass to treble, out along every ray from the ring
 * to its tip, as one colour, or each ray whole in the colour of its
 * loudness; Outline draws the ring as the line through the rays' tips at the
 * line width instead of the rays; Opacity is how solid the rays are; Glow
 * brightens the core.
 *
 * Every ray of one colour is one path — one, with a gradient round the ring
 * or along the rays; twelve for heat — and every mote is part of one path.
 */

/** The ring's radius and a ray's reach, as shares of the smaller side. */
const RADIUS = 0.19;
const REACH = 0.28;
/** A ray never narrower than this along the ring, in CSS pixels. */
const MIN_RAY_PITCH = 2.5;
const MOTE_LIMIT = 220;

interface IMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  tint: number;
}

export interface IHaloState {
  row: IPieceRow;
  peaks: IPeakHold;
  motes: IMote[];
  turn: number;
  seed: number;
}

export const createHaloState = (): IHaloState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  motes: [],
  turn: 0,
  seed: 0,
});

/** The ring's size in a band, so every copy and the ray count agree. */
const ringOf = (frame: ISceneFrame, band: IAnalysisBand) => {
  const { plot, music } = frame;
  const width = plot.right - plot.left;
  const side = Math.min(width, band.bottom - band.top);
  return {
    cx: (plot.left + plot.right) / 2,
    cy: (band.top + band.bottom) / 2,
    radius: side * RADIUS * (1 + music.pulse * 0.06 + music.bass * 0.05),
    reach: side * REACH,
  };
};

/**
 * The paint for the rays in one fill: round the ring, bass at the bottom to
 * treble at the top on both sides, or out along the rays from ring to tip.
 */
const ringInk = (
  frame: ISceneFrame,
  cx: number,
  cy: number,
  from: number,
  to: number,
  turn: number,
  whiten: number,
  alpha: number,
): string | CanvasGradient => {
  const { context, colours, look } = frame;
  if (look.ink === 'flat') {
    return lightInkAt(colours, 0.5, whiten, alpha);
  }
  if (look.ink === 'frequency') {
    // Clockwise from the bottom is up the left side, and on round to the
    // bottom again down the right: the ramp there and back.
    const round = context.createConicGradient(Math.PI / 2 + turn, cx, cy);
    const stops = 16;
    for (let stop = 0; stop <= stops; stop += 1) {
      const at = stop / stops;
      const fromBottom = at < 0.5 ? at * 2 : 2 - at * 2;
      round.addColorStop(at, lightInkAt(colours, fromBottom, whiten, alpha));
    }
    return round;
  }
  const out = context.createRadialGradient(cx, cy, from, cx, cy, to);
  const stops = 8;
  for (let stop = 0; stop < stops; stop += 1) {
    const at = stop / (stops - 1);
    out.addColorStop(at, lightInkAt(colours, at, whiten, alpha));
  }
  return out;
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IHaloState,
  body: Path2D | undefined,
): void => {
  const { context, colours, music, look } = frame;
  const { row, turn } = state;
  const { cx, cy, radius, reach } = ringOf(frame, band);
  const base = radius + 3;

  // The core: light pooled in the ring, breathing with the bass and the
  // look's Glow. Added to what is behind rather than laid over it, so it
  // glows instead of painting a disc.
  context.save();
  context.globalCompositeOperation = 'lighter';
  const core = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
  core.addColorStop(
    0,
    lightInkAt(
      colours,
      0.1,
      0.55,
      0.22 + music.bass * 0.3 + music.pulse * 0.3 + frame.glow * 0.3,
    ),
  );
  core.addColorStop(0.6, inkAt(colours, 0.85, 0.08 + music.bass * 0.14));
  core.addColorStop(1, inkAt(colours, 0.85, 0));
  context.fillStyle = core;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // The ring itself: a thin line the rays stand on.
  context.save();
  context.lineWidth = 1.5;
  context.strokeStyle = `rgba(255, 255, 255, ${(0.28 + music.pulse * 0.4).toFixed(3)})`;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  const half = row.count;
  const rayPitch = (Math.PI * base) / half;
  const halfWidth = Math.max(0.6, (rayPitch * (1 - clampUnit(look.gap))) / 2);
  const groups = look.ink === 'heat' ? HEAT_STEPS : 1;
  const rays: Path2D[] = [];
  for (let group = 0; group < groups; group += 1) {
    rays.push(new Path2D());
  }
  const tips = new Path2D();
  const held = new Path2D();
  const outline = new Path2D();
  const tipXs: number[] = [];
  const tipYs: number[] = [];
  // Round the ring clockwise from the bottom: up the left side, then down
  // the right, each side the spectrum from the bass at the bottom.
  for (let ray = 0; ray < half * 2; ray += 1) {
    const isLeft = ray < half;
    const piece = isLeft ? ray : half * 2 - 1 - ray;
    const fromBottom = (piece + 0.5) / half;
    const level = row.levels[piece];
    const angle =
      Math.PI / 2 + (isLeft ? fromBottom : 2 - fromBottom) * Math.PI + turn;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const length = 2 + level * reach;
    const tip = base + length;
    // The ray as a slim quad, so it can be filled — and textured — like any
    // other body, rather than a stroke that nothing can be printed in.
    const across = [-sin * halfWidth, cos * halfWidth];
    const path = rays[look.ink === 'heat' ? heatStep(level) : 0];
    path.moveTo(cx + cos * base + across[0], cy + sin * base + across[1]);
    path.lineTo(cx + cos * tip + across[0], cy + sin * tip + across[1]);
    path.lineTo(cx + cos * tip - across[0], cy + sin * tip - across[1]);
    path.lineTo(cx + cos * base - across[0], cy + sin * base - across[1]);
    path.closePath();
    tipXs.push(cx + cos * tip);
    tipYs.push(cy + sin * tip);
    if (level > 0.6 && fromBottom > 0.55 && music.treble > 0.2) {
      const sparkX = cx + cos * (tip + 2);
      const sparkY = cy + sin * (tip + 2);
      tips.moveTo(sparkX + 1.8, sparkY);
      tips.arc(sparkX, sparkY, 1.8, 0, Math.PI * 2);
    }
    const heldLength = 2 + state.peaks.held[piece] * reach;
    if (look.accents && heldLength - length > 3) {
      const dotX = cx + cos * (base + heldLength);
      const dotY = cy + sin * (base + heldLength);
      const dot = Math.max(1.2, halfWidth * 0.9);
      held.moveTo(dotX + dot, dotY);
      held.arc(dotX, dotY, dot, 0, Math.PI * 2);
    }
    if (
      music.onBeat &&
      level > 0.5 &&
      state.motes.length < MOTE_LIMIT &&
      hash01(ray * 1.7 + state.seed) < 0.45
    ) {
      state.seed += 1;
      const speed = 60 + 120 * hash01(state.seed * 2.9);
      state.motes.push({
        x: cx + cos * tip,
        y: cy + sin * tip,
        vx: cos * speed,
        vy: sin * speed,
        age: 0,
        life: 0.6 + 0.6 * hash01(state.seed * 1.3),
        tint: fromBottom,
      });
    }
  }

  const paint = ringInk(frame, cx, cy, base, base + reach, turn, 0, 0.95);
  context.save();
  context.globalAlpha = look.opacity;
  if (look.filled) {
    rays.forEach((path, group) => {
      context.fillStyle =
        look.ink === 'heat' ? heatInk(colours, group, 0.95) : paint;
      context.fill(path);
      body?.addPath(path);
    });
  } else {
    // In outline the ring is the line through the rays' tips, smoothed.
    const count = tipXs.length;
    outline.moveTo(
      (tipXs[count - 1] + tipXs[0]) / 2,
      (tipYs[count - 1] + tipYs[0]) / 2,
    );
    for (let point = 0; point < count; point += 1) {
      const next = (point + 1) % count;
      outline.quadraticCurveTo(
        tipXs[point],
        tipYs[point],
        (tipXs[point] + tipXs[next]) / 2,
        (tipYs[point] + tipYs[next]) / 2,
      );
    }
    outline.closePath();
    context.lineJoin = 'round';
    context.lineWidth = look.lineWidth;
    context.strokeStyle =
      look.ink === 'heat'
        ? ringInk(
            { ...frame, look: { ...look, ink: 'level' } },
            cx,
            cy,
            base,
            base + reach,
            turn,
            0,
            0.95,
          )
        : paint;
    context.stroke(outline);
  }
  context.restore();
  context.fillStyle = ringInk(
    frame,
    cx,
    cy,
    base,
    base + reach,
    turn,
    0.45,
    0.9,
  );
  context.fill(held);
  if (music.treble > 0.2) {
    context.fillStyle = 'rgba(255, 255, 255, 0.85)';
    context.fill(tips);
  }
};

export const drawHalo = (
  frame: ISceneFrame,
  state: IHaloState,
): ISceneDrawn => {
  // The ring turns with the middle of the music, a slow walk at most.
  state.turn =
    (state.turn + frame.music.step * (0.08 + frame.music.mid * 0.3)) %
    (Math.PI * 2);
  // The rays up one side: never more than the smallest copy's ring can hold
  // at the narrowest a ray reads.
  const [first] = frame.bands;
  const width = frame.plot.right - frame.plot.left;
  const smallest = frame.bands.reduce(
    (least, band) => Math.min(least, ringOf(frame, band).radius),
    first ? ringOf(frame, first).radius : 0,
  );
  const most = Math.max(
    4,
    Math.floor((Math.PI * (smallest + 3)) / MIN_RAY_PITCH),
  );
  const row = layPieces(frame, state.row, width / most);
  const falling = holdPeaks(state.peaks, row.levels, row.count, frame.deltaMs);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, body));

  const seconds = frame.deltaMs / 1000;
  const motes = new Path2D();
  const alive: IMote[] = [];
  let tint = 0;
  state.motes.forEach((mote) => {
    mote.age += seconds;
    if (mote.age >= mote.life) {
      return;
    }
    mote.x += mote.vx * seconds;
    mote.y += mote.vy * seconds;
    const size = 2.2 * (1 - mote.age / mote.life);
    motes.moveTo(mote.x + size, mote.y);
    motes.arc(mote.x, mote.y, size, 0, Math.PI * 2);
    tint += mote.tint;
    alive.push(mote);
  });
  state.motes = alive;
  if (alive.length > 0) {
    frame.context.fillStyle = lightInkAt(
      frame.colours,
      tint / alive.length,
      0.4,
      0.85,
    );
    frame.context.fill(motes);
  }
  return {
    moving: alive.length > 0 || (falling && frame.look.accents),
    body,
  };
};
