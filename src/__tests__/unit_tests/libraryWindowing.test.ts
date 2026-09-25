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
  gridWindowFor,
  IGridWindow,
  TGridBlock,
} from '../../renderer/library/libraryGridLayout';
import { rowWindowFor } from '../../renderer/library/useListWindow';

/**
 * The library's list and grid mount only the rows near the viewport. How many
 * that is comes from a measurement, and a measurement can be absurd: on a
 * resize the pane stopped being height-constrained, reported the full height
 * of its own contents, and both views obediently mounted every row of a
 * fourteen-thousand-track library. The app reached 5GB and the window froze.
 *
 * These are the guards against that, tested as arithmetic rather than through
 * a rendered component — jsdom has no layout, so the only honest way to hand
 * these functions an absurd pane height is to hand it to them directly.
 */

/** A 14,077-row library at the 46px `$library-row-height` the stylesheet sets
 * — the real numbers from the window this was measured in. */
const ROWS = 14_077;
const ROW_HEIGHT = 46;
/** What that list's scroll container reports as its full content height, and
 * what `clientHeight` came back as when the pane lost its constraint. */
const RUNAWAY_PANE = ROWS * ROW_HEIGHT;
const SCREEN = 1392;

const GRID_METRICS = {
  tileHeight: 196,
  rowGap: 16,
  columns: 6,
  padding: 16,
};

/** The whole library as one run of tiles: a grid with nothing searched. */
const ONE_RUN: TGridBlock[] = [{ kind: 'tiles', first: 0, count: ROWS }];

/** Every tile the window mounts, however many slices it came in. */
const tilesMounted = (grid: IGridWindow): number =>
  grid.mounted.reduce(
    (total, entry) =>
      entry.kind === 'tiles' ? total + entry.end - entry.start : total,
    0,
  );

describe('the list window', () => {
  it('mounts a few screenfuls, not the whole library', () => {
    const { start, end } = rowWindowFor({
      scrollTop: 0,
      paneHeight: SCREEN,
      screenHeight: SCREEN,
      rowHeight: ROW_HEIGHT,
      count: ROWS,
    });
    expect(start).toBe(0);
    // Four viewports below the top — the screenful plus three of overscan.
    expect(end).toBe(Math.ceil((SCREEN * 4) / ROW_HEIGHT));
    expect(end).toBeLessThan(200);
  });

  it('refuses a pane taller than the screen, which is what cost 5GB', () => {
    const { start, end } = rowWindowFor({
      scrollTop: 0,
      // The pane reporting the height of everything inside it. Believing this
      // is what mounted fourteen thousand rows.
      paneHeight: RUNAWAY_PANE,
      screenHeight: SCREEN,
      rowHeight: ROW_HEIGHT,
      count: ROWS,
    });
    expect(start).toBe(0);
    expect(end - start).toBeLessThanOrEqual(600);
    // And specifically: nothing like the whole library.
    expect(end).toBeLessThan(ROWS / 10);
  });

  it('caps the window even when the screen itself is absurd', () => {
    // A second line of defence, and it has to hold on its own: the screen
    // height is a measurement too.
    const { start, end } = rowWindowFor({
      scrollTop: 0,
      paneHeight: RUNAWAY_PANE,
      screenHeight: RUNAWAY_PANE,
      rowHeight: ROW_HEIGHT,
      count: ROWS,
    });
    expect(end - start).toBe(600);
  });

  it('keeps the window near the scroll position rather than at the top', () => {
    const scrollTop = 300_000;
    const { start, end } = rowWindowFor({
      scrollTop,
      paneHeight: SCREEN,
      screenHeight: SCREEN,
      rowHeight: ROW_HEIGHT,
      count: ROWS,
    });
    const row = Math.floor(scrollTop / ROW_HEIGHT);
    expect(start).toBeLessThan(row);
    expect(end).toBeGreaterThan(row);
    expect(end - start).toBeLessThan(600);
  });

  it('never runs past the end of the list', () => {
    const { start, end } = rowWindowFor({
      scrollTop: ROWS * ROW_HEIGHT,
      paneHeight: SCREEN,
      screenHeight: SCREEN,
      rowHeight: ROW_HEIGHT,
      count: ROWS,
    });
    expect(end).toBe(ROWS);
    expect(start).toBeLessThanOrEqual(end);
  });

  it('mounts something before the pane has been laid out', () => {
    // `clientHeight` is zero until the first layout, and a window of nothing
    // would leave the body empty with no height to measure on the next pass.
    const { start, end } = rowWindowFor({
      scrollTop: 0,
      paneHeight: 0,
      screenHeight: SCREEN,
      rowHeight: ROW_HEIGHT,
      count: ROWS,
    });
    expect(start).toBe(0);
    expect(end).toBeGreaterThan(0);
    expect(end - start).toBeLessThanOrEqual(600);
  });

  it('holds an empty list at nothing rather than at a negative', () => {
    expect(
      rowWindowFor({
        scrollTop: 0,
        paneHeight: SCREEN,
        screenHeight: SCREEN,
        rowHeight: ROW_HEIGHT,
        count: 0,
      }),
    ).toEqual({ start: 0, end: 0 });
  });
});

