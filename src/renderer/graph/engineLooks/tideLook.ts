/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  MOON_SEAS,
  MOST_GLINTS,
  SAMPLES,
  SWELL_COUNT,
  crestLines,
  glintAlpha,
  moonColumnAlpha,
  moonColumnWidth,
  moonHaloAlpha,
  moveSpray,
  placeGlints,
  placeTideStars,
  rollTide,
  shapeTide,
  throwSpray,
  tideSky,
  tideStarAlpha,
  traceSwell,
  type ITideState,
} from '../sceneViews/tide';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import {
  pushRectSprite,
  pushSprite,
  setLookVector,
  sizeLookData,
  spritesSoFarUnder,
} from './lookInput';

/**
 * TIDE on the GPU: the 2D look's moon and its halo, the four swells with
 * their night water, the glints of the moon's path, the foam on the crests
 * and the moon's column on the water (`sceneViews/tide.ts`), painted per
 * pixel from the swells, glints and sky the 2D look's own functions lay
 * out; the stars drawn as sprites under the picture and the spray over it.
 *
 *   uLook[6] samples, the halo's light, the column's light
 *   per copy, rows from 9 * copy:
 *     rows 0-3   swell by swell, far to near: its surface at each sample
 *     rows 4-7   its glints: middle x and y, half length, half thickness
 *     row 8      texel 0: foot, head, which way up, present
 *                texel 1: the moon's x, y, radius, halo
 *                texel 2: the far swell's rest, the column's width
 *                texels 3-6: each swell's tint, surface, water, glints
 *                texels 7-10: each crest line's width, whiten, light;
 *                             its glints' light
 *                texel 11: the front swell's foam: width, whiten, light
 *                texels 12-15: each swell's glints' extent across
 */

const ROWS_PER_COPY = 9;
const SEAS = MOON_SEAS.length;

