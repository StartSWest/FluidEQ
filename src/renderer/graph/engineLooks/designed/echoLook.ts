/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { GLOW_LAYERS } from '../../figureGlow';
import { ECHO_RAILS, echoRail, type echoLayout } from '../../echoWaves';
import type { IEngineLookInput } from '../engineLookInput';
import { setLookVector, sizeLookData } from '../lookInput';
import type { IDesignedFrame } from './designedInput';

/**
 * ECHO on the GPU (`echoWaves.ts`, painted by the page in
 * `LiveTraceCanvas`): the halo, the live wave shut against the floor, the
 * plane's rails, the bloom and line of the horizon, and the rows rolling
 * back to it — each drawn as steps, as the page draws them.
 *
 *   uLook[8]  rows (the live wave and the receding ones), the horizon, the
 *             bloom's reach, the bass
 *   uLook[9]  the rows' left and right ends at the front, the plane's front
 *             edge, the figure's own stroke (0 where it is filled)
 *   uLook[10] how far the rails close toward the middle by the horizon
 *   texel (i, r)          row r's point i: r 0 the live wave, then the
 *                         receding rows oldest first
 *   texel (r, PARAM_ROW)  row r's remaining light, its beat, its floor, its
 *                         points
 *   texel (r, CREST_ROW)  row r's highest point, for skipping it
 */

const MAX_ROWS = 11;
const PARAM_ROW = MAX_ROWS;
const CREST_ROW = MAX_ROWS + 1;
const f = (value: number) => value.toFixed(6);

const GLSL = `
const int PARAM_ROW = ${PARAM_ROW};
const int CREST_ROW = ${CREST_ROW};

// A row drawn as steps — a flat run at each column's own height and a riser
// to the next: how far q is from it, how far from it shut against floorY,
// and 1 where q is inside it shut.
vec3 echoStairs(vec2 q, int row, int count, float floorY) {
  if (count < 2) {
    return vec3(1e5, 1e5, 0.0);
  }
  int seg = dsSegment(row, count, q.x);
  float open = 1e5;
  for (int k = seg - 2; k <= seg + 2; k++) {
    if (k < 0 || k > count - 2) {
      continue;
    }
    vec2 a = dsPoint(row, count, k);
    vec2 b = dsPoint(row, count, k + 1);
    open = min(open, dsToSegment(q, a, vec2(b.x, a.y)));
    open = min(open, dsToSegment(q, vec2(b.x, a.y), b));
  }
  vec2 first = dsPoint(row, count, 0);
  vec2 last = dsPoint(row, count, count - 1);
  float closing = min(
    dsToSegment(q, last, vec2(last.x, floorY)),
    min(dsToSegment(q, vec2(last.x, floorY), vec2(first.x, floorY)), dsToSegment(q, vec2(first.x, floorY), first))
  );
  float runY = q.x >= last.x ? last.y : dsPoint(row, count, seg).y;
  float inside = q.x >= first.x && q.x <= last.x && q.y >= runY && q.y <= floorY ? 1.0 : 0.0;
  return vec3(open, min(open, closing), inside);
}

float echoCover(vec3 stairs) {
  return clamp(0.5 + (stairs.z > 0.5 ? stairs.y : -stairs.y) / lookPixel(), 0.0, 1.0);
}

vec4 echoCopy(vec4 picture, vec2 p, int copy) {
  vec2 q = dsScene(p, copy);
  int rows = int(uLook[8].x + 0.5);
  if (rows < 1) {
    return picture;
  }
  float horizon = uLook[8].y;
  float bloom = uLook[8].z;
  float bass = uLook[8].w;
  float left = uLook[9].x;
  float right = uLook[9].y;
  float front = uLook[9].z;
  vec4 live = texelFetch(uLookData, ivec2(0, PARAM_ROW), 0);
  vec3 figure = echoStairs(q, 0, int(live.w + 0.5), live.z);
  // The halo round the live wave, and the wave itself.
  if (uLook[6].z > 0.0) {
    vec3 glow = dsGlowPaint(q);
    ${GLOW_LAYERS.map(
      ({ widen, opacity }) =>
        `picture = lookOver(picture, lookPaint(glow, ${f(opacity)} * uLook[6].z * dsSoftStroke(figure.y, dsStrokeWidth() + ${f(widen)} * uLook[6].w)));`,
    ).join('\n    ')}
  }
  if (dsFilled()) {
    picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * dsFillOpacity() * echoCover(figure)));
  }
  // The plane: rails back to the horizon, brighter toward the front.
  if (q.y >= horizon - 2.0 && q.y <= front + 2.0) {
    float centre = (left + right) * 0.5;
    float u = clamp((front - q.y) / max(1e-3, front - horizon), 0.0, 1.0);
    // How far toward the middle the rails have closed at this row.
    float closing = 1.0 - (1.0 - uLook[10].x) * u;
    float along = ((q.x - centre) / max(1e-3, closing) + centre - left) / max(1e-3, right - left) * ${f(ECHO_RAILS)};
    float rail = 1e5;
    for (int k = int(floor(along)) - 1; k <= int(floor(along)) + 2; k++) {
      if (k < 0 || k > ${ECHO_RAILS}) {
        continue;
      }
      float at = left + (right - left) * float(k) / ${f(ECHO_RAILS)};
      float back = centre + (at - centre) * uLook[10].x;
      rail = min(rail, dsToSegment(q, vec2(at, front), vec2(back, horizon)));
    }
    float light = 0.16 * lookAlong(q.y, horizon, front);
    picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * (0.5 + bass * 0.5) * light * lookStroke(rail, 1.0)));
  }
  // The bloom on the horizon, swelling with the bass.
  float bloomTop = horizon - bloom;
  float bloomBottom = horizon + bloom * 0.5;
  if (q.y >= bloomTop && q.y <= bloomBottom && q.x >= uLook[1].x && q.x <= uLook[1].y) {
    float u = (q.y - bloomTop) / max(1e-3, bloomBottom - bloomTop);
    float haze = u < 0.66 ? mix(0.0, 0.14, u / 0.66) : mix(0.14, 0.0, (u - 0.66) / 0.34);
    picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * (0.55 + bass * 0.45) * haze));
  }
  // The horizon: a faint line, brightest in the middle.
  float middle = lookAlong(q.x, uLook[1].x, uLook[1].y);
  float lineLight = 0.35 * (1.0 - abs(middle * 2.0 - 1.0));
  float onLine = q.x >= uLook[1].x && q.x <= uLook[1].y ? lookStroke(q.y - horizon, 1.0) : 0.0;
  picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * lineLight * onLine));
  // Back to front: each past row dimmer and thinner with depth, a beat's
  // row heavier and brighter all the way back.
  for (int r = 1; r < ${MAX_ROWS}; r++) {
    if (r >= rows) {
      break;
    }
    vec4 row = texelFetch(uLookData, ivec2(r, PARAM_ROW), 0);
    float crest = texelFetch(uLookData, ivec2(r, CREST_ROW), 0).x;
    float reach = 1.0 + row.y * 1.6;
    if (q.y < crest - reach - 2.0 || q.y > row.z + 2.0) {
      continue;
    }
    vec3 stairs = echoStairs(q, r, int(row.w + 0.5), row.z);
    if (dsFilled()) {
      picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * dsFillOpacity() * 0.14 * row.x * echoCover(stairs)));
    }
    picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * row.x * (0.45 + row.y * 0.5) * lookStroke(stairs.x, reach)));
    if (row.y > 0.3) {
      picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * row.x * row.y * 0.6 * lookStroke(stairs.x, 0.8)));
    }
  }
  // A stroked look's own line round the live wave, over the rest.
  if (uLook[9].w > 0.0) {
    picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * lookStroke(figure.y, uLook[9].w)));
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    if (dsCopy(copy).z > 0.5) {
      picture = echoCopy(picture, p, copy);
    }
  }
  return picture;
}
`;

