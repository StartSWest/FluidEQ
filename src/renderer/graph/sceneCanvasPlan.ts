/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IPresentOptions } from './scenePost';
import type { ISceneDrawSize, ISceneFinish } from './sceneWorkerMessages';

/** A clip in panel fractions as a scissor box on a `width × height` target. */
export const scissorBox = (
  clip: readonly [number, number, number, number],
  width: number,
  height: number,
): [number, number, number, number] => {
  const [left, top, right, bottom] = clip;
  const x = Math.floor(left * width);
  const y = Math.floor(top * height);
  const farX = Math.ceil(right * width);
  const farY = Math.ceil(bottom * height);
  return [x, height - farY, farX - x, farY - y];
};

/**
 * What the canvas shows for a picture drawn at `width × height`: the panel's
 * own pixels when the picture is brought to them (FSR up, or the supersample
 * average down), or the drawn size when a smaller picture is left to the
 * compositor to stretch — the plain scaler, which costs the GPU nothing.
 */
export const canvasPlan = (
  width: number,
  height: number,
  output: ISceneDrawSize,
  finish: ISceneFinish,
): Omit<IPresentOptions, 'scissor'> => {
  const smaller = width < output.width || height < output.height;
  const wanted = smaller && !finish.fsr ? { width, height } : output;
  return {
    drawnWidth: width,
    drawnHeight: height,
    canvasWidth: wanted.width,
    canvasHeight: wanted.height,
    fsr: finish.fsr,
    fxaa: finish.fxaa,
  };
};
