export {
  DISCRETE_STYLES,
  MAX_GRAPH_COLUMNS,
  MIN_GRAPH_COLUMNS,
  canGraphFill,
  canGraphGlow,
  clampGraphColumns,
  getColumnCount,
  getGraphBallistics,
  getGraphBarGap,
  getGraphColumnCount,
  getGraphFillOpacity,
  hasGraphGap,
  isDiscreteGraphStyle,
} from './graphStyleForms';
export type { IGraphBallistics } from './graphStyleForms'; /*
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
  // The measuring views. Drawn by `renderer/graph/analysis`, not from this
  // file's geometry — see `common/graphAnalysis.ts` for what they are.
  | 'analyzer'
  | 'compare'
  | 'spectrogram'
  | 'rta'
  | 'average'
  | 'waterfall'
  | 'loudness'
  | 'scope'
  | 'midside'
  | 'notes'
  | 'energy'
  | 'phase'
  | 'ledwall'
  | 'towers'
  | 'tide'
  | 'halo'
  | 'synthwave'
  | 'ledbars'
  | 'neonbars'
  | 'bars3d'
  | 'spectrumwave'
  | 'silkwaves'
  | 'mirrorbars'
  | 'pixelbars'
  | 'sparkbars'
  | 'glitchbars'
  | 'halftone'
  | 'bouncedots'
  | 'fallblocks'
  | 'fibers'
  | 'afterglow'
  | 'horizon'
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
  /**
   * The measuring views lead, and the twenty plain forms behind them were
   * retired on 2026-09-23 (Ivan: "we have lot of crappy and non useful
   * visualizers, we want to kind of start from zero"). The cycle order is
   * normally append-only because people learn their favourite by counting
   * clicks; that argument dies with the forms those clicks landed on.
   */
  'analyzer',
  'compare',
  'spectrogram',
  'rta',
  'average',
  'waterfall',
  'loudness',
  // The second batch: four quick ones and the mastering pair, each reading
  // an axis none of the seven above does.
  'scope',
  'midside',
  'notes',
  'energy',
  'phase',
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
  // The drawn scenes, after the eight they are filed with
  // (`graphSceneViews.ts`), and the plain spectrums after them.
  'ledwall',
  'towers',
  'tide',
  'halo',
  'synthwave',
  'ledbars',
  'neonbars',
  'bars3d',
  'spectrumwave',
  'silkwaves',
  'mirrorbars',
  'pixelbars',
  'sparkbars',
  'glitchbars',
  'halftone',
  'bouncedots',
  'fallblocks',
  'fibers',
  'afterglow',
  'horizon',
];

/**
 * What the picker offers instead, for a form that is no longer in it.
 *
 * Every retired form still DRAWS — a look somebody saved on one keeps its
 * figure for good, and nothing here is deleted geometry. This table only
 * decides two things: which entries the picker lists, and where a built-in
 * selection lands when the form it named has gone.
 *
 * The plain forms went on 2026-09-23, all twenty of them, when the measuring
 * views took their place: Ivan asked to "remove all other standard
 * vizualuser and start building all these new". What stayed is the eight
 * scenes he designed one at a time — Terrace, Skyline, Truss, Slope field,
 * Echo, Bubbles, Pulse, Invaders — because those are pictures rather than
 * readings and the new views replace readings.
 *
 * Each lands on the view that answers the question it was being used to ask:
 * a trace or a body on the Analyzer, a row of pieces on the RTA.
 */
