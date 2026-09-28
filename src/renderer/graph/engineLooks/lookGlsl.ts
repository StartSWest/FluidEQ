/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { HEAT_STEPS } from '../sceneViews/sceneFrame';
import { LOOK_INKS, LOOK_VECTORS } from './engineLookInput';

/**
 * What every one of FluidEQ's own looks is written with, ahead of its own
 * `sceneColour`: the inputs the page lays out (`engineLookInput.ts`) and the
 * painting the 2D looks did with a canvas, as functions of a pixel.
 *
 * The picture is worked in CSS pixels, y down, as the 2D looks worked, so a
 * look's layout numbers mean here exactly what they meant there. Colours are
 * premultiplied throughout, which is what the engine's canvas holds and what
 * lets `lookOver` be the canvas's source-over and a sum its `lighter`.
 *
 * The vectors every look shares:
 *   uLook[0] the look's canvas in CSS pixels (xy)
 *   uLook[1] the plot: left, right, top, bottom
 *   uLook[2] the first copy of the figure: top, bottom, flipped, present
 *   uLook[3] the second, when the wave is mirrored
 *   uLook[4] the style editor: Colour by (0 one colour, 1 along the spectrum,
 *            2 up the height, 3 heat), filled, opacity, line width
 *   uLook[5] Lit peaks, the beat's pulse, Rainbow's glow, the music's energy
 *   uLook[8] where the first copy stands, for a look that stands on a
 *            floor: its floor, which way is up (-1 or 1), how far it
 *            reaches, present — worked out by the 2D look's own function
 *            (`ISceneStand`), so the shader never works it out again
 *   uLook[9] the second copy's
 * and uLook[6], uLook[7] and uLook[10] to uLook[15] are each look's own.
 */
