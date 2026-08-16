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

/** Room for the piano keys down the left edge. */
const PLOT_LEFT = 54;

/** A margin on the right, so the last note is not flush against the frame. */
const PLOT_RIGHT_INSET = 18;

/** Room under the plot for the time ruler. */
const PLOT_BOTTOM_INSET = 28;

/** The pitch range the grid covers, in MIDI note numbers. */
export const MIN_NOTE_MIDI = 24;
export const MAX_NOTE_MIDI = 96;

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
