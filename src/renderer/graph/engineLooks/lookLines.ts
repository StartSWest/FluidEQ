/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  LINE_POINTS_PER_ROW,
  MAX_LINE_POINTS,
  type IEngineLookLines,
} from './engineLookInput';
import {
  SEGMENT_CORNER_GLSL,
  createSegmentPass,
  type ISegmentPass,
} from './lookSegments';

/**
 * The free-drawn lines a look's shader reads as coverage
 * (`IEngineLookLines`): each segment a quad around it, drawn into a target
 * the size of the picture with the largest coverage kept at each pixel —
 * red, green, blue and alpha for the four widths — so crossings never add
 * up (`lookSegments.ts`).
 *
 * NOT UNIT-TESTED, like `sceneGl.ts`, and for its reason: verified in the
 * window.
 */

const VERTEX = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uPoints;
// The look's canvas in CSS pixels, and how far round a segment its quad
// reaches, in CSS pixels.
uniform vec2 uCss;
uniform float uReach;
out vec2 vFrom;
out vec2 vTo;
out vec2 vAt;
flat out vec4 vKept;
${SEGMENT_CORNER_GLSL}
vec4 point(int index) {
  return texelFetch(uPoints, ivec2(index % ${LINE_POINTS_PER_ROW}, index / ${LINE_POINTS_PER_ROW}), 0);
}
void main() {
  vec4 from = point(gl_InstanceID);
  vec4 to = point(gl_InstanceID + 1);
  vec2 at = segmentCorner(from.xy, to.xy, uReach);
  vFrom = from.xy;
  vTo = to.xy;
  vAt = at;
  // Which widths this segment is kept at: bits 1, 2, 4 and 8, or all four.
  int kept = int(to.w + 0.5);
  vKept = kept == 0
    ? vec4(1.0)
    : vec4(float(kept & 1), float((kept >> 1) & 1), float((kept >> 2) & 1), float((kept >> 3) & 1));
  // A point that starts a new line ends no segment.
  gl_Position = to.z > 0.5
    ? vec4(2.0, 2.0, 0.0, 1.0)
    : vec4(at.x / uCss.x * 2.0 - 1.0, 1.0 - at.y / uCss.y * 2.0, 0.0, 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec4 uWidths;
// CSS pixels a drawn pixel covers: the width of an anti-aliased edge.
uniform float uPixel;
in vec2 vFrom;
in vec2 vTo;
in vec2 vAt;
flat in vec4 vKept;
out vec4 fragColor;
void main() {
  vec2 along = vTo - vFrom;
  float span = dot(along, along);
  float t = span > 0.0 ? clamp(dot(vAt - vFrom, along) / span, 0.0, 1.0) : 0.0;
  float d = length(vAt - (vFrom + along * t));
  fragColor = vKept * clamp(0.5 - (d - uWidths * 0.5) / uPixel, 0.0, 1.0);
}
`;

/** Texture unit the lines' points are read from, clear of every other one. */
const POINTS_UNIT = 10;

export interface ILookLines {
  /**
   * Draws `lines` into its target at `width` by `height` and leaves the
   * target bound to `unit` for the look's shader; everything it changed is
   * put back as it was found.
   */
  draw(
    lines: IEngineLookLines,
    css: { width: number; height: number },
    width: number,
    height: number,
    unit: number,
  ): void;
  dispose(): void;
}

/** The lines' program and target, made on the first frame with any. */
export const createLookLines = (
  gl: WebGL2RenderingContext,
): ILookLines | null => {
  const pass: ISegmentPass | null = createSegmentPass(gl, {
    vertex: VERTEX,
    fragment: FRAGMENT,
    texelsPerPoint: 1,
    pointsPerRow: LINE_POINTS_PER_ROW,
    maxPoints: MAX_LINE_POINTS,
    pointsUnit: POINTS_UNIT,
    layers: 1,
  });
  if (!pass) {
    return null;
  }
  return {
    draw: (lines, css, width, height, unit) => {
      const [first, second, third, fourth = 0] = lines.widths;
      const pixel = Math.max(1, css.width) / Math.max(1, width);
      pass.draw(lines.points, lines.count, css, width, height, unit, (at) => {
        gl.uniform4f(at('uWidths'), first, second, third, fourth);
        gl.uniform1f(
          at('uReach'),
          Math.max(first, second, third, fourth) * 0.5 + pixel * 1.5,
        );
      });
    },
    dispose: pass.dispose,
  };
};
