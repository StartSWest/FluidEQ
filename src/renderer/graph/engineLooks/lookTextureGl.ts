/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IEngineLookTexture } from './engineLookInput';

/**
 * The style editor's texture on the GPU, for a look's program
 * (`lookTextured` in `lookGlsl.ts`): one texture on a unit of its own,
 * uploaded when the texture's key changes and never again for the same key,
 * and the two vectors that say how it prints and where one copy lies.
 *
 * NOT UNIT-TESTED, like `lookGl.ts`, and for its reason: verified in the
 * window (the harness's engine, software GL).
 */

/** Clear of the scene's units (0-3), the look's (4-12) and each other. */
const TEXTURE_UNIT = 13;

export interface ILookTextureGl {
  upload(texture: IEngineLookTexture | undefined): void;
  dispose(): void;
}

export const createLookTextureGl = (
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): ILookTextureGl => {
  // The style editor's texture (`IEngineLookTexture`): uploaded when its
  // key changes and never again for the same key. A placeholder of one
  // clear texel stands in until the first arrives, so the sampler always
  // reads a texture of this program's own and never whatever the scene left
  // on its unit.
  const textureAt = gl.getUniformLocation(program, 'uLookTexture');
  const texturingAt = gl.getUniformLocation(program, 'uLookTexturing');
  const textureRectAt = gl.getUniformLocation(program, 'uLookTextureRect');
  let fill: WebGLTexture | null = null;
  let fillKey = '';

  const upload = (texture: IEngineLookTexture | undefined) => {
    if (!textureAt) {
      return;
    }
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT);
    if (!fill) {
      fill = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, fill);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(4),
      );
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    gl.bindTexture(gl.TEXTURE_2D, fill);
    if (texture?.bitmap && texture.key !== fillKey) {
      // Redrawn at the device pixels it covers before it came, so the GPU
      // samples it one to one; the mipmaps are for the engine's own smaller
      // sizes (the size ladder), where it would otherwise shimmer.
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        texture.bitmap,
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      fillKey = texture.key;
    }
    const ready = texture !== undefined && texture.key === fillKey;
    const wrap = texture?.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.uniform1i(textureAt, TEXTURE_UNIT);
    gl.uniform4f(
      texturingAt,
      texture && ready ? texture.mode : 0,
      texture?.strength ?? 0,
      texture?.repeat ? 1 : 0,
      0,
    );
    gl.uniform4f(
      textureRectAt,
      texture?.x ?? 0,
      texture?.y ?? 0,
      texture?.width ?? 1,
      texture?.height ?? 1,
    );
  };

  return {
    upload,
    dispose: () => {
      gl.deleteTexture(fill);
    },
  };
};

export default createLookTextureGl;
