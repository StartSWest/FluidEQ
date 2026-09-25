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
  braid: 'analyzer',
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
   * The drawn scenes. Under Auto each is painted in its own colours
   * (`SCENE_OWN_COLOURS`), laid the way this says: a board's lamps and an
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

const DEFAULT_BALLISTICS: IGraphBallistics = { attackMs: 10, releaseMs: 90 };

const BALLISTICS: Partial<Record<GraphStyle, IGraphBallistics>> = {
  /**
   * The measuring views keep an instrument's manners: catch the transient,
   * let go slowly enough to read. A spectrum analyser that falls as fast as
   * it rises shows a peak to nobody — the eye is still arriving.
   *
   * The spectrogram is the exception and has to be: every row it prints is a
   * moment, and smoothing the reading before printing it would smear the
   * picture in the one direction the picture is about.
   */
  /**
   * A spectrum analyser follows peaks up and lets them down slowly: the
   * attack is as near instant as this graph can be, and the release is the
   * part everybody tunes. A studio analyser's display falls at about twenty
   * decibels a second, which on this eighty-decibel plot is a half-life near
   * eight hundred milliseconds — the first numbers here were a third of
   * that, which looks lively and is not what these views are for.
   *
   * The third-octave analyser is slower again, because an RTA is read as a
   * steady state rather than watched: it is the display somebody sets a room
   * curve by, and a band that is still moving cannot be matched to a target.
   */
  analyzer: { attackMs: 3, releaseMs: 360 },
  compare: { attackMs: 5, releaseMs: 360 },
  rta: { attackMs: 1, releaseMs: 400 },
  average: { attackMs: 3, releaseMs: 300 },
  /**
   * The two that print history keep the quick numbers, and have to: every
   * row of the spectrogram and every slice of the waterfall is a MOMENT, and
   * smoothing a reading before printing it smears the picture in the one
   * direction the picture is about.
   */
  spectrogram: { attackMs: 2, releaseMs: 40 },
  waterfall: { attackMs: 4, releaseMs: 120 },
  loudness: { attackMs: 1, releaseMs: 160 },
  /**
   * The quick ones. The first seven are studio-slow on purpose; these are
   * what Ivan asked for beside them ("some of them more fast"), and each is
   * quick for a reason rather than for effect: a scope draws the samples
   * themselves, a note has to appear the instant it is played, a band meter
   * is read like every other meter, and a phase history prints a moment per
   * row. Mid & side is the exception and keeps the Analyzer's manners,
   * because it is read against it.
   */
  scope: { attackMs: 1, releaseMs: 60 },
  notes: { attackMs: 2, releaseMs: 150 },
  energy: { attackMs: 1, releaseMs: 200 },
  phase: { attackMs: 2, releaseMs: 80 },
  /**
   * The drawn scenes move like the things they are: lamps snap on and let
   * go quickly, glass is a little heavier, the sea is slow both ways, and
   * the halo and the skyline sit between.
   */
  ledwall: { attackMs: 3, releaseMs: 240 },
  towers: { attackMs: 8, releaseMs: 220 },
  // The slowest release the style editor offers: a default past its slider
  // is one the look editor can never put back.
  tide: { attackMs: 45, releaseMs: 400 },
  halo: { attackMs: 6, releaseMs: 200 },
  synthwave: { attackMs: 14, releaseMs: 300 },
  // A segment board snaps like the lamps; bars carry a little weight; the
  // waves are strokes of a brush, slower both ways.
  ledbars: { attackMs: 2, releaseMs: 260 },
  neonbars: { attackMs: 6, releaseMs: 220 },
  bars3d: { attackMs: 8, releaseMs: 240 },
  spectrumwave: { attackMs: 10, releaseMs: 260 },
  silkwaves: { attackMs: 18, releaseMs: 320 },
  mirrorbars: { attackMs: 5, releaseMs: 220 },
  pixelbars: { attackMs: 2, releaseMs: 240 },
  sparkbars: { attackMs: 3, releaseMs: 220 },
  glitchbars: { attackMs: 3, releaseMs: 200 },
  halftone: { attackMs: 8, releaseMs: 260 },
  bouncedots: { attackMs: 4, releaseMs: 240 },
  fallblocks: { attackMs: 4, releaseMs: 260 },
  fibers: { attackMs: 6, releaseMs: 220 },
  afterglow: { attackMs: 4, releaseMs: 260 },
  midside: { attackMs: 4, releaseMs: 360 },
  line: { attackMs: 12, releaseMs: 150 },
  // Snap up, hang, drop away — a meter's manners.
  bars: { attackMs: 1, releaseMs: 250 },
  pillars: { attackMs: 4, releaseMs: 45 },
  blocks: { attackMs: 8, releaseMs: 125 },
  // Peak marks: they exist to be caught, so they fall slowly enough to see.
  caps: { attackMs: 2, releaseMs: 110 },
  dots: { attackMs: 14, releaseMs: 160 },
  scatter: { attackMs: 12, releaseMs: 220 },
  dashes: { attackMs: 6, releaseMs: 210 },
  // Thin forms can afford to be instant; there is no mass to them.
  ribs: { attackMs: 8, releaseMs: 180 },
  stems: { attackMs: 1, releaseMs: 250 },
  spikes: { attackMs: 8, releaseMs: 250 },
  crown: { attackMs: 4, releaseMs: 36 },
  // Landscapes. A hill that twitches is noise, so these are the slow ones.
  ridge: { attackMs: 22, releaseMs: 90 },
  terrace: { attackMs: 24, releaseMs: 240 },
  area: { attackMs: 18, releaseMs: 145 },
  // The staircase steps by nature; easing it hard would blur the treads.
  steps: { attackMs: 10, releaseMs: 90 },
  weave: { attackMs: 16, releaseMs: 110 },

  // More landscapes. A contour is drawn from where the level crosses a
  // threshold, so a jittery curve makes rings pop in and out of existence —
  // it is the slowest thing here on purpose.
  contour: { attackMs: 24, releaseMs: 240 },
  hatch: { attackMs: 18, releaseMs: 70 },
  bezier: { attackMs: 16, releaseMs: 55 },
  ribbon: { attackMs: 11, releaseMs: 46 },
  echo: { attackMs: 7, releaseMs: 140 },

  // Architecture. Buildings do not sway, so these are stiff going up and slow
  // coming down — the skyline should look built, not blown about.
  skyline: { attackMs: 5, releaseMs: 72 },
  // Quick, so the bridge rides the music; the deck eases itself on top.
  truss: { attackMs: 20, releaseMs: 140 },
  matrix: { attackMs: 3, releaseMs: 66 },
  sawtooth: { attackMs: 4, releaseMs: 40 },

  // Things that hang, fall or float have gravity in them: quick to appear,
  // reluctant to leave.
  stalactites: { attackMs: 45, releaseMs: 320 },
  bubbles: { attackMs: 12, releaseMs: 190 },
  diamonds: { attackMs: 4, releaseMs: 78 },

  // Keep the attack readable without losing 85% of a pulse between 30Hz
  // frames. Slope follows spatial direction, not instantaneous velocity.
  ecg: { attackMs: 8, releaseMs: 110 },
  slope: { attackMs: 8, releaseMs: 220 },
  feather: { attackMs: 4, releaseMs: 34 },
  zipper: { attackMs: 12, releaseMs: 90 },

  // The arcade. These are toys, and toys have physics: the runner pops off the
  // ground on a kick and comes down under its own weight, the aliens hover
  // rather than twitch, the warp streaks are as immediate as the pulse, and
  // the bricks behave like the level meter they secretly are.
  // Quick enough for the car, the trees and the lights to answer a beat;
  // the hillside eases itself far slower on top of this — see roadTrip.
  racer: { attackMs: 30, releaseMs: 200 },
  invaders: { attackMs: 6, releaseMs: 85 },
  starfield: { attackMs: 20, releaseMs: 150 },

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
  flames: { attackMs: 8, releaseMs: 90 },

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
  // A quick attack with enough release for Fluid's body to remain readable.
  fluid: { attackMs: 14, releaseMs: 100 },
  // The wave family keeps a quick attack but rides out per-frame jitter.
  'wave-line': { attackMs: 12, releaseMs: 100 },
  'wave-filled': { attackMs: 12, releaseMs: 100 },
  'wave-bars': { attackMs: 8, releaseMs: 100 },
  'wave-mirror': { attackMs: 8, releaseMs: 100 },
  'wave-dots': { attackMs: 10, releaseMs: 110 },
  'wave-ribbon': { attackMs: 12, releaseMs: 100 },
  'wave-spikes': { attackMs: 8, releaseMs: 95 },
  'wave-blocks': { attackMs: 8, releaseMs: 110 },
  'wave-outline': { attackMs: 12, releaseMs: 100 },
  'wave-lattice': { attackMs: 10, releaseMs: 100 },
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
  /**
   * Third-octave, which is what the view is called: the plot spans 10 Hz to
   * 25 kHz, eleven and a third octaves, so thirty-four bands land on the
   * standard centres. Turning Pieces down walks it toward whole octaves and
   * up toward sixth- and twelfth-octave, which is the same ladder every RTA
   * offers — one control, no new row in the panel.
   */
  rta: 34,
  /**
   * Twelve to the octave across the plot's eleven and a third, which is one
   * bar per semitone — the whole point of the view. Pieces walks it from one
   * bar an octave up to quarter-tones.
   */
  notes: 136,
  /** Bass, low mid, mid, high mid, treble: the five a listener names. */
  energy: 5,
  /**
   * How many points survive into each slice of the waterfall. The history is
   * fifty-six slices deep, so this is ninety-six times fifty-six figures a
   * frame: fine enough to keep a narrow peak, coarse enough to stay inside
   * the frame budget on the slowest display this ships to.
   */
  waterfall: 96,
  dots: 48,
  blocks: 40,
  stems: 48,
  terrace: 32,
  dashes: 48,
  scatter: 48,
  skyline: 26,
  truss: 28,
  ecg: 26,
  matrix: 40,
  bubbles: 24,
  zipper: 40,
  sawtooth: 40,
  feather: 44,
  slope: 44,
  diamonds: 48,
  stalactites: 36,
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

  // Few enough that a stitch is a stitch. At the default sixty-four the
  // swings are still closer together than they are deep, which reads as a
  // ripple rather than as a thread crossing a line.
  weave: 30,

  fence: 46,
  rain: 44,
  stitch: 38,

  /**
   * The titlebar's own bar COUNT, not its pixel spacing.
   *
   * The titlebar draws a bar every eleven pixels, and copying that rule onto
   * a plot three to five times wider gave a hundred and twenty-eight hair-thin
   * bars: the same spacing, a completely different picture — a dense comb
   * instead of the titlebar's row of fat bars. Its strip holds about forty of
   * them; forty on a plot this wide was too fat, so this sits between that and
   * the comb, and the Pieces control moves it like any other form's.
   */
  fluid: 72,

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
  /**
   * The drawn scenes made of pieces, at the density each was drawn for: a
   * stadium board's fine columns, a row of glass, half the halo's ring (the
   * other half is its mirror), and the plain bars at the counts hi-fi
   * analysers use.
   */
  ledwall: 112,
  towers: 48,
  halo: 60,
  ledbars: 48,
  neonbars: 64,
  bars3d: 32,
  mirrorbars: 72,
  pixelbars: 64,
  sparkbars: 56,
  glitchbars: 48,
  halftone: 72,
  bouncedots: 48,
  fallblocks: 40,
  fibers: 140,
  afterglow: 64,
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
   * The measuring views are read against the EQ curve drawn over them, so
   * they stop short of solid — except the spectrogram, which IS the picture
   * and has nothing behind it to show through.
   */
  analyzer: 0.85,
  compare: 0.7,
  spectrogram: 1,
  rta: 0.9,
  average: 0.8,
  waterfall: 0.72,
  loudness: 0.9,
  scope: 0.9,
  midside: 0.8,
  notes: 0.85,
  energy: 0.92,
  phase: 1,
  /**
   * The drawn scenes carry their own light and shade — a lamp's lens, a
   * tower's glass, water deepening to its floor — so they start solid and
   * the setting takes them down from there, rather than every one of them
   * opening at the shared default's half-strength.
   */
  ledwall: 1,
  towers: 1,
  tide: 1,
  halo: 1,
  synthwave: 1,
  ledbars: 1,
  neonbars: 1,
  bars3d: 1,
  spectrumwave: 1,
  silkwaves: 1,
  mirrorbars: 1,
  pixelbars: 1,
  sparkbars: 1,
  glitchbars: 1,
  halftone: 1,
  bouncedots: 1,
  fallblocks: 1,
  fibers: 1,
  afterglow: 1,
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
  fluid: 0.92,
  bubbles: 0.85,
  dots: 0.9,
  blocks: 0.74,
  // Denser: at three quarters the spikes were washed toward the black and
  // read as pastel; solid colour is what vibrant means on a black stage.
  spikes: 0.94,
  stems: 0.84,
  terrace: 0.74,
  scatter: 0.74,
  ribs: 1,
  contour: 0.74,
  stalactites: 0.74,
  // The fire's outer flame carries the ramp: washed out, it read as grass.
  flames: 0.95,
  // The storm's cloud bank is a body against the sky.
  rain: 0.92,
  // Pickets are planks: translucent, the hills showed through the wood.
  fence: 0.97,
  // Broad fills need enough colour to stand beside the brighter beads and
  // LEDs; their old shared opacity made these two look washed out.
  area: 0.78,
  bars: 0.82,
  // A scope's body is dim: the beam over it is the picture, and at the
  // shared default the fill outshone it.
  sawtooth: 0.28,
};

