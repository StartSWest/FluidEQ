/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where everything in the grid stands, and which of it belongs on screen —
 * from numbers alone, so nothing has to be mounted to be measured.
 *
 * The grid is runs of tiles, and between two runs a band across every column:
 * a search from inside a folder is that folder's matches, a band, and the
 * rest (`libraryRows.ts`). Each run starts a new row of the grid, because a
 * band spans the whole width and CSS grid places nothing beside it. Without a
 * search it is one run and no band, and every number here comes out as the
 * plain grid's did.
 */

import type { ILibraryRows } from './libraryRows';

/** How far beyond the viewport stays mounted, each way, in viewports. */
const OVERSCAN_VIEWPORTS = 3;

/** The most tiles the grid will mount, whatever it is told about the pane —
 * see `rowWindowFor` in `useListWindow.ts`, whose comment applies here word
 * for word. */
const MAX_WINDOW_TILES = 600;

/** A band's height: the section heading across the grid. */
export const GRID_BAND_HEIGHT = 40;

/** What the grid actually laid out, all of it measured. */
export interface IGridMetrics {
  tileHeight: number;
  rowGap: number;
  columns: number;
  padding: number;
}

/** A band, at its row of the list; or a run of tiles, `first` for `count`. */
export type TGridBlock =
  | { kind: 'band'; row: number }
  | { kind: 'tiles'; first: number; count: number };

/** The runs and bands of a list, in order. */
export const gridBlocksOf = (rows: ILibraryRows): TGridBlock[] => {
  const blocks: TGridBlock[] = [];
  let next = 0;
  rows.sections.forEach(({ row }) => {
    if (row > next) {
      blocks.push({ kind: 'tiles', first: next, count: row - next });
    }
    blocks.push({ kind: 'band', row });
    next = row + 1;
  });
  if (rows.count > next) {
    blocks.push({ kind: 'tiles', first: next, count: rows.count - next });
  }
  return blocks;
};

interface IPlacedBlock {
  block: TGridBlock;
  /** From the top of the content, the grid's padding not included. */
  top: number;
  /** Without the gap that follows it. */
  height: number;
}

const place = (
  blocks: readonly TGridBlock[],
  metrics: IGridMetrics,
): { placed: IPlacedBlock[]; total: number } => {
  const pitch = metrics.tileHeight + metrics.rowGap;
  const placed: IPlacedBlock[] = [];
  let y = 0;
  blocks.forEach((block) => {
    const height =
      block.kind === 'band'
        ? GRID_BAND_HEIGHT
        : Math.ceil(block.count / metrics.columns) * pitch - metrics.rowGap;
    placed.push({ block, top: y, height });
    y += height + metrics.rowGap;
  });
  return { placed, total: Math.max(0, y - metrics.rowGap) };
};

/** One thing to mount: a band, or a slice of a run of tiles by list row. */
export type TGridMounted =
  { kind: 'band'; row: number } | { kind: 'tiles'; start: number; end: number };

export interface IGridWindow {
  /** Empty space above what is mounted, as a spacer's own height. */
  above: number;
  mounted: TGridMounted[];
  below: number;
  /** The list rows under the tiles mounted, for asking their pages. */
  start: number;
  end: number;
}

/**
 * What to mount for where the grid is scrolled to: whole rows of tiles only —
 * half a row leaves a ragged edge the reader reads as missing art — and every
 * band in reach.
 *
 * Pure and tested for the reason `rowWindowFor` is: `paneHeight` is a
 * measurement and a measurement can be absurd, so the screen caps what is
 * believed and `MAX_WINDOW_TILES` caps the result regardless.
 */
export const gridWindowFor = ({
  scrollTop,
  paneHeight,
  screenHeight,
  metrics,
  blocks,
}: {
  scrollTop: number;
  paneHeight: number;
  screenHeight: number;
  metrics: IGridMetrics;
  blocks: readonly TGridBlock[];
}): IGridWindow => {
  const { tileHeight, rowGap, columns, padding } = metrics;
  const pitch = tileHeight + rowGap;
  const { placed, total } = place(blocks, metrics);
  const viewport = Math.min(paneHeight || pitch * 3, screenHeight);
  const overscan = viewport * OVERSCAN_VIEWPORTS;
  const viewTop = scrollTop - padding - overscan;
  const viewBottom = scrollTop - padding + viewport + overscan;

  const mounted: TGridMounted[] = [];
  let firstTop: number | undefined;
  let lastBottom = 0;
  let budget = MAX_WINDOW_TILES;
  let start = Number.MAX_SAFE_INTEGER;
  let end = 0;
  placed.forEach(({ block, top, height }) => {
    if (budget <= 0 || top > viewBottom || top + height < viewTop) {
      return;
    }
    if (block.kind === 'band') {
      mounted.push(block);
      firstTop = firstTop ?? top;
      lastBottom = top + height;
      return;
    }
    const rowsInBlock = Math.ceil(block.count / columns);
    const firstRow = Math.max(0, Math.floor((viewTop - top) / pitch));
    const lastRow = Math.min(
      rowsInBlock,
      Math.max(firstRow, Math.ceil((viewBottom - top) / pitch)),
    );
    const sliceStart = block.first + firstRow * columns;
    const sliceEnd = Math.min(
      block.first + block.count,
      block.first + lastRow * columns,
      sliceStart + budget,
    );
    if (sliceEnd <= sliceStart) {
      return;
    }
    budget -= sliceEnd - sliceStart;
    mounted.push({ kind: 'tiles', start: sliceStart, end: sliceEnd });
    start = Math.min(start, sliceStart);
    end = Math.max(end, sliceEnd);
    const rowTop = top + firstRow * pitch;
    firstTop = firstTop ?? rowTop;
    lastBottom =
      top + Math.ceil((sliceEnd - block.first) / columns) * pitch - rowGap;
  });

  // A spacer is a grid item too and brings a gap after it; what it stands in
  // for already counted one, hence the `- rowGap` either side.
  const above = firstTop === undefined ? 0 : Math.max(0, firstTop - rowGap);
  const below =
    firstTop === undefined
      ? Math.max(0, total)
      : Math.max(0, total - lastBottom - rowGap);
  return {
    above,
    mounted,
    below,
    start: start === Number.MAX_SAFE_INTEGER ? 0 : start,
    end,
  };
};

/** How far down the content a list row's tile starts, for scrolling to it. */
export const gridRowTop = (
  row: number,
  blocks: readonly TGridBlock[],
  metrics: IGridMetrics,
): number | undefined => {
  const { placed } = place(blocks, metrics);
  const pitch = metrics.tileHeight + metrics.rowGap;
  const found = placed.find(({ block }) =>
    block.kind === 'band'
      ? block.row === row
      : row >= block.first && row < block.first + block.count,
  );
  if (found === undefined) {
    return undefined;
  }
  return found.block.kind === 'band'
    ? found.top
    : found.top +
        Math.floor((row - found.block.first) / metrics.columns) * pitch;
};
