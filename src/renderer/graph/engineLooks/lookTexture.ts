/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILookTuning } from 'common/customLooks';
import {
  lookTexturePaint,
  textureAlphaOf,
  texturePlacement,
} from '../fillTextures';
import type { ITextureArea } from '../texturePictures';
import type { ITexturePose } from '../textureMotion';
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
 * Where the look's texture moves with the music, `pose` is this frame's
 * (`textureMotion.ts`): it moves the rectangle one copy lies in and the
 * strength it prints at, by the page's own rule, so the shader is the one it
 * always was and costs what it always did.
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
  pose?: ITexturePose,
): void => {
  if (!tuning.filled || tuning.texture === 'none') {
    input.texture = undefined;
    return;
  }
  const paint = lookTexturePaint(tuning, scale, area, pose);
  const placement = texturePlacement(paint);
  if (!placement) {
    input.texture = undefined;
    return;
  }
  input.texture = {
    key: placement.key,
    bitmap: placement.bitmap,
    mode: tuning.texture === 'image' ? 2 : 1,
    ink: paint.ink,
    strength: textureAlphaOf(paint),
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    repeat: placement.repeat,
  };
};

export default writeLookTexture;
