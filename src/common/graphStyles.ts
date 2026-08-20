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

/**
 * The ways to draw the live spectrum across the response graph.
 *
 * Counted nowhere in this comment on purpose — the list has grown three times
 * and the prose said "ten" throughout.
 *
 * Same rule as the titlebar meter's styles: every one is a single path, so
 * choosing a style changes the picture without adding or removing a single
 * element. Bars are rectangles as subpaths, dots are little squares, and the
 * element that draws them is the element that was already there.
 *
 * These take points already projected into pixels, because the graph's axes
 * are logarithmic in x and decibel in y — doing the geometry in data space and
 * projecting afterwards would put curves through the wrong places entirely.
 */

export type GraphStyle =
  | 'line'
  | 'area'
  | 'bars'
  | 'dots'
  | 'steps'
  | 'blocks'
  | 'spikes'
  | 'ridge'
  | 'stems'
  | 'terrace'
  | 'dashes'
  | 'scatter'
  | 'caps'
  | 'ribs'
  | 'pillars'
  | 'crown'
  | 'weave'
  | 'contour'
  | 'hatch'
  | 'matrix'
  | 'skyline'
  | 'bezier'
  | 'ribbon'
  | 'feather'
  | 'truss'
  | 'zipper'
  | 'slope'
  | 'stalactites'
  | 'bubbles'
  | 'diamonds'
  | 'sawtooth'
  | 'ecg'
  | 'echo'
  | 'racer'
  | 'invaders'
  | 'starfield'
  | 'candles'
  | 'arches'
  | 'flames'
  | 'barcode'
  | 'rain'
  | 'honeycomb'
  | 'fence'
  | 'braid'
  | 'stitch'
  | 'canyon'
  | 'fluid'
  | 'wave-line'
  | 'wave-filled'
  | 'wave-bars'
  | 'wave-mirror'
  | 'wave-dots'
  | 'wave-ribbon'
  | 'wave-spikes'
  | 'wave-blocks'
  | 'wave-outline'
  | 'wave-lattice';

/** In cycle order. */
export const GRAPH_STYLES: GraphStyle[] = [
  'line',
  'area',
  'bars',
  'dots',
  'steps',
  'blocks',
  'spikes',
  'ridge',
  'stems',
  'terrace',
  'dashes',
  'scatter',
  'caps',
  'ribs',
  'pillars',
  'crown',
  'weave',
  'contour',
  'hatch',
  'matrix',
  'skyline',
  'bezier',
  'ribbon',
  'feather',
  'truss',
  'zipper',
  'slope',
  'stalactites',
  'bubbles',
  'diamonds',
  'sawtooth',
  'ecg',
  'echo',
  'racer',
  'invaders',
  'starfield',
  // Appended rather than slotted in beside their relatives. The order is the
  // cycle order, and anybody who has learned that their favourite is four
  // clicks past Bars would have it moved out from under them.
  'candles',
  'arches',
  'flames',
  'barcode',
  'rain',
  'honeycomb',
  'fence',
  'braid',
  'stitch',
  'canyon',
  // Two inputs rather than one. Appended for the same reason as the row
  // above it: the order is the cycle order and people learn theirs by count.
  'fluid',
  // The titlebar wave's own ten, drawn by the titlebar's own code. Appended
  // for the same reason as everything above them: the order is the cycle
  // order and people learn theirs by counting clicks.
  'wave-line',
  'wave-filled',
  'wave-bars',
  'wave-mirror',
  'wave-dots',
  'wave-ribbon',
  'wave-spikes',
  'wave-blocks',
  'wave-outline',
  'wave-lattice',
];

/**
 * Human names for the picker.
 *
 * Written out rather than generated from the key, because "terrace" and
 * "crown" mean nothing on their own — the list is chosen by eye and the
 * label is what somebody searches.
 */
