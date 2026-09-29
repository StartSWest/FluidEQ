/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  GraphStyle,
  Projected,
  clampGraphColumns,
  getColumnCount,
  isDiscreteGraphStyle,
} from './graphStyles';
import toColumns from './graphColumns';
import { createWaveformShape } from './waveformStyles';
import { WAVE_SAMPLE_COUNT, toWaveSamples } from './graphShapeWaves';

// What the graph lays over a form: its accent styles, the glow, and the
// peaks worth marking.

/**
 * What, if anything, a form does when a band peaks.
 *
 * One form. Not forty.
 *
 * The reason there are forty drawings is that they behave differently, so an
 * effect applied to all of them is not an effect — it is the drawing with the
 * contrast turned up, and it flattens the exact variety the forms exist to
 * provide. A lit tip belongs on a stem, which is a thin line with an end. It
 * says nothing on a contour map, a slope field or a bridge truss, and on a
 * smooth curve it reads as damage.
 *
 * The table is a table rather than a check for one string so that a second
 * form can be given one deliberately, one at a time, by somebody who has
 * looked at it and decided it earns one.
 */
/**
 * The ways a peak can be marked.
 *
 * A lit peak is the one thing on the graph that is pure emphasis — it says
 * "this one" and nothing else — so which mark suits it is a question about
 * the form underneath and about taste, and neither is something this file
 * can answer. It is a choice.
 *
 * `wave` is the odd one and the reason the list is not all marks: it is not
 * a mark at all but a curve laid over the whole figure, which is what the
 * fluid is half made of. It stays exactly as it is.
 */
export type AccentStyle =
  | 'blink'
  | 'live'
  | 'wave'
  | 'bead'
  | 'fall'
  | 'ghost'
  | 'ripple'
  | 'sparks'
  | 'beam'
  | 'ceiling'
  | 'comet'
  | 'drip';

export const ACCENT_STYLES: AccentStyle[] = [
  'blink',
  'live',
  'bead',
  'fall',
  'ghost',
  'ripple',
  'sparks',
  'beam',
  'ceiling',
  'comet',
  'drip',
  'wave',
];

const ACCENTS: Partial<Record<GraphStyle, 'bead' | 'trace'>> = {
  slope: 'bead',
  dots: 'bead',
  scatter: 'bead',
  blocks: 'bead',
  /**
   * The wave line over the fluid's bars.
   *
   * Not decoration and not a peak mark — it is the form's second half. The
   * titlebar draws this one in two layers for a reason its comment gives:
   * a shared path cannot carry a gradient per bar, so the bars are painted
   * separately from the trace over them. The graph has the same seam, this
   * one, and using it means the two panes agree about what fluid is instead
   * of each assembling its own version.
   *
   * A `trace` accent has nothing to do with peaks, so it skips all of the
   * threshold work below and is simply the curve.
   */
  fluid: 'trace',
  /**
   * The drawn scenes that hold their peaks: the lamp left lit over a board's
   * column, the cap floating over glass or a bar, the dotted ring outside the
   * halo, the spray off the sea, the envelope over the spectrum wave. Each
   * draws its own mark (`sceneViews/`); this only says it has one, so Lit
   * peaks starts on for them.
   */
  ledwall: 'bead',
  towers: 'bead',
  tide: 'bead',
  halo: 'bead',
  ledbars: 'bead',
  neonbars: 'bead',
  bars3d: 'bead',
  spectrumwave: 'bead',
  mirrorbars: 'bead',
  pixelbars: 'bead',
  sparkbars: 'bead',
  glitchbars: 'bead',
  halftone: 'bead',
  bouncedots: 'bead',
  fallblocks: 'bead',
  fibers: 'bead',
  afterglow: 'bead',
};

