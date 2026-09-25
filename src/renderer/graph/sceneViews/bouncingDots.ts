/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  HEAT_STEPS,
  figureInk,
  heatInk,
  heatStep,
  type ISceneDrawn,
  type ISceneFrame,
  type ISceneSpan,
} from './sceneFrame';
import {
  createPeakHold,
  createPieceRow,
  holdPeaks,
  layPieces,
  type IPeakHold,
  type IPieceRow,
} from './scenePieces';
import {
  beginBloom,
  createSceneBloom,
  endBloom,
  type ISceneBloom,
} from './sceneBloom';

/**
 * BOUNCING DOTS: a ball on every band, thrown up by the music and falling
 * back under gravity.
 *
 * Each ball rides its band's level; when the band jumps, the ball is thrown
 * higher than the level and falls back onto it, bouncing a little less each
 * time and squashing flat for a moment where it lands. The kick throws every
 * loud ball at once. A faint stem joins each ball to the floor, and with Lit
 * peaks a mark holds the band's recent top.
 *
 * Pieces is how many balls and Gap how small they are; Colour by colours the
 * balls across the row, by their height, in one colour, or by each band's
 * loudness; Outline draws the balls as rings at the line width; Opacity is
 * how solid they are; Glow how much light they throw.
 *
 * The throw and the fall are counted in the frames' own time, so a ball
 * flies the same arc at 30 and at 144 frames a second.
 */

/** A ball never on a pitch smaller than this, in CSS pixels. */
const MIN_PITCH = 5;
/**
 * Gravity in plot heights a second per second, and launches in plot heights
 * a second. A launch of v rises v² / 2g and is back down in 2v / g: the
 * kick lifts a ball 3 to 7 percent of the plot, a jump of the level by about
 * half the jump again, and nothing past a seventh, so every ball is down
 * before the next beat at 120 BPM and the row hops together. Thrown higher,
 * each ball was kicked again mid-arc and the row became a scatter of dots.
 */
const GRAVITY = 5.2;
const KICK = 0.3;
const KICK_PER_LEVEL = 0.7;
const JUMP_THROW = 5;
const MAX_THROW = 1.2;
/** The least jump of the level worth a throw; below it a ball rides. */
const LEAST_JUMP = 0.015;
/** How much of its speed a ball keeps after a bounce, and the least worth one. */
const BOUNCE = 0.42;
const REST_SPEED = 0.18;
/** How long a landing squashes a ball, in milliseconds. */
const SQUASH_MS = 110;

export interface IBouncingDotsState {
  row: IPieceRow;
  peaks: IPeakHold;
  bloom: ISceneBloom;
  /** Per ball: its height, its speed upward, the level last frame, and how
   * long ago it landed hard. */
  height: Float64Array;
  speed: Float64Array;
  last: Float64Array;
  landed: Float64Array;
}

export const createBouncingDotsState = (): IBouncingDotsState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  bloom: createSceneBloom(),
  height: new Float64Array(0),
  speed: new Float64Array(0),
  last: new Float64Array(0),
  landed: new Float64Array(0),
});