export const GRAPH_STYLE_LABELS: Record<GraphStyle, string> = {
  line: 'Line',
  area: 'Area',
  bars: 'Bars',
  dots: 'Dots',
  steps: 'Staircase',
  blocks: 'LED blocks',
  spikes: 'Spikes',
  ridge: 'Ridge',
  stems: 'Stems',
  terrace: 'Terrace',
  dashes: 'Dashes',
  scatter: 'Scatter',
  caps: 'Floating caps',
  ribs: 'Ribs',
  pillars: 'Pillars',
  crown: 'Crown',
  weave: 'Weave',
  contour: 'Topography',
  hatch: 'Hatching',
  matrix: 'Dot matrix',
  skyline: 'Skyline',
  bezier: 'Silk',
  ribbon: 'Ribbon',
  feather: 'Feather',
  truss: 'Truss',
  zipper: 'Zipper',
  slope: 'Slope field',
  stalactites: 'Stalactites',
  bubbles: 'Bubbles',
  diamonds: 'Diamonds',
  sawtooth: 'Sawtooth',
  ecg: 'Pulse',
  echo: 'Echo',
  racer: 'Road trip',
  invaders: 'Invaders',
  starfield: 'Warp speed',
  candles: 'Candles',
  arches: 'Arches',
  flames: 'Flames',
  barcode: 'Barcode',
  rain: 'Rainfall',
  honeycomb: 'Honeycomb',
  fence: 'Fence',
  braid: 'Braid',
  stitch: 'Cross-stitch',
  canyon: 'Canyon',
  fluid: 'Fluid',
  'wave-line': 'Wave line',
  'wave-filled': 'Wave body',
  'wave-bars': 'Wave bars',
  'wave-mirror': 'Wave mirror',
  'wave-dots': 'Wave beads',
  'wave-ribbon': 'Wave ribbon',
  'wave-spikes': 'Wave spikes',
  'wave-blocks': 'Wave ladder',
  'wave-outline': 'Wave outline',
  'wave-lattice': 'Wave lattice',
};

export const nextGraphStyle = (style: GraphStyle): GraphStyle => {
  const index = GRAPH_STYLES.indexOf(style);
  return GRAPH_STYLES[(index + 1) % GRAPH_STYLES.length] ?? 'line';
};

/** Whether a style is painted rather than stroked, so the caller can say so. */
const STROKED_STYLES = new Set<GraphStyle>([
  'line',
  'steps',
  'dashes',
  'ribs',
  'weave',
  'contour',
  'hatch',
  'bezier',
  'feather',
  'truss',
  'zipper',
  'slope',
  'ecg',
  'echo',
  'starfield',
  'rain',
  'braid',
  'stitch',
  'wave-line',
  'wave-outline',
  'wave-lattice',
]);

export const isFilledGraphStyle = (style: GraphStyle): boolean =>
  !STROKED_STYLES.has(style);

/**
 * How a form is coloured, which is the second half of what makes a look.
 *
 * Kept separate from the shape rather than written into it, because the two
 * are genuinely independent — every form reads differently in the signal
 * colour and in the spectrum, and pairing them as forty flat entries would
 * mean forty pieces of geometry where twenty and a flag will do.
 *
 * `signal` is the trace's own colour, one hue for the whole figure.
 *
 * The other two are gradients, and they differ in which axis they run along —
 * which is to say, in what the colour actually tells you:
 *
 *  - `rainbow` runs across the frequency axis, so a bar's colour says where in
 *    the range it sits. Colour is position; a bar never changes hue.
 *  - `level` runs up the decibel axis, so a bar's colour says how loud it is.
 *    Colour is the signal, and a bar reddens as it grows.
 *
 * Both are painted from a gradient pinned to the plot rather than to the
 * figure, which is the whole reason `level` means anything: tied to the shape's
 * own bounding box the top of every bar would be the same red whether it was
 * the loudest thing on screen or barely off the floor.
 */
