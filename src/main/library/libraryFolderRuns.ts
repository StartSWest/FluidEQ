/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the folder headings of a song list fall, as two arrays of numbers.
 *
 * A heading stands before the first song of each run of one folder, in
 * whatever order the list is in, and it takes a row of its own — so a song's
 * row is its position plus every heading up to and including its own, and a
 * page of rows is some songs and the headings between them. SQL could answer
 * that with window functions over the whole list, at 200 ms a pass and two
 * passes a page on 14,077 songs. One pass over the folder column alone, in
 * the index's own order, answers it once per list and library version, and
 * what it keeps is a byte and a number per song — the runs, not the songs.
 */

export interface IFolderRuns {
  /** Songs in the list. */
  count: number;
  /** 1 where a heading stands before the song at that position. */
  starts: Uint8Array;
  /** Each song's row: its position plus every heading up to its own. */
  rows: Int32Array;
}

/**
 * The runs of a list, from its songs' folders in list order, pulled one at a
 * time from `nextFolder` — nothing when the list is done. Pulled rather than
 * handed over whole: the folders come straight off a statement over the
 * store, and are never all in memory at once.
 */
export const folderRunsOf = (
  count: number,
  nextFolder: () => string | undefined,
): IFolderRuns => {
  const starts = new Uint8Array(count);
  const rows = new Int32Array(count);
  let previous: string | undefined;
  let headings = 0;
  let at = 0;
  for (
    let folder = at < count ? nextFolder() : undefined;
    folder !== undefined;
    folder = at < count ? nextFolder() : undefined
  ) {
    if (at === 0 || folder !== previous) {
      starts[at] = 1;
      headings += 1;
    }
    rows[at] = at + headings;
    previous = folder;
    at += 1;
  }
  return { count: at, starts, rows: rows.subarray(0, at) };
};

/** Rows in the whole list, headings included. */
export const rowTotal = (runs: IFolderRuns): number =>
  runs.count === 0 ? 0 : runs.rows[runs.count - 1] + 1;

/** The first song whose own row is at or after `row` (`count` if none). */
export const songAtOrAfterRow = (runs: IFolderRuns, row: number): number => {
  let low = 0;
  let high = runs.count;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (runs.rows[middle] < row) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

/**
 * The songs a page of rows `[offset, end)` draws: every song whose own row or
 * heading row falls inside it. A song whose heading is the page's last row
 * belongs to the page for its heading alone.
 */
export const songsOfRows = (
  runs: IFolderRuns,
  offset: number,
  end: number,
): { first: number; last: number } => ({
  first: songAtOrAfterRow(runs, offset),
  // The first song whose heading row is at or past the end is not drawn;
  // one whose heading is the last row is, for the heading.
  last: Math.min(runs.count, songAtOrAfterRow(runs, end) + 1),
});
