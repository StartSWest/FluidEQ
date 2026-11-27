/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneFrame } from '../sceneGl';

/**
 * A look's texture goes to the engine's worker once per key
 * (`IEngineLookTexture`): the frame that names a new key carries its pixels,
 * and every frame after it the key alone, which the worker answers from the
 * copy it kept (`sceneRenderer.worker.ts`). Sent whole every frame, a
 * megapixel picture was copied into every message. One of these per worker
 * client: a new worker starts with nothing sent.
 *
 * The page's frame is never changed: a frame sent without its pixels is a
 * copy, because the page goes on holding them for the next key.
 */
export const createTextureOnce = (): ((frame: ISceneFrame) => ISceneFrame) => {
  let sentKey = '';
  return (frame) => {
    const texture = frame.look?.texture;
    if (!frame.look || !texture?.bitmap) {
      return frame;
    }
    if (texture.key !== sentKey) {
      sentKey = texture.key;
      return frame;
    }
    return {
      ...frame,
      look: { ...frame.look, texture: { ...texture, bitmap: undefined } },
    };
  };
};

export default createTextureOnce;