/**
 * `heat` is the fourth and the only one that is not a gradient.
 *
 * The other three colour a figure by WHERE something is — one hue for all of
 * it, a ramp across the axis, a ramp up it — so a given pixel keeps its
 * colour whatever the music does. Heat colours the whole drawing by HOW LOUD
 * it is: one colour at a time, cool through green and amber to red, moving
 * with the level rather than with the geometry.
 *
 * Which makes it the only palette you can read from across the room without
 * looking at the shape at all, and the reason `level` did not have to become
 * it: level is still the meter ramp, and a meter ramp and a mood ring are two
 * different instruments.
 */
export type GraphPalette = 'signal' | 'rainbow' | 'level' | 'heat';

export const GRAPH_PALETTES: GraphPalette[] = [
  'signal',
  'rainbow',
  'level',
  'heat',
];

export const GRAPH_PALETTE_LABELS: Record<GraphPalette, string> = {
  signal: '',
  rainbow: 'rainbow',
  level: 'level',
  heat: 'heat',
};

/**
 * The colour heat shows at a given loudness, 0 at the floor to 1 at the top.
 *
 * The meter ramp, as a hue: cyan at rest, down through green and amber to
 * red. Shared so the trace, the icon and the fluid's bars all read the same
 * loudness as the same colour — three places disagreeing about that would be
 * three different instruments wearing one name.
 */
export const heatHue = (level: number) =>
  190 - Math.max(0, Math.min(1, level)) * 190;

/** One selectable look: a form and how it is coloured. */
export interface IGraphLook {
  id: string;
  style: GraphStyle;
  palette: GraphPalette;
  label: string;
}

/**
 * Every combination, in a stable order.
 *
 * Generated rather than listed, so adding a form adds its whole row and no
 * entry can be forgotten or duplicated.
 */
/**
 * The id a form takes under a palette.
 *
 * One function rather than the rule written out wherever it is needed. The
 * signal palette leaves the id bare, which is what makes a form's own name
 * the id somebody's settings were saved under before palettes existed.
 */
export const graphLookId = (style: GraphStyle, palette: GraphPalette) =>
  palette === 'signal' ? style : `${style}-${palette}`;

export const GRAPH_LOOKS: IGraphLook[] = GRAPH_STYLES.flatMap((style) =>
  GRAPH_PALETTES.map((palette) => ({
    id: graphLookId(style, palette),
    style,
    palette,
    label: [GRAPH_STYLE_LABELS[style], GRAPH_PALETTE_LABELS[palette]]
      .filter(Boolean)
      .join(' · '),
  })),
);

/**
 * One entry per FORM, which is what a picker should list.
 *
 * `GRAPH_LOOKS` is every form times every palette, and two thirds of those
 * rows say nothing new about the drawing: Bars, Bars · rainbow and Bars ·
 * level are one figure with three fills. Listed in full it is a hundred and
 * forty-one rows to scroll and, worse, a hundred and forty-one steps for the
 * click-on-the-plot cycle — so flicking to the next FORM while listening
 * meant three clicks, or forty-seven to get back to where you started.
 *
 * The palette moves to a toggle beside the list. `GRAPH_LOOKS` stays exactly
 * as it was and remains the id space, so every stored preference keeps
 * resolving and nothing has to be migrated.
 */
export const GRAPH_FORM_LOOKS: IGraphLook[] = GRAPH_LOOKS.filter(
  (look) => look.palette === 'signal',
);

export const getGraphLook = (id: string): IGraphLook =>
  GRAPH_LOOKS.find((look) => look.id === id) ?? GRAPH_LOOKS[0];

/**
 * How each form moves.
 *
 * A form is not only a shape — the same spectrum reads completely differently
 * depending on how quickly the drawing chases it, and matching the motion to
 * the figure is most of what makes one look interesting rather than merely
 * different.
 *
 * Bars and blocks snap and hang, the way a level meter does, so a kick lands
 * as a step rather than a swell. A ridge is a landscape and moves like one,
 * slowly, because a hill that twitches is noise. Dots and caps float — quick
 * to rise so they mark the peak, slow to fall so the mark stays long enough to
 * read. The thin forms are nearly instantaneous, which is the
 * whole point of a form that thin.
 *
 * In milliseconds to halve the remaining distance.
 */
