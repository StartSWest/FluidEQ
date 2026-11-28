/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A far-city strip packed into a scene's artwork, and the line its edge drew
 * (Neon City, 2026-11-28: "there are some weird lines appearing on some
 * scenes"). The strip is see-through at the top, where the sky shows past its
 * towers, and solid at the bottom. Packed as a tile, its gutter was its own
 * wrapped pixels, so the rows right above its top were its solid bottom rows,
 * and a mipmap of that edge - the scene drawn at 50% - mixed them into a dark
 * line across the whole sky.
 *
 * The draws are laid out here on a grid of alpha values, the way the window
 * lays them on its canvas (copies of the piece at its size, a one-row copy
 * stretched down its rows, all cut to the gutter), and the edge is read the
 * way a mipmap's next level reads it: two rows averaged.
 */

import {
  pieceDraws,
  type IPieceDraw,
} from '../../../renderer/studio/chat/chatPackGutter';
import type { TStudioArtworkKind } from '../../../common/studioChat';

const GUTTER = 4;
const WIDTH = 6;
// Top row see-through sky, then a tower's tip, then solid city.
const STRIP = [
  [0, 0, 0, 0, 0, 0],
  [0, 0, 255, 0, 0, 0],
  [0, 255, 255, 255, 0, 0],
  [255, 255, 255, 255, 255, 255],
  [255, 255, 255, 255, 255, 255],
];
const HEIGHT = STRIP.length;

/** The piece and its gutter as the window's canvas holds them. */
const packed = (kind: TStudioArtworkKind) => {
  const piece = {
    x: GUTTER,
    y: GUTTER,
    width: WIDTH,
    height: HEIGHT,
    kind,
    gutter: GUTTER,
  };
  const rows = HEIGHT + GUTTER * 2;
  const columns = WIDTH + GUTTER * 2;
  const grid = Array.from({ length: rows }, () =>
    new Array<number>(columns).fill(0),
  );
  const lay = ({ from, to }: IPieceDraw) => {
    for (let y = 0; y < to.height; y += 1) {
      for (let x = 0; x < to.width; x += 1) {
        const atY = to.y + y;
        const atX = to.x + x;
        // Cut to the gutter, as the window's clip does.
        if (atY >= 0 && atY < rows && atX >= 0 && atX < columns) {
          const sourceY = from.y + Math.floor((y * from.height) / to.height);
          const sourceX = from.x + Math.floor((x * from.width) / to.width);
          grid[atY][atX] = STRIP[sourceY][sourceX];
        }
      }
    }
  };
  pieceDraws(piece).forEach(lay);
  return grid;
};

/** The next mip level's row over the piece's top edge: its top row and the one above, averaged. */
const edgeMip = (grid: number[][]) =>
  grid[GUTTER].map((alpha, column) => (alpha + grid[GUTTER - 1][column]) / 2);

describe('the gutter of a strip that repeats across', () => {
  it('holds its own top row above it, so the edge stays as see-through as the sky it ends in', () => {
    const grid = packed('strip');

    expect(edgeMip(grid)).toEqual(new Array(WIDTH + GUTTER * 2).fill(0));
    expect(grid.slice(0, GUTTER)).toEqual(new Array(GUTTER).fill(grid[GUTTER]));
  });

  it('holds its own bottom row below it, and wraps at its sides', () => {
    const grid = packed('strip');

    grid
      .slice(GUTTER + HEIGHT)
      .forEach((row) => expect(row).toEqual(grid[GUTTER + HEIGHT - 1]));
    // The column left of the strip is its last column, wrapped round.
    expect(grid.map((row) => row[GUTTER - 1])).toEqual(
      grid.map((row) => row[GUTTER + WIDTH - 1]),
    );
  });

  // The control: packed as a tile, the strip's own solid bottom rows sit
  // right above its top, which is the line Neon City drew.
  it('draws the line it was drawing when packed as a tile', () => {
    const grid = packed('tile');

    expect(grid[GUTTER - 1]).toEqual(new Array(WIDTH + GUTTER * 2).fill(255));
    expect(Math.min(...edgeMip(grid))).toBe(127.5);
  });

  it('leaves a subject alone in a clear margin', () => {
    const grid = packed('subject');

    expect(
      grid
        .slice(GUTTER + HEIGHT)
        .flat()
        .every((alpha) => alpha === 0),
    ).toBe(true);
    expect(
      grid.map((row) => row[GUTTER - 1]).every((alpha) => alpha === 0),
    ).toBe(true);
  });
});
