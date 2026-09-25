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

import { useId } from 'react';
import {
  GraphPalette,
  GraphStyle,
  resolveGraphPalette,
} from 'common/graphStyles';
import { resolveLookColours } from 'common/customLooks';
import { isTraceGradient, resolveTracePaint } from '../graph/liveTracePaint';

/**
 * A look, drawn small enough to sit in a list.
 *
 * The picker holds fifty-seven entries — one per form, with the palette on a
 * toggle beside it — and until now every one of them was a line of text.
 * "Terrace", "Crown", "Weave" and "Truss" are names chosen by eye for shapes
 * chosen by eye, and none of them tells anybody what they will get: the only
 * way to find the one you wanted was to select it and look, which for a list
 * this long means selecting a great many of them.
 *
 * A LOOK IS A FORM AND A COLOURING, so the icon is too, and neither half is
 * invented here:
 *
 *  - the form comes from `style`, through the glyph table below;
 *  - the colouring comes from `palette` and `colours`, through
 *    `resolveTracePaint` — the same function that decides what the real trace is
 *    painted with, handed the icon's own box instead of the plot's.
 *
 * That second point is the whole reason this file is short. The colour model is
 * genuinely subtle — rainbow runs across the frequency axis, level runs up the
 * decibel axis, one colour is a flat fill whatever the palette is called, and no
 * colours at all means "whatever is already on screen" — and a second
 * implementation of it here would be a second thing to get right and a second
 * thing to forget when the first one moves. So the icon asks the painter.
 */

/** The grid every icon in this app is drawn on. */
const ICON_SIZE = 16;

/**
 * The plot the icon stands in for.
 *
 * `resolveTracePaint` pins its ramps to the plot rather than to the figure —
 * see the note on it, which is the difference between "this many decibels" and
 * "the loudest thing on screen". The icon's plot is the icon, so a level ramp
 * runs the full height of the box and a short bar shows only the cool end of
 * it, exactly as a short bar does on the graph.
 */
const ICON_PLOT = { left: 0, right: ICON_SIZE, top: 0, bottom: ICON_SIZE };

/**
 * The colour a flat look is drawn in.
 *
 * `currentColor` rather than the trace's green, so the glyph takes the colour of
 * the row it is in — dim on a resting menu item, bright on the selected one,
 * white on hover. A flat look has no colour to advertise; what its icon has to
 * say is "one colour", and inheriting says that better than picking one.
 */
const FLAT_PAINT = 'currentColor';

interface ILookGlyph {
  /** The whole drawing, as one path on the 16-unit grid. */
  d: string;
  /**
   * Painted rather than stroked.
   *
   * The same distinction `isFilledGraphStyle` makes about the real forms, and
   * made again here rather than read from there, because these are pictures of
   * the forms rather than the forms: the glyph for the bars family is a solid
   * rectangle whatever a particular look's `filled` tuning has been moved to.
   */
  isFilled: boolean;
}

/**
 * The drawings, one per family of forms.
 *
 * FORTY-TWO GLYPHS FOR FIFTY-SEVEN FORMS, and the shortfall is deliberate. At
 * sixteen pixels a bar chart of sixty-four columns and one of forty-six are the
 * same picture, so a glyph per form would be fifty-seven near-identical drawings
 * pretending to a precision the size cannot carry — and the reader would learn
 * to stop looking at them. What the icon has to answer is "is this bars, or a
 * line, or dots, or something hanging off the ceiling", and the families below
 * are the level at which that question has different answers.
 *
 * Which forms share a glyph is recorded in `FORM_GLYPHS`, one line each, so the
 * grouping is legible from the mapping rather than only from here.
 *
 * Every one is drawn on the same grid as the rest of the app's icons: a floor
 * at y=13.5, a ceiling at y=2.5, and a stroke's clearance either side of both.
 * The shapes that punch holes — the skyline's windows, the invader's eyes, the
 * road's centre line — wind the other way round, which under the non-zero fill
 * rule cuts the hole rather than painting over it. That is the same trick
 * `graphStyles.ts` uses for the real drawings, and the same warning applies:
 * "tidying" one of them to match the others fills the hole in.
 */