export interface IGraphBallistics {
  attackMs: number;
  releaseMs: number;
}

const DEFAULT_BALLISTICS: IGraphBallistics = { attackMs: 8, releaseMs: 28 };

const BALLISTICS: Partial<Record<GraphStyle, IGraphBallistics>> = {
  // Snap up, hang, drop away — a meter's manners.
  bars: { attackMs: 4, releaseMs: 45 },
  pillars: { attackMs: 4, releaseMs: 45 },
  blocks: { attackMs: 3, releaseMs: 60 },
  // Peak marks: they exist to be caught, so they fall slowly enough to see.
  caps: { attackMs: 2, releaseMs: 110 },
  dots: { attackMs: 5, releaseMs: 70 },
  scatter: { attackMs: 5, releaseMs: 70 },
  dashes: { attackMs: 4, releaseMs: 85 },
  // Thin forms can afford to be instant; there is no mass to them.
  ribs: { attackMs: 3, releaseMs: 30 },
  stems: { attackMs: 4, releaseMs: 40 },
  spikes: { attackMs: 3, releaseMs: 22 },
  crown: { attackMs: 4, releaseMs: 36 },
  // Landscapes. A hill that twitches is noise, so these are the slow ones.
  ridge: { attackMs: 22, releaseMs: 90 },
  terrace: { attackMs: 16, releaseMs: 70 },
  area: { attackMs: 12, releaseMs: 48 },
  // The staircase steps by nature; easing it hard would blur the treads.
  steps: { attackMs: 6, releaseMs: 26 },
  weave: { attackMs: 6, releaseMs: 30 },

  // More landscapes. A contour is drawn from where the level crosses a
  // threshold, so a jittery curve makes rings pop in and out of existence —
  // it is the slowest thing here on purpose.
  contour: { attackMs: 26, releaseMs: 95 },
  hatch: { attackMs: 18, releaseMs: 70 },
  bezier: { attackMs: 16, releaseMs: 55 },
  ribbon: { attackMs: 11, releaseMs: 46 },
  echo: { attackMs: 7, releaseMs: 140 },

  // Architecture. Buildings do not sway, so these are stiff going up and slow
  // coming down — the skyline should look built, not blown about.
  skyline: { attackMs: 5, releaseMs: 72 },
  truss: { attackMs: 7, releaseMs: 32 },
  matrix: { attackMs: 3, releaseMs: 66 },
  sawtooth: { attackMs: 4, releaseMs: 40 },

  // Things that hang, fall or float have gravity in them: quick to appear,
  // reluctant to leave.
  stalactites: { attackMs: 9, releaseMs: 120 },
  bubbles: { attackMs: 3, releaseMs: 92 },
  diamonds: { attackMs: 4, releaseMs: 78 },

  // The pulse is a heartbeat. One that arrives late is not a heartbeat, so it
  // is the fastest of the lot in both directions.
  ecg: { attackMs: 1, releaseMs: 12 },
  // A slope field draws the direction the spectrum is moving in. Smooth it and
  // it starts pointing at where the music was, which is worse than useless.
  slope: { attackMs: 3, releaseMs: 18 },
  feather: { attackMs: 4, releaseMs: 34 },
  zipper: { attackMs: 4, releaseMs: 26 },

  // The arcade. These are toys, and toys have physics: the runner pops off the
  // ground on a kick and comes down under its own weight, the aliens hover
  // rather than twitch, the warp streaks are as immediate as the pulse, and
  // the bricks behave like the level meter they secretly are.
  racer: { attackMs: 6, releaseMs: 42 },
  invaders: { attackMs: 6, releaseMs: 85 },
  starfield: { attackMs: 3, releaseMs: 26 },

  // Meters with a body to them. A candle and a barcode stripe are both read by
  // their size rather than their outline, so they keep the level meter's
  // manners: snap to the peak, hang, drop away.
  candles: { attackMs: 4, releaseMs: 50 },
  barcode: { attackMs: 4, releaseMs: 44 },

  // Rounded forms swell rather than snap. An arch that jumped would stop
  // reading as an arch and start reading as a bar with a curved lid.
  arches: { attackMs: 7, releaseMs: 52 },

  // Fire is the quickest thing here after the pulse, and has to be: a flame
  // that eases into position is a balloon.
  flames: { attackMs: 3, releaseMs: 30 },

  // Weather. Rain falls at its own speed no matter what the music does, so the
  // release is long — the drops thin out gradually rather than stopping dead.
  rain: { attackMs: 4, releaseMs: 96 },

  // Things built out of stacked pieces, which is the same argument the dot
  // matrix and the LED blocks make: the eye is counting cells, and a cell that
  // flickers on the boundary is a miscount.
  honeycomb: { attackMs: 4, releaseMs: 68 },
  fence: { attackMs: 5, releaseMs: 58 },

  // A braid is a rope and a rope has mass. Slow enough that the strands stay
  // strands instead of blurring into a band.
  braid: { attackMs: 10, releaseMs: 44 },

  // Needlework does not hurry, and the marks are small enough that a fast
  // release would make them twinkle rather than settle.
  stitch: { attackMs: 5, releaseMs: 72 },

  // The negative space of a landscape, so it moves like one — the slowest of
  // the new forms, for the same reason the ridge and the contour are slow.
  canyon: { attackMs: 15, releaseMs: 82 },
  // Slow, and on purpose. These are the ballistics of the SPECTRUM half
  // only — the level rule over it is drawn from the waveform and is not
  // eased here at all, so a lazy body underneath is what lets the rule's
  // own speed be visible as speed rather than as both halves twitching.
  fluid: { attackMs: 14, releaseMs: 60 },
  // The titlebar family. Quick, because what these draw is a wave and a
  // wave that lags reads as syrup — the same reason the titlebar runs them
  // fast. One pair for all ten, which is what makes them a family.
  'wave-line': { attackMs: 5, releaseMs: 34 },
  'wave-filled': { attackMs: 5, releaseMs: 34 },
  'wave-bars': { attackMs: 5, releaseMs: 34 },
  'wave-mirror': { attackMs: 5, releaseMs: 34 },
  'wave-dots': { attackMs: 5, releaseMs: 34 },
  'wave-ribbon': { attackMs: 5, releaseMs: 34 },
  'wave-spikes': { attackMs: 5, releaseMs: 34 },
  'wave-blocks': { attackMs: 5, releaseMs: 34 },
  'wave-outline': { attackMs: 5, releaseMs: 34 },
  'wave-lattice': { attackMs: 5, releaseMs: 34 },
};

