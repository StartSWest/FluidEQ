/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  HEAT_STEPS,
  clampUnit,
  easeToward,
  figureInk,
  hash01,
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
 * SPARK BARS: slim bars tipped with fire, throwing sparks into the air.
 *
 * Every bar ends in a burning tip, and a bar that jumps throws embers off it
 * — the harder the jump, the more — which rise, drift, slow and fade; the
 * treble keeps a steady fizz coming off the loudest tips, and the kick
 * throws a shower from every tall one at once. With Lit peaks a hot mark is
 * held where each bar reached and falls back.
 *
 * Pieces is how many bars and Gap how slim they are; Colour by colours the
 * bars and the embers across the row, up their height, in one colour, or
 * each bar by its loudness; Outline draws the bars as lines at the line
 * width; Opacity is how solid they are; Glow how much the fire lights up.
 *
 * The embers live in the first copy's own terms — how far above its floor —
 * so a mirrored wave throws the same sparks in both copies, not two sets.
 */

/** A bar never on a pitch smaller than this, in CSS pixels. */
const MIN_PITCH = 4;
const EMBER_LIMIT = 520;
const EMBER_LIFE_S = 1.1;

interface IEmber {
  x: number;
  /** How far above the floor, in CSS pixels, and how fast it climbs. */
  rise: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

export interface ISparkBarsState {
  row: IPieceRow;
  peaks: IPeakHold;
  bloom: ISceneBloom;
  /** Each bar's level last frame, for how hard it jumped. */
  last: Float64Array;
  embers: IEmber[];
  seed: number;
}

export const createSparkBarsState = (): ISparkBarsState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  bloom: createSceneBloom(),
  last: new Float64Array(0),
  embers: [],
  seed: 0,
});

/** The floor and the reach of a copy. */
const standOf = (band: IAnalysisBand) => {
  const up = band.flipped ? 1 : -1;
  return {
    up,
    floor: band.flipped ? band.top : band.bottom,
    reach: (band.bottom - band.top) * 0.8,
  };
};