/**
 * How much of a column each form leaves empty, by default.
 *
 * Zero is pieces that touch, which is what the setting has to mean — a gap of
 * none is no gap. Every one of these forms was drawn at a width chosen by eye,
 * and that width IS a gap, so they live here as starting positions rather than
 * baked into the geometry: bars were 62% of the column, pillars 96%, dots 50%,
 * diamonds 85%.
 *
 * A form missing from the table has no piece to space — a line, a curve, a
 * contour — and reads zero, which it then ignores.
 */
const BAR_GAP_DEFAULTS: Partial<Record<GraphStyle, number>> = {
  // Wide enough that each third-octave band is a band rather than a wall,
  // narrow enough that the row still reads as one spectrum.
  rta: 0.22,
  notes: 0.25,
  energy: 0.16,
  fluid: 0,
  bars: 0.26,
  blocks: 0.26,
  pillars: 0.04,
  skyline: 0.12,
  dots: 0.38,
  stems: 0.58,
  dashes: 0.36,
  scatter: 0.56,
  slope: 0.25,
  caps: 0.34,
  ribs: 0.34,
  crown: 0.2,
  matrix: 0.64,
  stalactites: 0.08,
  bubbles: 0.38,
  diamonds: 0.15,
  fence: 0.64,
  candles: 0.48,
  barcode: 0.18,
  honeycomb: 0.2,
  invaders: 0.35,
  // The drawn scenes made of pieces, each at the spacing it was drawn at: a
  // board's lamps, a row of glass, the halo's rays, and the plain bars.
  ledwall: 0.28,
  towers: 0.36,
  halo: 0.48,
  ledbars: 0.22,
  neonbars: 0.3,
  bars3d: 0.3,
  mirrorbars: 0.4,
  pixelbars: 0.12,
  sparkbars: 0.55,
  glitchbars: 0.3,
  halftone: 0.2,
  bouncedots: 0.35,
  fallblocks: 0.14,
  fibers: 0.4,
  afterglow: 0.3,
};

