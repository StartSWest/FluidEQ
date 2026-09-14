/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAmbientElement } from 'common/sceneAmbient';
import type { IAmbientDraw } from './ambientField';
import type { TAmbientPictures } from './ambientPictures';
import { ambientSprite } from './ambientSprites';
import type { IVisualizerBox } from './visualizerSurfaces';

/** Below this, a shape or a pose's share of one is not worth a copy. */
const INVISIBLE = 0.002;

export interface IAmbientPaint {
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  elements: readonly IAmbientElement[];
  placed: readonly IAmbientDraw[];
  pictures: TAmbientPictures;
  /** Device pixels per CSS pixel on the canvas. */
  ratio: number;
  /** The canvas, in CSS pixels. */
  width: number;
  height: number;
  /** 0..1: the whole layer easing in or out. */
  fade: number;
  /**
   * Every visualizer's box on screen, in CSS pixels, left clear of every shape
   * (`visualizerSurfaces.ts`).
   */
  boxes: readonly IVisualizerBox[];
}

/**
 * One frame of the layer: every placed shape copied from its sprite, and every
 * picture from its poses, into a cleared canvas. Nothing is drawn per frame but
 * copies; the sprites and the poses were made once.
 */
export const paintAmbient = ({
  context,
  elements,
  placed,
  pictures,
  ratio,
  width,
  height,
  fade,
  boxes,
}: IAmbientPaint) => {
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.save();
  placed.forEach((placement) => {
    const element = elements[placement.element];
    const alpha = placement.alpha * fade;
    if (!element || alpha <= INVISIBLE) {
      return;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.translate(placement.x, placement.y);
    context.rotate(placement.rotation);
    context.scale(placement.scaleX, placement.scaleY);
    const { size } = placement.particle;
    if (element.shape === 'picture') {
      const poses = pictures.get(element.id);
      const [frameWidth, frameHeight] = [
        element.frames?.[0]?.[2] ?? 1,
        element.frames?.[0]?.[3] ?? 1,
      ];
      // The element's size is the pose's longer side.
      const across = (size * frameWidth) / Math.max(frameWidth, frameHeight);
      const down = (size * frameHeight) / Math.max(frameWidth, frameHeight);
      placement.poses?.forEach(([index, share]) => {
        const pose = poses?.[index];
        if (!pose || alpha * share <= INVISIBLE) {
          return;
        }
        context.globalAlpha = alpha * share;
        context.drawImage(pose, -across / 2, -down / 2, across, down);
      });
      return;
    }
    const sprite = ambientSprite({
      shape: element.shape,
      path: element.path,
      colour: element.colours[placement.particle.colour] ?? element.colours[0],
      size,
      ratio,
    });
    if (!sprite) {
      return;
    }
    context.globalAlpha = alpha;
    context.drawImage(
      sprite.image,
      -sprite.extent / 2,
      -sprite.extent / 2,
      sprite.extent,
      sprite.extent,
    );
  });
  context.restore();
  // Wiped out of what was drawn rather than cut out of the drawing: a clip
  // of several holes lets two that overlap draw into where they cross, and a
  // wipe leaves every box clear however they lie. Out to whole device pixels:
  // a picture a third of a pixel wider than a whole one kept two thirds of
  // a shape in its last column, measured along a gallery's right-hand edge.
  context.setTransform(1, 0, 0, 1, 0, 0);
  boxes.forEach((box) => {
    const left = Math.floor(box.left * ratio);
    const top = Math.floor(box.top * ratio);
    context.clearRect(
      left,
      top,
      Math.ceil((box.left + box.width) * ratio) - left,
      Math.ceil((box.top + box.height) * ratio) - top,
    );
  });
};
