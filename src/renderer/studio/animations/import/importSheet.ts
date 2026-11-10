/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDecodedImport, IImportFrame } from './importDecode';
import { sheetLayout, type ISheetLayout } from './importGrid';

/**
 * One animation of an import laid into the scene's sheet: an even grid of
 * cells, each frame on the canvas every frame shares, in the order and
 * number of cells its timing gives (`importTiming.ts`). A frame shown on
 * several cells is drawn once and copied.
 */

export interface IComposedSheet {
  canvas: HTMLCanvasElement;
  layout: ISheetLayout;
  count: number;
}

/**
 * Draws `frame` from `image` into the cell at (x, y). The frame's own
 * canvas stands centred on the shared one's floor, its trimmed drawing
 * where it was on that canvas, and one stored turned a quarter clockwise
 * turned back.
 */
const drawFrame = (
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  frame: IImportFrame,
  shared: { width: number; height: number },
  cell: { x: number; y: number; width: number; height: number },
) => {
  const scaleX = cell.width / shared.width;
  const scaleY = cell.height / shared.height;
  const left = cell.x + ((shared.width - frame.source.w) / 2) * scaleX;
  const top = cell.y + (shared.height - frame.source.h) * scaleY;
  const x = left + frame.placed.x * scaleX;
  const y = top + frame.placed.y * scaleY;
  const w = frame.placed.w * scaleX;
  const h = frame.placed.h * scaleY;
  if (!frame.rotated) {
    context.drawImage(
      image,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      x,
      y,
      w,
      h,
    );
    return;
  }
  // Stored turned clockwise, its stored width is its height: drawn turned
  // back, from its lower left corner.
  context.save();
  context.translate(x, y + h);
  context.rotate(-Math.PI / 2);
  context.drawImage(image, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, h, w);
  context.restore();
};

/** The sheet for `cells` (frame indexes, one per cell) of `decoded`. */
export const composeSheet = (
  decoded: IDecodedImport,
  cells: readonly number[],
): IComposedSheet | undefined => {
  const layout = sheetLayout(cells.length, decoded.width, decoded.height);
  const canvas = document.createElement('canvas');
  canvas.width = layout.columns * layout.cellWidth;
  canvas.height = layout.rows * layout.cellHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    return undefined;
  }
  context.imageSmoothingQuality = 'high';
  const drawnAt = new Map<number, { x: number; y: number }>();
  cells.forEach((index, at) => {
    const x = (at % layout.columns) * layout.cellWidth;
    const y = Math.floor(at / layout.columns) * layout.cellHeight;
    const first = drawnAt.get(index);
    if (first) {
      context.drawImage(
        canvas,
        first.x,
        first.y,
        layout.cellWidth,
        layout.cellHeight,
        x,
        y,
        layout.cellWidth,
        layout.cellHeight,
      );
      return;
    }
    drawFrame(context, decoded.image, decoded.frames[index], decoded, {
      x,
      y,
      width: layout.cellWidth,
      height: layout.cellHeight,
    });
    drawnAt.set(index, { x, y });
  });
  return { canvas, layout, count: cells.length };
};

/** The sheet as the PNG the scene keeps, or nothing if it cannot be made. */
export const sheetPng = (
  sheet: IComposedSheet,
): Promise<Uint8Array | undefined> =>
  new Promise((resolve) => {
    sheet.canvas.toBlob((blob) => {
      if (!blob) {
        resolve(undefined);
        return;
      }
      blob
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(() => resolve(undefined));
    }, 'image/png');
  });