const LOOK_GLSL = `
uniform sampler2D uLookData;
uniform vec4 uLook[${LOOK_VECTORS}];
uniform vec3 uInk[${LOOK_INKS}];
uniform int uInkCount;
uniform float uLookPass;
uniform sampler2D uLookBloom;
uniform float uLookBloomStrength;

vec2 lookPoint(vec2 uv) {
  return vec2(uv.x, 1.0 - uv.y) * uLook[0].xy;
}

// CSS pixels a drawn pixel covers: the width of an anti-aliased edge.
float lookPixel() {
  return uLook[0].x / max(1.0, uResolution.x);
}

bool lookBloomPass() {
  return uLookPass > 0.5;
}

vec4 lookData(int index) {
  return texelFetch(uLookData, ivec2(index, 0), 0);
}

// The look's ramp at t, as the 2D looks sample it (lookColours.ts): stops
// evenly spaced, straight lines between them.
vec3 lookInk(float t) {
  if (uInkCount <= 1) {
    return uInk[0];
  }
  float at = clamp(t, 0.0, 1.0) * float(uInkCount - 1);
  int from = int(floor(at));
  int to = min(uInkCount - 1, from + 1);
  return mix(uInk[from], uInk[to], at - float(from));
}

// The same colour moved toward white, for highlights.
vec3 lookLightInk(float t, float whiten) {
  vec3 colour = lookInk(t);
  return colour + (1.0 - colour) * clamp(whiten, 0.0, 1.0);
}

int lookInkMode() {
  return int(uLook[4].x + 0.5);
}

bool lookFilled() {
  return uLook[4].y > 0.5;
}

float lookOpacity() {
  return uLook[4].z;
}

float lookLineWidth() {
  return uLook[4].w;
}

bool lookAccents() {
  return uLook[5].x > 0.5;
}

float lookPulse() {
  return uLook[5].y;
}

// Where on the ramp a whole figure paints p: the middle for one colour,
// across the plot for the spectrum, up from the floor for height (and for
// heat, which has one height to read when the figure is not made of pieces).
float lookFigureT(vec2 p, float floorY, float headY) {
  int mode = lookInkMode();
  if (mode == 0) {
    return 0.5;
  }
  if (mode == 1) {
    return (p.x - uLook[1].x) / max(1.0, uLook[1].y - uLook[1].x);
  }
  float span = headY - floorY;
  return abs(span) < 1e-3 ? 0.0 : (p.y - floorY) / span;
}

// A figure mirrored about a middle line (sceneInks.ts, mirroredInk): across
// the plot, one colour, or out from the line both ways to reach either side.
float lookMirroredT(vec2 p, float middle, float reach) {
  int mode = lookInkMode();
  if (mode == 0) {
    return 0.5;
  }
  if (mode == 1) {
    return (p.x - uLook[1].x) / max(1.0, uLook[1].y - uLook[1].x);
  }
  return clamp(abs(p.y - middle) / max(1e-3, reach), 0.0, 1.0);
}

// A round figure (sceneInks.ts, roundInk): the spectrum round it, bass at
// the bottom climbing both sides to the treble at the top, turned by turn;
// out from radius from to radius to; or one colour.
float lookRoundT(vec2 p, vec2 centre, float from, float to, float turn) {
  int mode = lookInkMode();
  if (mode == 0) {
    return 0.5;
  }
  vec2 q = p - centre;
  if (mode == 1) {
    // The canvas's conic gradient: clockwise on screen from its start angle.
    float angle = atan(q.y, q.x) - (1.5707963 + turn);
    float at = fract(angle / 6.2831853);
    return at < 0.5 ? at * 2.0 : 2.0 - at * 2.0;
  }
  return clamp((length(q) - from) / max(1e-3, to - from), 0.0, 1.0);
}

// Heat's steps, a piece whole in the colour of its own loudness (heatStep).
float lookHeatT(float level) {
  return floor(clamp(level, 0.0, 1.0) * ${HEAT_STEPS - 1}.0 + 0.5) / ${HEAT_STEPS - 1}.0;
}

vec4 lookPaint(vec3 colour, float alpha) {
  float a = clamp(alpha, 0.0, 1.0);
  return vec4(colour * a, a);
}

// The canvas's source-over.
vec4 lookOver(vec4 under, vec4 top) {
  return top + under * (1.0 - top.a);
}

// A rectangle from lo to hi rounded by r: its signed distance, in CSS pixels.
float lookBox(vec2 p, vec2 lo, vec2 hi, float r) {
  vec2 centre = (lo + hi) * 0.5;
  vec2 extent = max(vec2(0.0), (hi - lo) * 0.5);
  float corner = clamp(r, 0.0, min(extent.x, extent.y));
  vec2 q = abs(p - centre) - extent + corner;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - corner;
}

// The same with a radius per corner: top-left, top-right, bottom-right,
// bottom-left, as the canvas's roundRect takes them (y runs down).
float lookBox4(vec2 p, vec2 lo, vec2 hi, vec4 r) {
  vec2 centre = (lo + hi) * 0.5;
  vec2 extent = max(vec2(0.0), (hi - lo) * 0.5);
  vec2 q = p - centre;
  float corner = q.x < 0.0 ? (q.y < 0.0 ? r.x : r.w) : (q.y < 0.0 ? r.y : r.z);
  corner = clamp(corner, 0.0, min(extent.x, extent.y));
  vec2 d = abs(q) - extent + corner;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - corner;
}

// A convex four-sided shape through a, b, c, d in order, either way round:
// its signed distance, near enough at the edges for an anti-aliased fill.
float lookQuad(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d) {
  float turn = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  float s = turn < 0.0 ? -1.0 : 1.0;
  vec2 corners[4] = vec2[4](a, b, c, d);
  float outside = -1e4;
  for (int i = 0; i < 4; i++) {
    vec2 from = corners[i];
    vec2 to = corners[(i + 1) % 4];
    vec2 edge = to - from;
    float len = max(1e-4, length(edge));
    // Positive to the right of an edge walked the shape's way round.
    float side = -s * ((edge.x * (p.y - from.y) - edge.y * (p.x - from.x)) / len);
    outside = max(outside, side);
  }
  return outside;
}

// A vertical gradient's position: 0 at from, 1 at to, clamped.
float lookAlong(float y, float from, float to) {
  float span = to - from;
  return abs(span) < 1e-3 ? 0.0 : clamp((y - from) / span, 0.0, 1.0);
}

// How much of a pixel a shape covers: filled, or its edge stroked.
float lookFill(float distance) {
  return clamp(0.5 - distance / lookPixel(), 0.0, 1.0);
}

float lookStroke(float distance, float width) {
  return clamp(0.5 - (abs(distance) - width * 0.5) / lookPixel(), 0.0, 1.0);
}

float lookShape(float distance) {
  return lookFilled()
    ? lookFill(distance)
    : lookStroke(distance, lookLineWidth());
}

// The copy of the figure: top, bottom, flipped, present.
vec4 lookBand(int copy) {
  return copy == 0 ? uLook[2] : uLook[3];
}

// Where the copy stands: floor, up, reach, present.
vec4 lookStand(int copy) {
  return copy == 0 ? uLook[8] : uLook[9];
}

// The bloom added over the finished picture, as the canvas's lighter.
vec4 lookBloomed(vec4 picture, vec2 uv) {
  if (uLookBloomStrength <= 0.0) {
    return picture;
  }
  return min(picture + texture(uLookBloom, uv) * uLookBloomStrength, vec4(1.0));
}
`;

export default LOOK_GLSL;
