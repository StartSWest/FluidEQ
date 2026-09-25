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
  inkAt,
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

/**
 * GLASS TOWERS: bars of coloured glass standing on a polished floor.
 *
 * Each tower is a column of glass rounded at its head, deep at its foot and
 * lit toward the top, rounded like a tube — a lit stripe down its left side,
 * a shadowed one down its right — with a bright cap. Under the floor line
 * the row stands reflected, each reflection in its own tower's glass and
 * fading into the floor, and the floor carries a pool of light that swells on
 * the bass. On a beat the tallest towers throw sparks off their caps; the
 * caps shimmer with the treble; with Lit peaks a cap floats over each tower
 * at its recent height and settles back.
 *
 * The style editor: Pieces is how many towers and Gap the space between
 * them; Colour by runs the glass across the row, up the towers, as one
 * colour, or each tower whole in the colour of its height; Outline draws the
 * towers as lines at the line width; Opacity is how solid the glass is.
 *
 * Every tower of one colour is one path and one fill, and each finish — the
 * shading, the stripes, the caps, the reflections — one more: however many
 * towers a wide screen holds, the frame is a score of fills and a handful of
 * sparks.
 */

/** A tower never on a pitch smaller than this, in CSS pixels. */
const MIN_PITCH = 8;
/** The floor stands this far up the band; the reflection fills below it. */
const REFLECTION = 0.2;
/** How long a reflection is, against the tower that casts it. */
const MIRROR = 0.42;
/**
 * Across the row, reflections are coloured in this many panes when the
 * glass runs bass to treble: a reflection fades DOWN, and one fill cannot
 * run two gradients, so the across is taken in steps.
 */
const PANES = 8;
/** Sparks: how many at most, how long each lives, how fast it climbs. */
const SPARK_LIMIT = 180;
const SPARK_LIFE_S = 0.9;
const SPARK_RISE = 120;

interface ISpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  /** Which copy of the drawing it belongs to. */
  copy: number;
}

export interface IGlassTowersState {
  row: IPieceRow;
  peaks: IPeakHold;
  sparks: ISpark[];
  seed: number;
}

export const createGlassTowersState = (): IGlassTowersState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  sparks: [],
  seed: 0,
});

const roundTop = (
  path: Path2D,
  x: number,
  foot: number,
  head: number,
  width: number,
  up: number,
) => {
  const height = Math.abs(foot - head);
  if (height < 1) {
    return;
  }
  const radius = Math.min(width / 2, height);
  // Rounded at the head only: a tower stands flat on its floor.
  if (up < 0) {
    path.roundRect(x, head, width, height, [radius, radius, 1.5, 1.5]);
  } else {
    path.roundRect(x, foot, width, height, [1.5, 1.5, radius, radius]);
  }
};

/** How many paths the glass needs for this Colour by, and which one a tower is in. */
const groupsFor = (frame: ISceneFrame): number =>
  frame.look.ink === 'heat' ? HEAT_STEPS : 1;
const mirrorGroupsFor = (frame: ISceneFrame): number => {
  if (frame.look.ink === 'heat') {
    return HEAT_STEPS;
  }
  return frame.look.ink === 'frequency' ? PANES : 1;
};

