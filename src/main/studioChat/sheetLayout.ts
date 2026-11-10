/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { drawnBox, type IBox, type IPixels } from './sheetRig';

/**
 * Frames laid into one sheet (`build_sheet`): an even grid of equal cells,
 * every frame at one scale, so the animal keeps its size from frame to
 * frame, and placed so it does not wander inside its cell:
 *
 * - `keep`: where each frame had it, measured from the frame's own middle -
 *   right for frames cut from one sheet, whose cells already line up;
 * - `baseline`: the same across, with every frame's lowest drawn row on one
 *   line - feet that stand, a waterline that holds;
 * - `centre`: each drawing's box in the middle of its cell - a bird or a
 *   fish, which stands on nothing.
 *
 * Pixels are premultiplied with alpha last, as in `sheetRig.ts`.
 */

export type TSheetAlign = 'keep' | 'baseline' | 'centre';

export type TResize = (
  picture: IPixels,
  width: number,
  height: number,
) => IPixels;

export interface ISheetLayout {
  columns: number;
  /** The cell, or undefined for the frames' own size at most `largestCell`. */
  cellWidth?: number;
  cellHeight?: number;
  align: TSheetAlign;
  /** Clear pixels kept round the drawing inside each cell. */
  margin: number;
}

export interface ILaidSheet {
  sheet: IPixels;
  cellWidth: number;
  cellHeight: number;
  rows: number;
  /** Cell pixels per frame pixel. */
  scale: number;
}

/** A frame's drawing as a box measured from the frame's own middle. */
interface IPlaced {
  frame: IPixels;
  box: IBox;
  /** Where the box goes, from the middle, before scaling. */
  dx: number;
  dy: number;
}

const fromMiddle = (frame: IPixels, box: IBox): IBox => ({
  left: box.left - frame.width / 2,
  right: box.right + 1 - frame.width / 2,
  top: box.top - frame.height / 2,
  bottom: box.bottom + 1 - frame.height / 2,
});

/**
 * Every frame's drawing placed by `align`, and the box all of them fill
 * together, measured from the middle; frames with nothing drawn are kept as
 * empty cells. Undefined when no frame has anything drawn.
 */
const placeFrames = (
  frames: readonly IPixels[],
  align: TSheetAlign,
): { placed: (IPlaced | undefined)[]; union: IBox } | undefined => {
  const placed = frames.map((frame): IPlaced | undefined => {
    const drawn = drawnBox(frame);
    if (!drawn) {
      return undefined;
    }
    const box = fromMiddle(frame, drawn);
    if (align === 'centre') {
      return {
        frame,
        box,
        dx: -(box.left + box.right) / 2,
        dy: -(box.top + box.bottom) / 2,
      };
    }
    return { frame, box, dx: 0, dy: align === 'baseline' ? -box.bottom : 0 };
  });
  const drawnFrames = placed.filter((entry) => entry !== undefined);
  if (drawnFrames.length === 0) {
    return undefined;
  }
  const union = drawnFrames.reduce<IBox>(
    (all, { box, dx, dy }) => ({
      left: Math.min(all.left, box.left + dx),
      right: Math.max(all.right, box.right + dx),
      top: Math.min(all.top, box.top + dy),
      bottom: Math.max(all.bottom, box.bottom + dy),
    }),
    { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity },
  );
  return { placed, union };
};

/** `picture`'s pixels over `onto` at (x, y), premultiplied "over". */
const blit = (onto: IPixels, picture: IPixels, x: number, y: number) => {
  for (let row = 0; row < picture.height; row += 1) {
    const ty = y + row;
    if (ty >= 0 && ty < onto.height) {
      for (let column = 0; column < picture.width; column += 1) {
        const tx = x + column;
        if (tx >= 0 && tx < onto.width) {
          const from = (row * picture.width + column) * 4;
          const to = (ty * onto.width + tx) * 4;
          const keep = 1 - picture.data[from + 3] / 255;
          for (let channel = 0; channel < 4; channel += 1) {
            onto.data[to + channel] = Math.round(
              picture.data[from + channel] + onto.data[to + channel] * keep,
            );
          }
        }
      }
    }
  }
};

/**
 * The `width` by `height` part of `picture` from (x, y); what lies past its
 * edges is clear. Both sizes at least 1.
 */
