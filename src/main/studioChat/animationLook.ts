/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  animationFindings,
  feetLineOf,
  inkOf,
  type IAnimationMeasure,
  type ISheetPixels,
} from '../../common/animationFrames';
import type { IStudioAnimation } from '../../common/studioAnimation';

/**
 * What the member's AI is shown of an animation (`look_at_animation`): the
 * animation alone, never the scene it is a speck in. One picture of two
 * rows - every frame in order, then each frame over the one before it,
 * faded - with the line the feet stand on drawn across both, and the
 * numbers that say which frame breaks the cycle.
 */

const GAP = 8;
/** A mid grey every drawing shows against, light or dark, cut out or not. */
const GROUND = 92;
const LINE = 18;
/** How strongly the frame before shows under the onion row's frame. */
const BEFORE = 0.38;

/**
 * Two rows of `cells` (all one size, four bytes a pixel, alpha last): the
 * frames, then each over the one before it. A cell's drawing is what
 * `inkOf` finds in it, so a frame on a flat background shows the frame
 * under it too.
 */
export const composeLook = (
  cells: ISheetPixels[],
  feetLine: number | undefined,
): ISheetPixels => {
  const cellWidth = cells[0].width;
  const cellHeight = cells[0].height;
  const width = cells.length * cellWidth + (cells.length + 1) * GAP;
  const height = 2 * cellHeight + 3 * GAP;
  const data = new Uint8Array(width * height * 4).fill(GROUND);
  for (let at = 3; at < data.length; at += 4) {
    data[at] = 255;
  }
  const inks = cells.map((cell) => inkOf(cell));
  /** Lays `cell` at (left, top), `strength` of it, grey when `faded`. */
  const lay = (
    index: number,
    left: number,
    top: number,
    strength: number,
    faded: boolean,
  ) => {
    const cell = cells[index];
    const ink = inks[index];
    for (let y = 0; y < cellHeight; y += 1) {
      for (let x = 0; x < cellWidth; x += 1) {
        const from = (y * cellWidth + x) * 4;
        if (ink(from)) {
          const to = ((top + y) * width + left + x) * 4;
          const alpha = (cell.data[from + 3] / 255) * strength;
          const grey =
            (cell.data[from] + cell.data[from + 1] + cell.data[from + 2]) / 3;
          for (let channel = 0; channel < 3; channel += 1) {
            const value = faded ? grey : cell.data[from + channel];
            data[to + channel] = Math.round(
              data[to + channel] * (1 - alpha) + value * alpha,
            );
          }
        }
      }
    }
  };
  cells.forEach((_, index) => {
    const left = GAP + index * (cellWidth + GAP);
    lay(index, left, GAP, 1, false);
    const before = (index + cells.length - 1) % cells.length;
    lay(before, left, 2 * GAP + cellHeight, BEFORE, true);
    lay(index, left, 2 * GAP + cellHeight, 1, false);
  });
  if (feetLine !== undefined) {
    const row = Math.min(cellHeight - 1, Math.round(feetLine * cellHeight));
    [GAP, 2 * GAP + cellHeight].forEach((top) => {
      for (let x = GAP; x < width - GAP; x += 1) {
        const to = ((top + row) * width + x) * 4;
        data[to] = LINE;
        data[to + 1] = LINE;
        data[to + 2] = LINE;
      }
    });
  }
  return { data, width, height };
};

const list = (values: string[]) => values.join(' ');

/** The numbers, and the frames that break the cycle, in plain words. */
export const describeAnimation = (
  animation: IStudioAnimation,
  measure: IAnimationMeasure,
): string => {
  const { count, columns, fps, loop } = animation;
  const cell = measure.cells[0];
  const lines = [
    `${animation.name}: ${count} frames, ${columns} to a row on ${animation.sheet}, each ${cell.width} x ${cell.height}; ${fps} a second, ${loop ? `looping (one loop ${(count / fps).toFixed(2)} s)` : 'played once'}; shown against: ${animation.ground}.`,
    'The picture: the top row is every frame in order, left to right; the bottom row is each frame drawn over the one before it (faded grey). The dark line is where the feet stand.',
    `Feet (lowest drawn row, pixels from the top of each frame): ${list(measure.shapes.map((shape) => (shape.ink > 0 ? String(shape.bottom) : '-')))}`,
    `Size (width x height of what is drawn): ${list(measure.shapes.map((shape) => (shape.ink > 0 ? `${shape.right - shape.left + 1}x${shape.bottom - shape.top + 1}` : '-')))}`,
    `Change from the frame before: ${list(measure.change.map((change) => `${Math.round(change * 100)}%`))}`,
  ];
  const findings = animationFindings(measure, {
    loop: animation.loop,
    ground: animation.ground,
  });
  if (findings.length === 0) {
    lines.push(
      'Nothing breaks the cycle by these measures: the feet stay on one line, every frame is the same size and no frame jumps. Judge the gait itself in the picture.',
    );
  }
  findings.forEach(({ frame, kind, amount }) => {
    if (kind === 'empty') {
      lines.push(`Frame ${frame} is empty: nothing is drawn in its cell.`);
    } else if (kind === 'feet') {
      lines.push(
        `Frame ${frame}'s feet are ${Math.abs(amount)} px ${amount < 0 ? 'above' : 'below'} the line the others stand on: the animal ${amount < 0 ? 'floats or hops' : 'sinks'} there.`,
      );
    } else if (kind === 'size') {
      lines.push(
        `Frame ${frame} is drawn ${Math.round(Math.abs(amount) * 100)}% ${amount < 0 ? 'smaller' : 'bigger'} than the others: it pops when played.`,
      );
    } else {
      lines.push(
        `Frame ${frame} changes ${amount.toFixed(1)} times as much from the frame before as the cycle usually does: it jumps.`,
      );
    }
  });
  const feet = feetLineOf(measure);
  if (feet !== undefined && animation.ground === 'ground') {
    lines.push(
      `In the scene, put the plane's bottom ${Math.round((1 - feet) * 100)}% of its height below the ground, so the feet, not the frame's empty bottom, touch it.`,
    );
  }
  return lines.join('\n');
};
