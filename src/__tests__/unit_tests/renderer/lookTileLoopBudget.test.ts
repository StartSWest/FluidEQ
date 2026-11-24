/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ivan, 2026-11-24: "make sure they are very light, we don't want to block
 * the user's PC loading or showing the animated graphs". The look picker's
 * live tiles draw thirty times a second each at most, and all of them
 * together within a share of one core however many there are and however
 * fast the display asks for frames - measured by what each drawing cost on
 * the page's clock. A first drawing is never held back.
 */

import { createLookTileLoop } from '../../../renderer/graph/lookTileLoop';

let frames: FrameRequestCallback[] = [];
let clock = 0;
/** What one drawing costs on the page's clock, in ms. */
let cost = 0;

beforeAll(() => {
  window.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  window.cancelAnimationFrame = () => {
    frames = [];
  };
  jest.spyOn(performance, 'now').mockImplementation(() => clock);
});

beforeEach(() => {
  frames = [];
  clock = 0;
  cost = 0;
});

/** `count` tiles, each counting its drawings and spending `cost`. */
const tilesOn = (loop: ReturnType<typeof createLookTileLoop>, count: number) =>
  Array.from({ length: count }, () => {
    const tile = { drawn: 0 };
    loop.add({
      draw: () => {
        tile.drawn += 1;
        clock += cost;
      },
      canvas: () => null,
    });
    return tile;
  });

/** A second of a display giving `hz` frames. */
const runSecond = (hz: number, from: number) => {
  for (let index = 1; index <= hz; index += 1) {
    const at = from + (index * 1000) / hz;
    clock = Math.max(clock, at);
    const due = frames;
    frames = [];
    due.forEach((callback) => callback(at));
  }
};

it('draws a tile thirty times a second, not at the display’s rate', () => {
  const loop = createLookTileLoop();
  const [tile] = tilesOn(loop, 1);
  runSecond(144, 0);
  expect(tile.drawn).toBeGreaterThanOrEqual(28);
  expect(tile.drawn).toBeLessThanOrEqual(37);
  loop.dispose();
});

it('holds all the tiles together to a share of one core, fairly', () => {
  // Forty tiles at a millisecond a drawing would ask 1.2 s of every second.
  cost = 1;
  const loop = createLookTileLoop();
  const tiles = tilesOn(loop, 40);
  runSecond(144, 0);
  const firstSecond = tiles.reduce((sum, tile) => sum + tile.drawn, 0);
  runSecond(144, 1000);
  const spent = tiles.reduce((sum, tile) => sum + tile.drawn, 0) - firstSecond;
  // 80 ms of drawing a second, give or take one frame's spend.
  expect(spent).toBeGreaterThanOrEqual(70);
  expect(spent).toBeLessThanOrEqual(90);
  // Each tile has its turn: none starved, none drawn far more than another.
  const counts = tiles.map((tile) => tile.drawn);
  expect(Math.min(...counts)).toBeGreaterThan(0);
  expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  loop.dispose();
});

it('lets cheap drawings run at their full pace', () => {
  // The control for the case above: the same forty tiles, cheap enough.
  cost = 0.05;
  const loop = createLookTileLoop();
  const tiles = tilesOn(loop, 40);
  runSecond(60, 0);
  tiles.forEach((tile) => expect(tile.drawn).toBeGreaterThanOrEqual(28));
  loop.dispose();
});

it('never holds back a tile’s first drawing', () => {
  // Twelve tiles at 5 ms a drawing are fifteen times one frame's spend, and
  // every one of them is drawn on the first frame all the same.
  cost = 5;
  const loop = createLookTileLoop();
  const tiles = tilesOn(loop, 12);
  const due = frames;
  frames = [];
  due.forEach((callback) => callback(16));
  tiles.forEach((tile) => expect(tile.drawn).toBe(1));
  loop.dispose();
});