export const cropPixels = (
  picture: IPixels,
  x: number,
  y: number,
  width: number,
  height: number,
): IPixels => {
  const out: IPixels = {
    data: new Uint8Array(width * height * 4),
    width,
    height,
  };
  for (let row = 0; row < height; row += 1) {
    const sy = y + row;
    if (sy >= 0 && sy < picture.height) {
      const left = Math.max(0, x);
      const right = Math.min(picture.width, x + width);
      if (right > left) {
        out.data.set(
          picture.data.subarray(
            (sy * picture.width + left) * 4,
            (sy * picture.width + right) * 4,
          ),
          (row * width + (left - x)) * 4,
        );
      }
    }
  }
  return out;
};

/**
 * The frames as one sheet. Undefined when nothing is drawn in any of them,
 * or when the cell is too small to hold a drawing at all.
 */
export const laySheet = (
  frames: readonly IPixels[],
  layout: ISheetLayout,
  resize: TResize,
  largestCell: number,
): ILaidSheet | undefined => {
  const found = placeFrames(frames, layout.align);
  if (!found) {
    return undefined;
  }
  const { placed, union } = found;
  const unionWidth = union.right - union.left;
  const unionHeight = union.bottom - union.top;
  const { margin } = layout;
  // Never larger than the frames were drawn: a cell is filled by the frame's
  // own pixels, not by stretching them.
  const own = Math.min(
    1,
    (largestCell - 2 * margin) / unionWidth,
    (largestCell - 2 * margin) / unionHeight,
  );
  const cellWidth =
    layout.cellWidth ?? Math.ceil(unionWidth * own) + 2 * margin;
  const cellHeight =
    layout.cellHeight ?? Math.ceil(unionHeight * own) + 2 * margin;
  const scale = Math.min(
    (cellWidth - 2 * margin) / unionWidth,
    (cellHeight - 2 * margin) / unionHeight,
  );
  if (!(scale > 0) || cellWidth < 1 || cellHeight < 1) {
    return undefined;
  }
  const rows = Math.ceil(frames.length / layout.columns);
  const sheet: IPixels = {
    data: new Uint8Array(layout.columns * cellWidth * rows * cellHeight * 4),
    width: layout.columns * cellWidth,
    height: rows * cellHeight,
  };
  // The union's middle sits in the cell's middle; with `baseline`, its
  // bottom is the line every frame's lowest row stands on.
  const middleX = (union.left + union.right) / 2;
  const middleY = (union.top + union.bottom) / 2;
  placed.forEach((entry, index) => {
    if (!entry) {
      return;
    }
    const { frame, box, dx, dy } = entry;
    const cropX = Math.floor(box.left + frame.width / 2);
    const cropY = Math.floor(box.top + frame.height / 2);
    const cropWidth = Math.ceil(box.right - box.left);
    const cropHeight = Math.ceil(box.bottom - box.top);
    const width = Math.max(1, Math.round(cropWidth * scale));
    const height = Math.max(1, Math.round(cropHeight * scale));
    const piece = resize(
      cropPixels(frame, cropX, cropY, cropWidth, cropHeight),
      width,
      height,
    );
    const column = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    const x =
      column * cellWidth + cellWidth / 2 + (box.left + dx - middleX) * scale;
    const y =
      row * cellHeight + cellHeight / 2 + (box.top + dy - middleY) * scale;
    // Kept inside its own cell: a frame never spills into its neighbour's.
    const cellLeft = column * cellWidth;
    const cellTop = row * cellHeight;
    const left = Math.round(x);
    const top = Math.round(y);
    const skipX = Math.max(0, cellLeft - left);
    const skipY = Math.max(0, cellTop - top);
    const visibleWidth =
      Math.min(piece.width, cellLeft + cellWidth - left) - skipX;
    const visibleHeight =
      Math.min(piece.height, cellTop + cellHeight - top) - skipY;
    if (visibleWidth > 0 && visibleHeight > 0) {
      blit(
        sheet,
        cropPixels(piece, skipX, skipY, visibleWidth, visibleHeight),
        left + skipX,
        top + skipY,
      );
    }
  });
  return { sheet, cellWidth, cellHeight, rows, scale };
};
