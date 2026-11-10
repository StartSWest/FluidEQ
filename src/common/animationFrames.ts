/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  frameCell,
  type IFrameCell,
  type IStudioAnimation,
  type TAnimationGround,
} from './studioAnimation';

/**
 * What an animation's frames are, measured from the sheet's own pixels: where
 * each frame's drawing stands, how big it is, how much it changes from the
 * one before. Read by the Studio's viewer (to stand the creature's feet on
 * the base line) and by the member's AI (`look_at_animation`), which used to
 * judge an animal by photographing the whole scene it was a speck in.
 *
 * Pixels are four bytes each with alpha last; the order of the other three
 * does not matter here (RGBA in a canvas, BGRA from Electron's nativeImage).
 */

export interface ISheetPixels {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

export interface IFrameShape {
  /** The drawing's box inside its cell; all -1 when the cell is empty. */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** How many of its pixels are drawn. */
  ink: number;
}

/** Drawn, where a sheet has transparency: more than faintly opaque. */
const INK_ALPHA = 40;
/** Drawn, on a sheet with a flat background: this far from its colour. */
const INK_DISTANCE = 48;

/**
 * Which pixels are the drawing: opaque ones on a sheet with a transparent
 * background, and on a flat one (a made picture often has no alpha), the
 * ones unlike its corners' colour.
 */
export const inkOf = (sheet: ISheetPixels): ((at: number) => boolean) => {
  const { data, width, height } = sheet;
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + width - 1) * 4,
  ];
  const transparent = corners.some((at) => data[at + 3] < 250);
  if (transparent) {
    return (at) => data[at + 3] > INK_ALPHA;
  }
  const flat = [0, 1, 2].map((channel) => {
    const values = corners
      .map((at) => data[at + channel])
      .sort((a, b) => a - b);
    return (values[1] + values[2]) / 2;
  });
  return (at) =>
    Math.abs(data[at] - flat[0]) +
      Math.abs(data[at + 1] - flat[1]) +
      Math.abs(data[at + 2] - flat[2]) >
    INK_DISTANCE;
};

const shapeOf = (
  sheet: ISheetPixels,
  cell: IFrameCell,
  ink: (at: number) => boolean,
): IFrameShape => {
  const shape: IFrameShape = {
    top: -1,
    bottom: -1,
    left: -1,
    right: -1,
    ink: 0,
  };
  for (let y = 0; y < cell.height; y += 1) {
    for (let x = 0; x < cell.width; x += 1) {
      if (ink(((cell.y + y) * sheet.width + cell.x + x) * 4)) {
        if (shape.ink === 0) {
          shape.top = y;
          shape.left = x;
          shape.right = x;
        }
        shape.ink += 1;
        shape.bottom = y;
        shape.left = Math.min(shape.left, x);
        shape.right = Math.max(shape.right, x);
      }
    }
  }
  return shape;
};

export interface IAnimationMeasure {
  cells: IFrameCell[];
  shapes: IFrameShape[];
  /**
   * Of every pixel drawn in either of two frames in a row, the share drawn
   * in only one: how much frame i changes from frame i - 1 (the first from
   * the last, round the loop).
   */
  change: number[];
}

export const measureAnimation = (
  sheet: ISheetPixels,
  animation: Pick<IStudioAnimation, 'count' | 'columns'>,
): IAnimationMeasure => {
  const ink = inkOf(sheet);
  const cells = Array.from({ length: animation.count }, (_, index) =>
    frameCell(animation, sheet.width, sheet.height, index),
  );
  const shapes = cells.map((cell) => shapeOf(sheet, cell, ink));
  const change = cells.map((cell, index) => {
    const before = cells[(index + cells.length - 1) % cells.length];
    let either = 0;
    let one = 0;
    const width = Math.min(cell.width, before.width);
    const height = Math.min(cell.height, before.height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const here = ink(((cell.y + y) * sheet.width + cell.x + x) * 4);
        const there = ink(((before.y + y) * sheet.width + before.x + x) * 4);
        if (here || there) {
          either += 1;
          if (here !== there) {
            one += 1;
          }
        }
      }
    }
    return either === 0 ? 0 : one / either;
  });
  return { cells, shapes, change };
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

/** Frames this far from the rest are named in the report. */
const FEET_SHARE = 0.02;
const FEET_LEAST_PX = 3;
const SIZE_SHARE = 0.1;
const JUMP_TIMES = 2.2;

export interface IAnimationFinding {
  /** 1-based, as the member counts them. */
  frame: number;
  kind: 'feet' | 'size' | 'jump' | 'empty';
  /** Pixels off the rest's line, a share of the usual size, or times the usual change. */
  amount: number;
}

/**
 * The frames that break the cycle: feet off the line the others stand on,
 * a drawing bigger or smaller than the rest, a change from the frame before
 * far above the usual - which is what a jump, a pop or a skating leg is.
 *
 * Judged as the animation means to move. Feet only for what stands on the
 * ground: a whale diving or a bird climbing leaves any line on purpose.
 * Size by how much is drawn, not by its box, which a turn alone changes
 * (a diving whale's box grew 30% with not a pixel more of whale). And a
 * one-shot never steps from its last frame back to its first, so that step
 * is no jump.
 */
export const animationFindings = (
  measure: IAnimationMeasure,
  how: { loop?: boolean; ground?: TAnimationGround } = {},
): IAnimationFinding[] => {
  const standing = how.ground === undefined || how.ground === 'ground';
  const findings: IAnimationFinding[] = [];
  const drawn = measure.shapes.filter((shape) => shape.ink > 0);
  measure.shapes.forEach((shape, index) => {
    if (shape.ink === 0) {
      findings.push({ frame: index + 1, kind: 'empty', amount: 0 });
    }
  });
  if (drawn.length === 0) {
    return findings;
  }
  const cellHeight = measure.cells[0].height;
  const feetLine = median(drawn.map((shape) => shape.bottom));
  const feetSlack = Math.max(FEET_LEAST_PX, cellHeight * FEET_SHARE);
  const size = median(drawn.map((shape) => shape.ink));
  measure.shapes.forEach((shape, index) => {
    if (shape.ink === 0) {
      return;
    }
    const off = shape.bottom - feetLine;
    if (standing && Math.abs(off) > feetSlack) {
      findings.push({ frame: index + 1, kind: 'feet', amount: off });
    }
    if (size > 0 && Math.abs(shape.ink / size - 1) > SIZE_SHARE) {
      findings.push({
        frame: index + 1,
        kind: 'size',
        amount: shape.ink / size - 1,
      });
    }
  });
  if (measure.change.length > 2) {
    // A one-shot's first frame follows nothing.
    const steps = how.loop === false ? measure.change.slice(1) : measure.change;
    const usual = median(steps);
    measure.change.forEach((change, index) => {
      if (how.loop === false && index === 0) {
        return;
      }
      if (usual > 0 && change / usual > JUMP_TIMES) {
        findings.push({
          frame: index + 1,
          kind: 'jump',
          amount: change / usual,
        });
      }
    });
  }
  return findings;
};

/**
 * The line the creature's feet stand on, as a share of the cell's height
 * from its top: where the viewer puts its base line. Undefined for a sheet
 * with nothing drawn.
 */
export const feetLineOf = (measure: IAnimationMeasure): number | undefined => {
  const drawn = measure.shapes.filter((shape) => shape.ink > 0);
  if (drawn.length === 0) {
    return undefined;
  }
  return (
    (median(drawn.map((shape) => shape.bottom)) + 1) / measure.cells[0].height
  );
};
