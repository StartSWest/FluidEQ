/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAX_SPRITES,
  SPRITE_FLOATS,
  SPRITES_PER_ROW,
  type IEngineLookInput,
} from './engineLookInput';
import { linkProgram, setNearestClamped } from '../glProgram';

/**
 * The sprites a look draws over its picture (`IEngineLookInput.sprites`):
 * one GL point each, read from a row of float texels, blended over whatever
 * the look's own shader left — the canvas's source-over, premultiplied.
 *
 * NOT UNIT-TESTED, like `sceneGl.ts`, and for its reason.
 */

const VERTEX = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uSprites;
// The look's canvas in CSS pixels, and drawn pixels to a CSS pixel.
uniform vec2 uCss;
uniform float uScale;
out vec4 vColour;
out vec2 vHalf;
out float vSoft;
out float vRect;
out float vSize;
void main() {
  // drawArrays' first sprite is gl_VertexID's first value, so a range of the
  // sprites is drawn by their own place in the texture.
  ivec2 at = ivec2((gl_VertexID % ${SPRITES_PER_ROW}) * 3, gl_VertexID / ${SPRITES_PER_ROW});
  vec4 place = texelFetch(uSprites, at, 0);
  vec4 paint = texelFetch(uSprites, at + ivec2(1, 0), 0);
  vec4 shape = texelFetch(uSprites, at + ivec2(2, 0), 0);
  gl_Position = vec4(place.x / uCss.x * 2.0 - 1.0, 1.0 - place.y / uCss.y * 2.0, 0.0, 1.0);
  vHalf = place.zw * uScale;
  vSize = 2.0 * max(vHalf.x, vHalf.y) + 2.0;
  gl_PointSize = vSize;
  vColour = paint;
  vSoft = shape.x;
  vRect = shape.y;
}
`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec4 vColour;
in vec2 vHalf;
in float vSoft;
in float vRect;
in float vSize;
out vec4 fragColor;
void main() {
  // Where in the sprite, in drawn pixels from its middle.
  vec2 q = (gl_PointCoord - 0.5) * vSize;
  float cover;
  float fall;
  if (vRect > 0.5) {
    vec2 edge = vHalf - abs(q);
    cover = clamp(min(edge.x, edge.y) + 0.5, 0.0, 1.0);
    fall = 1.0;
  } else {
    float k = length(q / max(vHalf, vec2(0.5)));
    float d = (k - 1.0) * min(vHalf.x, vHalf.y);
    cover = clamp(0.5 - d, 0.0, 1.0);
    fall = clamp(1.0 - k, 0.0, 1.0);
  }
  float a = vColour.a * cover * mix(1.0, fall, vSoft);
  fragColor = vec4(vColour.rgb * a, a);
}
`;

/** Texture unit the sprites are read from, clear of every other one. */
const SPRITE_UNIT = 7;

export interface ILookSprites {
  /** Draws the sprites from `first`, `count` of them. */
  draw(
    input: IEngineLookInput,
    panel: { width: number; height: number },
    first: number,
    count: number,
  ): void;
  dispose(): void;
}

/** The sprites' program, made on the first frame that has any; or nothing. */
export const createLookSprites = (
  gl: WebGL2RenderingContext,
): ILookSprites | null => {
  const program = linkProgram(gl, VERTEX, FRAGMENT);
  const texture = gl.createTexture();
  if (!program || !texture) {
    gl.deleteProgram(program);
    gl.deleteTexture(texture);
    return null;
  }
  const spritesAt = gl.getUniformLocation(program, 'uSprites');
  const cssAt = gl.getUniformLocation(program, 'uCss');
  const scaleAt = gl.getUniformLocation(program, 'uScale');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  setNearestClamped(gl);
  // Three texels a sprite and a row of them 768 wide, sized for the most a
  // frame may hold, so it is allocated once and only ever written after.
  const width = SPRITES_PER_ROW * 3;
  const rows = Math.ceil(MAX_SPRITES / SPRITES_PER_ROW);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA32F,
    width,
    rows,
    0,
    gl.RGBA,
    gl.FLOAT,
    null,
  );
  const rowFloats = SPRITES_PER_ROW * SPRITE_FLOATS;

  return {
    draw: (input, panel, first, wanted) => {
      const count = Math.min(wanted, MAX_SPRITES - first);
      if (count <= 0) {
        return;
      }
      gl.activeTexture(gl.TEXTURE0 + SPRITE_UNIT);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      // Every row the range touches, from its first sprite's row on.
      const end = first + count;
      for (
        let row = Math.floor(first / SPRITES_PER_ROW);
        row * SPRITES_PER_ROW < end;
        row += 1
      ) {
        const from = row * SPRITES_PER_ROW;
        const inRow = Math.min(SPRITES_PER_ROW, end - from);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          row,
          inRow * 3,
          1,
          gl.RGBA,
          gl.FLOAT,
          input.sprites.subarray(
            row * rowFloats,
            row * rowFloats + inRow * SPRITE_FLOATS,
          ),
        );
      }
      gl.useProgram(program);
      gl.uniform1i(spritesAt, SPRITE_UNIT);
      const cssWidth = Math.max(1, input.vectors[0]);
      gl.uniform2f(cssAt, cssWidth, Math.max(1, input.vectors[1]));
      gl.uniform1f(scaleAt, panel.width / cssWidth);
      // The blending the worker had is put back as it was found.
      const blended = gl.isEnabled(gl.BLEND);
      const factors = [
        gl.BLEND_SRC_RGB,
        gl.BLEND_DST_RGB,
        gl.BLEND_SRC_ALPHA,
        gl.BLEND_DST_ALPHA,
      ].map((name) => gl.getParameter(name) as number);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.POINTS, first, count);
      gl.blendFuncSeparate(factors[0], factors[1], factors[2], factors[3]);
      if (!blended) {
        gl.disable(gl.BLEND);
      }
    },
    dispose: () => {
      gl.deleteProgram(program);
      gl.deleteTexture(texture);
    },
  };
};