/** What the page hands the engine for the echo, beside the frame. */
export interface IEchoScene {
  layout: ReturnType<typeof echoLayout>;
  /** The figure's own stroke width, or 0 where it has none. */
  figureStroke: number;
}

const step = (
  frame: IDesignedFrame,
  scene: IEchoScene,
  input: IEngineLookInput,
): void => {
  const { layout, figureStroke } = scene;
  const rows = [
    { wave: layout.live.wave, floor: layout.live.floor, depth: 0, strength: 0 },
    ...layout.rows.slice(-(MAX_ROWS - 1)),
  ];
  const across = Math.max(MAX_ROWS, ...rows.map(({ wave }) => wave.length));
  const data = sizeLookData(input, across, CREST_ROW + 1);
  data.fill(0);
  rows.forEach(({ wave, floor, depth, strength }, row) => {
    let crest = floor;
    wave.forEach(([x, y], index) => {
      data[(row * across + index) * 4] = x;
      data[(row * across + index) * 4 + 1] = y;
      crest = Math.min(crest, y);
    });
    data.set(
      [(1 - depth) ** 1.5, strength, floor, wave.length],
      (PARAM_ROW * across + row) * 4,
    );
    data[(CREST_ROW * across + row) * 4] = crest;
  });
  setLookVector(
    input,
    8,
    rows.length,
    layout.horizon,
    layout.bloom,
    layout.bass,
  );
  setLookVector(
    input,
    9,
    layout.left,
    layout.right,
    layout.bottom,
    frame.filled ? 0 : figureStroke,
  );
  // How far the rails close toward the middle by the horizon, from the
  // page's own rail: a rail from the left edge of a plot two wide.
  const { back } = echoRail(0, 2, 0);
  setLookVector(input, 10, 1 - back, 0, 0, 0);
};

const echoLook = { glsl: GLSL, step };

export default echoLook;
