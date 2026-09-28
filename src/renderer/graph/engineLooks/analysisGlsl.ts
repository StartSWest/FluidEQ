/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseCssColour } from '../../utils/oklab';
import { FILL_DEPTH, FOOT_ALPHA } from '../analysis/spectrumPaint';
import { LOOK_INKS } from './engineLookInput';

/**
 * What the measuring views are painted with on the GPU, after `LOOK_GLSL`
 * and ahead of each view's own `sceneColour`: the rules of `spectrumPaint.ts`
 * — a body under a curve fading to its foot, an edge in the ramp it stands
 * in, a row of pieces, a beam — as functions of a pixel, and the curves the
 * page laid out, read from `uLookData`.
 *
 * The vectors every measuring view shares (`analysisLookInput.ts`):
 *   uLook[0] to uLook[3] as every look (`lookGlsl.ts`)
 *   uLook[4] the palette (0 one colour, 1 across the axis, 2 up the level,
 *            3 heat), filled, the look's fill opacity, its edge's width
 *   uLook[5] Rainbow's glow, 1 where the edge is Rainbow's own sweep, and
 *            how present each copy of the drawing is
 *   uLook[6] the edge's colour (Rainbow's sweep, or the look's hot end), and
 *            how many points a curve has
 * and uLook[7] to uLook[15] are each view's own.
 *
 * A CURVE is a row of `uLookData`: one texel per point, x in `.x` and the
 * rows of up to three curves that share those points in `.yzw`, all in CSS
 * pixels — placed on the page by the 2D view's own functions, so nothing
 * here decides where a reading lands.
 */