export const getGraphBallistics = (style: GraphStyle): IGraphBallistics =>
  BALLISTICS[style] ?? DEFAULT_BALLISTICS;

/** A point already in pixels. */
export type Projected = readonly [number, number];

export const rect = (x: number, y: number, width: number, height: number) =>
  `M ${x.toFixed(1)},${y.toFixed(1)} h ${width.toFixed(1)} v ${height.toFixed(
    1,
  )} h ${(-width).toFixed(1)} Z`;

/**
 * The same rectangle wound the other way round, which makes it a hole.
 *
 * Under the non-zero fill rule a subpath that runs counter to the shape it sits
 * inside cancels it out rather than painting over it, so a window punched this
 * way shows the chart behind the building rather than a darker patch of
 * building. Written as a separate helper because the only difference is the
 * order of the sides, and that is exactly the kind of detail that gets
 * "tidied" back into `rect` by someone who has not seen what it does.
 */
export const hole = (x: number, y: number, width: number, height: number) =>
  `M ${x.toFixed(1)},${y.toFixed(1)} v ${height.toFixed(1)} h ${width.toFixed(
    1,
  )} v ${(-height).toFixed(1)} Z`;

/**
 * How many columns the discrete styles get.
 *
 * The live curve carries 320 points, which is right for a curve and wrong for
 * bars twice over. It is slow — 320 rectangles is a path string several times
 * longer than the polyline it replaces, rebuilt on every animation frame — and
 * it does not even look like bars, because at that density they touch and read
 * as a filled area with a ragged top.
 *
 * Sixty-four is about the width of a finger on this pane: individually visible,
 * and a fifth of the string to build.
 */
