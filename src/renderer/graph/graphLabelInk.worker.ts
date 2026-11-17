/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { toLinear } from '../utils/oklab';
import type { ILabelInkReply, ILabelInkRequest } from './graphLabelInkMessages';

/**
 * Reads the picture behind the graph's scale labels back from the GPU, off
 * the page (`graphLabelInk.ts`). Every way a canvas can hand its pixels back
 * waits for the GPU to finish what it has queued: on the page,
 * `getImageData`, a video frame's copy and a WebGL pixel buffer behind a
 * fence held the window 270, 226 and 400 ms of every second on software GL,
 * read seven times a second. Here the wait holds only this worker, which
 * does nothing else.
 */

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<ILabelInkRequest>) => void) | null;
  postMessage(value: ILabelInkReply, transfer: Transferable[]): void;
};

let reader: OffscreenCanvasRenderingContext2D | null = null;

/**
 * The mean relative luminance of the box `x0..x1 × y0..y1` of `rgba` (rows
 * `stride` pixels long) laid over black, bytes in sRGB and un-premultiplied
 * as `getImageData` hands them back: what is not drawn reads as the dark card
 * it lies on. Each pixel is taken to linear light before it is averaged, as
 * `meanRelativeLuminance` does for a scene.
 */
const meanLuminanceOverBlack = (
  rgba: Uint8ClampedArray,
  stride: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number => {
  let sum = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const at = (y * stride + x) * 4;
      const cover = rgba[at + 3] / 255 / 255;
      sum +=
        0.2126 * toLinear(rgba[at] * cover) +
        0.7152 * toLinear(rgba[at + 1] * cover) +
        0.0722 * toLinear(rgba[at + 2] * cover);
    }
  }
  const pixels = (x1 - x0) * (y1 - y0);
  return pixels > 0 ? sum / pixels : 0;
};

scope.onmessage = ({ data }) => {
  const { id, picture, boxes } = data;
  const { width, height } = picture;
  const levels = new Float32Array(boxes.length / 4).fill(Number.NaN);
  if (!reader || reader.canvas.width < width || reader.canvas.height < height) {
    // Made in memory and read often, so it never lives on the GPU.
    reader = new OffscreenCanvas(width, height).getContext('2d', {
      willReadFrequently: true,
    });
  }
  if (reader && width > 0 && height > 0) {
    reader.clearRect(0, 0, width, height);
    reader.drawImage(picture, 0, 0);
    const { data: rgba } = reader.getImageData(0, 0, width, height);
    for (let label = 0; label < levels.length; label += 1) {
      const at = label * 4;
      const x0 = Math.max(0, Math.floor(boxes[at]));
      const y0 = Math.max(0, Math.floor(boxes[at + 1]));
      const x1 = Math.min(width, Math.ceil(boxes[at + 2]));
      const y1 = Math.min(height, Math.ceil(boxes[at + 3]));
      if (x1 > x0 && y1 > y0) {
        levels[label] = meanLuminanceOverBlack(rgba, width, x0, y0, x1, y1);
      }
    }
  }
  picture.close();
  scope.postMessage({ id, levels }, [levels.buffer]);
};