const GLYPHS = {
  // A stroked trace, corners and all.
  line: {
    d: 'M1 11.4L4.4 5.6L7.6 9.2L10.8 3.4L13.2 7.6L15 6.2',
    isFilled: false,
  },
  // The same trace with the corners taken off.
  curve: {
    d: 'M1 11.2C2.8 11.2 3.4 4.8 5.8 4.8C8.2 4.8 7.8 10.4 9.8 10.4C12 10.4 12.6 6 15 6.4',
    isFilled: false,
  },
  // Everything under the trace, painted.
  area: {
    d: 'M1 13.5V10.6L4.4 5.4L7.6 9L10.8 3.4L13.2 7.6L15 6.4V13.5Z',
    isFilled: true,
  },
  /**
   * Bars with the wave line running over them, which is what the form is.
   *
   * The line is drawn as a thin closed band rather than a stroke, because a
   * glyph is one path with one paint and this one is filled — an open curve
   * in a filled path closes itself and paints the region under it instead.
   */
  fluid: {
    d: 'M1.6 9h2.2v4.5h-2.2ZM5.2 6.5h2.2v7h-2.2ZM8.8 8h2.2v5.5h-2.2ZM12.4 7h2.2v6.5h-2.2ZM1 5.4C3 5.4 4 2.6 6.4 2.6C8.8 2.6 9 5 11 5C13 5 13.4 3.4 15 3.8V5C13.4 4.6 13 6.2 11 6.2C9 6.2 8.8 3.8 6.4 3.8C4 3.8 3 6.6 1 6.6Z',
    isFilled: true,
  },
  /**
   * The spread of a band: its loudest point and its quietest, as two marks.
   *
   * The pairs have to sit at different distances from each other across the
   * icon, because the whole reading is how far apart they are — drawn at a
   * constant gap it would be two dotted rows and would say the opposite of
   * what the form says.
   */
  spread: {
    d: 'M2 4.6H4V6.6H2ZM2 11.4H4V13.4H2ZM6.5 6.4H8.5V8.4H6.5ZM6.5 9.4H8.5V11.4H6.5ZM11 2.6H13V4.6H11ZM11 12.4H13V14.4H11Z',
    isFilled: true,
  },
  /*
   * The titlebar wave's family.
   *
   * Every one is symmetric about the middle of the box, because that is what
   * tells these apart from the rest of the list at a glance: the spectrum
   * forms hang off the floor and these straddle a centre line.
   *
   * Wave ladder is the exception and is NOT here — it stands on the floor in
   * the titlebar too, so it takes the ladder glyph with the other stacking
   * forms. An icon that mirrored it would be describing a shape the form does
   * not draw.
   */
  waveLine: {
    d: 'M1 5.5C3 5.5 3.6 2.8 5.8 2.8C8 2.8 7.8 6.4 9.8 6.4C11.8 6.4 12.8 4 15 4.4M1 10.5C3 10.5 3.6 13.2 5.8 13.2C8 13.2 7.8 9.6 9.8 9.6C11.8 9.6 12.8 12 15 11.6',
    isFilled: false,
  },
  waveBody: {
    d: 'M1 5.5C3 5.5 3.6 2.8 5.8 2.8C8 2.8 7.8 6.4 9.8 6.4C11.8 6.4 12.8 4 15 4.4V11.6C12.8 12 11.8 9.6 9.8 9.6C7.8 9.6 8 13.2 5.8 13.2C3.6 13.2 3 10.5 1 10.5Z',
    isFilled: true,
  },
  waveBars: {
    d: 'M1.6 5H3.8V11H1.6ZM5.2 2.5H7.4V13.5H5.2ZM8.8 6H11V10H8.8ZM12.4 4H14.6V12H12.4Z',
    isFilled: true,
  },
  // Diamonds rather than triangles: a spike mirrored about the centre line
  // meets its own reflection, and what that draws is a diamond.
  waveSpikes: {
    d: 'M1 8L2.7 3.6L4.4 8L2.7 12.4ZM5.4 8L7.1 1.8L8.8 8L7.1 14.2ZM9.8 8L11.5 5L13.2 8L11.5 11Z',
    isFilled: true,
  },
  waveBeads: {
    d: 'M2 7H4.4V9.4H2ZM2 3.8H4.4V6.2H2ZM2 10.2H4.4V12.6H2ZM6.8 7H9.2V9.4H6.8ZM6.8 3.8H9.2V6.2H6.8ZM6.8 10.2H9.2V12.6H6.8ZM6.8 0.6H9.2V3H6.8ZM11.6 7H14V9.4H11.6ZM11.6 10.2H14V12.6H11.6Z',
    isFilled: true,
  },
  waveLattice: {
    d: 'M2 5V11M5 2.8V13.2M8 6V10M11 4V12M14 6.6V9.4',
    isFilled: false,
  },
  // A band whose thickness is the level: fat where it is loud, a thread where
  // it is not.
  ribbon: {
    d: 'M1 10.5L5 4.6L8 3L11 5.5L15 8.5L15 9.5L11 9.5L8 9L5 9.4L1 11.5Z',
    isFilled: true,
  },
  // Two strands crossing. Two long crossings rather than the four short ones
  // the real form makes across a plot: at a pitch anywhere near the true one
  // the strands enclose round holes and the glyph reads as a chain, where the
  // stretched version reads as a rope.
  braid: {
    d: 'M1 9.4C3.3 6.4 5.7 6.4 8 9.4C10.3 12.4 12.7 12.4 15 9.4M1 9.4C3.3 12.4 5.7 12.4 8 9.4C10.3 6.4 12.7 6.4 15 9.4',
    isFilled: false,
  },
  // The room above the trace rather than the energy under it, which is why this
  // is the area glyph turned upside down and not simply a mirror of it.
  canyon: {
    d: 'M1 2.5H15V6.6L12.4 8.4L9.4 4.4L6.2 9.6L3.4 6.8L1 9.2Z',
    isFilled: true,
  },
  // Columns standing on the floor.
  bars: {
    d: 'M1.6 9h2.2v4.5h-2.2ZM5.2 4.5h2.2v9h-2.2ZM8.8 7h2.2v6.5h-2.2ZM12.4 6h2.2v7.5h-2.2Z',
    isFilled: true,
  },
  // Bodies floating at the level with a wick through them — nothing touching
  // the floor, which is the whole difference from the bars above.
  candles: {
    d: 'M2 8.5h3v3h-3ZM3.05 7.2h0.9v5.6h-0.9ZM6.5 4h3v4h-3ZM7.55 2.9h0.9v6.2h-0.9ZM11 7h3v3.4h-3ZM12.05 5.9h0.9v5.6h-0.9Z',
    isFilled: true,
  },
  // Level as width rather than height: full-depth stripes, fat where it is
  // loud. The one form that does not use the vertical axis at all.
  barcode: {
    d: 'M1.5 2.5h1v11h-1ZM4 2.5h2.2v11h-2.2ZM7.6 2.5h0.9v11h-0.9ZM9.9 2.5h2.6v11h-2.6ZM13.6 2.5h1.2v11h-1.2Z',
    isFilled: true,
  },
  // Triangles standing on the floor.
  spikes: {
    d: 'M1 13.5L3.2 8.4L5.4 13.5ZM5.2 13.5L7.9 3.6L10.6 13.5ZM10.4 13.5L12.6 7.4L14.8 13.5Z',
    isFilled: true,
  },
  // Tongues: the same triangles with the sides curved in and the tips leaning.
  flames: {
    d: 'M1.6 13.5Q1.9 9.4 3.2 6.4Q4.5 9.6 4.4 13.5ZM5.8 13.5Q6.1 8 7.6 3Q9.1 8.4 9 13.5ZM10.4 13.5Q10.7 9.4 11.8 6.2Q13.4 9.4 13.6 13.5Z',
    isFilled: true,
  },
  // A colonnade: domes rather than points.
  arches: {
    d: 'M1 13.5Q3.2 6 5.4 13.5ZM5.8 13.5Q8 1.2 10.2 13.5ZM10.6 13.5Q12.8 5.6 15 13.5Z',
    isFilled: true,
  },
  // Marks floating at the level, all the same size.
  dots: {
    d: 'M1.2 10a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0ZM5 5.2a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0ZM8.8 8a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0ZM12.6 6.4a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0Z',
    isFilled: true,
  },
  // The same marks sized by the level, which is the only thing that tells
  // bubbles from dots — so the sizes here are exaggerated well past what four
  // marks would really differ by.
  bubbles: {
    d: 'M1.4 10.6a1 1 0 1 0 2 0a1 1 0 1 0-2 0ZM4.3 5.8a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0ZM9.4 8.8a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0ZM13.3 5.4a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0-1.6 0Z',
    isFilled: true,
  },
  // Gems on the peaks.
  diamonds: {
    d: 'M3 8.2L4.8 10L3 11.8L1.2 10ZM7.2 2.6L9.6 5L7.2 7.4L4.8 5ZM11 6L13 8L11 10L9 8ZM14.4 5.2L15.8 6.6L14.4 8L13 6.6Z',
    isFilled: true,
  },
  // A mark on the peak with a thread down to the floor.
  stems: {
    d: 'M2.4 9.5h0.8v4h-0.8ZM1.7 8.4h2.2v2.2h-2.2ZM6.2 4.5h0.8v9h-0.8ZM5.5 3.4h2.2v2.2h-2.2ZM10 7.5h0.8v6h-0.8ZM9.3 6.4h2.2v2.2h-2.2ZM13.8 6h0.8v7.5h-0.8ZM13.1 4.9h2.2v2.2h-2.2Z',
    isFilled: true,
  },
  // One level per band rather than a curve through them.
  steps: {
    d: 'M1 11.4H4.5V6.4H8V9.2H11.5V3.6H14V7.6H15',
    isFilled: false,
  },
  // The same staircase, filled.
  terrace: {
    d: 'M1 13.5V11.4H4.5V6.4H8V9.2H11.5V3.6H14V7.6H15V13.5Z',
    isFilled: true,
  },
  // Just the tops, hanging in the air where the level is.
  dashes: {
    d: 'M1.2 10.6h2.6M5 5.4h2.6M8.8 8.2h2.6M12.6 6.2h2.6',
    isFilled: false,
  },
  // The same marks laid along the gradient instead of level, because what this
  // form draws is which way the spectrum is going rather than where it is.
  slope: {
    d: 'M1.2 11.6L4 9.8M5.2 6.8L8 5.6M9.2 6L12 8.6M12.8 9.4L15.4 7.4',
    isFilled: false,
  },
  // Cells stacked up each column on a fixed grid, so the eye counts rows rather
  // than measuring a height.
  ladder: {
    d: 'M1.8 11.9h3v1.6h-3ZM1.8 9.5h3v1.6h-3ZM1.8 7.1h3v1.6h-3ZM6.5 11.9h3v1.6h-3ZM6.5 9.5h3v1.6h-3ZM6.5 7.1h3v1.6h-3ZM6.5 4.7h3v1.6h-3ZM6.5 2.3h3v1.6h-3ZM11.2 11.9h3v1.6h-3ZM11.2 9.5h3v1.6h-3ZM11.2 7.1h3v1.6h-3ZM11.2 4.7h3v1.6h-3Z',
    isFilled: true,
  },
  // Towers with the lights on. The windows are wound the other way round.
  skyline: {
    d: 'M1.6 6.6h4v6.9h-4ZM2.6 8.4v1h1v-1ZM3.9 8.4v1h1v-1ZM2.6 10.4v1h1v-1ZM3.9 10.4v1h1v-1ZM6.4 3.4h3.4v10.1h-3.4ZM7.1 5.2v1h1v-1ZM8.3 5.2v1h1v-1ZM7.1 7.2v1h1v-1ZM8.3 7.2v1h1v-1ZM10.6 8h3.8v5.5h-3.8ZM11.4 9.6v1h1v-1ZM12.7 9.6v1h1v-1Z',
    isFilled: true,
  },
  // A hill read as an Ordnance Survey map reads one: rings round the loud part,
  // nothing over the quiet.
  contour: {
    d: 'M1.6 12.2h12M3 9.8h7.6M4.2 7.4h4.6M5 5h2.4',
    isFilled: false,
  },
  // The area under the trace, shaded rather than painted.
  hatch: {
    d: 'M1 10.8L5 5.4L9 8.6L15 6M1.6 13.5L3.4 11.7M3.6 13.5L6.4 10.7M6 13.5L8.6 10.9M8.4 13.5L11.4 10.5M10.8 13.5L13.4 10.9M13 13.5L15 11.5',
    isFilled: false,
  },
  // The spectrum drawn as the bridge that would have to hold it up. The top
  // chord is flatter than a spectrum really is, because a chord with a proper
  // peak in it closes the bays into one triangle and the glyph stops reading as
  // a structure.
  truss: {
    d: 'M1.5 7.4L5.5 5.6L9.5 7L14.5 6M1.5 13.5H14.5M1.5 7.4L5.5 13.5L9.5 7L14.5 13.5M5.5 5.6V13.5M9.5 7V13.5',
    isFilled: false,
  },
  // Two rails with teeth reaching alternately across the gap.
  zipper: {
    d: 'M1 7L15 4.6M1 12L15 9.6M3 6.7V10.2M5 11.3V7.8M7 6V9.5M9 10.6V7.1M11 5.3V8.8M13 9.9V6.4',
    isFilled: false,
  },
  // A running thread with a cross worked over each band.
  stitch: {
    d: 'M1.5 11.2L5.6 6L10.2 8.6L14.6 5.4M1.3 9L3.5 11.2M3.5 9L1.3 11.2M4.3 4.7L6.9 7.3M6.9 4.7L4.3 7.3M8.9 7.3L11.5 9.9M11.5 7.3L8.9 9.9M13.5 4.3L15.7 6.5M15.7 4.3L13.5 6.5',
    isFilled: false,
  },
  // A spine with barbs swept back off both sides of it.
  feather: {
    d: 'M1.5 11.6L5.4 5.8L9.4 8.2L14.6 4.6M3.2 9.2L2.1 8M3.2 9.2L2.1 10.4M5.4 5.8L4 4.1M5.4 5.8L4 7.5M9.4 8.2L8.1 6.7M9.4 8.2L8.1 9.7M12 6.4L10.7 5M12 6.4L10.7 7.8',
    isFilled: false,
  },
  // Streaks falling through the picture, which is what both the rain and the
  // warp field are — one above the trace and one through it, and at this size
  // the same drawing.
  streaks: {
    d: 'M2.4 2.6v3.2M4.4 4.4v4.4M6.4 2v2.6M8.4 5.2v5M10.4 3v3.6M12.4 6.2v3.2M14.2 3.4v4.2',
    isFilled: false,
  },
  // A heart monitor: a resting line that deflects once per band.
  pulse: {
    d: 'M1 9H3.4L4.2 10.4L5.2 4L6 11.2L6.8 9H9.2L10 10.4L11 5L11.8 11.2L12.6 9H15',
    isFilled: false,
  },
  // The trace and two afterimages, each later and lower.
  echo: {
    d: 'M1 10.8L4.4 5.2L8 8.4L12.2 6M2.4 11.6L5.8 6.9L9.4 9.6L13.6 7.6M3.8 12.3L7.2 8.6L10.8 10.8L15 9.2',
    isFilled: false,
  },
  // Hung from the ceiling rather than stood on the floor.
  hanging: {
    d: 'M1.4 2.5h2.4L2.6 8.4ZM5.2 2.5h2.4L6.4 12.6ZM9 2.5h2.4L10.2 7ZM12.8 2.5h2.4L14 10Z',
    isFilled: true,
  },
  // One of the rank of little creatures, eyes cut out of it.
  sprite: {
    d: 'M4.8 7.2h6.4v3.2h-6.4ZM3.2 8h1.6v2.4h-1.6ZM11.2 8h1.6v2.4h-1.6ZM5.6 4.8h1.6v2.4h-1.6ZM8.8 4.8h1.6v2.4h-1.6ZM4.8 10.4h1.6v1.6h-1.6ZM9.6 10.4h1.6v1.6h-1.6ZM6.2 8v1.2h1.2v-1.2ZM8.8 8v1.2h1.2v-1.2Z',
    isFilled: true,
  },
  // The trace as tarmac, with a centre line punched through it and a car riding
  // the loudest band.
  road: {
    d: 'M1 9.6L5.5 6L10.5 8L15 6.8L15 9.6L10.5 10.8L5.5 8.8L1 12.4ZM2.4 9.2v0.6h1.4v-0.6ZM7.3 8.1v0.6h1.4v-0.6ZM12.3 8.4v0.6h1.4v-0.6ZM2.9 3.8h5.2v2h-5.2ZM4.3 2.4h2.6v1.4h-2.6ZM3.5 5.8h1.4v1.2h-1.4ZM6.3 5.8h1.4v1.2h-1.4Z',
    isFilled: true,
  },
  /**
   * The measuring views. Each glyph draws the one thing that view has and the
   * other six do not — a hold line over a body, a filled wedge between two
   * readings, rows of a raster, capped bars, two traces at two speeds, ridges
   * receding, a phase scope over its needle — because these seven sit next to
   * each other at the top of the picker and are the only place in this file
   * where telling one from its neighbour is the whole job.
   */
  // A filled spectrum with its peak hold hanging above it.
  analyzer: {
    d: 'M1 14V9L3 6L5 8.5L7 4L9 7.5L11 6L13 10L15 8V14ZM1 8.1L3 5.1L5 7.6L7 3.1L9 6.6L11 5.1L13 9.1L15 7.1V6.2L13 8.2L11 4.2L9 5.7L7 2.2L5 6.7L3 4.2L1 7.2Z',
    isFilled: true,
  },
  // Two readings with the difference between them painted in.
  compare: {
    d: 'M1 10L4 6.5L8 8.5L12 4.5L15 7L15 10.5L12 9L8 11L4 10L1 12.5Z',
    isFilled: true,
  },
  // Rows of a raster, each a moment, the newest along the bottom.
  raster: {
    d: 'M1 2.4h4.2v2H1ZM6.4 2.4h8.6v2H6.4ZM1 6h9.8v2H1ZM12 6h3v2h-3ZM1 9.6h2.6v2H1ZM4.8 9.6h10.2v2H4.8ZM1 13.2h12v2H1Z',
    isFilled: true,
  },
  // Bars with the floating caps that make an analyser an RTA.
  capped: {
    d: 'M1 10h2.2v4H1ZM1 7.6h2.2v0.9H1ZM4 7h2.2v7H4ZM4 4.4h2.2v0.9H4ZM7 4.5h2.2v9.5H7ZM7 2.2h2.2v0.9H7ZM10 8.5h2.2v5.5H10ZM10 6h2.2v0.9H10ZM13 11h2v3h-2ZM13 8.6h2v0.9h-2Z',
    isFilled: true,
  },
  // The same spectrum at two speeds, one over the other.
  twoSpeeds: {
    d: 'M1 8.4L4 4.8L8 7.2L12 3.4L15 5.8V6.9L12 4.5L8 8.3L4 5.9L1 9.5ZM1 12L4 9.4L8 11L12 8.6L15 10.4V11.3L12 9.5L8 11.9L4 10.3L1 12.9Z',
    isFilled: true,
  },
  // Ridges receding: the same reading at three moments, into the distance,
  // joined down their columns into one surface.
  waterfall: {
    d: 'M1 13.4L4 10.4L7 12.4L10 8.4L13 11.4L15 10.4M2.2 10.6L4.8 8.2L7.4 9.9L9.9 6.6L12.4 9L14 8.2M3.4 8L5.6 6.1L7.8 7.5L9.9 4.9L12 6.9L13.4 6.2M1 13.4L2.2 10.6L3.4 8M4 10.4L4.8 8.2L5.6 6.1M7 12.4L7.4 9.9L7.8 7.5M10 8.4L9.9 6.6L9.9 4.9M13 11.4L12.4 9L12 6.9M15 10.4L14 8.2L13.4 6.2',
    isFilled: false,
  },
  // A waveform either side of a centre rule: the oscilloscope.
  beam: {
    d: 'M1 8H15M1 8C2 8 2.2 3 3.6 3C5 3 5 13 6.6 13C8.2 13 8 4.6 9.4 4.6C10.8 4.6 10.8 11 12.2 11C13.4 11 13.8 8 15 8',
    isFilled: false,
  },
  // Two bodies over one another: what the channels share, and what only one
  // of them has.
  midSide: {
    d: 'M1 14V8.5L4 5L7.5 7.5L11 3.6L15 6.4V14ZM1 11.6L4 9.6L7.5 11L11 8.8L15 10.6V11.6L11 9.9L7.5 12.1L4 10.7L1 12.6Z',
    isFilled: true,
  },
  // Bars on a keyboard: the spectrum cut into semitones.
  notes: {
    d: 'M1 9h1.4v5H1ZM3 5.6h1.4V14H3ZM5 10.4h1.4V14H5ZM7 3.4h1.4V14H7ZM9 8h1.4v6H9ZM11 6.4h1.4V14H11ZM13 11h1.4v3H13ZM1 1.6h0.9v1.2H1ZM7 1.6h0.9v1.2H7ZM13 1.6h0.9v1.2H13Z',
    isFilled: true,
  },
  // A handful of wide columns with caps: the five band meters.
  bands: {
    d: 'M1 6h3v8H1ZM1 3.6h3v1.4H1ZM5.6 9h3v5h-3ZM5.6 6.8h3v1.4h-3ZM10.2 4.4h3.8v9.6h-3.8ZM10.2 2h3.8v1.4h-3.8Z',
    isFilled: true,
  },
  // A line wandering either side of a rule, with a band under it: the
  // image written down over time.
  history: {
    d: 'M1 8H15M1 5.4L3.4 4.2L5.8 7.4L8.2 5L10.6 10.4L13 6.6L15 7.4M1 5.4L3.4 4.2L5.8 7.4L8.2 5L10.6 10.4L13 6.6L15 7.4V9.8L13 9L10.6 12.8L8.2 7.4L5.8 9.8L3.4 6.6L1 7.8Z',
    isFilled: false,
  },
  // The phase scope over its correlation bar.
  scope: {
    d: 'M13 6.5A5 5 0 1 1 3 6.5A5 5 0 1 1 13 6.5M7.2 2.4L8.8 5L7 7.6L9 10.4M2 13.6H14M9.2 12.4V14.8',
    isFilled: false,
  },
  /** The drawn scenes, each by the one thing it is made of. */
  // A board of lamps with columns of them lit.
  ledBoard: {
    d: 'M0.75 14a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM0.75 11a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM3.75 14a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM3.75 11a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM3.75 8a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM3.75 5a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM6.75 14a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM6.75 11a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM6.75 8a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM6.75 5a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM6.75 2a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM9.75 14a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM9.75 11a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM9.75 8a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM12.75 14a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0ZM1.55 8a0.45 0.45 0 1 0 0.9 0a0.45 0.45 0 1 0 -0.9 0ZM1.55 5a0.45 0.45 0 1 0 0.9 0a0.45 0.45 0 1 0 -0.9 0ZM1.55 2a0.45 0.45 0 1 0 0.9 0a0.45 0.45 0 1 0 -0.9 0ZM4.55 2a0.45 0.45 0 1 0 0.9 0a0.45 0.45 0 1 0 -0.9 0ZM10.55 5a0.45 0.45 0 1 0 0.9 0a0.45 0.45 0 1 0 -0.9 0ZM10.55 2a0.45 0.45 0 1 0 0.9 0a0.45 0.45 0 1 0 -0.9 0ZM13.55 11a0.45 0.45 0 1 0 0.9 0a0.45 0.45 0 1 0 -0.9 0ZM13.55 8a0.45 0.45 0 1 0 0.9 0a0.45 0.45 0 1 0 -0.9 0ZM13.55 5a0.45 0.45 0 1 0 0.9 0a0.45 0.45 0 1 0 -0.9 0ZM13.55 2a0.45 0.45 0 1 0 0.9 0a0.45 0.45 0 1 0 -0.9 0Z',
    isFilled: true,
  },
  // Rounded towers on a floor, reflected under it.
  towers: {
    d: 'M1 12V8.6A1.6 1.6 0 0 1 4.2 8.6V12ZM4.4 12V5.1A1.6 1.6 0 0 1 7.6 5.1V12ZM7.8 12V3.2A1.6 1.6 0 0 1 11 3.2V12ZM11.2 12V6.8A1.6 1.6 0 0 1 14.4 6.8V12ZM0.6 12.6H15.4V13.2H0.6ZM1 13.8H4.2V15.05H1ZM4.4 13.8H7.6V15.6H4.4ZM7.8 13.8H11V15.6H7.8ZM11.2 13.8H14.4V15.5H11.2Z',
    isFilled: true,
  },
  // Three swells, one behind the other.
  tide: {
    d: 'M1 15V5.2L1 5.96L1.5 5.96L2 5.67L2.5 5.2L3 4.73L3.5 4.44L4 4.44L4.5 4.73L5 5.2L5.5 5.67L6 5.96L6.5 5.96L7 5.67L7.5 5.2L8 4.73L8.5 4.44L9 4.44L9.5 4.73L10 5.2L10.5 5.67L11 5.96L11.5 5.96L12 5.67L12.5 5.2L13 4.73L13.5 4.44L14 4.44L14.5 4.73L15 5.2V15ZM1 15V9.19L1 8.72L1.5 8.3L2 7.85L2.5 7.48L3 7.25L3.5 7.21L4 7.36L4.5 7.68L5 8.1L5.5 8.55L6 8.92L6.5 9.15L7 9.19L7.5 9.04L8 8.72L8.5 8.3L9 7.85L9.5 7.48L10 7.25L10.5 7.21L11 7.36L11.5 7.68L12 8.1L12.5 8.55L13 8.92L13.5 9.15L14 9.19L14.5 9.04L15 8.72V15ZM1 15V10.87L1 10.19L1.5 9.99L2 9.9L2.5 9.94L3 10.11L3.5 10.38L4 10.73L4.5 11.13L5 11.53L5.5 11.9L6 12.21L6.5 12.41L7 12.5L7.5 12.46L8 12.29L8.5 12.02L9 11.67L9.5 11.27L10 10.87L10.5 10.5L11 10.19L11.5 9.99L12 9.9L12.5 9.94L13 10.11L13.5 10.38L14 10.73L14.5 11.13L15 11.53V15Z',
    isFilled: true,
  },
  // A ring with rays standing out of it.
  halo: {
    d: 'M11.2 8A3.2 3.2 0 1 1 4.8 8A3.2 3.2 0 1 1 11.2 8M8 3.7L8 2.06M9.65 4.03L10.62 1.68M11.04 4.96L12.5 3.5M11.97 6.35L14.04 5.5M12.3 8L14.71 8M11.97 9.65L13.68 10.35M11.04 11.04L12.92 12.92M9.65 11.97L10.18 13.27M8 12.3L8 15.08M6.35 11.97L6 12.82M4.96 11.04L2.99 13.01M4.03 9.65L2.76 10.17M3.7 8L1.04 8M4.03 6.35L2.34 5.66M4.96 4.96L3.24 3.24M6.35 4.03L5.51 1.98',
    isFilled: false,
  },
  // A striped sun setting over a grid floor.
  synth: {
    d: 'M8.68 3.85L10.26 4.39L11.02 4.93L11.55 5.47L11.93 6.02L12.22 6.56L12.41 7.1L3.59 7.1L3.78 6.56L4.07 6.02L4.45 5.48L4.98 4.93L5.74 4.39L7.32 3.85ZM12.53 7.6L12.55 7.71L12.56 7.82L12.58 7.92L12.59 8.03L12.59 8.14L12.6 8.25L3.4 8.25L3.41 8.14L3.41 8.03L3.42 7.92L3.44 7.82L3.45 7.71L3.47 7.6ZM12.59 8.7L12.59 8.77L12.58 8.83L12.57 8.9L12.56 8.97L12.56 9.03L12.55 9.1L3.45 9.1L3.44 9.03L3.44 8.97L3.43 8.9L3.42 8.83L3.41 8.77L3.41 8.7ZM0.6 9.95L15.4 9.95L15.4 9.25L0.6 9.25ZM0.6 11.5L15.4 11.5L15.4 10.9L0.6 10.9ZM0.6 13.7L15.4 13.7L15.4 13.1L0.6 13.1ZM6.05 9.42L0.8 15.22L1.2 15.58L6.45 9.78ZM6.87 9.49L4.25 15.29L4.75 15.51L7.38 9.71ZM7.72 9.6L7.72 15.4L8.28 15.4L8.28 9.6ZM8.62 9.71L11.25 15.51L11.75 15.29L9.13 9.49ZM9.55 9.78L14.8 15.58L15.2 15.22L9.95 9.42Z',
    isFilled: true,
  },
  /** The plain spectrums drawn as scenes. */
  // Columns of square segments, a held one floating over three of them.
  ledSegments: {
    d: 'M1 12.8h2.2v1.6H1ZM1 10.6h2.2v1.6H1ZM1 8.4h2.2v1.6H1ZM4 12.8h2.2v1.6H4ZM4 10.6h2.2v1.6H4ZM4 8.4h2.2v1.6H4ZM4 6.2h2.2v1.6H4ZM4 4h2.2v1.6H4ZM7 12.8h2.2v1.6H7ZM7 10.6h2.2v1.6H7ZM7 8.4h2.2v1.6H7ZM7 6.2h2.2v1.6H7ZM7 4h2.2v1.6H7ZM7 1.8h2.2v1.6H7ZM10 12.8h2.2v1.6H10ZM10 10.6h2.2v1.6H10ZM10 8.4h2.2v1.6H10ZM10 6.2h2.2v1.6H10ZM13 12.8h2.2v1.6H13ZM13 10.6h2.2v1.6H13ZM1 4h2.2v0.8H1ZM10 1.8h2.2v0.8H10ZM13 6.2h2.2v0.8H13Z',
    isFilled: true,
  },
  // Slim rounded tubes on a floor line, their reflections under it.
  neonTubes: {
    d: 'M1.2 5.3a0.9 0.9 0 0 1 1.8 0V11.4H1.2ZM1.2 12.4h1.8v2.45H1.2ZM4.2 7.7a0.9 0.9 0 0 1 1.8 0V11.4H4.2ZM4.2 12.4h1.8v1.61H4.2ZM7.2 3.3a0.9 0.9 0 0 1 1.8 0V11.4H7.2ZM7.2 12.4h1.8v3.15H7.2ZM10.2 6.9a0.9 0.9 0 0 1 1.8 0V11.4H10.2ZM10.2 12.4h1.8v1.89H10.2ZM13.2 9.3a0.9 0.9 0 0 1 1.8 0V11.4H13.2ZM13.2 12.4h1.8v1.05H13.2ZM0.6 11.8H15.4V12.1H0.6Z',
    isFilled: true,
  },
  // Three blocks in depth: fronts, tops and sides as lines.
  blocks3d: {
    d: 'M1 9.5h3.2v5H1ZM1 9.5L2.3 8.3H5.5L4.2 9.5M5.5 8.3V13.3L4.2 14.5M6 4.5h3.2v10H6ZM6 4.5L7.3 3.3H10.5L9.2 4.5M10.5 3.3V13.3L9.2 14.5M11 11h3.2v3.5H11ZM11 11L12.3 9.8H15.5L14.2 11M15.5 9.8V13.3L14.2 14.5',
    isFilled: false,
  },
  // A smooth spectrum line with its echo trailing under it.
  waveEcho: {
    d: 'M1 12C3 12 3.4 5 5.6 5S8 9.6 9.8 9.6S12.4 3.4 15 4.2M1 14.2C3 14.2 3.6 8.4 5.6 8.4S8.2 11.6 9.8 11.6S12.6 7 15 7.4',
    isFilled: false,
  },
  // Three strands woven through each other, held at both ends.
  silk: {
    d: 'M1 8C3.5 8 4 3.5 6.5 3.5S10 12.5 12.5 12.5S14.5 8 15 8M1 8C3 8 4.2 11 6.5 11S9.5 5 11.5 5S14 8 15 8M1 8C3 8 4 6.5 5.5 6.5S8.5 9.5 10 9.5S13 7 15 8',
    isFilled: false,
  },
  /** The second ten: plain visualizers, no scenery. */
  // Bars standing both ways from a middle line.
  mirrorBars: {
    d: 'M1 6.5h1.6v3H1ZM3.45 4.5h1.6v7H3.45ZM5.9 2.5h1.6v11H5.9ZM8.35 4h1.6v8H8.35ZM10.8 1.8h1.6v12.4H10.8ZM13.25 5.5h1.6v5H13.25Z',
    isFilled: true,
  },
  // Square pixels stacked, a held pixel over some.
  pixelBars: {
    d: 'M1 13h2v2H1ZM1 10.5h2v2H1ZM4 13h2v2H4ZM4 10.5h2v2H4ZM4 8h2v2H4ZM4 5.5h2v2H4ZM7 13h2v2H7ZM7 10.5h2v2H7ZM7 8h2v2H7ZM7 5.5h2v2H7ZM7 3h2v2H7ZM10 13h2v2H10ZM10 10.5h2v2H10ZM10 8h2v2H10ZM13 13h2v2H13ZM1 5.5h2v2H1ZM10 3h2v2H10Z',
    isFilled: true,
  },
  // Balls on stems, one in the air.
  bounceDots: {
    d: 'M1.7 10h0.6v5H1.7ZM0.7 8.7a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0ZM5 6h0.6v9H5ZM4 4.7a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0ZM8.3 8h0.6v7H8.3ZM7.3 1.7a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0ZM11.6 11h0.6v4H11.6ZM10.6 9.7a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0ZM14.1 9h0.6v6H14.1ZM13.1 7.7a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0Z',
    isFilled: true,
  },
  // Slim bars with sparks flying off them.
  sparkBars: {
    d: 'M1.5 9h1.2v6H1.5ZM4.5 6h1.2v9H4.5ZM7.5 4h1.2v11H7.5ZM10.5 7h1.2v8H10.5ZM13.5 10h1.2v5H13.5ZM4.9 3.6h0.8v0.8H4.9ZM7.2 1.8h0.8v0.8H7.2ZM8.6 2.4h0.8v0.8H8.6ZM10.9 4.6h0.8v0.8H10.9ZM2 6.8h0.8v0.8H2Z',
    isFilled: true,
  },
  // Bars with a strip torn sideways.
  glitchBars: {
    d: 'M1 8h2.5v-0.5H1ZM2 7.5h2.5v1.5H2ZM1 9.5h2.5v5.5H1ZM4.5 4h2.5v3.5H4.5ZM5.5 7.5h2.5v1.5H5.5ZM4.5 9.5h2.5v5.5H4.5ZM8 6h2.5v1.5H8ZM9 7.5h2.5v1.5H9ZM8 9.5h2.5v5.5H8ZM11.5 3h2.5v4.5H11.5ZM12.5 7.5h2.5v1.5H12.5ZM11.5 9.5h2.5v5.5H11.5Z',
    isFilled: true,
  },
  // Stacks of blocks, one falling onto them.
  fallBlocks: {
    d: 'M1 12.4h2.8v2.6H1ZM1 9.4h2.8v2.6H1ZM4.6 12.4h2.8v2.6H4.6ZM4.6 9.4h2.8v2.6H4.6ZM4.6 6.4h2.8v2.6H4.6ZM4.6 3.4h2.8v2.6H4.6ZM8.2 12.4h2.8v2.6H8.2ZM8.2 9.4h2.8v2.6H8.2ZM8.2 6.4h2.8v2.6H8.2ZM11.8 12.4h2.8v2.6H11.8ZM4.6 1.2h2.8v2.6H4.6Z',
    isFilled: true,
  },
  // Hair-thin fibres with lit tips.
  fibers: {
    d: 'M0.95 8h0.5v7H0.95ZM0.4 8a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0ZM2.65 5h0.5v10H2.65ZM2.1 5a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0ZM4.35 3.5h0.5v11.5H4.35ZM3.8 3.5a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0ZM6.05 6h0.5v9H6.05ZM5.5 6a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0ZM7.75 9h0.5v6H7.75ZM7.2 9a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0ZM9.45 7h0.5v8H9.45ZM8.9 7a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0ZM11.15 4.5h0.5v10.5H11.15ZM10.6 4.5a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0ZM12.85 8.5h0.5v6.5H12.85ZM12.3 8.5a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0ZM14.55 10.5h0.5v4.5H14.55ZM14 10.5a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0Z',
    isFilled: true,
  },
  // Bars with their light left above them.
  afterglow: {
    d: 'M1 8h2.6v7H1ZM1 4h2.6v0.6H1ZM1 5.6h2.6v0.6H1ZM1 7.2h2.6v0.6H1ZM4.8 10h2.6v5H4.8ZM4.8 5h2.6v0.6H4.8ZM4.8 6.6h2.6v0.6H4.8ZM4.8 8.2h2.6v0.6H4.8ZM8.6 6h2.6v9H8.6ZM8.6 3h2.6v0.6H8.6ZM8.6 4.6h2.6v0.6H8.6ZM12.4 11h2.6v4H12.4ZM12.4 7h2.6v0.6H12.4ZM12.4 8.6h2.6v0.6H12.4Z',
    isFilled: true,
  },
  // A dot screen, full under a line, specks above.
  halftone: {
    d: 'M0.6 14a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM0.86 11a1.14 1.14 0 1 0 2.29 0a1.14 1.14 0 1 0 -2.29 0ZM1.37 8a0.63 0.63 0 1 0 1.26 0a0.63 0.63 0 1 0 -1.26 0ZM1.75 5a0.25 0.25 0 1 0 0.5 0a0.25 0.25 0 1 0 -0.5 0ZM1.75 2a0.25 0.25 0 1 0 0.5 0a0.25 0.25 0 1 0 -0.5 0ZM3.6 14a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM3.6 11a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM3.73 8a1.27 1.27 0 1 0 2.54 0a1.27 1.27 0 1 0 -2.54 0ZM4.24 5a0.76 0.76 0 1 0 1.52 0a0.76 0.76 0 1 0 -1.52 0ZM4.75 2a0.25 0.25 0 1 0 0.5 0a0.25 0.25 0 1 0 -0.5 0ZM6.6 14a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM6.6 11a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM7.11 8a0.89 0.89 0 1 0 1.77 0a0.89 0.89 0 1 0 -1.77 0ZM7.75 5a0.25 0.25 0 1 0 0.5 0a0.25 0.25 0 1 0 -0.5 0ZM7.75 2a0.25 0.25 0 1 0 0.5 0a0.25 0.25 0 1 0 -0.5 0ZM9.73 14a1.27 1.27 0 1 0 2.54 0a1.27 1.27 0 1 0 -2.54 0ZM10.24 11a0.76 0.76 0 1 0 1.52 0a0.76 0.76 0 1 0 -1.52 0ZM10.75 8a0.25 0.25 0 1 0 0.5 0a0.25 0.25 0 1 0 -0.5 0ZM10.75 5a0.25 0.25 0 1 0 0.5 0a0.25 0.25 0 1 0 -0.5 0ZM10.75 2a0.25 0.25 0 1 0 0.5 0a0.25 0.25 0 1 0 -0.5 0ZM12.6 14a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM12.73 11a1.27 1.27 0 1 0 2.54 0a1.27 1.27 0 1 0 -2.54 0ZM13.24 8a0.76 0.76 0 1 0 1.52 0a0.76 0.76 0 1 0 -1.52 0ZM13.75 5a0.25 0.25 0 1 0 0.5 0a0.25 0.25 0 1 0 -0.5 0ZM13.75 2a0.25 0.25 0 1 0 0.5 0a0.25 0.25 0 1 0 -0.5 0Z',
    isFilled: true,
  },
} satisfies Record<string, ILookGlyph>;

