/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A still sheet's grid read from the gaps between its frames, guessed from
 * its size when it has none, and the scene's even sheet the frames are laid
 * into. Each rule beside its control.
 */

import { SHEET_BOUNDS } from '../../../common/pictureBounds';
import { gridFrames } from '../../../renderer/studio/animations/import/importDecode';
import {
  detectGrid,
  guessGrid,
  MAX_IMPORT_CELL,
  MAX_IMPORT_COLUMNS,
  sheetLayout,
} from '../../../renderer/studio/animations/import/importGrid';

/**
 * A `columns` by `rows` sheet of `cell` px cells on `background` (RGBA),
 * each holding a block inset by `inset`, and `holes` columns of background
 * inside every block (a creature's legs).
 */
const sheet = ({
  columns,
  rows,
  cell,
  inset,
  background = [0, 0, 0, 0],
  holes = [] as number[],
}: {
  columns: number;
  rows: number;
  cell: number;
  inset: number;
  background?: number[];
  holes?: number[];
}) => {
  const width = columns * cell;
  const height = rows * cell;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cx = x % cell;
      const cy = y % cell;
      const inside =
        cx >= inset &&
        cx < cell - inset &&
        cy >= inset &&
        cy < cell - inset &&
        !holes.includes(cx);
      data.set(inside ? [200, 120, 40, 255] : background, (y * width + x) * 4);
    }
  }
  return { width, height, data };
};

describe('a sheet’s grid', () => {
  it('is read from transparent gaps between the frames', () => {
    expect(
      detectGrid(sheet({ columns: 4, rows: 2, cell: 20, inset: 3 })),
    ).toEqual({
      columns: 4,
      rows: 2,
      found: true,
    });
  });

  it('is read from a flat-coloured background as well', () => {
    expect(
      detectGrid(
        sheet({
          columns: 3,
          rows: 3,
          cell: 20,
          inset: 3,
          background: [255, 0, 255, 255],
        }),
      ),
    ).toEqual({ columns: 3, rows: 3, found: true });
  });

  it('control: a gap inside every frame does not split it into frames', () => {
    // A two-pixel gap between the legs, in every frame at the same place.
    expect(
      detectGrid(
        sheet({ columns: 4, rows: 1, cell: 30, inset: 2, holes: [6, 7] }),
      ),
    ).toEqual({ columns: 4, rows: 1, found: false });
  });

  it('is guessed as a strip of square frames when there are no gaps', () => {
    expect(
      detectGrid(sheet({ columns: 5, rows: 1, cell: 16, inset: 0 })),
    ).toEqual({
      columns: 5,
      rows: 1,
      found: false,
    });
    expect(guessGrid(16, 96)).toEqual({ columns: 1, rows: 6, found: false });
  });

  it('control: a picture whose sides do not divide is one frame until set', () => {
    expect(guessGrid(100, 70)).toEqual({ columns: 1, rows: 1, found: false });
  });
});

describe('a still sheet cut by the grid the member set', () => {
  it('is its first cells, left to right and top to bottom', () => {
    const frames = gridFrames(120, 60, { columns: 3, rows: 2 }, 4);
    expect(frames.map(({ sx, sy, sw, sh }) => [sx, sy, sw, sh])).toEqual([
      [0, 0, 40, 30],
      [40, 0, 40, 30],
      [80, 0, 40, 30],
      [0, 30, 40, 30],
    ]);
  });

  it('control: every cell when the frames fill the grid', () => {
    expect(gridFrames(120, 60, { columns: 3, rows: 2 }, 6)).toHaveLength(6);
  });
});

describe('the scene’s sheet', () => {
  it('is one row for up to sixteen cells, at the frames’ own size', () => {
    expect(sheetLayout(8, 120, 80)).toEqual({
      columns: 8,
      rows: 1,
      cellWidth: 120,
      cellHeight: 80,
    });
  });

  it('is sixteen across for more', () => {
    expect(sheetLayout(40, 64, 64)).toMatchObject({
      columns: MAX_IMPORT_COLUMNS,
      rows: 3,
    });
  });

  it('makes a frame larger than a cell may be smaller, keeping its shape', () => {
    const layout = sheetLayout(4, 1024, 512);
    expect(layout.cellWidth).toBe(MAX_IMPORT_CELL);
    expect(layout.cellHeight).toBe(MAX_IMPORT_CELL / 2);
  });

  it('keeps the sheet inside what a sheet may hold', () => {
    const layout = sheetLayout(256, 500, 500);
    const width = layout.columns * layout.cellWidth;
    const height = layout.rows * layout.cellHeight;
    expect(width).toBeLessThanOrEqual(SHEET_BOUNDS.side);
    expect(height).toBeLessThanOrEqual(SHEET_BOUNDS.side);
    expect(width * height).toBeLessThanOrEqual(SHEET_BOUNDS.pixels);
  });

  it('control: small frames are never made larger', () => {
    expect(sheetLayout(2, 10, 10)).toMatchObject({
      cellWidth: 10,
      cellHeight: 10,
    });
  });
});