/** The colour a reflection group fades from. */
const mirrorColour = (
  frame: ISceneFrame,
  group: number,
  alpha: number,
): string => {
  const { look, colours } = frame;
  if (look.ink === 'heat') {
    return heatInk(colours, group, alpha);
  }
  if (look.ink === 'frequency') {
    return inkAt(colours, (group + 0.5) / PANES, alpha);
  }
  return inkAt(colours, look.ink === 'flat' ? 0.5 : 0.25, alpha);
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  copy: number,
  state: IGlassTowersState,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look } = frame;
  const { row } = state;
  const width = plot.right - plot.left;
  const depth = band.bottom - band.top;
  const up = band.flipped ? 1 : -1;
  // The floor, and how far a tower can reach from it.
  const floor = band.flipped
    ? band.top + depth * REFLECTION
    : band.bottom - depth * REFLECTION;
  const reach = depth * (1 - REFLECTION) - 6;
  const ceiling = floor + up * reach;
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: ceiling,
  };
  const { body: bodyWidth } = row;

  const glass: Path2D[] = [];
  for (let group = 0; group < groupsFor(frame); group += 1) {
    glass.push(new Path2D());
  }
  const mirrors: Path2D[] = [];
  for (let group = 0; group < mirrorGroupsFor(frame); group += 1) {
    mirrors.push(new Path2D());
  }
  const all = new Path2D();
  const lit = new Path2D();
  const shade = new Path2D();
  const caps = new Path2D();
  const floating = new Path2D();
  const addTower = (
    left: number,
    height: number,
    level: number,
    piece: number,
  ): void => {
    const head = floor + up * height;
    const heat = heatStep(level);
    const group = look.ink === 'heat' ? heat : 0;
    const tower = new Path2D();
    roundTop(tower, left, floor, head, bodyWidth, up);
    glass[group].addPath(tower);
    all.addPath(tower);
    // The glass: a lit stripe down the left, a shadow down the right.
    const inset = Math.min(bodyWidth / 2, height);
    const stripeTop = Math.min(head - up * inset, floor);
    const stripeBottom = Math.max(head - up * inset, floor);
    lit.rect(
      left + bodyWidth * 0.14,
      stripeTop,
      bodyWidth * 0.16,
      stripeBottom - stripeTop,
    );
    shade.rect(
      left + bodyWidth * 0.72,
      stripeTop,
      bodyWidth * 0.2,
      stripeBottom - stripeTop,
    );
    // The cap: a bright band across the head.
    const capY = head - up * Math.min(3, height / 3);
    caps.roundRect(
      left + bodyWidth * 0.1,
      Math.min(head, capY),
      bodyWidth * 0.8,
      2.5,
      1.2,
    );
    // The reflection: the same tower, shorter, hanging from the floor.
    const shown = height * MIRROR;
    let mirrorGroup = 0;
    if (look.ink === 'heat') {
      mirrorGroup = heat;
    } else if (look.ink === 'frequency') {
      mirrorGroup = Math.min(
        PANES - 1,
        Math.floor(((left - plot.left) / width) * PANES),
      );
    }
    mirrors[mirrorGroup].rect(
      left,
      up < 0 ? floor + 1 : floor - 1 - shown,
      bodyWidth,
      shown,
    );

    // Sparks off the tallest towers, on the beat.
    if (
      copy === 0 &&
      music.onBeat &&
      level > 0.55 &&
      state.sparks.length < SPARK_LIMIT
    ) {
      for (let spark = 0; spark < 2; spark += 1) {
        state.seed += 1;
        state.sparks.push({
          x: left + bodyWidth * (0.2 + 0.6 * hash01(state.seed)),
          y: head,
          vx: (hash01(state.seed * 3.1) - 0.5) * 30,
          vy: up * SPARK_RISE * (0.6 + 0.8 * hash01(state.seed * 5.7)),
          age: 0,
          copy,
        });
      }
    }
    // The floating cap, where the tower was a moment ago.
    const held = state.peaks.held[piece] * reach;
    if (look.accents && held - height > 3) {
      const heldY = floor + up * held;
      floating.roundRect(
        left + bodyWidth * 0.06,
        heldY - 1.5,
        bodyWidth * 0.88,
        3,
        1.5,
      );
    }
  };
  for (let piece = 0; piece < row.count; piece += 1) {
    const level = row.levels[piece];
    const height = level * reach;
    // A tower under two pixels is not drawn: it would be its own cap.
    if (height >= 2) {
      addTower(row.lefts[piece], height, level, piece);
    }
  }

  // The pool of light on the floor: an ellipse lying on it, wider and
  // brighter on the bass and with the Glow. Drawn round and squashed, so its
  // edge is the gradient's own fall-off and never a line.
  const middle = (plot.left + plot.right) / 2;
  const across = width * (0.42 + music.bass * 0.18);
  context.save();
  context.translate(middle, floor);
  context.scale(1, (depth * REFLECTION * 0.9) / across);
  const pool = context.createRadialGradient(0, 0, 0, 0, 0, across);
  pool.addColorStop(
    0,
    inkAt(
      colours,
      0.5,
      0.16 + music.bass * 0.24 + music.pulse * 0.14 + frame.glow * 0.2,
    ),
  );
  pool.addColorStop(0.55, inkAt(colours, 0.5, 0.05 + music.bass * 0.06));
  pool.addColorStop(1, inkAt(colours, 0.5, 0));
  context.fillStyle = pool;
  context.beginPath();
  context.arc(0, 0, across, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.globalAlpha = look.opacity;
  const whole = figureInk(context, frame, span, 1);
  glass.forEach((path, group) => {
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
    // The glass's depth: dark at the foot, clear in the middle, lit toward
    // the top, laid over whatever colour it is.
    const depthShade = context.createLinearGradient(0, floor, 0, ceiling);
    depthShade.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    depthShade.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
    depthShade.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
    context.fillStyle = depthShade;
    context.fill(all);
    context.fillStyle = 'rgba(255, 255, 255, 0.22)';
    context.fill(lit);
    context.fillStyle = 'rgba(0, 0, 0, 0.22)';
    context.fill(shade);
  }
  // The caps in their own towers' colour, lit whiter by the treble.
  context.fillStyle = figureInk(
    context,
    frame,
    span,
    0.75 + music.treble * 0.25,
    0.45 + music.treble * 0.4,
  );
  context.fill(caps);

  // The reflections, each in its own tower's glass, fading into the floor.
  mirrors.forEach((path, group) => {
    const fade = context.createLinearGradient(
      0,
      floor,
      0,
      floor - up * reach * MIRROR,
    );
    fade.addColorStop(0, mirrorColour(frame, group, 0.34));
    fade.addColorStop(0.5, mirrorColour(frame, group, 0.1));
    fade.addColorStop(1, mirrorColour(frame, group, 0));
    if (look.filled) {
      context.fillStyle = fade;
      context.fill(path);
    } else {
      context.strokeStyle = fade;
      context.lineWidth = look.lineWidth;
      context.stroke(path);
    }
  });
  context.restore();

  // The floating caps, over everything, lit.
  context.fillStyle = figureInk(context, frame, span, 0.95, 0.5);
  context.fill(floating);

  // The floor's edge: a hairline of polish.
  context.fillStyle = 'rgba(255, 255, 255, 0.16)';
  context.fillRect(plot.left, floor - 0.5, width, 1);
};

export const drawGlassTowers = (
  frame: ISceneFrame,
  state: IGlassTowersState,
): ISceneDrawn => {
  const row = layPieces(frame, state.row, MIN_PITCH);
  const falling = holdPeaks(state.peaks, row.levels, row.count, frame.deltaMs);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band, copy) => drawCopy(frame, band, copy, state, body));

  // Sparks: rise, drift, slow down and fade — thrown from the first copy and
  // mirrored into the others' bands by the band they belong to.
  const seconds = frame.deltaMs / 1000;
  const drag = 1 - easeToward(frame.deltaMs, 500);
  const alive: ISpark[] = [];
  const glow = new Path2D();
  const hot = new Path2D();
  state.sparks.forEach((spark) => {
    spark.age += seconds;
    if (spark.age >= SPARK_LIFE_S || !frame.bands[spark.copy]) {
      return;
    }
    spark.x += spark.vx * seconds;
    spark.y += spark.vy * seconds;
    spark.vy *= drag;
    const life = 1 - spark.age / SPARK_LIFE_S;
    const [first] = frame.bands;
    frame.bands.forEach((band) => {
      // The same spark in every copy: moved with its band, or reflected
      // when the band is the other way up.
      const y =
        band.flipped === first.flipped
          ? spark.y - first.top + band.top
          : band.top + (first.bottom - spark.y);
      glow.moveTo(spark.x + 3.2 * life, y);
      glow.arc(spark.x, y, 3.2 * life, 0, Math.PI * 2);
      hot.moveTo(spark.x + 1.2, y);
      hot.arc(spark.x, y, 1.2, 0, Math.PI * 2);
    });
    alive.push(spark);
  });
  state.sparks = alive;
  if (alive.length > 0) {
    const span: ISceneSpan = {
      left: frame.plot.left,
      right: frame.plot.right,
      floor: frame.plot.bottom,
      head: frame.plot.top,
    };
    frame.context.fillStyle = figureInk(
      frame.context,
      frame,
      span,
      clampUnit(0.4 + frame.glow * 0.3),
      0.2,
    );
    frame.context.fill(glow);
    frame.context.fillStyle = 'rgba(255, 255, 255, 0.85)';
    frame.context.fill(hot);
  }
  return {
    moving: alive.length > 0 || (falling && frame.look.accents),
    body,
  };
};
