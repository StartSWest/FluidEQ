/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_ANIMATION_FRAMES } from './studioAnimation';
import { SHEET_BOUNDS } from './pictureBounds';

/**
 * A still sheet's grid, read from the gaps between its frames, and the
 * scene's even grid the frames are laid into.
 */

export interface IGridPixels {
  width: number;
  height: number;
  /** RGBA, a row after another, as `ImageData` holds it. */
  data: Uint8ClampedArray;
}

export interface IGrid {
  columns: number;
  rows: number;
  /** Read from gaps between frames; otherwise only a likely guess. */
  found: boolean;
}

/** A pixel this transparent is empty, whatever its colour. */
const EMPTY_ALPHA = 8;
/** A colour this close to the background's, on each channel, is background. */
const BACKGROUND_SLACK = 6;
/** Frames of one sheet are the same size; runs this far apart are not frames. */
const RUN_SPREAD = 0.25;

const isBackgroundAt = (
  pixels: IGridPixels,
  at: number,
  background: readonly number[] | undefined,
) => {
  const { data } = pixels;
  if (data[at + 3] < EMPTY_ALPHA) {
    return true;
  }
  return (
    background !== undefined &&
    Math.abs(data[at] - background[0]) <= BACKGROUND_SLACK &&
    Math.abs(data[at + 1] - background[1]) <= BACKGROUND_SLACK &&
    Math.abs(data[at + 2] - background[2]) <= BACKGROUND_SLACK
  );
};

/** The background, when the four corners agree on an opaque colour. */
const flatBackground = (pixels: IGridPixels): number[] | undefined => {
  const { width, height, data } = pixels;
  const corners = [0, width - 1, (height - 1) * width, height * width - 1].map(
    (index) => Array.from(data.subarray(index * 4, index * 4 + 4)),
  );
  const [first] = corners;
  if (first[3] < EMPTY_ALPHA) {
    return undefined;
  }
  const agree = corners.every((corner) =>
    corner.every(
      (channel, at) => Math.abs(channel - first[at]) <= BACKGROUND_SLACK,
    ),
  );
  return agree ? first.slice(0, 3) : undefined;
};

/**
 * How many runs of drawing a line of pixels holds across one axis, when
 * they are about one size: the frames across that axis.
 */
const runsAcross = (empty: readonly boolean[]): number | undefined => {
  const runs: number[] = [];
  let length = 0;
  empty.forEach((isEmpty) => {
    if (isEmpty) {
      if (length > 0) {
        runs.push(length);
      }
      length = 0;
    } else {
      length += 1;
    }
  });
  if (length > 0) {
    runs.push(length);
  }
  if (runs.length < 1) {
    return undefined;
  }
  const largest = Math.max(...runs);
  // A frame's own gaps (between a creature's legs) split one frame's run
  // into pieces far smaller than the rest: then the gaps are not a grid's.
  return runs.every((run) => run >= largest * (1 - RUN_SPREAD))
    ? runs.length
    : undefined;
};

/**
 * A likely grid from the picture's size alone: a strip of square frames
 * when one side divides by the other, one frame otherwise.
 */
export const guessGrid = (width: number, height: number): IGrid => {
  if (width > height && width % height === 0) {
    return {
      columns: Math.min(width / height, MAX_ANIMATION_FRAMES),
      rows: 1,
      found: false,
    };
  }
  if (height > width && height % width === 0) {
    return {
      columns: 1,
      rows: Math.min(height / width, MAX_ANIMATION_FRAMES),
      found: false,
    };
  }
  return { columns: 1, rows: 1, found: false };
};

/**
 * The sheet's grid: from the empty or flat-coloured lines between frames,
 * or, with no such lines, a strip of square frames when the picture's
 * sides divide, or one frame. `found` says which.
 */
export const detectGrid = (pixels: IGridPixels): IGrid => {
  const { width, height } = pixels;
  const background = flatBackground(pixels);
  const emptyColumn = Array.from({ length: width }, (_, x) => {
    for (let y = 0; y < height; y += 1) {
      if (!isBackgroundAt(pixels, (y * width + x) * 4, background)) {
        return false;
      }
    }
    return true;
  });
  const emptyRow = Array.from({ length: height }, (_, y) => {
    for (let x = 0; x < width; x += 1) {
      if (!isBackgroundAt(pixels, (y * width + x) * 4, background)) {
        return false;
      }
    }
    return true;
  });
  const columns = runsAcross(emptyColumn);
  const rows = runsAcross(emptyRow);
  if (
    columns !== undefined &&
    rows !== undefined &&
    columns * rows > 1 &&
    columns * rows <= MAX_ANIMATION_FRAMES
  ) {
    return { columns, rows, found: true };
  }
  return guessGrid(width, height);
};

/** The largest a frame's cell is drawn in the scene's sheet. */
export const MAX_IMPORT_CELL = 512;
/** A sheet this many frames across at most: a row stays under the side. */
export const MAX_IMPORT_COLUMNS = 16;

export interface ISheetLayout {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
}

/**
 * The scene's sheet for `count` cells of frames `width` by `height`: one
 * row when they fit in sixteen, sixteen across otherwise; each cell the
 * frame's size, made smaller only as far as the largest cell, the sheet's
 * side and the pixels a sheet may hold (`SHEET_BOUNDS`) need.
 */
export const sheetLayout = (
  count: number,
  width: number,
  height: number,
): ISheetLayout => {
  const columns = Math.min(count, MAX_IMPORT_COLUMNS);
  const rows = Math.ceil(count / columns);
  const scale = Math.min(
    1,
    MAX_IMPORT_CELL / Math.max(width, height),
    SHEET_BOUNDS.side / (columns * width),
    SHEET_BOUNDS.side / (rows * height),
    Math.sqrt(SHEET_BOUNDS.pixels / (columns * rows * width * height)),
  );
  return {
    columns,
    rows,
    cellWidth: Math.max(1, Math.floor(width * scale)),
    cellHeight: Math.max(1, Math.floor(height * scale)),
  };
};