const COLUMN_COUNT = 64;

/**
 * Forms that want a different density.
 *
 * Sixty-four is right for bars and far too many for buildings: a skyline of
 * sixty-four towers is a fence. Anything that stacks pieces up its column also
 * has to be counted twice over — a chevron every ten pixels across sixty-four
 * columns is two thousand marks in one path string, rebuilt every frame — so
 * the ornate forms are given fewer, larger columns and the sparse ones more.
 */
const COLUMN_OVERRIDES: Partial<Record<GraphStyle, number>> = {
  skyline: 26,
  truss: 22,
  ecg: 26,
  matrix: 40,
  bubbles: 40,
  zipper: 40,
  sawtooth: 40,
  feather: 44,
  slope: 44,
  diamonds: 48,
  stalactites: 52,
  // The arcade forms are drawn as sprites, and a sprite squeezed into a
  // six-pixel column is a smudge. Fewer, bigger.
  invaders: 20,
  starfield: 40,

  // Anything with an inside needs room to show it. A hexagon under about ten
  // pixels across is a blob, an arch is a bump, and a flame with no width to
  // taper over is a spike.
  honeycomb: 30,
  arches: 40,
  flames: 34,
  candles: 40,

  // A barcode is the opposite argument: the whole read is many thin stripes of
  // varying width, and at sixty-four it stops looking like one.
  barcode: 56,

  fence: 46,
  rain: 44,
  stitch: 38,

  /**
   * The fluid is the dense one, and its default has to be a real number.
   *
   * The titlebar draws this form at a bar every eleven pixels, which is a
   * rule rather than a count and cannot be written here — this table is read
   * without knowing how wide the plot is. On a typical graph pane that rule
   * lands near a hundred and thirty, so that is what it starts at: close
   * enough that the shipped look matches the titlebar, and an ordinary
   * number the Pieces control can move like any other form's.
   */
  fluid: 128,

  /**
   * The wave family's own band count, which is the titlebar's forty-eight.
   *
   * Here rather than as a constant in the shape module so there is one
   * answer to "how many pieces is this form": the designer reads it to seed
   * the control, and the drawing reads it when nobody has said otherwise.
   * Two answers is how a form ends up drawn at one density and reported at
   * another.
   */
  'wave-bars': 48,
  'wave-mirror': 48,
  'wave-dots': 48,
  'wave-spikes': 48,
  'wave-blocks': 48,
  'wave-outline': 48,
  'wave-lattice': 48,
};

export const getColumnCount = (style: GraphStyle) =>
  COLUMN_OVERRIDES[style] ?? COLUMN_COUNT;

/**
 * The density a form was drawn for, for anything that wants to offer it back.
 *
 * The table above is the author's answer to "how many pieces should this form
 * be made of", arrived at by looking at it. A custom look starts from that
 * answer rather than from a number somebody had to guess, so exposing it is
 * what makes tuning a form feel like adjusting it rather than rebuilding it.
 */
export const getGraphColumnCount = (style: GraphStyle): number =>
  getColumnCount(style);

/**
 * How solid a form's fill starts out, where the shared default is wrong.
 *
 * Most forms want the translucent fill the designer defaults to — it is what
 * lets the grid and the EQ curves stay legible under them. The fluid does
 * not: its bars carry their own per-bar alpha ramp, from a light top to an
 * almost-clear foot, and dimming that by a further 55% left a drawing that is
 * meant to match the titlebar's noticeably fainter than it.
 *
 * A table rather than a check, so the next form that needs its own answer is
 * a line here rather than a branch somewhere.
 */
