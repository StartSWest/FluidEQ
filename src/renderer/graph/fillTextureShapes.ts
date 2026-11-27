/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The patterns added on 2026-11-27 (Ivan: "add more patterns like bricks"),
 * each drawn on the same 16-unit grid as the first ones (`drawTile`), so a
 * tile meets its copies at every edge whatever the size slider makes it.
 * Every stroke is laid in units of `unit` device pixels; a shape that
 * crosses the tile's edge is drawn again on the other side, so the canvas's
 * own clip leaves exactly the half that tile owns.
 */

/** The tile's side in units: the grid every pattern is drawn on. */
const GRID = 16;

/** A stroke one unit wide, never under a device pixel. */
const stroke = (context: CanvasRenderingContext2D, unit: number) => {
  context.lineWidth = Math.max(1, unit);
  context.stroke();
};

/**
 * Running bond: courses 4 units tall, bricks 8 long, every other course
 * offset by half a brick. The mortar runs half a unit in from each course's
 * top, and each joint from one mortar line to the next; the last course's
 * joints cross the tile's foot, so they are drawn again over its head.
 */
export const drawBricks = (context: CanvasRenderingContext2D, unit: number) => {
  context.beginPath();
  for (let course = 0; course < 4; course += 1) {
    const top = course * 4 + 0.5;
    context.moveTo(0, top * unit);
    context.lineTo(GRID * unit, top * unit);
    const shift = course % 2 === 0 ? 0 : 4;
    for (let joint = shift; joint < GRID; joint += 8) {
      [top, top - GRID].forEach((from) => {
        context.moveTo((joint + 0.5) * unit, from * unit);
        context.lineTo((joint + 0.5) * unit, (from + 4) * unit);
      });
    }
  }
  stroke(context, unit);
};

/**
 * Flat-topped hexagons in two columns a tile wide, the second half a row
 * lower. A true hexagon's rows are √3/2 of its width apart, which no whole
 * number of rows fits into a square tile; these stand 8 units apart, an
 * eighth flatter than true, so the comb repeats exactly at every size.
 */
export const drawHoneycomb = (
  context: CanvasRenderingContext2D,
  unit: number,
) => {
  const radius = GRID / 3;
  const half = 4;
  const hexagon = (cx: number, cy: number) => {
    context.moveTo((cx - radius) * unit, cy * unit);
    context.lineTo((cx - radius / 2) * unit, (cy - half) * unit);
    context.lineTo((cx + radius / 2) * unit, (cy - half) * unit);
    context.lineTo((cx + radius) * unit, cy * unit);
    context.lineTo((cx + radius / 2) * unit, (cy + half) * unit);
    context.lineTo((cx - radius / 2) * unit, (cy + half) * unit);
    context.closePath();
  };
  context.beginPath();
  for (let x = 0; x <= GRID; x += GRID) {
    for (let y = 0; y <= GRID; y += 8) {
      hexagon(x, y);
    }
  }
  for (let y = 4; y <= GRID; y += 8) {
    hexagon(GRID / 2, y);
  }
  stroke(context, unit);
};

/** Waves: four lines a tile, each one whole sine wave across it. */
export const drawWaves = (context: CanvasRenderingContext2D, unit: number) => {
  context.beginPath();
  for (let row = 2; row < GRID; row += 4) {
    for (let x = 0; x <= GRID; x += 0.25) {
      const y = row + 1.2 * Math.sin((x / GRID) * Math.PI * 2);
      if (x === 0) {
        context.moveTo(x * unit, y * unit);
      } else {
        context.lineTo(x * unit, y * unit);
      }
    }
  }
  context.lineJoin = 'round';
  stroke(context, unit);
};

/** Speaker cones: two rings and a dust cap, one cone a tile. */
export const drawSpeakers = (
  context: CanvasRenderingContext2D,
  unit: number,
) => {
  const mid = GRID / 2;
  context.beginPath();
  context.arc(mid * unit, mid * unit, 6.5 * unit, 0, Math.PI * 2);
  context.moveTo((mid + 4) * unit, mid * unit);
  context.arc(mid * unit, mid * unit, 4 * unit, 0, Math.PI * 2);
  stroke(context, unit);
  context.beginPath();
  context.arc(mid * unit, mid * unit, 1.6 * unit, 0, Math.PI * 2);
  context.fill();
};