/** Throws embers off the bars that jumped, off the treble and off the kick. */
const throwEmbers = (
  frame: ISceneFrame,
  state: ISparkBarsState,
  reach: number,
): void => {
  const { music } = frame;
  const { row } = state;
  if (state.last.length !== row.count) {
    state.last = new Float64Array(row.levels);
  }
  for (let piece = 0; piece < row.count; piece += 1) {
    const level = row.levels[piece];
    const jump = Math.max(0, level - state.last[piece]);
    state.last[piece] = level;
    const chance =
      jump * 10 +
      music.treble * 0.05 * level +
      (music.onBeat && level > 0.45 ? 0.9 : 0);
    let count = Math.floor(chance);
    state.seed += 1;
    if (hash01(state.seed * 1.37) < chance - count) {
      count += 1;
    }
    for (
      let ember = 0;
      ember < count && state.embers.length < EMBER_LIMIT;
      ember += 1
    ) {
      state.seed += 1;
      state.embers.push({
        x: row.lefts[piece] + row.body * hash01(state.seed * 2.1),
        rise: level * reach,
        vx: (hash01(state.seed * 3.7) - 0.5) * 40,
        vy: (50 + 150 * hash01(state.seed * 5.3)) * (0.5 + level),
        age: 0,
        life: EMBER_LIFE_S * (0.55 + 0.45 * hash01(state.seed * 7.9)),
      });
    }
  }
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: ISparkBarsState,
  bloom: CanvasRenderingContext2D | null,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look } = frame;
  const { row } = state;
  const { up, floor, reach } = standOf(band);
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: floor + up * reach,
  };
  const groups = look.ink === 'heat' ? HEAT_STEPS : 1;
  const bars: Path2D[] = [];
  for (let group = 0; group < groups; group += 1) {
    bars.push(new Path2D());
  }
  const tips = new Path2D();
  const held = new Path2D();
  const all = new Path2D();
  for (let piece = 0; piece < row.count; piece += 1) {
    const left = row.lefts[piece];
    const level = row.levels[piece];
    const height = Math.max(2, level * reach);
    const top = up < 0 ? floor - height : floor;
    const bar = new Path2D();
    bar.rect(left, top, row.body, height);
    bars[look.ink === 'heat' ? heatStep(level) : 0].addPath(bar);
    all.addPath(bar);
    const tip = Math.min(4, height);
    tips.rect(
      left - 0.5,
      up < 0 ? top : floor + height - tip,
      row.body + 1,
      tip,
    );
    const heldHeight = state.peaks.held[piece] * reach;
    if (look.accents && heldHeight - height > 3) {
      held.rect(left, floor + up * heldHeight - 1, row.body, 2);
    }
  }
  const whole = figureInk(context, frame, span, 1);
  context.save();
  context.globalAlpha = look.opacity;
  bars.forEach((path, group) => {
    const paint = look.ink === 'heat' ? heatInk(colours, group, 1) : whole;
    if (look.filled) {
      context.fillStyle = paint;
      context.fill(path);
    } else {
      context.strokeStyle = paint;
      context.lineWidth = look.lineWidth;
      context.stroke(path);
    }
  });
  if (look.filled) {
    body?.addPath(all);
    // Dark at the foot: the fire is at the top.
    const foot = context.createLinearGradient(0, floor, 0, span.head);
    foot.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    foot.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
    context.fillStyle = foot;
    context.fill(all);
  }
  context.restore();
  context.fillStyle = figureInk(
    context,
    frame,
    span,
    clampUnit(0.85 + music.treble * 0.15),
    0.55 + music.pulse * 0.35,
  );
  context.fill(tips);
  context.fillStyle = figureInk(context, frame, span, 0.95, 0.7);
  context.fill(held);

  // The embers, in this copy's place.
  const glow = new Path2D();
  const hot = new Path2D();
  state.embers.forEach((ember) => {
    const life = 1 - ember.age / ember.life;
    const y = floor + up * ember.rise;
    const size = 0.6 + 1.6 * life;
    glow.moveTo(ember.x + size * 2.2, y);
    glow.arc(ember.x, y, size * 2.2, 0, Math.PI * 2);
    hot.rect(ember.x - size / 2, y - size / 2, size, size);
  });
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.fillStyle = figureInk(
    context,
    frame,
    span,
    0.22 + frame.glow * 0.15,
    0.2,
  );
  context.fill(glow);
  context.fillStyle = figureInk(context, frame, span, 0.95, 0.75);
  context.fill(hot);
  context.restore();

  if (bloom) {
    bloom.fillStyle = figureInk(bloom, frame, span, 1, 0.3);
    bloom.fill(tips);
    bloom.fill(hot);
  }
};

export const drawSparkBars = (
  frame: ISceneFrame,
  state: ISparkBarsState,
): ISceneDrawn => {
  const row = layPieces(frame, state.row, MIN_PITCH);
  const falling = holdPeaks(state.peaks, row.levels, row.count, frame.deltaMs);
  const [first] = frame.bands;
  if (first) {
    throwEmbers(frame, state, standOf(first).reach);
  }
  // Rise, drift, slow down, fade.
  const seconds = frame.deltaMs / 1000;
  const drag = 1 - easeToward(frame.deltaMs, 450);
  state.embers = state.embers.filter((ember) => {
    ember.age += seconds;
    ember.x += ember.vx * seconds;
    ember.rise += ember.vy * seconds;
    ember.vy = ember.vy * drag - 30 * seconds;
    ember.vx *= drag;
    return ember.age < ember.life;
  });
  const bloom = beginBloom(frame, state.bloom);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, bloom, body));
  if (bloom) {
    endBloom(
      frame,
      state.bloom,
      (0.35 + frame.music.pulse * 0.35 + frame.glow * 0.5) * frame.look.opacity,
    );
  }
  return {
    moving: state.embers.length > 0 || (falling && frame.look.accents),
    body,
  };
};