describe('the grid window', () => {
  it('mounts a few rows of tiles, not the whole library', () => {
    const grid = gridWindowFor({
      scrollTop: 0,
      paneHeight: SCREEN,
      screenHeight: SCREEN,
      metrics: GRID_METRICS,
      blocks: ONE_RUN,
    });
    expect(grid.start).toBe(0);
    expect(grid.end).toBeGreaterThan(0);
    expect(grid.end).toBeLessThan(300);
    expect(tilesMounted(grid)).toBe(grid.end - grid.start);
  });

  it('refuses a pane taller than the screen', () => {
    const grid = gridWindowFor({
      scrollTop: 0,
      paneHeight: RUNAWAY_PANE,
      screenHeight: SCREEN,
      metrics: GRID_METRICS,
      blocks: ONE_RUN,
    });
    expect(tilesMounted(grid)).toBeLessThanOrEqual(600);
    expect(grid.end).toBeLessThan(ROWS / 10);
  });

  it('caps the window even when the screen itself is absurd', () => {
    const grid = gridWindowFor({
      scrollTop: 0,
      paneHeight: RUNAWAY_PANE,
      screenHeight: RUNAWAY_PANE,
      metrics: GRID_METRICS,
      blocks: ONE_RUN,
    });
    expect(tilesMounted(grid)).toBeLessThanOrEqual(600);
  });

  it('survives a single-column layout, which is what a narrow window gives', () => {
    // The resize that started all this. One column means one tile per row, so
    // the row count equals the tile count — the case most likely to overshoot.
    const grid = gridWindowFor({
      scrollTop: 0,
      paneHeight: RUNAWAY_PANE,
      screenHeight: 700,
      metrics: { ...GRID_METRICS, columns: 1 },
      blocks: ONE_RUN,
    });
    expect(tilesMounted(grid)).toBeLessThanOrEqual(600);
  });

  it('caps the window across runs too, not one run at a time', () => {
    // A search from inside a folder is two runs of tiles with a band between
    // them. A cap applied per run would let each mount its own six hundred.
    const grid = gridWindowFor({
      scrollTop: 0,
      paneHeight: RUNAWAY_PANE,
      screenHeight: RUNAWAY_PANE,
      metrics: GRID_METRICS,
      blocks: [
        { kind: 'band', row: 0 },
        { kind: 'tiles', first: 1, count: 5_000 },
        { kind: 'band', row: 5_001 },
        { kind: 'tiles', first: 5_002, count: 9_000 },
      ],
    });
    expect(tilesMounted(grid)).toBeLessThanOrEqual(600);
  });

  it('mounts whole rows, so the last line is never ragged', () => {
    // Far enough down that the overscan above does not reach the top: a
    // window starting at tile 0 is a whole row by accident.
    const grid = gridWindowFor({
      scrollTop: 40_000,
      paneHeight: SCREEN,
      screenHeight: SCREEN,
      metrics: GRID_METRICS,
      blocks: ONE_RUN,
    });
    expect(grid.start).toBeGreaterThan(0);
    expect(grid.start % GRID_METRICS.columns).toBe(0);
    expect(grid.end % GRID_METRICS.columns).toBe(0);
  });

  it('starts every run on a row of its own, whole rows either side of a band', () => {
    // A band spans every column and CSS grid places nothing beside it, so the
    // run after one starts a new row — counted from the run, not the list.
    const grid = gridWindowFor({
      scrollTop: 0,
      paneHeight: SCREEN,
      screenHeight: SCREEN,
      metrics: GRID_METRICS,
      blocks: [
        { kind: 'band', row: 0 },
        { kind: 'tiles', first: 1, count: 4 },
        { kind: 'band', row: 5 },
        { kind: 'tiles', first: 6, count: 20 },
      ],
    });
    expect(grid.mounted).toEqual([
      { kind: 'band', row: 0 },
      { kind: 'tiles', start: 1, end: 5 },
      { kind: 'band', row: 5 },
      { kind: 'tiles', start: 6, end: 26 },
    ]);
  });

  it('never runs past the end of the grid', () => {
    const pitch = GRID_METRICS.tileHeight + GRID_METRICS.rowGap;
    const content =
      Math.ceil(ROWS / GRID_METRICS.columns) * pitch -
      GRID_METRICS.rowGap +
      GRID_METRICS.padding * 2;
    // Scrolled to the very bottom: the last tile is mounted and nothing after.
    const bottom = gridWindowFor({
      scrollTop: content - SCREEN,
      paneHeight: SCREEN,
      screenHeight: SCREEN,
      metrics: GRID_METRICS,
      blocks: ONE_RUN,
    });
    expect(bottom.end).toBe(ROWS);
    expect(bottom.start).toBeLessThanOrEqual(bottom.end);
    // And a scroll position past the content — a list that shrank before the
    // pane clamped its scroll — mounts nothing that is not there.
    const past = gridWindowFor({
      scrollTop: 10_000_000,
      paneHeight: SCREEN,
      screenHeight: SCREEN,
      metrics: GRID_METRICS,
      blocks: ONE_RUN,
    });
    expect(past.end).toBeLessThanOrEqual(ROWS);
    expect(past.start).toBeLessThanOrEqual(past.end);
  });

  it('holds an empty grid at nothing', () => {
    expect(
      gridWindowFor({
        scrollTop: 0,
        paneHeight: SCREEN,
        screenHeight: SCREEN,
        metrics: GRID_METRICS,
        blocks: [],
      }),
    ).toEqual({ above: 0, mounted: [], below: 0, start: 0, end: 0 });
  });
});
