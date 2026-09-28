/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { HALO_SCALE } from '../../figureGlow';
import { LOOK_INKS } from '../engineLookInput';

/**
 * What the designed scenes — the terrace, the skyline, the bridge, the
 * slope, the bubbles, the monitor, the echo and the invasion — are painted
 * with on the GPU, after `LOOK_GLSL` and ahead of each scene's own
 * `sceneColour`: where each copy of the drawing stands, the look's paint and
 * the glow's as the page resolves them (`resolveTracePaint`), the halo's
 * soft strokes and the polylines the scenes are made of.
 *
 * Every scene is laid out by the page in SCENE space — the screen with the
 * wave's stretch undone and its flip kept (`LiveTraceCanvas`) — and a few
 * things in WAVE space, the stretch kept; a pixel is taken into either.
 *
 * The vectors every designed scene shares (`designedInput.ts`):
 *   uLook[0], uLook[1] as every look (`lookGlsl.ts`)
 *   uLook[2], uLook[3] each copy's placement: its row offset, its vertical
 *            scale, present
 *   uLook[4] the look's paint: 0 one colour, 1 across, 2 up; its ramp's
 *            start and end; the fill's opacity
 *   uLook[5] the glow's paint, the same way; 1 where the figure is filled
 *   uLook[6] the trace's presence, its width, the halo's light and swell
 *   uLook[7] the shake, and the scene's floor and ceiling
 * and uLook[8] to uLook[15] are each scene's own. The look's stops are
 * `uInk`, the glow's `uInkMate`.
 */
const DESIGNED_GLSL = `
uniform vec3 uInkMate[${LOOK_INKS}];
uniform int uInkMateCount;

vec4 dsCopy(int copy) {
  return copy == 0 ? uLook[2] : uLook[3];
}

// A pixel in a copy's scene space: the shake and the row offset taken off,
// the flip undone, the stretch not applied.
vec2 dsScene(vec2 p, int copy) {
  vec4 at = dsCopy(copy);
  return vec2(p.x - uLook[7].x, (p.y - uLook[7].y - at.x) * (at.y < 0.0 ? -1.0 : 1.0));
}

// The same pixel in wave space, the stretch undone as well.
vec2 dsWave(vec2 p, int copy) {
  vec4 at = dsCopy(copy);
  return vec2(p.x - uLook[7].x, (p.y - uLook[7].y - at.x) / (abs(at.y) < 1e-4 ? 1e-4 : at.y));
}

float dsOpacity() {
  return uLook[6].x;
}

float dsStrokeWidth() {
  return uLook[6].y;
}

float dsFillOpacity() {
  return uLook[4].w;
}

bool dsFilled() {
  return uLook[5].w > 0.5;
}

float dsSceneBase() {
  return uLook[7].z;
}

float dsSceneTop() {
  return uLook[7].w;
}

vec3 dsMateInk(float t) {
  if (uInkMateCount <= 1) {
    return uInkMate[0];
  }
  float at = clamp(t, 0.0, 1.0) * float(uInkMateCount - 1);
  int from = int(floor(at));
  int to = min(uInkMateCount - 1, from + 1);
  return mix(uInkMate[from], uInkMate[to], at - float(from));
}

// Where along a paint's ramp q is: across from its start to its end, or up.
float dsRampAt(vec4 paint, vec2 q) {
  float span = paint.z - paint.y;
  float along = paint.x < 1.5 ? q.x : q.y;
  return abs(span) < 1e-4 ? 0.0 : (along - paint.y) / span;
}

// The look's paint at q, in whatever space the shape it fills is drawn in.
vec3 dsPaint(vec2 q) {
  return uLook[4].x < 0.5 ? uInk[0] : lookInk(dsRampAt(uLook[4], q));
}

// The halo's: the look's, or Rainbow's sweep where it is the border.
vec3 dsGlowPaint(vec2 q) {
  return uLook[5].x < 0.5 ? uInkMate[0] : dsMateInk(dsRampAt(uLook[5], q));
}

// A stroke as soft as the halo's, painted at a fraction of the resolution
// and stretched back over the frame.
float dsSoftStroke(float distance, float width) {
  float edge = lookPixel() / ${HALO_SCALE.toFixed(6)};
  return clamp(0.5 - (abs(distance) - width * 0.5) / edge, 0.0, 1.0);
}

float dsToSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float span = dot(ab, ab);
  float t = span > 0.0 ? clamp(dot(p - a, ab) / span, 0.0, 1.0) : 0.0;
  return length(p - (a + ab * t));
}

// Point i of a polyline kept in a row of uLookData, left to right.
vec2 dsPoint(int row, int count, int i) {
  return texelFetch(uLookData, ivec2(clamp(i, 0, count - 1), row), 0).xy;
}

// The segment x falls in along a row's polyline.
int dsSegment(int row, int count, float x) {
  int last = count - 1;
  if (last < 1 || x <= dsPoint(row, count, 0).x) {
    return 0;
  }
  if (x >= dsPoint(row, count, last).x) {
    return last - 1;
  }
  int lo = 0;
  int hi = last;
  for (int k = 0; k < 16; k++) {
    if (hi - lo <= 1) {
      break;
    }
    int mid = (lo + hi) / 2;
    if (dsPoint(row, count, mid).x <= x) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

// A polyline's height at x, straight between its points.
float dsLineAt(int row, int count, int seg, float x) {
  vec2 a = dsPoint(row, count, seg);
  vec2 b = dsPoint(row, count, seg + 1);
  float t = b.x > a.x ? clamp((x - a.x) / (b.x - a.x), 0.0, 1.0) : 0.0;
  return mix(a.y, b.y, t);
}

// How far p is from a row's polyline, and the x of the nearest point on it:
// every segment that could be within reach of it.
vec2 dsNearest(vec2 p, int row, int count, float reach) {
  if (count < 2) {
    return vec2(1e5, p.x);
  }
  int seg = dsSegment(row, count, p.x);
  vec2 best = vec2(1e5, p.x);
  int first = seg;
  for (int k = 0; k < 96; k++) {
    if (first <= 0 || dsPoint(row, count, first).x < p.x - reach) {
      break;
    }
    first -= 1;
  }
  vec2 a = dsPoint(row, count, first);
  for (int k = 0; k < 192; k++) {
    int j = first + k;
    if (j >= count - 1 || a.x > p.x + reach) {
      break;
    }
    vec2 b = dsPoint(row, count, j + 1);
    vec2 ab = b - a;
    float span = dot(ab, ab);
    float t = span > 0.0 ? clamp(dot(p - a, ab) / span, 0.0, 1.0) : 0.0;
    vec2 near = a + ab * t;
    float d = length(p - near);
    if (d < best.x) {
      best = vec2(d, near.x);
    }
    a = b;
  }
  return best;
}
`;

export default DESIGNED_GLSL;
