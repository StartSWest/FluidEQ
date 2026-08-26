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
 * The bands stacked above the pitch grid, in pixels from the canvas top.
 *
 * A layout in numbers rather than in CSS, because the whole header is drawn
 * into the same canvas as the grid — there are no elements here to lay out.
 * They were loose constants beside the component's unrelated ones; the paint
 * and the hit-testing both measure against them, so they belong with the rest
 * of the geometry.
 */
export const WAVEFORM_TOP = 9;
/**
 * Tall enough for three readable rows — the mix, the backing track and the
 * voice a separation produces — at ~25 px each. It was 27 px, sized for one
 * overview wave, and three waves crammed into it were unreadable ribbons.
 * A song without stems draws its single wave across the full height, which
 * is strictly an upgrade. Everything below derives from these constants, so
 * the section band, lyric lanes, plot and hit-testing all move together.
 */
export const WAVEFORM_HEIGHT = 81;
export const SECTION_GROUP_TOP = 97;
export const SECTION_GROUP_HEIGHT = 30;
/** Where the lyric lanes start before any section groups push them down. */
export const BASE_LYRIC_SECTION_TOP = 97;
// 26, down from 34: with the wave strip grown to three rows, the lyric band
// was the tallest thing on the stage while holding one line of text per lane.
export const LYRIC_LANE_HEIGHT = 26;

/**
 * How far a word-boundary drag handle's hit region reaches below its own
 * lane's centre (`paintLyrics.ts`'s `wordCenterY + WORD_BOUNDARY_HANDLE_
 * REACH`). Fixed on purpose, not a fraction of `lyricLaneHeight`: a drag
 * target has to stay grabbable at any lane height, so it does not shrink
 * with the lane the way the word box and text clip below it do.
 *
 * Read here, rather than left as a bare `21` only inside `paintLyrics.ts`,
 * because `paintTranslation.ts` also needs it: the last original lane's own
 * handle reaches past that lane's bottom edge into the translation row
 * beneath it, and the row has to know by how much to stay clear of it.
 */
export const WORD_BOUNDARY_HANDLE_REACH = 21;

// Used only at the small window size, and only while a translation row is
// also showing (see useMakerCanvasModel.ts). Not an arbitrary cut: 22 is the
// smallest this may go and still leave the translation row's own text clear
// of the previous lane's boundary handle. That handle reaches
// `WORD_BOUNDARY_HANDLE_REACH - height / 2` past this lane's own bottom
// edge — 10px at height 22, worse than at the normal 26px lane (8px) — and
// TRANSLATION_LANE_HEIGHT below reserves exactly that worst case as dead
// space, which still leaves that row 16px for its own content. Going
// smaller than 22 would eat into that 16px.
export const COMPACT_LYRIC_LANE_HEIGHT = 22;

// Reuses LYRIC_LANE_HEIGHT rather than a bespoke number, split in
// paintTranslation.ts into two pieces that are each independently checked:
// - 10px of dead space at the top, always reserved regardless of window
//   size: `WORD_BOUNDARY_HANDLE_REACH - COMPACT_LYRIC_LANE_HEIGHT / 2` =
//   21 - 11 = 10, the worst-case reach of the previous lane's boundary
//   handle (see COMPACT_LYRIC_LANE_HEIGHT above) — using the worst case
//   always, rather than recomputing per frame, keeps the row's own text at
//   one fixed position instead of shifting when the window crosses the
//   small-window breakpoint.
// - 16px left over for the row's own text: an 11px line needs about 14px at
//   a browser's own default 1.2 line-height (11 * 1.2 = 13.2, rounded up to
//   14), so 16 leaves a couple of pixels to spare rather than sitting
//   exactly on the limit.
// 10 + 16 = 26 = LYRIC_LANE_HEIGHT. This is the height the budget grows
// by — never the height that shrinks; only COMPACT_LYRIC_LANE_HEIGHT above
// does that.
export const TRANSLATION_LANE_HEIGHT = LYRIC_LANE_HEIGHT;

/** Room for the piano keys down the left edge. */
const PLOT_LEFT = 54;

/** A margin on the right, so the last note is not flush against the frame. */
const PLOT_RIGHT_INSET = 18;

/** Room under the plot for the time ruler. */
const PLOT_BOTTOM_INSET = 28;

/** The pitch range the grid covers, in MIDI note numbers. */
export const MIN_NOTE_MIDI = 24;
export const MAX_NOTE_MIDI = 96;