type TLookGlyphId = keyof typeof GLYPHS;

/**
 * Which drawing stands for which form. EVERY FORM, BY THE TYPE.
 *
 * `Record<GraphStyle, ...>` rather than a lookup with a fallback, so a
 * fifty-eighth form cannot be added without somebody deciding what it looks
 * like. A fallback would have been kinder to write and would have shipped the
 * new form with the line glyph on it, which is worse than useless: it is a
 * picture that is confidently wrong, and nothing about the picker would look
 * broken enough for anybody to notice.
 *
 * The families, and why each one is a family rather than several:
 *
 *  - `line` also draws Weave, which is the same trace with a wobble worked
 *    into it. The wobble is the band's own level now rather than the fixed six
 *    pixels it used to be, so it reaches about twelve — still nothing at all in
 *    an icon sixteen across, which is why the family holds even though the
 *    reason it was written down no longer does.
 *  - `area` also draws Ridge. They are the same path in the engine; only the
 *    ballistics differ, and an icon cannot draw a time constant.
 *  - `bars` also draws Pillars and Fence, which are bars with the gaps closed
 *    and bars with two rails behind them.
 *  - `spikes` also draws Sawtooth and Crown — a triangle leaning, and a
 *    triangle with its tip cut off.
 *  - `dots` stands alone now. It used to cover Scatter as well, on the grounds
 *    that Scatter was the same mark with a second one halfway down the column —
 *    and halfway down was derived from the first rather than measured, so there
 *    was nothing for an icon to draw. Scatter marks the loudest and quietest
 *    point of each band now. Two marks at two measured heights is exactly the
 *    kind of thing sixteen pixels CAN say, so it gets its own.
 *  - `dashes` also draws Floating caps, which is the same mark three pixels
 *    thick instead of one.
 *  - `ladder` draws all four of the stacking forms — LED blocks, Ribs, Dot
 *    matrix and Honeycomb. They differ in the shape of the cell, and a cell at
 *    this size is a cell.
 *  - `streaks` draws both Rainfall and Warp speed: one fills the room above the
 *    trace and the other the room under it, which is a difference the icon has
 *    no trace to hang either off.
 */