/** Moves every ball one frame; returns whether any is still in the air. */
const fly = (frame: ISceneFrame, state: IBouncingDotsState): boolean => {
  const { row } = state;
  const { music } = frame;
  if (state.height.length !== row.count) {
    state.height = new Float64Array(row.levels);
    state.speed = new Float64Array(row.count);
    state.last = new Float64Array(row.levels);
    state.landed = new Float64Array(row.count).fill(SQUASH_MS);
  }
  const seconds = Math.min(0.05, frame.deltaMs / 1000);
  let flying = false;
  for (let ball = 0; ball < row.count; ball += 1) {
    const level = row.levels[ball];
    const jump = level - state.last[ball];
    state.last[ball] = level;
    // The fastest throw whose arc still tops out under the plot's ceiling.
    const headroom = Math.sqrt(2 * GRAVITY * Math.max(0, 1 - level));
    // A band that jumps throws its ball; the kick throws every loud one.
    if (jump > LEAST_JUMP) {
      state.speed[ball] = Math.max(
        state.speed[ball],
        Math.min(MAX_THROW, headroom, 0.15 + jump * JUMP_THROW),
      );
    }
    if (music.onBeat && level > 0.2) {
      state.speed[ball] = Math.max(
        state.speed[ball],
        Math.min(headroom, KICK + level * KICK_PER_LEVEL),
      );
    }
    state.speed[ball] -= GRAVITY * seconds;
    state.height[ball] += state.speed[ball] * seconds;
    // A ball kicked while already in the air can still reach the top: it
    // stops there and falls, rather than leaving the plot.
    if (state.height[ball] > 1) {
      state.height[ball] = 1;
      state.speed[ball] = Math.min(0, state.speed[ball]);
    }
    if (state.height[ball] <= level) {
      // On the level: bounce if it came down fast, carry on up if it was
      // just thrown, otherwise ride it. A throw comes from the level rising,
      // so the ball is still under the new level on that frame; settling it
      // there cancelled every throw and no ball ever left its stem.
      if (state.speed[ball] < -REST_SPEED) {
        state.speed[ball] = -state.speed[ball] * BOUNCE;
        state.landed[ball] = 0;
      } else if (state.speed[ball] < 0) {
        state.speed[ball] = 0;
      }
      state.height[ball] = level;
    }
    state.landed[ball] += frame.deltaMs;
    if (state.height[ball] > level + 0.002 || state.speed[ball] !== 0) {
      flying = true;
    }
  }
  return flying;
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IBouncingDotsState,
  bloom: CanvasRenderingContext2D | null,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look } = frame;
  const { row } = state;
  const up = band.flipped ? 1 : -1;
  const radius = row.body / 2;
  const floor = band.flipped ? band.top + radius : band.bottom - radius;
  const reach = band.bottom - band.top - radius * 3;
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: floor + up * reach,
  };
  const groups = look.ink === 'heat' ? HEAT_STEPS : 1;
  const balls: Path2D[] = [];
  for (let group = 0; group < groups; group += 1) {
    balls.push(new Path2D());
  }
  const stems = new Path2D();
  const held = new Path2D();
  const shine = new Path2D();
  for (let piece = 0; piece < row.count; piece += 1) {
    const x = row.lefts[piece] + radius;
    const height = Math.max(0, state.height[piece]) * reach;
    const y = floor + up * height;
    const levelY = floor + up * row.levels[piece] * reach;
    stems.moveTo(x, floor);
    stems.lineTo(x, levelY);
    // Squashed flat where it lands, and back to round as it lifts off.
    const squash = 1 - Math.max(0, 1 - state.landed[piece] / SQUASH_MS) * 0.35;
    const wide = radius * (2 - squash);
    const tall = radius * squash;
    const centre = y - up * (radius - tall);
    const path = balls[look.ink === 'heat' ? heatStep(row.levels[piece]) : 0];
    path.moveTo(x + wide, centre);
    path.ellipse(x, centre, wide, tall, 0, 0, Math.PI * 2);
    shine.moveTo(x - wide * 0.3 + tall * 0.28, centre - tall * 0.32);
    shine.arc(
      x - wide * 0.3,
      centre - tall * 0.32,
      tall * 0.28,
      0,
      Math.PI * 2,
    );
    const heldHeight = state.peaks.held[piece] * reach;
    if (look.accents && heldHeight - height > radius * 2) {
      held.rect(x - radius, floor + up * heldHeight - 0.75, radius * 2, 1.5);
    }
  }
  const whole = figureInk(context, frame, span, 1);
  context.save();
  context.lineCap = 'round';
  context.strokeStyle = figureInk(context, frame, span, 0.22 * look.opacity);
  context.lineWidth = Math.max(1, radius * 0.35);
  context.stroke(stems);
  context.globalAlpha = look.opacity;
  balls.forEach((path, group) => {
    const paint = look.ink === 'heat' ? heatInk(colours, group, 1) : whole;
    if (look.filled) {
      context.fillStyle = paint;
      context.fill(path);
      body?.addPath(path);
    } else {
      context.strokeStyle = paint;
      context.lineWidth = look.lineWidth;
      context.stroke(path);
    }
  });
  if (look.filled) {
    context.fillStyle = 'rgba(255, 255, 255, 0.55)';
    context.fill(shine);
  }
  context.restore();
  context.fillStyle = figureInk(
    context,
    frame,
    span,
    0.85,
    0.5 + music.treble * 0.3,
  );
  context.fill(held);
  if (bloom) {
    bloom.fillStyle = figureInk(bloom, frame, span, 1);
    balls.forEach((path) => bloom.fill(path));
  }
};

export const drawBouncingDots = (
  frame: ISceneFrame,
  state: IBouncingDotsState,
): ISceneDrawn => {
  const row = layPieces(frame, state.row, MIN_PITCH);
  const falling = holdPeaks(state.peaks, row.levels, row.count, frame.deltaMs);
  const flying = fly(frame, state);
  const bloom = beginBloom(frame, state.bloom);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, bloom, body));
  if (bloom) {
    endBloom(
      frame,
      state.bloom,
      (0.3 + frame.music.pulse * 0.3 + frame.glow * 0.5) * frame.look.opacity,
    );
  }
  return { moving: flying || (falling && frame.look.accents), body };
};
