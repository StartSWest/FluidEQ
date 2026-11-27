/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PATTERN_TILE, type TFillTexture } from '../../common/graphTextures';

/**
 * The patterns' tiles, drawn: what `fillTextures.ts` makes its patterns and
 * the engine's bitmaps from, and the style editor its buttons.
 */

/**
 * The grid a tile is drawn on, in units: one unit is one CSS pixel at the
 * size every pattern had before the size slider, so the two are one number.
 */
export const TILE = PATTERN_TILE;

export const makeCanvas = (side: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  return canvas;
};

/**
 * The colour a pattern's tile is drawn in: white on a dark window, black on
 * a light one (`patternInk`).
 */
export type TTileInk = 'white' | 'black';

/**
 * One tile of a named pattern, drawn in `ink` on nothing.
 *
 * White or black rather than the figure's colour because the tile is cached
 * across every look on screen and tinted at paint time through `globalAlpha`
 * and the composite operation — building one tile per colour would mean a
 * new canvas every time a gradient moved.
 *
 * `side` is the tile in device pixels. `zoom` is how many times its first
 * size the size slider grew it (never the display's ratio, which `side`
 * already carries): every stroke is drawn in units and grows by itself, and
 * the grain is the one pattern that has to be told, because it counts specks.
 */
export const drawTile = (
  context: CanvasRenderingContext2D,
  texture: TFillTexture,
  side: number,
  zoom = 1,
  ink: TTileInk = 'white',
): void => {
  const unit = side / TILE;
  const colour = ink === 'black' ? '#000000' : '#ffffff';
  context.strokeStyle = colour;
  context.fillStyle = colour;
  context.lineCap = 'butt';

  const diagonals = (step: number, back: boolean) => {
    context.lineWidth = Math.max(1, unit);
    context.beginPath();
    for (let offset = -side; offset <= side * 2; offset += step * unit) {
      if (back) {
        context.moveTo(offset, 0);
        context.lineTo(offset - side, side);
      } else {
        context.moveTo(offset, 0);
        context.lineTo(offset + side, side);
      }
    }
    context.stroke();
  };

  switch (texture) {
    case 'hatch':
      // A third of the tile, so three stripes meet their copies at every
      // edge. It was 6 units, which does not divide 16: every tile ended on
      // a gap of 4 between two of 6, invisible at 16 pixels and a broken
      // stripe every tile once the size slider grew it. The average spacing
      // is the same 16/3 it always was.
      diagonals(TILE / 3, false);
      break;
    case 'crosshatch':
      diagonals(8, false);
      diagonals(8, true);
      break;
    case 'rules':
      context.lineWidth = Math.max(1, unit);
      context.beginPath();
      for (let y = unit * 0.5; y < side; y += unit * 4) {
        context.moveTo(0, y);
        context.lineTo(side, y);
      }
      context.stroke();
      break;
    case 'pinstripe':
      context.lineWidth = Math.max(1, unit);
      context.beginPath();
      for (let x = unit * 0.5; x < side; x += unit * 4) {
        context.moveTo(x, 0);
        context.lineTo(x, side);
      }
      context.stroke();
      break;
    case 'dots': {
      const radius = unit * 1.1;
      for (let y = unit * 2; y < side; y += unit * 8) {
        for (let x = unit * 2; x < side; x += unit * 8) {
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
      // The half-offset row is what stops a dot field reading as a grid.
      for (let y = unit * 6; y < side; y += unit * 8) {
        for (let x = unit * 6; x < side; x += unit * 8) {
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
      break;
    }
    case 'grid':
      context.lineWidth = Math.max(1, unit);
      context.beginPath();
      for (let step = unit * 0.5; step < side; step += unit * 4) {
        context.moveTo(0, step);
        context.lineTo(side, step);
        context.moveTo(step, 0);
        context.lineTo(step, side);
      }
      context.stroke();
      break;
    case 'weave': {
      /**
       * Basket weave: quadrants of parallel runs turned through a right
       * angle from their neighbours, which is what the eye reads as
       * over-and-under.
       *
       * Two crossed bars was the first attempt and it did not weave. Tiled
       * across a fill the bars lined up into a staircase, which drew as a
       * second copy of the chevron three buttons along.
       */
      const half = side / 2;
      context.lineWidth = Math.max(1, unit);
      const runs = (originX: number, originY: number, vertical: boolean) => {
        context.beginPath();
        for (let step = unit * 1.5; step < half; step += unit * 2.5) {
          if (vertical) {
            context.moveTo(originX + step, originY + unit * 0.5);
            context.lineTo(originX + step, originY + half - unit * 0.5);
          } else {
            context.moveTo(originX + unit * 0.5, originY + step);
            context.lineTo(originX + half - unit * 0.5, originY + step);
          }
        }
        context.stroke();
      };
      runs(0, 0, false);
      runs(half, 0, true);
      runs(0, half, true);
      runs(half, half, false);
      break;
    }
    case 'scales': {
      // Overlapping arcs, the row below offset by half a scale. Half the
      // tile across: at a quarter it tiled into a net rather than scales,
      // and was indistinguishable from the chevron beside it.
      context.lineWidth = Math.max(1, unit * 1.1);
      const radius = unit * 8;
      context.beginPath();
      for (let y = 0; y <= side; y += radius * 2) {
        for (let x = 0; x <= side + radius; x += radius * 2) {
          context.moveTo(x - radius, y);
          context.arc(x, y, radius, Math.PI, 0, true);
        }
        for (let x = radius; x <= side + radius; x += radius * 2) {
          context.moveTo(x - radius, y + radius);
          context.arc(x, y + radius, radius, Math.PI, 0, true);
        }
      }
      context.stroke();
      break;
    }
    case 'chevron': {
      context.lineWidth = Math.max(1, unit * 1.4);
      context.lineJoin = 'miter';
      const step = unit * 8;
      context.beginPath();
      for (let y = -step; y < side + step; y += step) {
        for (let x = 0; x <= side; x += step) {
          context.moveTo(x, y + step * 0.5);
          context.lineTo(x + step * 0.5, y);
          context.lineTo(x + step, y + step * 0.5);
        }
      }
      context.stroke();
      break;
    }
    case 'static': {
      /**
       * Film grain, not random noise.
       *
       * The pattern repeats across the whole fill, so a tile whose speckle
       * came from `Math.random` would show the eye the same clump over and
       * over — the seeded walk below spreads them evenly enough that the
       * repeat does not announce itself.
       */
      // Modulo rather than the usual `>>> 0`: the product stays under 2^53,
      // so the arithmetic is exact and the tile is the same on every run.
      let seed = 0x2f6e2b1;
      const next = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967295;
      };
      // A twentieth of the tile carries a speck. At a hundredth the grain
      // was invisible at every size it is actually seen at, which is not a
      // texture but an expensive way of drawing nothing. Counted on the
      // tile as it was before it was grown, so a grown grain is the same
      // specks larger, as a grown picture of it would be: counted on the
      // grown tile, four times the size held sixteen times the specks, each
      // four times as wide, and the fill went solid.
      const before = side / zoom;
      const count = Math.round(before * before * 0.05);
      // Never under a device pixel, as no stroke is: a tile shrunk under its
      // first size would print its specks as a faint blur.
      const speck = Math.max(1, unit);
      for (let index = 0; index < count; index += 1) {
        const x = next() * side;
        const y = next() * side;
        context.globalAlpha = 0.45 + next() * 0.55;
        context.fillRect(x, y, speck, speck);
      }
      context.globalAlpha = 1;
      break;
    }
    default:
      break;
  }
};
