/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which of the Up Next list's entries are mounted (`LibraryUpNext`): the
 * entries over the scrollport and an overscan either side, from a table of
 * where each entry starts.
 */

/** A track row: 30px of picture with 6px either side of it. */
export const ROW_HEIGHT = 42;
/** Entries kept mounted beyond the scrollport, either side. */
const OVERSCAN = 6;
/**
 * How far the list scrolls before the mounted entries are worked out again.
 *
 * The panel used to re-render on every scroll event, a frame apart, to mount
 * the same rows it already had. The offset it works from now moves in steps
 * of the overscan, and the window reaches one step further down to cover the
 * scroll inside a step, so it renders once a step rather than once a frame.
 */
export const SCROLL_STEP = OVERSCAN * ROW_HEIGHT;

/** The first entry that starts at or below `y`. The offsets only ever grow. */
const firstEntryFrom = (offsets: readonly number[], y: number): number => {
  let low = 0;
  let high = offsets.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (offsets[middle] < y) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

/**
 * The entries to mount, for a list scrolled to somewhere in the step that
 * starts at `scrolledTo`.
 *
 * Searched rather than walked from the top: the queue holds two hundred
 * tracks and their headings, and this runs for every step of a scroll.
 */
export const upNextWindowFor = (
  layout: { offsets: readonly number[]; height: number },
  paneHeight: number,
  scrolledTo: number,
): { start: number; end: number } => {
  const viewport = paneHeight || ROW_HEIGHT * 12;
  // CLAMPED TO THE LIST AS IT IS NOW, not as it was when this offset was
  // last read.
  //
  // The queue shortens under this panel all the time — choosing a song
  // drops everything above it, removing a row drops one — and the offset
  // passed in is from before that happened. Left alone, the arithmetic ran
  // off the end: `start` landed past the last entry, so nothing mounted and
  // both spacers came out zero, and the panel went blank while the
  // scrollbar still claimed a list. That is the "it stops filling" and it
  // is intermittent because it needs the list to shrink under a scroll that
  // was already deep.
  const clamped = Math.max(
    0,
    Math.min(scrolledTo, Math.max(0, layout.height - viewport)),
  );
  const top = clamped - OVERSCAN * ROW_HEIGHT;
  const bottom = clamped + viewport + OVERSCAN * ROW_HEIGHT + SCROLL_STEP;
  // A row's height past an entry's start, whatever its kind: a heading ends
  // sooner, so it is kept a little longer than it needs to be, never less.
  const start = firstEntryFrom(layout.offsets, top - ROW_HEIGHT);
  const end = Math.max(start, firstEntryFrom(layout.offsets, bottom));
  return { start, end };
};