const ANALYSIS_GLSL = `
uniform vec3 uInkMate[${LOOK_INKS}];
uniform int uInkMateCount;

vec3 anMateInk(float t) {
  if (uInkMateCount <= 1) {
    return uInkMate[0];
  }
  float at = clamp(t, 0.0, 1.0) * float(uInkMateCount - 1);
  int from = int(floor(at));
  int to = min(uInkMateCount - 1, from + 1);
  return mix(uInkMate[from], uInkMate[to], at - float(from));
}

// The look's ramp, or the second reading's turned copy of it.
vec3 anRamp(bool mate, float t) {
  return mate ? anMateInk(t) : lookInk(t);
}

int anPalette() {
  return int(uLook[4].x + 0.5);
}

float anFillOpacity() {
  return uLook[4].z;
}

float anEdgeWidth() {
  return uLook[4].w;
}

float anGlow() {
  return uLook[5].x;
}

bool anEuphoria() {
  return uLook[5].y > 0.5;
}

// How present a copy of the drawing is (IAnalysisBand.opacity).
float anOpacity(int copy) {
  return copy == 0 ? uLook[5].z : uLook[5].w;
}

vec3 anEdgeColour() {
  return uLook[6].rgb;
}

int anPoints() {
  return int(uLook[6].w + 0.5);
}

// A copy's foot, where a reading of nothing rests, and its head.
float anFoot(vec4 band) {
  return band.z > 0.5 ? band.x : band.y;
}

float anHead(vec4 band) {
  return band.z > 0.5 ? band.y : band.x;
}

// Which way is up the copy, in rows: -1 toward the top of the window.
float anRise(vec4 band) {
  return band.z > 0.5 ? 1.0 : -1.0;
}

// 0 at the copy's foot, 1 at its head.
float anUp(vec4 band, float y) {
  return lookAlong(y, anFoot(band), anHead(band));
}

// 0 at the plot's left, 1 at its right.
float anAcross(float x) {
  return clamp((x - uLook[1].x) / max(1.0, uLook[1].y - uLook[1].x), 0.0, 1.0);
}

vec4 anPoint(int i, int row) {
  return texelFetch(uLookData, ivec2(clamp(i, 0, anPoints() - 1), row), 0);
}

// The segment x falls in: the last point at or left of it, by the first
// row's x, which every row shares.
int anSegment(float x) {
  int last = anPoints() - 1;
  if (last < 1 || x <= anPoint(0, 0).x) {
    return 0;
  }
  if (x >= anPoint(last, 0).x) {
    return last - 1;
  }
  int lo = 0;
  int hi = last;
  for (int k = 0; k < 16; k++) {
    if (hi - lo <= 1) {
      break;
    }
    int mid = (lo + hi) / 2;
    if (anPoint(mid, 0).x <= x) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

// A row's three curves at x, inside segment seg: straight lines between
// points, as a path's lineTo draws them.
vec3 anCurvesAt(float x, int row, int seg) {
  vec4 a = anPoint(seg, row);
  vec4 b = anPoint(seg + 1, row);
  float t = b.x > a.x ? clamp((x - a.x) / (b.x - a.x), 0.0, 1.0) : 0.0;
  return mix(a.yzw, b.yzw, t);
}

float anToSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float span = dot(ab, ab);
  float t = span > 0.0 ? clamp(dot(p - a, ab) / span, 0.0, 1.0) : 0.0;
  return length(p - (a + ab * t));
}

vec3 anSegmentsTo(vec2 p, vec4 a, vec4 b) {
  return vec3(
    anToSegment(p, a.xy, b.xy),
    anToSegment(p, a.xz, b.xz),
    anToSegment(p, a.xw, b.xw)
  );
}

// How far p is from each of a row's three curves, over every segment that
// could be within reach of it: the same distance a stroked path's round
// joins and caps are drawn to, and one shape however many segments meet.
vec3 anDistances(vec2 p, int row, int seg, float reach) {
  int last = anPoints() - 1;
  vec4 a = anPoint(seg, row);
  vec4 b = anPoint(seg + 1, row);
  vec3 best = anSegmentsTo(p, a, b);
  vec4 right = a;
  for (int k = 1; k <= 64; k++) {
    int j = seg - k;
    if (j < 0 || right.x < p.x - reach) {
      break;
    }
    vec4 left = anPoint(j, row);
    best = min(best, anSegmentsTo(p, left, right));
    right = left;
  }
  vec4 left = b;
  for (int k = 1; k <= 64; k++) {
    int j = seg + 1 + k;
    if (j > last || left.x > p.x + reach) {
      break;
    }
    vec4 next = anPoint(j, row);
    best = min(best, anSegmentsTo(p, left, next));
    left = next;
  }
  return best;
}

// How much of p the body under a curve covers: between the curve and the
// copy's foot, across the curve's own span. lineY is the curve at p.x and
// dist the distance to it.
float anBodyCover(vec2 p, vec4 band, float lineY, float dist) {
  float px = lookPixel();
  float rise = anRise(band);
  bool inside = (p.y - lineY) * rise <= 0.0;
  float edge = clamp(0.5 + (inside ? dist : -dist) / px, 0.0, 1.0);
  float footing = clamp(0.5 + (p.y - anFoot(band)) * rise / px, 0.0, 1.0);
  float first = anPoint(0, 0).x;
  float last = anPoint(anPoints() - 1, 0).x;
  float sides = clamp(0.5 + (p.x - first) / px, 0.0, 1.0)
    * clamp(0.5 + (last - p.x) / px, 0.0, 1.0);
  return min(min(edge, footing), sides);
}

// How much of p lies between two curves of a row, across their span:
// a ribbon, out along one and back along the other.
float anRibbonCover(vec2 p, float aY, float bY, float aDist, float bDist) {
  float px = lookPixel();
  bool inside = (p.y - aY) * (p.y - bY) <= 0.0;
  float dist = min(aDist, bDist);
  float edge = clamp(0.5 + (inside ? dist : -dist) / px, 0.0, 1.0);
  float first = anPoint(0, 0).x;
  float last = anPoint(anPoints() - 1, 0).x;
  float sides = clamp(0.5 + (p.x - first) / px, 0.0, 1.0)
    * clamp(0.5 + (last - p.x) / px, 0.0, 1.0);
  return min(edge, sides);
}

// A body's fill (spectrumFill): kept deeper than its colours, and on the
// level ramp faded toward the foot in the gradient itself.
vec4 anFillPaint(vec2 p, vec4 band, bool mate, float energy, float alpha) {
  const float keep = ${(1 - FILL_DEPTH).toFixed(6)};
  int palette = anPalette();
  if (palette == 2) {
    float up = anUp(band, p.y);
    return lookPaint(
      anRamp(mate, up) * keep,
      alpha * (${FOOT_ALPHA.toFixed(6)} + up * ${(1 - FOOT_ALPHA).toFixed(6)})
    );
  }
  float t = palette == 0 ? 0.0 : (palette == 3 ? energy : anAcross(p.x));
  return lookPaint(anRamp(mate, t) * keep, alpha);
}

// The fade a fill that cannot carry it is given (fadeTowardFoot): how much
// of whatever is inside the body is taken back at p.
float anFootFade(vec2 p, vec4 band) {
  return anPalette() == 2
    ? 0.0
    : ${(1 - FOOT_ALPHA).toFixed(6)} * (1.0 - anUp(band, p.y));
}

// A body under a curve, filled and faded as paintSpectrum does.
vec4 anBody(vec4 picture, vec2 p, vec4 band, bool mate, float energy, float alpha, float cover) {
  if (cover <= 0.0 || alpha <= 0.0) {
    return picture;
  }
  picture = lookOver(picture, anFillPaint(p, band, mate, energy, alpha) * cover);
  return picture * (1.0 - anFootFade(p, band) * cover);
}

// A reading's outline (spectrumInk): the ramp the body stands in, at full
// strength, or Rainbow's sweep where it is the edge.
vec3 anEdgeInk(vec2 p, vec4 band, bool mate, float energy) {
  if (anEuphoria()) {
    return anEdgeColour();
  }
  int palette = anPalette();
  if (palette == 0) {
    return anRamp(mate, 0.0);
  }
  if (palette == 3) {
    return anRamp(mate, energy);
  }
  return anRamp(mate, palette == 1 ? anAcross(p.x) : anUp(band, p.y));
}

// A row of pieces (piecePaint): the level ramp dims toward the foot.
vec4 anPiecePaint(vec2 p, vec4 band, bool mate, float loudest, float alpha) {
  int palette = anPalette();
  if (palette == 2) {
    float up = anUp(band, p.y);
    return lookPaint(anRamp(mate, up), alpha * (0.22 + up * 0.78));
  }
  float t = palette == 0 ? 0.0 : (palette == 3 ? loudest : anAcross(p.x));
  return lookPaint(anRamp(mate, t), alpha);
}

// A beam (beamPaint): hottest furthest from rest, which is the middle.
vec3 anBeamInk(vec2 p, vec4 band, bool mate) {
  int palette = anPalette();
  if (palette == 0 || palette == 3) {
    return anRamp(mate, 0.8);
  }
  if (palette == 1) {
    return anRamp(mate, anAcross(p.x));
  }
  float u = lookAlong(p.y, band.x, band.y);
  vec3 hot = anRamp(mate, 1.0);
  vec3 rest = anRamp(mate, 0.15);
  return u < 0.5 ? mix(hot, rest, u * 2.0) : mix(rest, hot, u * 2.0 - 1.0);
}
`;

