/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TEditMark } from './stageEditStore';

const INK = '#00e5cf';
const PAPER = '#03222a';

/**
 * The stage's picture with the member's marks drawn on it, each with its
 * number, as the member's AI is sent it: "make 2 a third bigger" then names
 * a place the AI can see. Undefined when the picture cannot be read.
 */
const markPicture = async (
  picture: Uint8Array,
  marks: readonly TEditMark[],
): Promise<Uint8Array | undefined> => {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([picture.slice()]));
  } catch {
    return undefined;
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return undefined;
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { width, height } = canvas;
  // Sized to the picture, so a mark reads the same on a small stage's
  // picture as on a full screen's.
  const unit = Math.max(10, Math.round(Math.min(width, height) / 40));
  context.lineWidth = Math.max(2, unit / 5);
  context.font = `700 ${String(Math.round(unit * 1.2))}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  marks.forEach((mark, index) => {
    let x: number;
    let y: number;
    context.strokeStyle = INK;
    context.fillStyle = INK;
    if (mark.kind === 'box') {
      x = mark.x0 * width;
      y = mark.y0 * height;
      context.setLineDash([unit * 0.7, unit * 0.5]);
      context.strokeRect(
        x,
        y,
        (mark.x1 - mark.x0) * width,
        (mark.y1 - mark.y0) * height,
      );
      context.setLineDash([]);
    } else {
      const spotX = mark.x * width;
      const spotY = mark.y * height;
      x = spotX;
      y = spotY - unit * 2.2;
      context.beginPath();
      context.moveTo(spotX, spotY);
      context.lineTo(x, y);
      context.stroke();
      context.beginPath();
      context.arc(spotX, spotY, unit * 0.35, 0, 2 * Math.PI);
      context.fill();
    }
    context.beginPath();
    context.arc(x, y, unit, 0, 2 * Math.PI);
    context.fill();
    context.fillStyle = PAPER;
    context.fillText(String(index + 1), x, y);
  });
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined;
};

export default markPicture;