const FILL_OPACITY_OVERRIDES: Partial<Record<GraphStyle, number>> = {
  /**
   * Brighter than the shared default and dimmer than solid.
   *
   * At the designer's 0.55 these were noticeably fainter than the titlebar's,
   * because the bars carry their own ramp from a light top to an almost-clear
   * foot and that was being dimmed twice. At 1 they were too lit: the same
   * alpha over a plot several times the titlebar's size is a great deal more
   * light on screen, and the bars stopped sitting behind the curves they are
   * supposed to sit behind.
   */
  fluid: 0.7,
};

/**
 * How much of a column each form leaves empty, by default.
 *
 * Zero is bars that touch, which is what the setting has to mean — a gap of
 * none is no gap. The widths these forms were drawn at are gaps of their own,
 * so they live here as starting positions rather than being baked into the
 * geometry: bars were 62% of the column, pillars 96%, skyline 88%.
 */
const BAR_GAP_DEFAULTS: Partial<Record<GraphStyle, number>> = {
  bars: 0.38,
  blocks: 0.38,
  pillars: 0.04,
  skyline: 0.12,
};

export const getGraphBarGap = (style: GraphStyle): number =>
  BAR_GAP_DEFAULTS[style] ?? 0;

export const getGraphFillOpacity = (
  style: GraphStyle,
  fallback: number,
): number => FILL_OPACITY_OVERRIDES[style] ?? fallback;

/** The forms drawn one piece per column rather than as a continuous figure. */
export const DISCRETE_STYLES = new Set<GraphStyle>([
  /**
   * The fluid belongs here, and the designer is why it matters.
   *
   * Pieces is disabled for anything this set does not name, so leaving it
   * out greyed the control out on a form that is one bar per column and
   * reads `columns` every frame — the setting worked and could not be
   * reached.
   *
   * The wave forms that read frequency bands are here for the same reason:
   * they are made of pieces and the density reaches them. The three that are
   * not — line, body and ribbon — draw one continuous figure from the
   * waveform, so the control stays greyed out on those.
   */
  'fluid',
  'wave-bars',
  'wave-mirror',
  'wave-dots',
  'wave-spikes',
  'wave-blocks',
  'wave-outline',
  'wave-lattice',
  'bars',
  'dots',
  'blocks',
  'spikes',
  'stems',
  'dashes',
  'scatter',
  'caps',
  'ribs',
  'pillars',
  'crown',
  'matrix',
  'skyline',
  'feather',
  'truss',
  'zipper',
  'slope',
  'stalactites',
  'bubbles',
  'diamonds',
  'sawtooth',
  'ecg',
  'invaders',
  'starfield',
  'candles',
  'arches',
  'flames',
  'barcode',
  'rain',
  'honeycomb',
  'fence',
  'stitch',
]);

/**
 * Whether a form is made of separate pieces, one per band.
 *
 * The distinction matters to anything offering the density as a setting: a
 * line, an area or a contour keeps all three hundred and twenty points and has
 * no columns to count, so a density slider on one of those would be a control
 * that visibly does nothing.
 */
export const isDiscreteGraphStyle = (style: GraphStyle): boolean =>
  DISCRETE_STYLES.has(style);

/**
 * How few and how many pieces a form may be broken into.
 *
 * The floor is where columns stop reading as a spectrum and start reading as a
 * bar chart of nothing in particular; the ceiling is where they touch and the
 * figure turns back into the filled area that `toColumns` exists to avoid.
 * Both are wider than any built-in form uses, because the point of the setting
 * is to go somewhere the built-ins do not.
 */
export const MIN_GRAPH_COLUMNS = 8;
export const MAX_GRAPH_COLUMNS = 160;

/**
 * A column count that `toColumns` can safely be handed.
 *
 * Applied at the drawing end as well as when a look is saved, because this is
 * the one tuning value that can turn a bad number into a broken loop rather
 * than an ugly picture: a count of zero divides by zero and a fractional one
 * walks off the end of the buffer.
 */
export const clampGraphColumns = (columns: number): number =>
  Number.isFinite(columns)
    ? Math.min(
        MAX_GRAPH_COLUMNS,
        Math.max(MIN_GRAPH_COLUMNS, Math.round(columns)),
      )
    : COLUMN_COUNT;
