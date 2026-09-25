/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { clampUnit, type ISceneFrame } from './sceneFrame';

/**
 * The light a lit scene throws into the air around it.
 *
 * The lit shapes are drawn a second time on a canvas an eighth of the
 * window's size, blurred there — where a blur costs a few thousand pixels
 * rather than two million — and stretched back over the scene, added to it
 * rather than laid on it. Flat colour stretched up from a quarter of the
 * size, which was the first way of doing it, read as a slab behind the
 * lamps with the columns' edges in it: the blur is what makes it light.
 */

/** The bloom canvas against the window, and its blur there. */
const SCALE = 0.125;
const BLUR_PX = 2;

export interface ISceneBloom {
  sharp?: HTMLCanvasElement;
  soft?: HTMLCanvasElement;
  key: string;
}

export const createSceneBloom = (): ISceneBloom => ({ key: '' });

const makeCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

/**
 * Clears the small canvas for this frame and hands back its context, set up
 * so the scene draws on it in the same CSS pixels it draws everything else
 * in. Null only where no canvas context can be had.
 */
export const beginBloom = (
  frame: ISceneFrame,
  bloom: ISceneBloom,
): CanvasRenderingContext2D | null => {
  const { width, height } = frame.window;
  const key = `${Math.round(width)}x${Math.round(height)}`;
  if (bloom.key !== key || !bloom.sharp || !bloom.soft) {
    bloom.key = key;
    bloom.sharp = makeCanvas(width * SCALE, height * SCALE);
    bloom.soft = makeCanvas(width * SCALE, height * SCALE);
  }
  const context = bloom.sharp.getContext('2d');
  if (!context) {
    return null;
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, bloom.sharp.width, bloom.sharp.height);
  context.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  return context;
};

/**
 * Blurs what was drawn and adds it over the scene at `strength` (0..1),
 * which each scene sets from its beat and the look's Glow.
 */
export const endBloom = (
  frame: ISceneFrame,
  bloom: ISceneBloom,
  strength: number,
): void => {
  const { sharp, soft } = bloom;
  const softContext = soft?.getContext('2d');
  if (!sharp || !soft || !softContext) {
    return;
  }
  softContext.clearRect(0, 0, soft.width, soft.height);
  softContext.filter = `blur(${BLUR_PX}px)`;
  softContext.drawImage(sharp, 0, 0);
  softContext.filter = 'none';
  const { context, ratio, window } = frame;
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = 'lighter';
  context.globalAlpha = clampUnit(strength);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    soft,
    0,
    0,
    soft.width,
    soft.height,
    0,
    0,
    window.width * ratio,
    window.height * ratio,
  );
  context.restore();
};
