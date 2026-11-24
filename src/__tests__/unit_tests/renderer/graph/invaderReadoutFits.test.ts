/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { invaderUnit } from 'common/graphInvaders';
import {
  cabinetFrameLayout,
  createInvaderCabinet,
} from 'renderer/graph/invaderCabinet';

/**
 * The arcade's readouts - the score, the best and the credit - are printed
 * only where each stands whole and clear of its neighbour. On a screen the
 * width of the look picker's tile they printed through one another as one
 * smear (2026-11-24); on the graph they are all there, as before.
 */

const HEIGHT = 80;

const readoutAt = (width: number) => {
  const unit = invaderUnit(HEIGHT, Number.POSITIVE_INFINITY);
  return cabinetFrameLayout(createInvaderCabinet(), width, HEIGHT, unit, [])
    .readout;
};

/** Whether any two of the readout's pixels lie over each other. */
const overlaps = (rects: readonly (readonly number[])[]) =>
  rects.some(([x, y, w, h], index) =>
    rects
      .slice(index + 1)
      .some(
        ([x2, y2, w2, h2]) =>
          x < x2 + w2 - 0.01 &&
          x2 < x + w - 0.01 &&
          y < y2 + h2 - 0.01 &&
          y2 < y + h - 0.01,
      ),
  );

it('prints every readout on a screen wide enough for them', () => {
  const readout = readoutAt(1200);
  const rows = new Set(readout.map(([, y]) => Math.round(y)));
  // The top row and the bottom row both carry words: the control.
  expect(Math.max(...rows) - Math.min(...rows)).toBeGreaterThan(HEIGHT / 2);
  expect(readout.length).toBeGreaterThan(0);
});

it('prints nothing past the edge of a tile-sized screen', () => {
  const width = 143;
  const readout = readoutAt(width);
  readout.forEach(([x, , w]) => {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(width);
  });
  expect(readout.length).toBeLessThan(readoutAt(1200).length);
});

it('never prints one readout over another, at any width', () => {
  [1200, 640, 400, 260, 200, 143, 100].forEach((width) => {
    expect(overlaps(readoutAt(width))).toBe(false);
  });
});