const RETIRED: Partial<Record<GraphStyle, GraphStyle>> = {
  // Traces and bodies: the filled spectrum with its peak hold.
  line: 'analyzer',
  area: 'analyzer',
  ridge: 'analyzer',
  ribbon: 'analyzer',
  contour: 'analyzer',
  hatch: 'analyzer',
  weave: 'analyzer',
  bezier: 'analyzer',
  feather: 'analyzer',
  zipper: 'analyzer',
  stitch: 'analyzer',
  sawtooth: 'analyzer',
  fluid: 'analyzer',
  'wave-line': 'analyzer',
  'wave-outline': 'analyzer',
  'wave-filled': 'analyzer',
  'wave-ribbon': 'analyzer',
  'wave-lattice': 'analyzer',
  // The mirrored wave: the graph mirrors any form on its own, from the menu.
  'wave-mirror': 'analyzer',
  // Rows of pieces across the axis: the third-octave analyser.
  bars: 'rta',
  dots: 'rta',
  steps: 'rta',
  blocks: 'rta',
  spikes: 'rta',
  stems: 'rta',
  dashes: 'rta',
  scatter: 'rta',
  caps: 'rta',
  crown: 'rta',
  diamonds: 'rta',
  ribs: 'rta',
  pillars: 'rta',
  candles: 'rta',
  barcode: 'rta',
  matrix: 'rta',
  honeycomb: 'rta',
  fence: 'rta',
  arches: 'rta',
  flames: 'rta',
  'wave-bars': 'rta',
  'wave-dots': 'rta',
  'wave-spikes': 'rta',
  'wave-blocks': 'rta',
  // Scenes dropped before this round, each for its own reason at the time:
  // the cave, the night road, the storm, the gorge and hyperspace.
  stalactites: 'analyzer',
  racer: 'analyzer',
  rain: 'analyzer',
  canyon: 'analyzer',
  starfield: 'analyzer',
  // Two of the plain spectrums, taken out on 2026-09-28 (Ivan: "remove silk
  // waves", "and mirror bars"), each onto the living one nearest it: the
  // flowing waves onto Spectrum wave, the bars grown both ways from the
  // middle onto the LED bars — the graph still mirrors any form from its
  // menu.
  silkwaves: 'spectrumwave',
  mirrorbars: 'ledbars',
};

export const canonicalGraphStyle = (style: GraphStyle): GraphStyle =>
  RETIRED[style] ?? style;
export const SELECTABLE_GRAPH_STYLES = GRAPH_STYLES.filter(
  (style) => canonicalGraphStyle(style) === style,
);

/**
 * Human names for the picker.
 *
 * Written out rather than generated from the key, because "terrace" and
 * "crown" mean nothing on their own — the list is chosen by eye and the
 * label is what somebody searches.
 */
export const GRAPH_STYLE_LABELS: Record<GraphStyle, string> = {
  analyzer: 'Analyzer',
  compare: 'Before & after',
  spectrogram: 'Spectrogram',
  rta: 'Third-octave RTA',
  average: 'Peak & average',
  waterfall: 'Waterfall',
  loudness: 'Stereo & loudness',
  scope: 'Oscilloscope',
  midside: 'Mid & side',
  notes: 'Note spectrum',
  energy: 'Energy bands',
  phase: 'Phase history',
  ledwall: 'LED wall',
  towers: 'Glass towers',
  tide: 'Tide',
  halo: 'Halo',
  synthwave: 'Synthwave',
  ledbars: 'LED bars',
  neonbars: 'Neon bars',
  bars3d: '3D bars',
  spectrumwave: 'Spectrum wave',
  silkwaves: 'Silk waves',
  mirrorbars: 'Mirror bars',
  pixelbars: 'Pixel bars',
  sparkbars: 'Spark bars',
  glitchbars: 'Glitch bars',
  halftone: 'Halftone',
  bouncedots: 'Bouncing dots',
  fallblocks: 'Falling blocks',
  fibers: 'Fiber optics',
  afterglow: 'Afterglow',
  horizon: 'Horizon',
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
  flames: 'Dancing flames',
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
  const index = SELECTABLE_GRAPH_STYLES.indexOf(canonicalGraphStyle(style));
  return (
    SELECTABLE_GRAPH_STYLES[(index + 1) % SELECTABLE_GRAPH_STYLES.length] ??
    'line'
  );
};

/** Whether a style is painted rather than stroked, so the caller can say so. */
/**
 * Echo is not here on purpose. It is a sea of waves receding to a
 * horizon, and the water wants a body: stroked, the rows read as a stack
 * of wires, and the same scene filled reads as distance.
 */
