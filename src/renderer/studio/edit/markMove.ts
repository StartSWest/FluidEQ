/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TEditMark } from './stageEditStore';

/**
 * A painted scene's marks moved and resized by hand (Ivan, 2026-11-12:
 * "these things I need to be able to move them and modify them like resizing
 * or moving the pins"). Everything is in shares of the scene, 0 to 1, as the
 * marks are kept: the same mark at any size the stage shows the scene.
 */

/** Which part of a mark the hand took: the whole of it, or an edge or corner of a box. */
export type TMarkGrip =
  'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** The edges and corners of a box, in the order they are drawn. */
export const BOX_GRIPS: readonly Exclude<TMarkGrip, 'move'>[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
];

/**
 * The smallest a box may be pulled, as a share of the scene: smaller, it is
 * a pin with a frame round it, and its edges sit on top of each other where
 * no hand can take one.
 */
export const LEAST_BOX = 0.02;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * The mark as it was when the hand took it, moved by `dx`, `dy` (shares of
 * the scene) through `grip`. A moved mark stays whole inside the scene; an
 * edge pulled past the one facing it stops short of it rather than turning
 * the box inside out.
 */
export const movedMark = (
  mark: TEditMark,
  grip: TMarkGrip,
  dx: number,
  dy: number,
): TEditMark => {
  if (mark.kind === 'pin') {
    return { kind: 'pin', x: clamp(mark.x + dx), y: clamp(mark.y + dy) };
  }
  if (grip === 'move') {
    const across = mark.x1 - mark.x0;
    const down = mark.y1 - mark.y0;
    const x0 = Math.min(1 - across, Math.max(0, mark.x0 + dx));
    const y0 = Math.min(1 - down, Math.max(0, mark.y0 + dy));
    return { kind: 'box', x0, y0, x1: x0 + across, y1: y0 + down };
  }
  let { x0, y0, x1, y1 } = mark;
  if (grip.includes('w')) {
    x0 = Math.min(x1 - LEAST_BOX, Math.max(0, x0 + dx));
  }
  if (grip.includes('e')) {
    x1 = Math.max(x0 + LEAST_BOX, Math.min(1, x1 + dx));
  }
  if (grip.includes('n')) {
    y0 = Math.min(y1 - LEAST_BOX, Math.max(0, y0 + dy));
  }
  if (grip.includes('s')) {
    y1 = Math.max(y0 + LEAST_BOX, Math.min(1, y1 + dy));
  }
  return { kind: 'box', x0, y0, x1, y1 };
};

/** Where a box's edge or corner grip stands, as shares of the scene. */
export const gripAt = (
  mark: Extract<TEditMark, { kind: 'box' }>,
  grip: Exclude<TMarkGrip, 'move'>,
): [number, number] => {
  const middleX = (mark.x0 + mark.x1) / 2;
  const middleY = (mark.y0 + mark.y1) / 2;
  let x = middleX;
  if (grip.includes('w')) {
    x = mark.x0;
  } else if (grip.includes('e')) {
    x = mark.x1;
  }
  let y = middleY;
  if (grip.includes('n')) {
    y = mark.y0;
  } else if (grip.includes('s')) {
    y = mark.y1;
  }
  return [x, y];
};
