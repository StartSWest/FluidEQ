/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the free-drawn passes share (`lookLines.ts`, `lookStrokes.ts`): a
 * program that draws each segment between two points as a quad around it,
 * instanced, into a target the size of the picture — or of several stacked,
 * one per copy of the drawing kept apart — keeping at each pixel the most
 * any segment put there (MAX blending), and everything the worker had bound
 * put back as it was found.
 *
 * The points travel as a float texture, `texelsPerPoint` texels a point,
 * `pointsPerRow` points a row, and each pass's vertex shader reads them.
 *
 * NOT UNIT-TESTED, like `sceneGl.ts`, and for its reason: verified in the
 * window.
 */

import { linkProgram, setNearestClamped } from '../glProgram';

export interface ISegmentPassSpec {
  vertex: string;
  fragment: string;
  texelsPerPoint: number;
  pointsPerRow: number;
  maxPoints: number;
  /** Texture unit the points are read from, clear of every other one. */
  pointsUnit: number;
  /** How many pictures the target holds, stacked bottom to top. */
  layers: number;
}

export interface ISegmentPass {
  /**
   * Draws the first `count` points' segments into the target at `width` by
   * `height` a picture and leaves the target bound to `unit` for the look's
   * shader. `uniforms` sets the pass's own uniforms, with the program in use.
   */
  draw(
    points: Float32Array,
    count: number,
    css: { width: number; height: number },
    width: number,
    height: number,
    unit: number,
    uniforms: (at: (name: string) => WebGLUniformLocation | null) => void,
  ): void;
  dispose(): void;
}

/** A pass's program and target, made on the first frame that has any. */
export const createSegmentPass = (
  gl: WebGL2RenderingContext,
  spec: ISegmentPassSpec,
): ISegmentPass | null => {
  const program = linkProgram(gl, spec.vertex, spec.fragment);
  const points = gl.createTexture();
  const target = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  const vertexArray = gl.createVertexArray();
  const release = () => {
    gl.deleteProgram(program);
    gl.deleteTexture(points);
    gl.deleteTexture(target);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteVertexArray(vertexArray);
  };
  if (!program || !points || !target || !framebuffer || !vertexArray) {
    release();
    return null;
  }
  const locations = new Map<string, WebGLUniformLocation | null>();
  const at = (name: string) => {
    if (!locations.has(name)) {
      locations.set(name, gl.getUniformLocation(program, name));
    }
    return locations.get(name) ?? null;
  };

  const rowTexels = spec.pointsPerRow * spec.texelsPerPoint;
  const rowFloats = rowTexels * 4;
  gl.bindTexture(gl.TEXTURE_2D, points);
  setNearestClamped(gl);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA32F,
    rowTexels,
    Math.ceil(spec.maxPoints / spec.pointsPerRow),
    0,
    gl.RGBA,
    gl.FLOAT,
    null,
  );
  gl.bindTexture(gl.TEXTURE_2D, target);
  setNearestClamped(gl);
  let targetSize = '';

  return {
    draw: (source, pointCount, css, width, height, unit, uniforms) => {
      const count = Math.min(pointCount, spec.maxPoints);
      const tall = height * spec.layers;
      // Everything the worker had, put back afterwards.
      const framebufferWas = gl.getParameter(
        gl.FRAMEBUFFER_BINDING,
      ) as WebGLFramebuffer | null;
      const viewport = gl.getParameter(gl.VIEWPORT) as Int32Array;
      const programWas = gl.getParameter(
        gl.CURRENT_PROGRAM,
      ) as WebGLProgram | null;
      const vertexArrayWas = gl.getParameter(
        gl.VERTEX_ARRAY_BINDING,
      ) as WebGLVertexArrayObject | null;
      const scissored = gl.isEnabled(gl.SCISSOR_TEST);
      const blended = gl.isEnabled(gl.BLEND);
      const equations = [gl.BLEND_EQUATION_RGB, gl.BLEND_EQUATION_ALPHA].map(
        (name) => gl.getParameter(name) as number,
      );
      const factors = [
        gl.BLEND_SRC_RGB,
        gl.BLEND_DST_RGB,
        gl.BLEND_SRC_ALPHA,
        gl.BLEND_DST_ALPHA,
      ].map((name) => gl.getParameter(name) as number);

      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, target);
      const size = `${width}x${tall}`;
      if (size !== targetSize) {
        targetSize = size;
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA8,
          width,
          tall,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
        );
      }
      // Unbound while it is drawn to, as the bloom target is.
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        target,
        0,
      );
      gl.viewport(0, 0, width, tall);
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (count > 1) {
        gl.activeTexture(gl.TEXTURE0 + spec.pointsUnit);
        gl.bindTexture(gl.TEXTURE_2D, points);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        for (let row = 0; row * spec.pointsPerRow < count; row += 1) {
          const inRow = Math.min(
            spec.pointsPerRow,
            count - row * spec.pointsPerRow,
          );
          gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            row,
            inRow * spec.texelsPerPoint,
            1,
            gl.RGBA,
            gl.FLOAT,
            source.subarray(
              row * rowFloats,
              row * rowFloats + inRow * spec.texelsPerPoint * 4,
            ),
          );
        }
        gl.useProgram(program);
        gl.uniform1i(at('uPoints'), spec.pointsUnit);
        gl.uniform2f(
          at('uCss'),
          Math.max(1, css.width),
          Math.max(1, css.height),
        );
        gl.uniform1f(at('uPixel'), Math.max(1, css.width) / Math.max(1, width));
        uniforms(at);
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.MAX);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.bindVertexArray(vertexArray);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count - 1);
      }

      gl.blendEquationSeparate(equations[0], equations[1]);
      gl.blendFuncSeparate(factors[0], factors[1], factors[2], factors[3]);
      if (!blended) {
        gl.disable(gl.BLEND);
      }
      if (scissored) {
        gl.enable(gl.SCISSOR_TEST);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebufferWas);
      gl.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
      gl.useProgram(programWas);
      gl.bindVertexArray(vertexArrayWas);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, target);
    },
    dispose: release,
  };
};

/**
 * The corners of a segment's quad, shared by the passes' vertex shaders:
 * `segmentCorner(from, to, reach)` — the quad reaches `reach` past both
 * ends and to both sides, two triangles, corners (0,0) (1,0) (1,1) and
 * (0,0) (1,1) (0,1).
 */
export const SEGMENT_CORNER_GLSL = `
vec2 segmentCorner(vec2 from, vec2 to, float reach) {
  vec2 along = to - from;
  float span = length(along);
  vec2 unit = span > 1e-4 ? along / span : vec2(1.0, 0.0);
  vec2 normal = vec2(-unit.y, unit.x);
  int corner = gl_VertexID;
  bool far = corner == 1 || corner == 2 || corner == 4;
  bool up = corner == 2 || corner == 4 || corner == 5;
  return (far ? to + unit * reach : from - unit * reach)
    + normal * (up ? reach : -reach);
}
`;