/**
 * A fixed colour of a view's — a rule, a tint — as the GLSL constant it is
 * painted in: straight colour and its alpha, from the view's own string.
 */
export const cssInkGlsl = (colour: string): string => {
  const f = (value: number) => value.toFixed(6);
  const parsed = parseCssColour(colour);
  const [red, green, blue] = parsed ? parsed.rgb : [1, 1, 1];
  return `vec4(${f(red)}, ${f(green)}, ${f(blue)}, ${f(parsed?.alpha ?? 1)})`;
};

/**
 * A gradient of the look's ramp, as a GLSL function `vec4 name(float u, bool
 * mate)` answering the colour and its alpha at `u`: each stop a place on the
 * gradient, the ramp position it takes its colour from, and its alpha,
 * straight lines between them as a canvas gradient draws them. Written from
 * the view's own stops, so the two painters cannot disagree about them.
 */
export const rampStopsGlsl = (
  name: string,
  stops: readonly (readonly [at: number, ramp: number, alpha: number])[],
): string => {
  const f = (value: number) => value.toFixed(6);
  const between = stops.slice(1).map(([at, ramp, alpha], index) => {
    const [fromAt, fromRamp, fromAlpha] = stops[index];
    return `  if (u <= ${f(at)}) {
    float t = clamp((u - ${f(fromAt)}) / ${f(Math.max(1e-6, at - fromAt))}, 0.0, 1.0);
    return vec4(mix(anRamp(mate, ${f(fromRamp)}), anRamp(mate, ${f(ramp)}), t), mix(${f(fromAlpha)}, ${f(alpha)}, t));
  }`;
  });
  const [, lastRamp, lastAlpha] = stops[stops.length - 1];
  return `vec4 ${name}(float u, bool mate) {
${between.join('\n')}
  return vec4(anRamp(mate, ${f(lastRamp)}), ${f(lastAlpha)});
}
`;
};

export default ANALYSIS_GLSL;