export const getGraphBarGap = (style: GraphStyle): number =>
  BAR_GAP_DEFAULTS[style] ?? 0;

/**
 * Whether Gap means anything on this form.
 *
 * Not the same question as whether it is discrete. A weave is made of pieces
 * and answers Pieces, but its pieces are stitches on a thread and have no
 * width to leave a gap between — and the starfield's streaks are placed by
 * the column rather than sized by it. Offering the slider on those is
 * offering a control that does nothing, which is the fault this codebase
 * keeps having to fix.
 *
 * The table is the answer: a form is in it because it has a width that was
 * chosen for it, and a form that has one is a form that can space it.
 */
export const hasGraphGap = (style: GraphStyle): boolean =>
  BAR_GAP_DEFAULTS[style] !== undefined;

export const getGraphFillOpacity = (
  style: GraphStyle,
  fallback: number,
): number => FILL_OPACITY_OVERRIDES[style] ?? fallback;

/**
 * The forms made of marks rather than of a body, for which Filled is not a
 * question that has an answer.
 *
 * A fill needs an inside. These forms have none: their drawings are thin
 * strokes — dashes floating at the level, rungs up a column, ticks lying
 * along the gradient, streaks, drops, teeth, cross-stitches, hatching. Asking
 * the canvas to paint a straight line paints nothing at all, so turning the
 * switch on did not restyle them, it ERASED them, and an empty pane reads as
 * the capture having died rather than as a setting having been changed.
 *
 * The three wave entries are here on the titlebar's own authority: it gives
 * those three no fill path, because there is where these ten figures are
 * defined and stroke-only is what it decided they are.
 *
 * Giving each of them a body instead was the alternative and it is the wrong
 * trade — a hatch with solid diagonals is a wall, which is the exact thing
 * hatching exists to avoid, and fattened ticks are the same picture slightly
 * blurred. The switch is what is wrong here, not the drawings.
 */