const STROKED_STYLES = new Set<GraphStyle>([
  'line',
  'steps',
  'dashes',
  'weave',
  'hatch',
  'bezier',
  'feather',
  'zipper',
  'slope',
  'ecg',
  // The bridge: an open truss over water with wireframe cars, which is
  // the design; filled only makes its posts solid.
  'truss',
  'starfield',
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
/**
 * `auto` is the fifth and the only one that is not a colouring at all: it
 * says "whatever this form looks best in". A road is lit by loudness and a
 * row of bars by position, and a toggle that painted both the same way
 * always had one of them wrong. Under auto every form resolves to its own
 * palette through `resolveGraphPalette`, and nothing downstream ever sees
 * the word: painters, icons and the designer all resolve first.
 */
export type GraphPalette = 'signal' | 'rainbow' | 'level' | 'heat' | 'auto';

export const GRAPH_PALETTES: GraphPalette[] = [
  'signal',
  'rainbow',
  'level',
  'heat',
  'auto',
];

export const GRAPH_PALETTE_LABELS: Record<GraphPalette, string> = {
  signal: '',
  rainbow: 'rainbow',
  level: 'level',
  heat: 'heat',
  auto: 'auto',
};

/** A concrete palette, never `auto`. */
export type ResolvedGraphPalette = Exclude<GraphPalette, 'auto'>;

/**
 * What each form is painted in under auto, decided by what the form IS.
 *
 * A spectrum of pieces spread across the axis — bars, dots, spikes — is
 * coloured by where each piece sits, which is what a frequency ramp says.
 * A meter reads its loudness up the axis — an LED ladder, a filled area, a
 * terrain of contours or strata — and that is the level ramp. A single
 * trace on a scope or a monitor, a silhouette, a structure, is one colour,
 * because that is what the real thing is. A scene lit by how hard the
 * music is playing — fire, a road at night — takes heat, one colour for
 * the whole picture that moves with the loudness. Listed in full rather
 * than derived, because this is taste and taste is not a rule.
 */
const OWN_PALETTES: Record<GraphStyle, ResolvedGraphPalette> = {
  /**
   * The measuring views. A reading is coloured by what it is reading: the
   * spectrum views run the level ramp up the axis, so height and colour say
   * the same thing twice and a peak is unmistakable; the spectrogram and the
   * waterfall are rasters whose whole content IS the ramp; and the stereo
   * meters are instruments, one colour, because a moving needle that also
   * changes hue is two readings fighting.
   */
  analyzer: 'level',
  compare: 'level',
  spectrogram: 'level',
  rta: 'level',
  average: 'level',
  waterfall: 'level',
  loudness: 'signal',
  /**
   * The second batch. A scope is a beam and a beam is one colour; the note
   * spectrum and the energy bands are read by WHERE a piece sits, so they
   * take the ramp across the axis; mid and side are two spectra and take the
   * level ramp like the rest of them; the phase history is a raster whose
   * whole content is the ramp.
   */
  scope: 'signal',
  notes: 'rainbow',
  energy: 'rainbow',
  midside: 'level',
  phase: 'level',
  /**
   * The drawn scenes. Under Auto each is painted in the window's colours
   * (`windowInk.ts`), laid the way this says: a board's lamps and an
   * LED column up the axis, like the sea's depth; glass, bars, waves, the
   * halo and a synthwave skyline across it, bass to treble.
   */
  ledwall: 'level',
  towers: 'rainbow',
  tide: 'level',
  halo: 'rainbow',
  synthwave: 'rainbow',
  ledbars: 'level',
  neonbars: 'rainbow',
  bars3d: 'rainbow',
  spectrumwave: 'rainbow',
  silkwaves: 'level',
  mirrorbars: 'rainbow',
  pixelbars: 'level',
  sparkbars: 'level',
  glitchbars: 'rainbow',
  halftone: 'level',
  bouncedots: 'rainbow',
  fallblocks: 'level',
  fibers: 'rainbow',
  afterglow: 'rainbow',
  // Every bar through the colours from its foot to its head.
  horizon: 'level',
  // Traces and silhouettes: one colour.
  line: 'signal',
  ridge: 'signal',
  weave: 'signal',
  bezier: 'signal',
  ribbon: 'signal',
  feather: 'signal',
  zipper: 'signal',
  truss: 'signal',
  sawtooth: 'signal',
  ecg: 'signal',
  // Hyperspace: the tunnel's streaks coloured by where they fly.
  starfield: 'rainbow',
  barcode: 'signal',
  // The storm: the cloud bank, dark at its base and pale at its tops.
  rain: 'level',
  // The countryside: weathered wood, a ramp from the foot of a picket up.
  fence: 'level',
  // The night city: concrete, lighter where the street light reaches it
  // and near black at the roofline. The spectrum is in the heights and in
  // the lit windows, so the towers themselves can be towers.
  skyline: 'level',
  'wave-line': 'signal',
  'wave-mirror': 'signal',
  'wave-ribbon': 'signal',
  'wave-outline': 'signal',
  // Pieces across the axis: coloured by where they sit.
  bars: 'rainbow',
  dots: 'rainbow',
  steps: 'rainbow',
  spikes: 'rainbow',
  stems: 'rainbow',
  dashes: 'rainbow',
  scatter: 'rainbow',
  caps: 'rainbow',
  ribs: 'rainbow',
  pillars: 'rainbow',
  crown: 'rainbow',
  hatch: 'rainbow',
  matrix: 'rainbow',
  slope: 'rainbow',
  bubbles: 'rainbow',
  diamonds: 'rainbow',
  invaders: 'rainbow',
  // The aqueduct: the evening sky through the arches, a ramp up from the
  // horizon.
  arches: 'level',
  honeycomb: 'rainbow',
  braid: 'rainbow',
  stitch: 'rainbow',
  fluid: 'rainbow',
  'wave-bars': 'rainbow',
  'wave-dots': 'rainbow',
  'wave-spikes': 'rainbow',
  'wave-lattice': 'rainbow',
  // Meters and terrain: the level ramp up the axis.
  area: 'level',
  blocks: 'level',
  terrace: 'level',
  contour: 'level',
  echo: 'level',
  candles: 'level',
  canyon: 'level',
  // The cave: the ramp lights the tips a different colour from the roots.
  stalactites: 'level',
  'wave-filled': 'level',
  'wave-blocks': 'level',
  // A scene lit by the music: one colour that moves with the loudness.
  // The fire: a ramp from the white-hot base to the red tips.
  flames: 'level',
  // A city at night: its windows light up with the music.

  // The road at night reads its ground by the level ramp: dark at the
  // foot, lit at the ridge, brighter as the music climbs.
  racer: 'level',
};

/** The palette a form is actually painted in: `auto` becomes its own. */
export const resolveGraphPalette = (
  style: GraphStyle,
  palette: GraphPalette,
): ResolvedGraphPalette => (palette === 'auto' ? OWN_PALETTES[style] : palette);

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
  (look) =>
    look.palette === 'signal' && canonicalGraphStyle(look.style) === look.style,
);

/**
 * What a machine that has never been told otherwise draws.
 *
 * The Analyzer, because it is the one drawing on this pane that a person can
 * act on without being told anything: the spectrum of what is playing,
 * tipped so a balanced record reads level, with a peak hold above it. It is
 * also the picture the EQ curve is meant to be read against, so the two
 * halves of the plot say one thing on first launch rather than introducing
 * the product with an ornament over a measurement.
 *
 * Named rather than positional. This was `GRAPH_LOOKS[0]` in five places,
 * which is not a choice — it is whichever form happens to be written first in
 * the cycle order, and that order is a list people append to.
 *
 * Under the auto colouring, so that the two-minute cycle a fresh install
 * runs shows every form in its own colours rather than all of them flat.
 */
export const DEFAULT_GRAPH_LOOK_ID = graphLookId('analyzer', 'auto');

export const DEFAULT_GRAPH_LOOK: IGraphLook =
  GRAPH_LOOKS.find((look) => look.id === DEFAULT_GRAPH_LOOK_ID) ??
  GRAPH_LOOKS[0];

export const getGraphLook = (id: string): IGraphLook =>
  GRAPH_LOOKS.find((look) => look.id === id) ?? DEFAULT_GRAPH_LOOK;

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