const FORM_GLYPHS: Record<GraphStyle, TLookGlyphId> = {
  analyzer: 'analyzer',
  compare: 'compare',
  spectrogram: 'raster',
  rta: 'capped',
  average: 'twoSpeeds',
  waterfall: 'waterfall',
  loudness: 'scope',
  scope: 'beam',
  midside: 'midSide',
  notes: 'notes',
  energy: 'bands',
  phase: 'history',
  ledwall: 'ledBoard',
  towers: 'towers',
  tide: 'tide',
  halo: 'halo',
  synthwave: 'synth',
  ledbars: 'ledSegments',
  neonbars: 'neonTubes',
  bars3d: 'blocks3d',
  spectrumwave: 'waveEcho',
  silkwaves: 'silk',
  mirrorbars: 'mirrorBars',
  pixelbars: 'pixelBars',
  bouncedots: 'bounceDots',
  sparkbars: 'sparkBars',
  glitchbars: 'glitchBars',
  fallblocks: 'fallBlocks',
  fibers: 'fibers',
  afterglow: 'afterglow',
  halftone: 'halftone',
  line: 'line',
  area: 'area',
  bars: 'bars',
  dots: 'dots',
  steps: 'steps',
  blocks: 'ladder',
  spikes: 'spikes',
  ridge: 'area',
  stems: 'stems',
  terrace: 'terrace',
  dashes: 'dashes',
  scatter: 'spread',
  caps: 'dashes',
  ribs: 'ladder',
  pillars: 'bars',
  crown: 'spikes',
  weave: 'line',
  contour: 'contour',
  hatch: 'hatch',
  matrix: 'ladder',
  skyline: 'skyline',
  bezier: 'curve',
  ribbon: 'ribbon',
  feather: 'feather',
  truss: 'truss',
  zipper: 'zipper',
  slope: 'slope',
  stalactites: 'hanging',
  bubbles: 'bubbles',
  diamonds: 'diamonds',
  sawtooth: 'spikes',
  ecg: 'pulse',
  echo: 'echo',
  racer: 'road',
  invaders: 'sprite',
  starfield: 'streaks',
  candles: 'candles',
  arches: 'arches',
  flames: 'flames',
  barcode: 'barcode',
  rain: 'streaks',
  honeycomb: 'ladder',
  fence: 'bars',
  braid: 'braid',
  stitch: 'stitch',
  canyon: 'canyon',
  fluid: 'fluid',
  'wave-line': 'waveLine',
  'wave-outline': 'waveLine',
  'wave-filled': 'waveBody',
  'wave-ribbon': 'waveBody',
  'wave-bars': 'waveBars',
  'wave-mirror': 'waveBars',
  'wave-spikes': 'waveSpikes',
  'wave-dots': 'waveBeads',
  'wave-blocks': 'ladder',
  'wave-lattice': 'waveLattice',
};