/**
 * How tall the lyric band is: the original lanes at `laneHeight` each, plus a
 * translated row underneath when one is showing (0 when it is not).
 *
 * `laneHeight` is a parameter rather than always `LYRIC_LANE_HEIGHT` because
 * it is the value that shrinks at the small window size — see
 * `COMPACT_LYRIC_LANE_HEIGHT` and `useMakerCanvasModel.ts`. The backdrop and
 * the model both call this with whatever height is actually in effect that
 * frame, so the background band and the words painted on it never disagree
 * about where the lyric section ends.
 */
export const lyricSectionHeight = (
  laneCount: number,
  laneHeight: number,
  translationLaneHeight = 0,
): number => laneCount * laneHeight + translationLaneHeight;

/** What a drag against a hit region is trying to do. */
export type TMakerDragBehavior = 'move' | 'resize-start' | 'resize-end';

/**
 * A rectangle the pointer can land on, published by the paint.
 *
 * The painting is the only thing that knows where anything ended up, so it
 * records these as it goes and the pointer handlers read them back. Which is
 * why the type belongs with the geometry rather than with either half: it is
 * the contract between them.
 */
export interface IHitRegion {
  kind: 'word' | 'note';
  id: string;
  behavior?: TMakerDragBehavior;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Begin a rounded rectangle path. The caller fills or strokes it.
 *
 * Separated from filling because most of the editor's shapes are drawn twice —
 * once filled, once stroked — and building the path once is the point.
 */
export const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
};

const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
];

/**
 * A MIDI note number as a name: 60 is `C4`.
 *
 * Sharps only, never flats. The grid has one row per semitone, so a row can
 * carry one name — offering `A♯`/`B♭` would need two labels for one line.
 *
 * The modulo is written twice on purpose: `%` keeps the sign in JavaScript, so
 * a negative note number would index off the front of the array.
 */
export const midiName = (midi: number): string => {
  const rounded = Math.round(midi);
  return `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${
    Math.floor(rounded / 12) - 1
  }`;
};

export interface IMakerPlotInput {
  width: number;
  height: number;
  /** Where the lyric lanes end and the pitch grid begins. */
  headerHeight: number;
  viewStartMs: number;
  visibleViewDurationMs: number;
}

export interface IMakerPlot {
  left: number;
  right: number;
  width: number;
  top: number;
  bottom: number;
  height: number;
  /** Milliseconds to a horizontal pixel. */
  timeX: (timeMs: number) => number;
  /** A MIDI note number to a vertical pixel. */
  noteY: (midi: number) => number;
  /** The inverse of `timeX`, for turning a click back into a moment. */
  xTime: (x: number) => number;
  /** The inverse of `noteY`. Fractional — callers round to taste. */
  yNote: (y: number) => number;
}

/**
 * The editor's coordinate system: where a moment and a pitch land in pixels.
 *
 * Everything drawn on the timeline and everything clicked on it agree because
 * they use these. They were six local constants and two arrows declared inside
 * a nine-hundred-line paint effect, which meant the hit-testing that has to
 * invert them could not reach them and re-derived the same arithmetic from the
 * same constants somewhere else.
 *
 * The inverses are here for that reason. `xTime` and `yNote` are not used by
 * the painting at all — they exist so that turning a click back into a time or
 * a note is the same arithmetic run backwards, rather than a second version of
 * it that has to be kept in step by hand.
 *
 * `width` and `height` are clamped to at least 1: a zero-width plot makes every
 * `timeX` infinite, and the editor is briefly zero-sized while it mounts.
 */
export const makerPlot = ({
  width,
  height,
  headerHeight,
  viewStartMs,
  visibleViewDurationMs,
}: IMakerPlotInput): IMakerPlot => {
  const left = PLOT_LEFT;
  const right = width - PLOT_RIGHT_INSET;
  const plotWidth = Math.max(1, right - left);
  const top = headerHeight;
  const bottom = height - PLOT_BOTTOM_INSET;
  const plotHeight = Math.max(1, bottom - top);
  const midiSpan = MAX_NOTE_MIDI - MIN_NOTE_MIDI;

  return {
    left,
    right,
    width: plotWidth,
    top,
    bottom,
    height: plotHeight,
    timeX: (timeMs) =>
      left + ((timeMs - viewStartMs) / visibleViewDurationMs) * plotWidth,
    noteY: (midi) => top + ((MAX_NOTE_MIDI - midi) / midiSpan) * plotHeight,
    xTime: (x) =>
      viewStartMs + ((x - left) / plotWidth) * visibleViewDurationMs,
    yNote: (y) => MAX_NOTE_MIDI - ((y - top) / plotHeight) * midiSpan,
  };
};
