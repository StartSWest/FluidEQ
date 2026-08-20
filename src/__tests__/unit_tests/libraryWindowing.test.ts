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

import { rowWindowFor } from '../../renderer/library/LibraryListView';
import { tileWindowFor } from '../../renderer/library/LibraryGridView';

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
    const { start, end } = tileWindowFor({
      scrollTop: 0,
      paneHeight: SCREEN,
      screenHeight: SCREEN,
      metrics: GRID_METRICS,
      count: ROWS,
    });
    expect(start).toBe(0);
    expect(end).toBeLessThan(300);
  });

  it('refuses a pane taller than the screen', () => {
    const { start, end } = tileWindowFor({
      scrollTop: 0,
      paneHeight: RUNAWAY_PANE,
      screenHeight: SCREEN,
      metrics: GRID_METRICS,
      count: ROWS,
    });
    expect(end - start).toBeLessThanOrEqual(600);
    expect(end).toBeLessThan(ROWS / 10);
  });

  it('caps the window even when the screen itself is absurd', () => {
    const { start, end } = tileWindowFor({
      scrollTop: 0,
      paneHeight: RUNAWAY_PANE,
      screenHeight: RUNAWAY_PANE,
      metrics: GRID_METRICS,
      count: ROWS,
    });
    expect(end - start).toBeLessThanOrEqual(600);
  });

  it('survives a single-column layout, which is what a narrow window gives', () => {
    // The resize that started all this. One column means one tile per row, so
    // the row count equals the tile count — the case most likely to overshoot.
    const { start, end } = tileWindowFor({
      scrollTop: 0,
      paneHeight: RUNAWAY_PANE,
      screenHeight: 700,
      metrics: { ...GRID_METRICS, columns: 1 },
      count: ROWS,
    });
    expect(end - start).toBeLessThanOrEqual(600);
  });

  it('mounts whole rows, so the last line is never ragged', () => {
    const { start, end } = tileWindowFor({
      scrollTop: 4_000,
      paneHeight: SCREEN,
      screenHeight: SCREEN,
      metrics: GRID_METRICS,
      count: ROWS,
    });
    expect(start % GRID_METRICS.columns).toBe(0);
    expect(end % GRID_METRICS.columns).toBe(0);
  });

  it('never runs past the end of the grid', () => {
    const { start, end } = tileWindowFor({
      scrollTop: 10_000_000,
      paneHeight: SCREEN,
      screenHeight: SCREEN,
      metrics: GRID_METRICS,
      count: ROWS,
    });
    expect(end).toBe(ROWS);
    expect(start).toBeLessThanOrEqual(end);
  });

  it('holds an empty grid at nothing', () => {
    expect(
      tileWindowFor({
        scrollTop: 0,
        paneHeight: SCREEN,
        screenHeight: SCREEN,
        metrics: GRID_METRICS,
        count: 0,
      }),
    ).toEqual({ start: 0, end: 0 });
  });
});