const STROKE_ONLY_STYLES = new Set<GraphStyle>([
  'dashes',
  'slope',
  'starfield',
  'feather',
  'zipper',
  'stitch',
  'hatch',
  'wave-line',
  'wave-outline',
  'wave-lattice',
]);

/** Whether painting this form instead of stroking it draws anything. */
export const canGraphFill = (style: GraphStyle): boolean =>
  !STROKE_ONLY_STYLES.has(style);

/**
 * The forms that never glow. A glow is a halo stroked round a figure's
 * silhouette; on a grid of LEDs the silhouette is a stand-in curve that has
 * nothing to do with the cells, and the halo round it read as a cheap trick
 * laid over the blocks. The Glow control is disabled for these.
 */
const GLOWLESS_STYLES = new Set<GraphStyle>([
  'blocks',
  // Rasters, both of them: the spectrogram has no silhouette at all, and the
  // waterfall has fifty-six, so a halo round "the figure" would be a halo
  // round whichever one the code happened to pick.
  'spectrogram',
  'waterfall',
  // The phase history is a raster too, and the scope's halo is its own: the
  // beam already carries one, drawn along the trace rather than round it.
  'phase',
  // Not the drawn scenes (`graphSceneViews.ts`): they light themselves — the
  // boards bloom, the towers pool light on their floor, the halo has its
  // core — and the Glow setting is how much more of that light they throw.
]);