const GLSL = `
const int SWELLS = ${SWELL_COUNT};
const int SEAS = ${SEAS};
const vec4 MOON_SEAS[${SEAS}] = vec4[${SEAS}](${MOON_SEAS.map(
  (sea) => `vec4(${sea.map((value) => value.toFixed(3)).join(', ')})`,
).join(', ')});

vec4 tideConst(int copy, int index) {
  return texelFetch(uLookData, ivec2(index, copy * ${ROWS_PER_COPY} + 8), 0);
}

// A swell's surface at x: its height and slope.
vec2 swellAt(float x, int row) {
  float width = max(1.0, uLook[1].y - uLook[1].x);
  float samples = uLook[6].x;
  float at = clamp((x - uLook[1].x) / width, 0.0, 1.0) * samples;
  int i = int(min(floor(at), samples - 1.0));
  vec4 a = texelFetch(uLookData, ivec2(i, row), 0);
  vec4 b = texelFetch(uLookData, ivec2(i + 1, row), 0);
  return vec2(mix(a.x, b.x, at - float(i)), (b.x - a.x) / (width / samples));
}

vec3 rimInk(vec2 p, float tint, float whiten) {
  if (lookInkMode() == 1) {
    return lookLightInk((p.x - uLook[1].x) / max(1.0, uLook[1].y - uLook[1].x), whiten);
  }
  return lookLightInk(tint, whiten);
}

vec4 tideCopy(vec2 p, int copy, vec4 picture) {
  vec4 place = tideConst(copy, 0);
  if (place.w < 0.5) {
    return picture;
  }
  float footY = place.x;
  float up = place.z;
  vec4 moon = tideConst(copy, 1);
  vec4 sea = tideConst(copy, 2);
  float opacity = lookOpacity();
  int base = copy * ${ROWS_PER_COPY};

  // The moon: its halo, its face, the soft seas on it.
  vec2 m = moon.xy;
  float radius = moon.z;
  float d = length(p - m);
  float haloT = clamp((d - radius * 0.9) / max(1e-3, moon.w - radius * 0.9), 0.0, 1.0);
  picture = lookOver(picture, lookPaint(lookLightInk(1.0, 0.5), uLook[6].y * (1.0 - haloT) * lookFill(d - moon.w)));
  float faceT = clamp((length(p - (m - radius * 0.3)) - radius * 0.1) / (radius * 1.2), 0.0, 1.0);
  vec4 face = mix(vec4(vec3(0.97), 0.97), lookPaint(lookLightInk(1.0, 0.55), 0.92), faceT);
  picture = lookOver(picture, face * lookFill(d - radius));
  for (int s = 0; s < SEAS; s++) {
    vec4 spot = MOON_SEAS[s];
    float size = spot.z * radius;
    float fall = clamp(1.0 - length(p - (m + spot.xy * radius)) / max(1e-3, size), 0.0, 1.0);
    picture = lookOver(picture, lookPaint(lookInk(0.55), spot.w * fall));
  }

  for (int layer = 0; layer < SWELLS; layer++) {
    vec4 swell = tideConst(copy, 3 + layer);
    vec4 line = tideConst(copy, 7 + layer);
    vec2 v = swellAt(p.x, base + layer);
    float y = v.x;
    bool across = p.x >= uLook[1].x && p.x <= uLook[1].y;
    if (lookFilled() && across) {
      float water = clamp(min((p.y - y) * -up, (footY - p.y) * -up) / lookPixel() + 0.5, 0.0, 1.0);
      float along = lookAlong(p.y, swell.y, footY);
      if (lookInkMode() == 1) {
        float t = (p.x - uLook[1].x) / max(1.0, uLook[1].y - uLook[1].x);
        picture = lookOver(picture, lookPaint(lookLightInk(t, 0.1), swell.z * opacity * water));
        float deepMid = 0.45 - float(layer) * 0.08;
        float dark = along < 0.35 ? mix(0.0, deepMid, along / 0.35) : mix(deepMid, 0.82, (along - 0.35) / 0.65);
        picture = lookOver(picture, vec4(0.0, 0.0, 0.0, dark * opacity * water));
      } else {
        float tint = swell.x;
        vec3 ink = along < 0.22
          ? mix(lookLightInk(tint, 0.15), lookInk(tint * 0.75), along / 0.22)
          : (along < 0.6
            ? mix(lookInk(tint * 0.75), lookInk(tint * 0.3), (along - 0.22) / 0.38)
            : mix(lookInk(tint * 0.3), lookInk(0.0), (along - 0.6) / 0.4));
        picture = lookOver(picture, lookPaint(ink, swell.z * opacity * water));
      }
      // The glints of the moon's path on this swell.
      vec4 extent = tideConst(copy, 12 + layer);
      if (p.x >= extent.x && p.x <= extent.y) {
        float glints = 0.0;
        int count = int(swell.w + 0.5);
        for (int g = 0; g < ${MOST_GLINTS}; g++) {
          if (g >= count) {
            break;
          }
          vec4 glint = texelFetch(uLookData, ivec2(g, base + 4 + layer), 0);
          glints = max(glints, lookFill(lookBox(p, glint.xy - glint.zw, glint.xy + glint.zw, 0.0)));
        }
        picture = lookOver(picture, lookPaint(lookLightInk(1.0, 0.8), line.w * glints));
      }
    }
    // The crest: the front swell's foam wash, then its line.
    float slope = v.y;
    float crestD = abs(p.y - y) / sqrt(1.0 + slope * slope);
    if (!across) {
      float x = clamp(p.x, uLook[1].x, uLook[1].y);
      crestD = length(p - vec2(x, swellAt(x, base + layer).x));
    }
    if (layer == SWELLS - 1) {
      vec4 wash = tideConst(copy, 11);
      picture = lookOver(picture, lookPaint(rimInk(p, swell.x, wash.y), wash.z * lookStroke(crestD, wash.x)));
    }
    picture = lookOver(picture, lookPaint(rimInk(p, swell.x, line.y), line.z * lookStroke(crestD, line.x)));
  }

  // The moon's column on the water, added as light.
  if (lookFilled()) {
    float tall = abs(footY - sea.x) * 0.5;
    if (tall >= 1.0) {
      float r = length(vec2((p.x - m.x) / max(1.0, sea.y), (p.y - (sea.x + footY) * 0.5) / tall));
      picture = min(picture + lookPaint(lookLightInk(1.0, 0.6), uLook[6].z * clamp(1.0 - r, 0.0, 1.0)), vec4(1.0));
    }
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    picture = tideCopy(p, copy, picture);
  }
  return picture;
}
`;

