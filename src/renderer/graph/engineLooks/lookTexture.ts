/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILookTuning } from 'common/customLooks';
import {
  PICTURE_ALPHA,
  TEXTURE_ALPHA,
  lookTexturePaint,
  texturePlacement,
} from '../fillTextures';
import type { ITextureArea } from '../texturePictures';
import type { IEngineLookInput } from './engineLookInput';

/**
 * The style editor's texture handed to the engine with a frame.
 *
 * A look with a texture used to be taken off the engine and drawn whole on
 * the page's canvas (`isEngineLookStyle`), which on its own is what made a
 * picture cost several times a plain look: the page rasterised every bar
 * again, through a clip, every frame. The measuring views now print it in
 * their shaders (`lookTextured`), from the same device pixels the page's
 * pattern is made of — a tile, or a picture redrawn at the size it lies at
 * (`texturePictures.ts`) — which travel to the engine once per change.
 *
 * Nothing while the texture is not ready yet: the engine draws the figure
 * plain for those frames, as the page does, and the page's next frame after
 * it lands carries it (`onTextureReady`).
 */
export const writeLookTexture = (
  input: IEngineLookInput,
  tuning: Pick<
    ILookTuning,
    | 'filled'
    | 'texture'
    | 'textureImage'
    | 'textureFit'
    | 'textureSize'
    | 'patternSize'
  >,
  scale: number,
  area: ITextureArea,
): void => {
  if (!tuning.filled || tuning.texture === 'none') {
    input.texture = undefined;
    return;
  }
  const paint = lookTexturePaint(tuning, scale, area);
  const placement = texturePlacement(paint);
  if (!placement) {
    input.texture = undefined;
    return;
  }
  const isPicture = tuning.texture === 'image';
  input.texture = {
    key: placement.key,
    bitmap: placement.bitmap,
    mode: isPicture ? 2 : 1,
    ink: paint.ink,
    strength: isPicture ? PICTURE_ALPHA : TEXTURE_ALPHA,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    repeat: placement.repeat,
  };
};

export default writeLookTexture;
