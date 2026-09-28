/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  coreLight,
  eachRay,
  moveMotes,
  rayBase,
  rayHalfWidth,
  rayLength,
  raySparks,
  readHalo,
  ringLineAlpha,
  ringOf,
  type IHaloState,
} from '../sceneViews/halo';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import {
  lightRamp,
  pushSprite,
  setLookVector,
  sizeLookData,
} from './lookInput';

/**
 * HALO on the GPU: the 2D look's ring of rays — the core breathing inside
 * it, the ring line, the rays (or in outline the line through their tips),
 * the held dots and the treble's sparks (`sceneViews/halo.ts`) — painted per
 * pixel from the rays the 2D look's own function lays out; the motes thrown
 * off the tips moved by it too and drawn as sprites.
 *
 *   uLook[6] rays up one side, how far the ring has turned
 *   uLook[7] the core's light at its middle and six tenths out, the ring's
 *   uLook[10], uLook[11] each copy's ring (`ringOf`): middle x and y, its
 *            radius, a ray's reach
 *   uLook[12], uLook[13] each copy's rays: where they stand, half a width
 *   texel (piece, copy)  that ray's length, its held length, whether it
 *            sparks, its level
 */

const GLSL = `
const float PI = 3.14159265;

vec4 haloCopy(vec2 p, int copy, vec4 picture) {
  vec4 ring = copy == 0 ? uLook[10] : uLook[11];
  vec4 rays = copy == 0 ? uLook[12] : uLook[13];
  vec2 centre = ring.xy;
  float radius = ring.z;
  float reach = ring.w;
  float base = rays.x;
  float halfWidth = rays.y;
  float side = uLook[6].x;
  float turn = uLook[6].y;
  float opacity = lookOpacity();
  vec2 q = p - centre;
  float dist = length(q);

  // The core, added as light.
  float coreT = dist / max(1e-3, radius);
  if (coreT < 1.0) {
    vec4 core = coreT < 0.6
      ? mix(lookPaint(lookLightInk(0.1, 0.55), uLook[7].x), lookPaint(lookInk(0.85), uLook[7].y), coreT / 0.6)
      : mix(lookPaint(lookInk(0.85), uLook[7].y), vec4(0.0), (coreT - 0.6) / 0.4);
    picture = min(picture + core * lookFill(dist - radius), vec4(1.0));
  }
  // The ring line.
  picture = lookOver(picture, vec4(vec3(1.0), 1.0) * uLook[7].z * lookStroke(abs(dist - radius), 1.5));

  float u = mod(atan(q.y, q.x) - PI * 0.5 - turn, 2.0 * PI) / PI * side;
  float count = side * 2.0;
  vec3 paint = lookInk(lookRoundT(p, centre, base, base + reach, turn));
  float shape = 0.0;
  vec3 shapeInk = paint;
  float held = 0.0;
  float spark = 0.0;
  float outlineR[3];
  for (int n = -1; n <= 1; n++) {
    float at = mod(floor(u) + float(n) + count, count);
    int piece = int(at < side ? at : count - 1.0 - at);
    vec4 ray = texelFetch(uLookData, ivec2(piece, copy), 0);
    float angle = PI * 0.5 + turn + (at + 0.5) / side * PI;
    vec2 dir = vec2(cos(angle), sin(angle));
    vec2 local = vec2(dot(q, dir), dot(q, vec2(-dir.y, dir.x)));
    float d = lookBox(local, vec2(base, -halfWidth), vec2(base + ray.x, halfWidth), 0.0);
    float cover = lookFill(d);
    if (cover > shape) {
      shape = cover;
      shapeInk = lookInkMode() == 3 ? lookInk(lookHeatT(ray.w)) : paint;
    }
    outlineR[n + 1] = base + ray.x;
    if (lookAccents() && ray.y - ray.x > 3.0) {
      float dotRadius = max(1.2, halfWidth * 0.9);
      held = max(held, lookFill(length(q - dir * (base + ray.y)) - dotRadius));
    }
    if (ray.z > 0.5) {
      spark = max(spark, lookFill(length(q - dir * (base + ray.x + 2.0)) - 1.8));
    }
  }
  if (lookFilled()) {
    picture = lookOver(picture, lookPaint(shapeInk, 0.95 * opacity * shape));
  } else {
    // In outline the ring is the line through the rays' tips.
    float frac = u - floor(u) - 0.5;
    float tipR = frac < 0.0 ? mix(outlineR[0], outlineR[1], frac + 1.0) : mix(outlineR[1], outlineR[2], frac);
    vec3 ink = lookInkMode() == 3
      ? lookInk(clamp((dist - base) / max(1e-3, reach), 0.0, 1.0))
      : paint;
    picture = lookOver(picture, lookPaint(ink, 0.95 * opacity * lookStroke(abs(dist - tipR), lookLineWidth())));
  }
  vec3 heldInk = lookLightInk(lookRoundT(p, centre, base, base + reach, turn), 0.45);
  picture = lookOver(picture, lookPaint(heldInk, 0.9 * held));
  return lookOver(picture, vec4(vec3(1.0), 1.0) * 0.85 * spark);
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 ring = copy == 0 ? uLook[10] : uLook[11];
    if (ring.w > 0.0) {
      picture = haloCopy(p, copy, picture);
    }
  }
  return picture;
}
`;

const step = (
  reading: ISceneReading,
  state: IHaloState,
  input: IEngineLookInput,
): boolean => {
  const { bands, look, music, colours } = reading;
  const falling = readHalo(reading, state);
  const half = state.row.count;
  const data = sizeLookData(input, half, 2);
  data.fill(0);
  [0, 1].forEach((copy) => {
    const band = bands[copy];
    if (!band) {
      setLookVector(input, 10 + copy, 0, 0, 0, 0);
      setLookVector(input, 12 + copy, 0, 0, 0, 0);
      return;
    }
    const { cx, cy, radius, reach } = ringOf(reading, band);
    const base = rayBase(radius);
    setLookVector(input, 10 + copy, cx, cy, radius, reach);
    setLookVector(
      input,
      12 + copy,
      base,
      rayHalfWidth(base, half, look.gap),
      0,
      0,
    );
    // Every ray, as the 2D look lays it out — which throws the motes, once a
    // copy a frame, as it does there.
    eachRay(reading, band, state, ({ piece, fromBottom, level, length }) => {
      const at = (copy * half + piece) * 4;
      data[at] = length;
      data[at + 1] = rayLength(state.peaks.held[piece], reach);
      data[at + 2] = raySparks(level, fromBottom, music.treble) ? 1 : 0;
      data[at + 3] = level;
    });
  });
  const light = coreLight(music, reading.glow);
  setLookVector(input, 6, half, state.turn, 0, 0);
  setLookVector(
    input,
    7,
    light.middle,
    light.halfway,
    ringLineAlpha(music.pulse),
    0,
  );
  // The motes, all in the colour of their mean tint.
  const placed: number[] = [];
  const { alive, tint } = moveMotes(state, reading.deltaMs, (x, y, size) =>
    placed.push(x, y, size),
  );
  const ink = lightRamp(colours, tint, 0.4);
  for (let at = 0; at < placed.length; at += 3) {
    pushSprite(input, placed[at], placed[at + 1], placed[at + 2], 0.85, ink);
  }
  input.bloom = 0;
  return alive > 0 || (falling && look.accents);
};

const haloLook: IEngineLook<IHaloState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.halo,
  step,
};

export default haloLook;