/**
 * The form a look's glow should be taken from, which is not always its own.
 *
 * Light comes off the outside of a thing. A wall of LED bricks glows as one
 * lit bar, not as forty separately haloed bricks; hatching glows along the
 * edge of the hatched region, not around each diagonal. Drawing the halo from
 * the real geometry gets that wrong in exactly the way that looks cheap — every
 * internal detail ringed in light, so the figure reads as embroidery rather
 * than as something glowing.
 *
 * It is also what makes the halo affordable. The ornate forms are hundreds of
 * pieces and a stroke has to be tessellated from every one of them; a
 * silhouette is one rectangle per band whatever is drawn inside it. Simplifying
 * for looks and simplifying for cost turn out to be the same edit, which is
 * usually the sign of the right one — and it buys back enough budget for the
 * halo to be drawn twice, which is what gives it a falloff instead of an edge.
 *
 * Forms already shaped like their own silhouette answer with themselves.
 */
/**
 * Where "too many pieces to light individually" begins, in characters of path.
 *
 * Measured rather than guessed, which matters because guessing got it wrong:
 * a hand-written list of which forms deserved a silhouette put a bar chart
 * behind the zipper, a form that turns out to be one of the cheapest here.
 *
 * The real spread is not close. Drawn over the same spectrum, the thin forms
 * land between 1,200 and 5,300 — slope 1.2k, zipper 2.3k, bars 2.4k, line 4.6k,
 * contour 5.1k — and the stacked ones are an order of magnitude past that:
 * hatch 14k, honeycomb 18k, matrix 28k, skyline 31k, ribs 33k, blocks 44k.
 * There is an empty gap between about 5k and 9k with almost nothing in it, so
 * the line goes there and no form sits near enough to flicker across it.
 *
 * The string's length is the measure because it is a fair proxy for the work a
 * wide stroke has to do — every command in it is a piece to tessellate — and it
 * is free, being already built. It also means the decision follows the look
 * rather than the form: turn a bar chart's density up to a hundred and sixty
 * and it crosses the line on its own.
 */
export const GLOW_COMPLEXITY_LIMIT = 8000;

/**
 * The silhouette to use when a figure is too intricate to light piece by piece.
 *
 * Only reached past the limit above. `pillars` for the skyline because towers
 * stand shoulder to shoulder and the gaps a bar chart leaves would read as
 * light between buildings that are not there.
 */
const GLOW_SILHOUETTES: Partial<Record<GraphStyle, GraphStyle>> = {
  skyline: 'pillars',
  /*
   * The wave family lights as its own body, not as the fallback.
   *
   * The fallback is `area` for a continuous form and `bars` for a discrete
   * one, and both of those stand on the floor. Under a figure that straddles
   * the centre line they would put the halo along the bottom of the plot with
   * the drawing floating above it — light coming from somewhere the shape is
   * not, which is the one thing a glow must never do.
   *
   * `wave-filled` is the family's silhouette because it is the family's
   * outline: every one of these is that body, drawn in pieces.
   */
  'wave-line': 'wave-filled',
  'wave-bars': 'wave-filled',
  'wave-mirror': 'wave-filled',
  'wave-dots': 'wave-filled',
  'wave-ribbon': 'wave-filled',
  'wave-spikes': 'wave-filled',
  'wave-outline': 'wave-filled',
  'wave-lattice': 'wave-filled',
  // The two that stand on the floor, so the floor-standing silhouette is the
  // right one for them.
  'wave-blocks': 'bars',
  fluid: 'bars',
};

export const getGlowStyle = (
  style: GraphStyle,
  pathLength: number,
  filled = true,
): GraphStyle => {
  // A filled silhouette closes along the floor. Using it behind an open
  // trace drew a glowing box whenever the path crossed the complexity limit.
  if (!filled) {
    return pathLength <= GLOW_COMPLEXITY_LIMIT ? style : 'line';
  }
  if (pathLength <= GLOW_COMPLEXITY_LIMIT) {
    // Few enough pieces that the light can follow the real thing, which always
    // looks better — it is the actual shape rather than an impression of it.
    return style;
  }
  return (
    GLOW_SILHOUETTES[style] ?? (isDiscreteGraphStyle(style) ? 'bars' : 'area')
  );
};

/**
 * Whether a form has lit tips to offer at all.
 *
 * For the designer, which would otherwise show a switch that does nothing on
 * thirty-five of the thirty-six forms. A control that is off because the form
 * has none is a different thing from one that is off because the user turned
 * it off, and the panel says so rather than leaving them to work it out.
 */