const STAR: readonly [number, number, number] = [1, 1, 1];

const step = (
  reading: ISceneReading,
  state: ITideState,
  input: IEngineLookInput,
): boolean => {
  const { bands, look, music, plot, window: frame } = reading;
  rollTide(reading, state);
  shapeTide(reading, state);
  const across = Math.max(SAMPLES + 1, MOST_GLINTS, 16);
  const data = sizeLookData(input, across, ROWS_PER_COPY * 2);
  data.fill(0);
  const put = (row: number, column: number, values: readonly number[]) => {
    data.set(values, (row * across + column) * 4);
  };
  const xs: number[] = [];
  const ys: number[] = [];
  const stars = tideStarAlpha(music.treble);
  bands.slice(0, 2).forEach((band, copy) => {
    const base = copy * ROWS_PER_COPY;
    const sky = tideSky(band, plot, music);
    if (bands.length === 1) {
      const [from, to] = band.flipped
        ? [sky.farRest, frame.height]
        : [0, sky.farRest];
      placeTideStars(music, frame.width, from, to, (x, y, size) =>
        pushRectSprite(input, x, y, size, size, stars, STAR),
      );
    }
    put(base + 8, 0, [sky.foot, sky.head, sky.up, 1]);
    put(base + 8, 1, [sky.moonX, sky.moonY, sky.moonRadius, sky.halo]);
    put(base + 8, 2, [
      sky.farRest,
      moonColumnWidth(plot.right - plot.left),
      0,
      0,
    ]);
    for (let layer = 0; layer < SWELL_COUNT; layer += 1) {
      const traced = traceSwell(reading, band, state, layer, xs, ys);
      ys.forEach((y, sample) => put(base + layer, sample, [y, 0, 0, 0]));
      let glints = 0;
      let left = Number.POSITIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;
      if (look.filled) {
        placeGlints(
          reading,
          layer,
          copy,
          sky.moonX,
          ys,
          sky.depth,
          sky.up,
          (x, y, length, thick) => {
            if (glints < across) {
              put(base + 4 + layer, glints, [x, y, length / 2, thick / 2]);
              glints += 1;
              left = Math.min(left, x - length / 2 - 1);
              right = Math.max(right, x + length / 2 + 1);
            }
          },
        );
      }
      const lines = crestLines(look, music, reading.glow, layer);
      put(base + 8, 3 + layer, [
        traced.tint,
        traced.surface,
        traced.alpha,
        glints,
      ]);
      put(base + 8, 7 + layer, [
        lines.line.width,
        lines.line.whiten,
        lines.line.alpha,
        glintAlpha(music.treble, layer),
      ]);
      if (lines.wash) {
        put(base + 8, 11, [
          lines.wash.width,
          lines.wash.whiten,
          lines.wash.alpha,
          1,
        ]);
      }
      put(
        base + 8,
        12 + layer,
        glints > 0 ? [left, right, 0, 0] : [1, 0, 0, 0],
      );
      throwSpray(
        state,
        reading,
        layer,
        traced.crestX,
        traced.crestY,
        sky.up,
        copy,
      );
    }
  });
  spritesSoFarUnder(input);
  const alive = moveSpray(state, reading, (x, y, size) =>
    pushSprite(input, x, y, size, 0.75, STAR),
  );
  setLookVector(
    input,
    6,
    SAMPLES,
    moonHaloAlpha(music.pulse, reading.glow),
    moonColumnAlpha(music),
    0,
  );
  input.bloom = 0;
  return alive > 0 || state.rollers.length > 0;
};

const tideLook: IEngineLook<ITideState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.tide,
  step,
};

export default tideLook;
