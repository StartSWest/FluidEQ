/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readInk } from '../../utils/theme';
import { isLightWindow } from '../../utils/windowSide';
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

/**
 * Everything a scene reads for a frame except where it is painted: what the
 * engine's own looks are stepped from (`engineLooks/`), which lay the scene
 * out here and paint it on the GPU.
 */
export interface ISceneReading {
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

/** A reading and the 2D canvas it is painted on. */
export interface ISceneFrame extends ISceneReading {
  context: CanvasRenderingContext2D;
  ratio: number;
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

/**
 * Where one copy of a figure stands in its band: the row its foot is on,
 * which way it grows (-1 up the screen, 1 down it when the wave is upside
 * down), and how far it may reach. Each look that stands on a floor states
 * its own in one function, which its 2D drawing and its GPU painting
 * (`engineLooks/`) both read.
 */
export interface ISceneStand {
  floor: number;
  up: number;
  reach: number;
}

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

/**
 * Where on the ramp `figureInk` paints the point x, y of a figure standing
 * in `span`: the middle for one colour, across for the spectrum, up from the
 * floor otherwise. For what is coloured one point at a time — a spark, a
 * sprite on the GPU — rather than filled with the gradient.
 */
export const figureInkAt = (
  ink: TSceneInk,
  span: ISceneSpan,
  x: number,
  y: number,
): number => {
  if (ink === 'flat') {
    return 0.5;
  }
  if (ink === 'frequency') {
    const width = span.right - span.left;
    return width > 0 ? clampUnit((x - span.left) / width) : 0;
  }
  const height = span.head - span.floor;
  return Math.abs(height) > 1e-3 ? clampUnit((y - span.floor) / height) : 0;
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

/**
 * How far toward black a highlight goes on a light window, per unit of the
 * whitening it asks for on a dark one. A held peak, a column's hot top, a
 * spark: each was its colour moved toward white, which on a white window is
 * the floor itself, so every one of them vanished there (2026-11-19 scan:
 * LED bars' top segment and peaks at 1.2:1). Deepened instead, the strongest
 * of them (0.7) keeps 58% of its colour, which on the light window's
 * darkened stops reads well over 3:1. `lookGlsl.ts` paints with the same.
 */
export const LIGHT_WINDOW_DEEPEN = 0.6;

/**
 * One 0..255 channel of a highlight: moved toward white by `amount` on a
 * dark window, toward black on a light one.
 */
export const highlightChannel = (channel: number, amount: number): number =>
  isLightWindow()
    ? channel * (1 - clampUnit(amount) * LIGHT_WINDOW_DEEPEN)
    : channel + (255 - channel) * clampUnit(amount);

/**
 * The same colour lifted by `amount` for a highlight: toward white on a dark
 * window, toward black on a light one (`highlightChannel`).
 */
export const lightInkAt = (
  colours: readonly string[],
  position: number,
  amount: number,
  alpha: number,
): string => {
  const [red, green, blue] = rampAt(colours, clampUnit(position));
  const lift = (channel: number) =>
    Math.round(highlightChannel(channel, amount));
  return `rgba(${lift(red)}, ${lift(green)}, ${lift(blue)}, ${clampUnit(
    alpha,
  ).toFixed(3)})`;
};

/**
 * How much of a night sky's stars a window shows: all of them on a dark
 * window, none on a light one, which is a daytime sky — white specks on a
 * white floor were noise at best.
 */
export const starShare = (): number => (isLightWindow() ? 0 : 1);

/** How strongly a spark is lifted from the look's top colour on white. */
export const SPARK_LIFT = 0.7;

/**
 * A spark's colour, 0..1 channels — a flung droplet, a tower's hot spark, a
 * ray's tip: white on a dark window; on a light one, where white vanished,
 * the look's top colour deepened as a highlight is (`lookSpark` on the GPU).
 */
export const sparkRgb = (
  colours: readonly string[],
): readonly [number, number, number] => {
  if (!isLightWindow()) {
    return [1, 1, 1];
  }
  const [red, green, blue] = rampAt(colours, 1);
  const lift = (channel: number) => highlightChannel(channel, SPARK_LIFT) / 255;
  return [lift(red), lift(green), lift(blue)];
};

/** `sparkRgb` as a CSS fill at `alpha`. */
export const sparkFill = (
  colours: readonly string[],
  alpha: number,
): string => {
  const [red, green, blue] = sparkRgb(colours).map((channel) =>
    Math.round(channel * 255),
  );
  return `rgba(${red}, ${green}, ${blue}, ${clampUnit(alpha).toFixed(3)})`;
};

const white = (alpha: number): string =>
  `rgba(255, 255, 255, ${clampUnit(alpha).toFixed(3)})`;

/**
 * A white highlight laid over a figure — a gloss, a lit face, a whitened tip
 * — at `alpha`: white on a dark window, and on a light one the darkening a
 * highlight takes there (`highlightChannel`) laid on as black, which is the
 * same arithmetic over whatever colour is under it. Laid on as white, a tip
 * on the white floor washed into the floor and the peaks read as missing
 * (Ivan, 2026-11-24: "the peaks, they are white"). `lookSheen` on the GPU.
 */
export const sheenFill = (alpha: number): string =>
  isLightWindow()
    ? `rgba(0, 0, 0, ${(clampUnit(alpha) * LIGHT_WINDOW_DEEPEN).toFixed(3)})`
    : white(alpha);

/**
 * A mark drawn on the window's own ground — a ring the rays stand on, a
 * floor's hairline — at `alpha`: white on a dark window, the window's
 * strongest ink on a light one (`readInk`). `lookMark` on the GPU.
 */
export const markFill = (alpha: number): string =>
  isLightWindow() ? readInk(clampUnit(alpha)) : white(alpha);

/**
 * How a light that glows is laid over the picture: added, as light is, on a
 * dark window; laid on as colour on a light one, where adding light can only
 * lighten toward the white floor and turned every glowing look's colour to a
 * neon pale against it.
 */
export const glowComposite = (): GlobalCompositeOperation =>
  isLightWindow() ? 'source-over' : 'lighter';

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