/**
 * Whether a form comes with a lit peak already on.
 *
 * Not whether it can have one — every form can, and the switch is there to
 * be pressed. This is the starting position, which is off for the forms the
 * mark says nothing on: a lit tip suits a stem and reads as damage on a
 * smooth curve, so those open without it rather than being denied it.
 */
/**
 * Which mark a form starts with.
 *
 * The fluid opens on its wave, because that is not decoration on it — it is
 * half of what the form is. Everything else opens on the box, which is the
 * mark this graph has always drawn.
 */
export const getDefaultAccentStyle = (style: GraphStyle): AccentStyle => {
  if (style === 'slope') {
    return 'sparks';
  }
  if (style === 'scatter' || style === 'dots') {
    return 'blink';
  }
  if (style === 'blocks') {
    return 'fall';
  }
  return ACCENTS[style] === 'trace' ? 'wave' : 'bead';
};

export const hasGraphAccent = (style: GraphStyle): boolean =>
  Boolean(ACCENTS[style]);

/**
 * How loud a peak has to be, against the loudest thing on screen, to be lit.
 *
 * Low enough that a busy mix lights several at once, high enough that quiet
 * passages light nothing rather than picking an arbitrary winner out of the
 * noise floor.
 */
const ACCENT_THRESHOLD = 0.62;

/**
 * A ceiling on how many tips can be lit at once.
 *
 * Without it, a wall of pink noise lights every column and the accent stops
 * meaning "here is the peak".
 */
/** As wide as a lit peak is ever allowed to be, whatever the density. */
const MAX_ACCENT_BEAD = 7;

const MAX_ACCENTS = 10;

/**
 * The lit tips, as a path of their own — for the one form that has them.
 *
 * Drawn separately from the figure so the tips can be lit while the body stays
 * calm: the caller strokes this twice, once thick and faint and once thin and
 * bright, which reads as a glow without a filter anywhere near it. That
 * matters more than it sounds — an SVG filter on a path whose geometry changes
 * every frame re-rasterises its whole region every frame, and this pane learned
 * that lesson expensively.
 *
 * Returns an empty path for every other form, which is the intended answer and
 * not a failure to draw one.
 */
/**
 * Where a form's drawing actually TOPS OUT, given a reading.
 *
 * A mark goes on the piece, and the piece is not always where the projected
 * point is. Two families put it somewhere else entirely:
 *
 *  - The fluid's bars fill 82% of the pane, because that is the proportion
 *    the titlebar draws them at. Marks taken from the raw point floated a
 *    fifth of the plot above the bars they were marking.
 *  - The mirrored wave forms straddle the centre line rather than standing
 *    on the floor, so their top is half the plot up from the middle — a
 *    completely different mapping, not a scale of the same one.
 *
 * A function per family rather than a fraction, because the second of those
 * cannot be written as a fraction of anything.
 */
const PEAK_ROWS: Partial<
  Record<GraphStyle, (baseline: number, energy: number) => number>
> = {
  fluid: (baseline, energy) => baseline - energy * baseline * 0.82,
  // Floor-standing in the titlebar too, and at full depth rather than 82%.
  'wave-bars': (baseline, energy) => baseline - energy * baseline,
  'wave-blocks': (baseline, energy) => baseline - energy * baseline,
  'wave-dots': (baseline, energy) => baseline - energy * baseline,
  'wave-spikes': (baseline, energy) => baseline - energy * baseline,
  'wave-outline': (baseline, energy) => baseline - energy * baseline,
  'wave-lattice': (baseline, energy) => baseline - energy * baseline,
};

/** The mirrored family, whose figure grows out of the middle. */
const MIRRORED_WAVE_FORMS: GraphStyle[] = [
  'wave-line',
  'wave-filled',
  'wave-ribbon',
  'wave-mirror',
];

MIRRORED_WAVE_FORMS.forEach((style) => {
  PEAK_ROWS[style] = (baseline, energy) => (baseline / 2) * (1 - energy);
});

