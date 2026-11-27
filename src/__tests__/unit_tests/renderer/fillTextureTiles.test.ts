/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A pattern's tile as the size slider grows it (Ivan, 2026-11-27: "a slider
 * to grow the tile"): the whole tile magnified, as a tiled picture is. Two
 * things that cannot be seen at 16 pixels show once it grows, and are held
 * here — a tile whose stripes do not meet their copies at its edges, and a
 * grain that multiplies rather than grows.
 */

import { TILE, drawTile } from 'renderer/graph/fillTextureTiles';

interface IStroke {
  from: [number, number];
  to: [number, number];
}

/** A context that keeps what was drawn: the stroked lines and the specks. */
const recording = () => {
  const strokes: IStroke[] = [];
  const specks: { x: number; y: number; w: number; h: number }[] = [];
  let at: [number, number] = [0, 0];
  const context = {
    strokeStyle: '',
    fillStyle: '',
    lineCap: 'butt',
    lineJoin: 'miter',
    lineWidth: 1,
    globalAlpha: 1,
    beginPath: () => undefined,
    stroke: () => undefined,
    fill: () => undefined,
    arc: () => undefined,
    moveTo: (x: number, y: number) => {
      at = [x, y];
    },
    lineTo: (x: number, y: number) => {
      strokes.push({ from: at, to: [x, y] });
      at = [x, y];
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      specks.push({ x, y, w, h });
    },
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    strokes,
    specks,
  };
};

/**
 * Where a tile's diagonal stripes cross its top edge and its bottom edge,
 * inside the tile — the canvas cuts off the rest. A tile meets its copies
 * only if the two are the same: the copy below starts each stripe where this
 * one ends it.
 */
const edgeCrossings = (strokes: IStroke[], side: number) => {
  const inside = (x: number) => x > -1e-6 && x < side - 1e-6;
  // `+ 0` turns the -0 a rounding can leave into the 0 it is.
  const at = (x: number) => Math.round(x * 1000) / 1000 + 0;
  const crossings = (xs: number[]) =>
    [...new Set(xs.filter(inside).map(at))].sort((a, b) => a - b);
  return {
    top: crossings(strokes.map(({ from }) => from[0])),
    bottom: crossings(strokes.map(({ to }) => to[0])),
  };
};

describe('a grown hatch', () => {
  it.each([16, 64, 256])(
    'meets its copies at every edge at %i device pixels',
    (side) => {
      const { context, strokes } = recording();
      drawTile(context, 'hatch', side, side / TILE);
      const { top, bottom } = edgeCrossings(strokes, side);
      expect(top.length).toBe(3);
      expect(bottom).toEqual(top);
      // Three stripes evenly spaced, so no copy's seam shows as a gap.
      const gaps = top.map((x, index) => (top[index + 1] ?? top[0] + side) - x);
      gaps.forEach((gap) => expect(gap).toBeCloseTo(side / 3));
    },
  );

  it('would show a seam drawn at the old six-unit spacing', () => {
    // The control: the check above fails on the stripes the hatch used to
    // draw, so its passing is the hatch and not a check that cannot fail.
    const side = 64;
    const unit = side / TILE;
    const old: IStroke[] = [];
    for (let offset = -side; offset <= side * 2; offset += 6 * unit) {
      old.push({ from: [offset, 0], to: [offset + side, side] });
    }
    const { top, bottom } = edgeCrossings(old, side);
    expect(bottom).not.toEqual(top);
  });
});

describe('a grown grain', () => {
  it('keeps the specks it had at its first size, each grown with the tile', () => {
    const first = recording();
    drawTile(first.context, 'static', 16, 1);
    const grown = recording();
    drawTile(grown.context, 'static', 64, 4);
    // A twentieth of the 16-pixel tile, as the grain always drew.
    expect(first.specks).toHaveLength(Math.round(16 * 16 * 0.05));
    expect(grown.specks).toHaveLength(first.specks.length);
    grown.specks.forEach((speck, index) => {
      const before = first.specks[index];
      expect(speck.w).toBe(4);
      expect(speck.x).toBeCloseTo(before.x * 4);
      expect(speck.y).toBeCloseTo(before.y * 4);
    });
  });

  it('is the same grain as before on a 2x display at its first size', () => {
    // The display's ratio is in the side, not in the zoom: a 2x tile at 16
    // CSS pixels keeps every speck it drew before the slider.
    const { context, specks } = recording();
    drawTile(context, 'static', 32, 1);
    expect(specks).toHaveLength(Math.round(32 * 32 * 0.05));
    expect(specks[0].w).toBe(2);
  });

  it('would have gone solid if the grown tile were counted', () => {
    // The control: drawn at four times the size with no zoom, the count
    // follows the grown tile, sixteen times the specks at four times the
    // width — the fill this test exists to keep from going solid.
    const { context, specks } = recording();
    drawTile(context, 'static', 64, 1);
    expect(specks).toHaveLength(Math.round(64 * 64 * 0.05));
    const covered = specks.length * 16;
    expect(covered / (64 * 64)).toBeGreaterThan(0.7);
  });

  it('never prints a speck under a device pixel when shrunk', () => {
    const { context, specks } = recording();
    drawTile(context, 'static', 8, 0.5);
    expect(specks.length).toBeGreaterThan(0);
    specks.forEach((speck) => expect(speck.w).toBe(1));
  });
});
