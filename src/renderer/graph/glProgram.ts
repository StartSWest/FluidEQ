/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The steps every small GL program in the graph is made with: the looks'
 * passes, the finishing chain's and the flash guard's. Five files carried
 * their own copies, and one of them left its shaders and program behind
 * whenever the program could not be made.
 *
 * `logAs` names the program on the console with the driver's own log when it
 * fails; without it a failure is only the `null` the caller answers.
 */

/** One stage compiled, or nothing; a stage that does not compile is deleted. */
export const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
  logAs?: string,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    if (logAs) {
      console.error(`${logAs} shader failed:`, gl.getShaderInfoLog(shader));
    }
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

/**
 * A vertex and a fragment stage linked into a program, or nothing. Every
 * object made on the way is let go whichever way it ends: the stages once
 * linked, since a linked program keeps what it needs, and the program too
 * when it does not link.
 */
export const linkProgram = (
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  logAs?: string,
): WebGLProgram | null => {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource, logAs);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, logAs);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    gl.deleteProgram(program);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (logAs) {
      console.error(`${logAs} program failed:`, gl.getProgramInfoLog(program));
    }
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

/** The bound 2D texture read texel for texel: nearest, clamped at its edges. */
export const setNearestClamped = (gl: WebGL2RenderingContext): void => {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
};
