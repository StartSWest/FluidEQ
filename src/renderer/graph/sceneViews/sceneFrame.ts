/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { rampAt } from '../lookColours';
import type { IAnalysisBand, IAnalysisPlot } from '../analysis/analysisFrame';

/**
 * What every one of the drawn scenes is handed each frame (`drawSceneView`).
 *
 * The scenes are pictures, not instruments, but they obey the graph's rules
 * like the rest of it: the reading arrives normalised (0 the plot's floor, 1
 * its ceiling) and eased by the look's own attack and release; the wave
 * controls arrive as the bands a figure stands in (`IAnalysisBand`, one per
 * copy of a mirrored wave); and the music arrives read three ways, bass,
 * middle and treble, with the beat found in the bass (`sceneMusic.ts`),
 * because a scene that only follows one loudness moves like a meter.
 *
 * Scenery — a sky's stars, a floor's grid — reaches the edges of the window
 * whatever the height slider says (`window`); only the figure answers the
 * slider, and it answers by drawing fewer pieces of the same size rather
 * than squashing them. Nothing here ever paints a background: a video
 * playing behind the graph has to show through every scene.
 */

export interface ISceneMusic {
  /** 30-150 Hz, 0..1, eased quickly up and slowly down. */
  bass: number;
  /** 300 Hz - 2.5 kHz. */
  mid: number;
  /** 4-14 kHz. */
  treble: number;
  /** The whole reading's loudness, 0..1. */
  energy: number;
  /** 1 on a beat, falling away over a few hundred milliseconds. */
  pulse: number;
  /** A beat landed in this frame. */
  onBeat: boolean;
  /**
   * Seconds of MUSIC, not of wall clock: it runs faster the harder the music
   * plays and stands still in silence, so a scene at rest is at rest rather
   * than drifting through a quiet room.
   */
  clock: number;
  /** The frame's step of that clock. */
  step: number;
}

/**
 * How the look's colours are laid over a scene — the style editor's Colour
 * by: one colour, along the spectrum bass to treble, up the height from the
 * floor, or each piece whole in the colour of its own loudness.
 */
export type TSceneInk = 'flat' | 'frequency' | 'level' | 'heat';

/**
 * The style editor, as a scene reads it.
 *
 * Every scene obeys the same settings the other forms do (Ivan, 2026-09-24:
 * "those new viz are not following the ... edit style setting and colors");
 * what each one MEANS is the scene's to say — a board's Pieces are its
 * columns of lamps, the halo's are the rays of half its ring — but none of
 * them may leave a control on the panel that moves nothing.
 */
export interface ISceneLook {
  ink: TSceneInk;
  /** Pieces across the plot, for the scenes made of pieces. */
  pieces: number;
  /** The share of a piece's pitch left empty between it and the next. */
  gap: number;
  /** Solid, or drawn in outline at `lineWidth`. */
  filled: boolean;
  /** How solid the figure is, 0..1, over the scene's own light and shade. */
  opacity: number;
  lineWidth: number;
  /** Lit peaks: whether the scene's own peak mark is drawn. */
  accents: boolean;
  /**
   * Whether a texture will be printed in the body, so a scene only gathers
   * its body (`ISceneDrawn`) when somebody is going to use it.
   */
  textured: boolean;
}

export interface ISceneFrame {
  context: CanvasRenderingContext2D;
  ratio: number;
  plot: IAnalysisPlot;
  /** The whole canvas, in CSS pixels: where scenery may reach. */
  window: { width: number; height: number };
  bands: readonly IAnalysisBand[];
  deltaMs: number;
  playing: boolean;
  /** The reading as drawn, 0..1, eased by the look's attack and release. */
  levels: Float64Array;
  /** Each reading's column, in CSS pixels. */
  xs: Float64Array;
  /** Each reading's frequency, in hertz. */
  axis: Float64Array;
  music: ISceneMusic;
  /** The stops the scene is painted in: the look's own, or the scene's. */
  colours: readonly string[];
  /** The style editor's settings (`ISceneLook`). */
  look: ISceneLook;
  /** The look's glow, 0 unless the euphoria mode is lighting the graph. */
  glow: number;
}

/**
 * What one scene's frame came to: whether it is still moving, and the body
 * it filled — the union of its solid pieces — for the look's texture to be
 * printed in. A scene drawn in outline has no body.
 */
export interface ISceneDrawn {
  moving: boolean;
  body?: Path2D;
}

/** The look's colours sampled into this many stops for one gradient. */
const RAMP_STOPS = 8;

/**
 * The look's ramp as one gradient along a line, whitened by `whiten`.
 *
 * One fill with one of these paints a whole row of pieces each in the colour
 * of where it stands, which is what keeps a scene of two hundred pieces at a
 * handful of calls.
 */
export const rampAlong = (
  context: CanvasRenderingContext2D,
  colours: readonly string[],
  from: readonly [number, number],
  to: readonly [number, number],
  whiten: number,
  alpha: number,
): CanvasGradient => {
  const ramp = context.createLinearGradient(from[0], from[1], to[0], to[1]);
  for (let stop = 0; stop < RAMP_STOPS; stop += 1) {
    const position = stop / (RAMP_STOPS - 1);
    ramp.addColorStop(position, lightInkAt(colours, position, whiten, alpha));
  }
  return ramp;
};

