/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A canvas drawn once and laid onto another until what it shows changes.
 *
 * For a graph that repaints every frame the screen does while only part of
 * it moves: the parts that hold still are drawn here when they change, and a
 * frame lays them down with one `drawImage` each instead of drawing them
 * again.
 */
export interface ICanvasLayer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  /** What the layer was last drawn for; the owner says what it means. */
  key: string;
}

export const createCanvasLayer = (): ICanvasLayer | undefined => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  return context ? { canvas, context, key: '' } : undefined;
};

/**
 * Ready to draw on: `width` by `height` device pixels, cleared, with the
 * transform set so the drawing is in CSS pixels at `ratio`.
 */
export const prepareCanvasLayer = (
  layer: ICanvasLayer,
  width: number,
  height: number,
  ratio: number,
): void => {
  const { canvas, context } = layer;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
};

/**
 * `layer` laid onto `target` at its device-pixel origin, redrawn by `draw`
 * first whenever `key` differs from what it was last drawn for. With no layer
 * — a browser that gave no context for one — `draw` paints `target` itself.
 */
export const layCanvasLayer = (
  target: CanvasRenderingContext2D,
  layer: ICanvasLayer | undefined,
  key: string,
  ratio: number,
  draw: (context: CanvasRenderingContext2D) => void,
): void => {
  if (!layer) {
    draw(target);
    return;
  }
  if (layer.key !== key) {
    prepareCanvasLayer(layer, target.canvas.width, target.canvas.height, ratio);
    draw(layer.context);
    layer.key = key;
  }
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.drawImage(layer.canvas, 0, 0);
  target.restore();
};
