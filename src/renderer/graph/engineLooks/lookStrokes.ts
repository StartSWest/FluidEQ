/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAX_STROKE_POINTS,
  STROKE_POINTS_PER_ROW,
  type IEngineLookStrokes,
} from './engineLookInput';
import {
  SEGMENT_CORNER_GLSL,
  createSegmentPass,
  type ISegmentPass,
} from './lookSegments';

/**
 * The strokes in their own colours a look lays over its picture
 * (`IEngineLookStrokes`): each segment a quad around it, drawn into a
 * target two pictures tall — the first copy's strokes in the lower, the
 * second's in the upper — keeping at each pixel the most colour any stroke
 * put there (`lookSegments.ts`). A look reads its copy's half:
 * `texture(uLookStrokes, vec2(uv.x, (uv.y + float(copy)) * 0.5))`.
 *
 * NOT UNIT-TESTED, like `sceneGl.ts`, and for its reason: verified in the
 * window.
 */

const ROW_TEXELS = STROKE_POINTS_PER_ROW * 2;

const VERTEX = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uPoints;
uniform vec2 uCss;
uniform float uPixel;
out vec2 vFrom;
out vec2 vTo;
out vec2 vAt;
flat out vec4 vInk;
// The segment's width, 1 where its ends are round.
flat out vec2 vShape;
${SEGMENT_CORNER_GLSL}
vec4 texel(int point, int part) {
  int at = point * 2 + part;
  return texelFetch(uPoints, ivec2(at % ${ROW_TEXELS}, at / ${ROW_TEXELS}), 0);
}
void main() {
  vec4 from = texel(gl_InstanceID, 0);
  vec4 to = texel(gl_InstanceID + 1, 0);
  float flags = to.z;
  bool starts = mod(flags, 2.0) > 0.5;
  float roundEnds = mod(floor(flags / 2.0), 2.0);
  float copy = floor(flags / 4.0);
  vec2 at = segmentCorner(from.xy, to.xy, to.w * 0.5 + uPixel * 1.5);
  vFrom = from.xy;
  vTo = to.xy;
  vAt = at;
  vInk = texel(gl_InstanceID + 1, 1);
  vShape = vec2(to.w, roundEnds);
  // Each copy in its own picture of the target: the first below, the
  // second above. A point that starts a new line ends no segment.
  gl_Position = starts
    ? vec4(2.0, 2.0, 0.0, 1.0)
    : vec4(at.x / uCss.x * 2.0 - 1.0, 1.0 - at.y / uCss.y + copy - 1.0, 0.0, 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision highp float;
// CSS pixels a drawn pixel covers: the width of an anti-aliased edge.
uniform float uPixel;
in vec2 vFrom;
in vec2 vTo;
in vec2 vAt;
flat in vec4 vInk;
flat in vec2 vShape;
out vec4 fragColor;
void main() {
  vec2 along = vTo - vFrom;
  float span = length(along);
  vec2 unit = span > 1e-4 ? along / span : vec2(1.0, 0.0);
  vec2 rel = vAt - vFrom;
  float t = dot(rel, unit);
  float halfWidth = vShape.x * 0.5;
  // Round ends: how far from the segment. Flat ends: from the box it
  // sweeps, which a segment of no length does not have.
  float edge = vShape.y > 0.5
    ? length(rel - unit * clamp(t, 0.0, span)) - halfWidth
    : max(abs(dot(rel, vec2(-unit.y, unit.x))) - halfWidth, max(-t, t - span));
  float solid = vInk.a * clamp(0.5 - edge / uPixel, 0.0, 1.0);
  fragColor = vec4(vInk.rgb * solid, solid);
}
`;

/** Texture unit the strokes' points are read from, clear of every other one. */
const POINTS_UNIT = 11;

export interface ILookStrokes {
  /**
   * Draws `strokes` into its target, two pictures of `width` by `height`,
   * and leaves it bound to `unit` for the look's shader; everything it
   * changed is put back as it was found.
   */
  draw(
    strokes: IEngineLookStrokes,
    css: { width: number; height: number },
    width: number,
    height: number,
    unit: number,
  ): void;
  dispose(): void;
}

/** The strokes' program and target, made on the first frame with any. */
export const createLookStrokes = (
  gl: WebGL2RenderingContext,
): ILookStrokes | null => {
  const pass: ISegmentPass | null = createSegmentPass(gl, {
    vertex: VERTEX,
    fragment: FRAGMENT,
    texelsPerPoint: 2,
    pointsPerRow: STROKE_POINTS_PER_ROW,
    maxPoints: MAX_STROKE_POINTS,
    pointsUnit: POINTS_UNIT,
    layers: 2,
  });
  if (!pass) {
    return null;
  }
  return {
    draw: (strokes, css, width, height, unit) => {
      pass.draw(
        strokes.points,
        strokes.count,
        css,
        width,
        height,
        unit,
        () => undefined,
      );
    },
    dispose: pass.dispose,
  };
};