/** A peak worth marking: where it is, and how big a mark suits it. */
export interface IGraphPeak {
  x: number;
  y: number;
  /** The piece's own width, capped to something a mark should be. */
  size: number;
  /** How tall it is as a fraction of the plot's depth. */
  energy: number;
}

/**
 * Which peaks are worth lighting, and where.
 *
 * Exported because the answer is the same whatever the mark is, and there are
 * ten of them now — several drawn by the renderer rather than as path data,
 * because they fall, expand or fade and none of that fits in one frame's
 * geometry. Three separate opinions about what counts as a peak is three
 * drawings disagreeing about where the music is.
 */
export const getGraphPeaks = (
  points: readonly Projected[],
  style: GraphStyle,
  baseline: number,
  columns?: number,
  ceiling = 0,
): IGraphPeak[] => {
  if (points.length < 3) {
    return [];
  }
  // The same density as the figure, or the marks land between the pieces they
  // are supposed to be sitting on.
  const figure = toColumns(
    points,
    columns === undefined ? getColumnCount(style) : clampGraphColumns(columns),
  );
  if (figure.length < 3) {
    return [];
  }
  const span = figure[figure.length - 1][0] - figure[0][0];
  const step = Math.max(1, span / (figure.length - 1));
  let tallest = 0;
  for (let index = 0; index < figure.length; index += 1) {
    const height = baseline - figure[index][1];
    if (height > tallest) {
      tallest = height;
    }
  }
  if (tallest <= 1) {
    return [];
  }
  const size = Math.max(2.6, Math.min(MAX_ACCENT_BEAD, step * 0.5));
  const floor = tallest * ACCENT_THRESHOLD;
  const depth = Math.max(1, baseline - ceiling);
  const peaks: IGraphPeak[] = [];
  let lastX = -Infinity;
  for (
    let index = 1;
    index < figure.length - 1 && peaks.length < MAX_ACCENTS;
    index += 1
  ) {
    const [x, y] = figure[index];
    // Three things make a tip worth lighting: it is loud enough against the
    // rest of the frame, nothing beside it is louder — which keeps a broad
    // peak to one mark rather than a smear across its shoulders — and it is
    // far enough from the last one to be a separate peak at all.
    const isLoud = baseline - y >= floor;
    const isLocalPeak =
      y <= figure[index - 1][1] && y <= figure[index + 1][1] && isLoud;
    if (isLocalPeak && x - lastX >= step * 1.5) {
      lastX = x;
      const energy = Math.max(0, Math.min(1, (baseline - y) / depth));
      const row = PEAK_ROWS[style];
      peaks.push({
        x,
        // The row the DRAWING reaches, which is not always the point's own.
        y: row ? ceiling + row(depth, energy) : y,
        size,
        energy,
      });
    }
  }
  return peaks;
};

export const createGraphAccent = (
  points: readonly Projected[],
  style: GraphStyle,
  baseline: number,
  /** The output envelope, which is what this accent is made of. */
  waveform?: readonly number[],
  /** Which mark. Left out, the form's own starting choice. */
  accentStyle?: AccentStyle,
  ceiling = 0,
): string => {
  /**
   * Only the wave is a path.
   *
   * The other nine hang, sink, expand, fly or trail, and none of that exists
   * inside one frame's geometry — so they are painted by the renderer, which
   * is the only place that has the last frame to compare against. See
   * `graphAccents`. This is the one that is simply a curve, and it is the
   * titlebar's own curve at that.
   */
  const accent = accentStyle ?? (ACCENTS[style] === 'trace' ? 'wave' : 'bead');
  if (accent !== 'wave' || points.length < 3) {
    return '';
  }
  const left = points[0][0];
  return createWaveformShape(
    waveform !== undefined && waveform.length >= 2
      ? waveform
      : toWaveSamples(toColumns(points, WAVE_SAMPLE_COUNT), baseline, ceiling),
    'fluid',
    Math.max(1, points[points.length - 1][0] - left),
    Math.max(1, baseline - ceiling),
    Math.max(1, baseline - ceiling) / 2,
    undefined,
    { x: left, y: ceiling },
  ).line;
};