interface ILookIconProps {
  /** The form. */
  style: GraphStyle;
  /** How it is coloured. */
  palette: GraphPalette;
  /**
   * A look's own gradient stops, straight off `IResolvedLook`.
   *
   * Empty means the palette's own colours, which is what every built-in flat
   * and rainbow look carries — the same value the chart is handed, passed
   * through to the same resolver, so an icon cannot disagree with the drawing
   * it stands for.
   */
  colours?: readonly string[];
  className?: string;
}

const LookIcon = ({
  style,
  palette,
  colours = [],
  className,
}: ILookIconProps) => {
  const glyph = GLYPHS[FORM_GLYPHS[style]];
  const ownPalette = resolveGraphPalette(style, palette);
  const paint = resolveTracePaint(
    ownPalette,
    resolveLookColours(ownPalette, colours),
    FLAT_PAINT,
    ICON_PLOT,
  );
  /*
   * A gradient is referenced by id, so every icon on screen needs its own.
   *
   * There may be a hundred rows of them mounted at once and the ramp differs
   * per row, so a shared definition in a `<defs>` somewhere would have to be
   * one per distinct ramp and keyed by its colours — machinery for a saving
   * that does not exist, since these are four stops apiece.
   *
   * The separators `useId` puts around its counter are not legal in a URL
   * fragment, and `fill="url(#...)"` is exactly that. Stripping them keeps the
   * uniqueness, which is the only property being asked of it.
   */
  const rampId = `look-ramp-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // One value for both attributes: whether it lands on `fill` or on `stroke` is
  // the glyph's business, and a ramp is written the same way either way.
  const ink = isTraceGradient(paint) ? `url(#${rampId})` : paint;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
      // Decorative: the row it sits in already carries the look's name, and a
      // second announcement of the same thing is one the reader has to skip.
      aria-hidden
      focusable="false"
    >
      {isTraceGradient(paint) && (
        <defs>
          <linearGradient
            id={rampId}
            // The ramp belongs to the box, not to the glyph — the same reason
            // the real one is pinned to the plot rather than to the figure.
            gradientUnits="userSpaceOnUse"
            x1={paint.x1}
            y1={paint.y1}
            x2={paint.x2}
            y2={paint.y2}
          >
            {paint.stops.map((stop) => (
              <stop
                // The offset IS the stop's identity: a ramp may legitimately
                // repeat a colour, and nothing here ever reorders.
                key={stop.offset}
                offset={stop.offset}
                stopColor={stop.colour}
              />
            ))}
          </linearGradient>
        </defs>
      )}
      <path
        d={glyph.d}
        fill={glyph.isFilled ? ink : 'none'}
        stroke={glyph.isFilled ? 'none' : ink}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default LookIcon;
