import type { IPoint } from './sketchMarks';

/**
 * The sketch's crop box (Ivan, 2026-11-08: "I also need to zoom and crop
 * attached chat images"): in the picture's own pixels, like the marks, so it
 * lands on what was framed whatever size the dialog shows the picture at.
 */
export interface ICropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What a drag holds: a new box, the whole box, or one of its corners. */
export type TCropGrip = 'new' | 'move' | 'nw' | 'ne' | 'sw' | 'se';

export const CROP_CORNERS = ['nw', 'ne', 'sw', 'se'] as const;

/**
 * The least a crop keeps, a side, in the picture's pixels: smaller is a click
 * that meant nothing, and a picture of a few pixels says nothing to Claude.
 */
export const LEAST_CROP = 16;

interface ISize {
  width: number;
  height: number;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** The box between two points, inside the picture. */
const between = (a: IPoint, b: IPoint, size: ISize): ICropBox => {
  const left = clamp(Math.min(a.x, b.x), 0, size.width);
  const top = clamp(Math.min(a.y, b.y), 0, size.height);
  const right = clamp(Math.max(a.x, b.x), 0, size.width);
  const bottom = clamp(Math.max(a.y, b.y), 0, size.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
};

/** The corner across from the one a grip names: it holds still. */
const acrossFrom = (
  box: ICropBox,
  grip: (typeof CROP_CORNERS)[number],
): IPoint => {
  const west = grip === 'nw' || grip === 'sw';
  const north = grip === 'nw' || grip === 'ne';
  return {
    x: west ? box.x + box.width : box.x,
    y: north ? box.y + box.height : box.y,
  };
};

/**
 * The box after a drag from `start` to `at`: drawn new between them, moved
 * by their difference without leaving the picture, or stretched by one
 * corner with the corner across from it held. A corner dragged past the one
 * across turns the box over rather than inside out.
 */
export const cropAfter = (
  grip: TCropGrip,
  from: ICropBox | undefined,
  start: IPoint,
  at: IPoint,
  size: ISize,
): ICropBox => {
  if (grip === 'new' || !from) {
    return between(start, at, size);
  }
  if (grip === 'move') {
    return {
      ...from,
      x: clamp(from.x + at.x - start.x, 0, size.width - from.width),
      y: clamp(from.y + at.y - start.y, 0, size.height - from.height),
    };
  }
  return between(acrossFrom(from, grip), at, size);
};

/** A box worth cropping to. */
export const cropUsable = (box: ICropBox | undefined): box is ICropBox =>
  !!box && box.width >= LEAST_CROP && box.height >= LEAST_CROP;

/** Whole pixels, inside the picture: what the crop actually keeps. */
export const cropPixels = (box: ICropBox, size: ISize): ICropBox => {
  const x = clamp(Math.round(box.x), 0, size.width - 1);
  const y = clamp(Math.round(box.y), 0, size.height - 1);
  return {
    x,
    y,
    width: clamp(Math.round(box.width), 1, size.width - x),
    height: clamp(Math.round(box.height), 1, size.height - y),
  };
};