/** Where a figure stands, for its paint: across, and from floor to head. */
export interface ISceneSpan {
  left: number;
  right: number;
  floor: number;
  head: number;
}

/**
 * The paint for a whole figure in one fill, as Colour by says: one colour,
 * the ramp across the plot, or the ramp up from the floor.
 *
 * Heat has no single paint — each piece is its own colour (`heatInk`) — so a
 * figure that is not made of pieces takes it as level, which is what heat's
 * colours mean when there is only one height to read.
 */
export const figureInk = (
  context: CanvasRenderingContext2D,
  frame: ISceneFrame,
  span: ISceneSpan,
  alpha: number,
  whiten = 0,
): string | CanvasGradient => {
  const { colours, look } = frame;
  if (look.ink === 'flat') {
    return lightInkAt(colours, 0.5, whiten, alpha);
  }
  if (look.ink === 'frequency') {
    return rampAlong(
      context,
      colours,
      [span.left, 0],
      [span.right, 0],
      whiten,
      alpha,
    );
  }
  return rampAlong(
    context,
    colours,
    [0, span.floor],
    [0, span.head],
    whiten,
    alpha,
  );
};

/** Heat is painted in this many steps, one fill each. */
export const HEAT_STEPS = 12;

/** Which heat step a piece at `level` falls in. */
export const heatStep = (level: number): number =>
  Math.round(clampUnit(level) * (HEAT_STEPS - 1));

/**
 * How many paths a scene's pieces are painted in, one colour each: one per
 * row for level (a board's rows are its colours), one per heat step for
 * heat, and one for the rest, whose single paint runs across or is flat.
 */
export const inkGroups = (ink: TSceneInk, rows: number): number => {
  if (ink === 'level') {
    return rows;
  }
  return ink === 'heat' ? HEAT_STEPS : 1;
};

/** The colour of one heat step. */
export const heatInk = (
  colours: readonly string[],
  step: number,
  alpha: number,
  whiten = 0,
): string => lightInkAt(colours, step / (HEAT_STEPS - 1), whiten, alpha);

/**
 * Where on the ramp a point of a scene sits, for the scenes that colour
 * point by point (a ray, a strand, a lamp): along the spectrum, up the
 * height, its own loudness for heat, or the middle for one colour.
 */
export const inkPosition = (
  ink: TSceneInk,
  along: number,
  height: number,
): number => {
  if (ink === 'flat') {
    return 0.5;
  }
  if (ink === 'frequency') {
    return along;
  }
  return height;
};

/** 0..1, with anything unreadable taken as nothing. */
export const clampUnit = (value: number): number => {
  if (!(value > 0)) {
    return 0;
  }
  return value > 1 ? 1 : value;
};

/** A colour on the scene's ramp as a CSS string. */
export const inkAt = (
  colours: readonly string[],
  position: number,
  alpha: number,
): string => {
  const [red, green, blue] = rampAt(colours, clampUnit(position));
  return `rgba(${red}, ${green}, ${blue}, ${clampUnit(alpha).toFixed(3)})`;
};

/** The same colour moved toward white by `amount`, for highlights. */
export const lightInkAt = (
  colours: readonly string[],
  position: number,
  amount: number,
  alpha: number,
): string => {
  const [red, green, blue] = rampAt(colours, clampUnit(position));
  const toward = (channel: number) =>
    Math.round(channel + (255 - channel) * clampUnit(amount));
  return `rgba(${toward(red)}, ${toward(green)}, ${toward(blue)}, ${clampUnit(
    alpha,
  ).toFixed(3)})`;
};

/** Halving `remaining` every `halfLifeMs`: the fraction of it to close now. */
export const easeToward = (deltaMs: number, halfLifeMs: number): number =>
  halfLifeMs <= 0 ? 1 : 1 - 0.5 ** (Math.max(0, deltaMs) / halfLifeMs);

/**
 * The reading at `x` pixels, between the two readings either side of it.
 *
 * The readings are spaced by frequency on a logarithmic axis, so their
 * columns are not even; a scene that lays its own pieces out evenly asks
 * here rather than indexing, or its left third would be the bass alone.
 */
export const levelAtX = (
  xs: Float64Array,
  levels: Float64Array,
  x: number,
): number => {
  const count = xs.length;
  if (count === 0) {
    return 0;
  }
  if (x <= xs[0]) {
    return levels[0];
  }
  if (x >= xs[count - 1]) {
    return levels[count - 1];
  }
  let low = 0;
  let high = count - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (xs[middle] <= x) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const span = xs[high] - xs[low];
  const along = span > 0 ? (x - xs[low]) / span : 0;
  return levels[low] + (levels[high] - levels[low]) * along;
};

/**
 * The loudest reading between two columns, so a piece covering several
 * readings shows the peak inside it rather than whichever reading its middle
 * happened to land on.
 */
export const peakBetween = (
  xs: Float64Array,
  levels: Float64Array,
  from: number,
  to: number,
): number => {
  let peak = Math.max(levelAtX(xs, levels, from), levelAtX(xs, levels, to));
  for (let index = 0; index < xs.length; index += 1) {
    const x = xs[index];
    if (x > to) {
      break;
    }
    if (x >= from && levels[index] > peak) {
      peak = levels[index];
    }
  }
  return peak;
};

/**
 * A small deterministic noise, 0..1, for twinkles and scattering that must
 * look random but stay put from one frame to the next.
 */
export const hash01 = (seed: number): number => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
