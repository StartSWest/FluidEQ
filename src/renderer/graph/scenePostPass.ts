/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SCENE_VERTEX_SOURCE } from '../../common/sceneUniformContract';
import { linkProgram } from './glProgram';

/**
 * One full-screen pass of the finishing chain: a program over the shared
 * triangle, its input texture on unit 0, and its uniform locations by name.
 *
 * Compiled synchronously, like the flash guard's programs: each is a hundred
 * lines the driver takes milliseconds over, once per worker, unlike a scene.
 */
export interface IPostPass {
  where: Record<string, WebGLUniformLocation | null>;
  /** Bind the program and `input` on texture unit 0; set the caller's uniforms next. */
  use(input: WebGLTexture): void;
  draw(): void;
  dispose(): void;
}

export const linkPostProgram = (
  gl: WebGL2RenderingContext,
  fragmentSource: string,
  uniforms: readonly string[],
): IPostPass | null => {
  const program = linkProgram(
    gl,
    SCENE_VERTEX_SOURCE,
    fragmentSource,
    'Scene finishing',
  );
  const vao = gl.createVertexArray();
  if (!program || !vao) {
    gl.deleteProgram(program);
    gl.deleteVertexArray(vao);
    return null;
  }
  const where: Record<string, WebGLUniformLocation | null> = {};
  uniforms.forEach((name) => {
    where[name] = gl.getUniformLocation(program, name);
  });
  return {
    where,
    use: (input) => {
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, input);
      if (where.uInput !== undefined) {
        gl.uniform1i(where.uInput, 0);
      }
    },
    draw: () => {
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose: () => {
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
};