export const canGraphGlow = (style: GraphStyle): boolean =>
  !GLOWLESS_STYLES.has(style);

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
  /**
   * The weave belongs here, and its absence was the whole of what was wrong
   * with it.
   *
   * "A zigzag threading the peaks" is what it is called and what its comment
   * says, and threading peaks means one stitch per peak. Left continuous it
   * was drawn over every point on the plot — three hundred-odd of them, two
   * or three pixels apart — so the zigzag had no room to be a zigzag and the
   * form came out as a solid band with a fuzzy edge. Nothing about it read as
   * weaving.
   */
  'weave',
  // The third-octave analyser's bands, and how many points survive into a
  // waterfall slice. Both are genuinely "how many pieces is this made of".
  'rta',
  'waterfall',
  // One bar per note, and one per band.
  'notes',
  'energy',
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
  'terrace',
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
  // The drawn scenes made of pieces (`graphSceneViews.ts`).
  'ledwall',
  'towers',
  'halo',
  'ledbars',
  'neonbars',
  'bars3d',
  'mirrorbars',
  'pixelbars',
  'sparkbars',
  'glitchbars',
  'halftone',
  'bouncedots',
  'fallblocks',
  'fibers',
  'afterglow',
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
/**
 * Four, not eight.
 *
 * Eight was the floor while every form was a spectrum, where fewer pieces
 * stop reading as one. The energy bands are not: they are five named meters
 * — sub, bass, mid, presence, air — and five has to be a number the slider
 * can reach, or the view ships at a setting nobody can put back.
 */
export const MIN_GRAPH_COLUMNS = 4;
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
