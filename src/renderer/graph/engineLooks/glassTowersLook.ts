/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { figureInkAt, type ISceneReading } from '../sceneViews/sceneFrame';
import {
  MIN_PITCH,
  MIRROR,
  SPARK_CORE,
  moveTowerSparks,
  sparkGlowRadius,
  throwTowerSparks,
  towerMirrorInk,
  towerPool,
  towerSparkAlpha,
  towerSparkSpan,
  towerStand,
  type IGlassTowersState,
} from '../sceneViews/glassTowers';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import {
  lightRamp,
  pushSprite,
  setLookStands,
  setLookVector,
  sizeLookData,
} from './lookInput';

/**
 * GLASS TOWERS on the GPU: the 2D look's towers of glass, their shading and
 * stripes, caps, reflections, the pool of light on the floor and the floating
 * caps (`sceneViews/glassTowers.ts`), painted per pixel from the same layout;
 * the sparks thrown and moved by the 2D look's own functions and drawn as
 * sprites.
 *
 *   uLook[6] the row: pitch, tower width, how many, the treble
 *   uLook[7] the reflection's length against its tower, the plot's middle
 *   uLook[8], uLook[9] where each copy stands (`towerStand`)
 *   uLook[10], uLook[11] each copy's pool of light (`towerPool`): how far
 *            across, how deep, its light at its middle and half way out
 *   texel i  tower i's level, its held peak, where its reflection is inked
 */

const GLSL = `
float towerShape(vec2 p, float left, float width, float floorY, float up, float height) {
  if (height < 2.0) {
    return 1e4;
  }
  float head = floorY + up * height;
  float r = min(width * 0.5, height);
  return up < 0.0
    ? lookBox4(p, vec2(left, head), vec2(left + width, floorY), vec4(r, r, 1.5, 1.5))
    : lookBox4(p, vec2(left, floorY), vec2(left + width, head), vec4(1.5, 1.5, r, r));
}

vec4 towersCopy(vec2 p, vec4 stand, vec4 pool, vec4 picture) {
  float floorY = stand.x;
  float up = stand.y;
  float reach = stand.z;
  float ceiling = floorY + up * reach;
  float pitch = uLook[6].x;
  float width = uLook[6].y;
  int count = int(uLook[6].z + 0.5);
  float treble = uLook[6].w;
  float opacity = lookOpacity();
  float t = lookFigureT(p, floorY, ceiling);
  vec3 whole = lookInk(t);

  // The pool of light on the floor, round and squashed.
  float dx = (p.x - uLook[7].y) / max(1.0, pool.x);
  float dy = (p.y - floorY) / max(1.0, pool.y);
  float r = length(vec2(dx, dy));
  float poolLight = r < 0.55
    ? mix(pool.z, pool.w, r / 0.55)
    : (r < 1.0 ? mix(pool.w, 0.0, (r - 0.55) / 0.45) : 0.0);
  picture = lookOver(picture, lookPaint(lookInk(0.5), poolLight));

  int here = int(floor((p.x - uLook[1].x) / pitch));
  // The glass, in its colour, stroked over neighbours' edges as well.
  for (int k = here - 1; k <= here + 1; k++) {
    if (k < 0 || k >= count) {
      continue;
    }
    vec4 tower = lookData(k);
    float left = uLook[1].x + float(k) * pitch + (pitch - width) * 0.5;
    float shape = lookShape(towerShape(p, left, width, floorY, up, tower.x * reach));
    vec3 ink = lookInkMode() == 3 ? lookInk(lookHeatT(tower.x)) : whole;
    picture = lookOver(picture, lookPaint(ink, opacity * shape));
  }
  if (here < 0 || here >= count) {
    return picture;
  }
  vec4 tower = lookData(here);
  float left = uLook[1].x + float(here) * pitch + (pitch - width) * 0.5;
  float height = tower.x * reach;
  float head = floorY + up * height;
  if (height >= 2.0) {
    if (lookFilled()) {
      float solid = lookFill(towerShape(p, left, width, floorY, up, height));
      // The glass's depth: dark at the foot, clear in the middle, lit on top.
      float along = lookAlong(p.y, floorY, ceiling);
      vec4 shade = along < 0.55
        ? vec4(0.0, 0.0, 0.0, mix(0.5, 0.0, along / 0.55))
        : vec4(vec3(1.0), 0.2) * ((along - 0.55) / 0.45);
      picture = lookOver(picture, vec4(shade.rgb * shade.a, shade.a) * opacity * solid);
      float inset = min(width * 0.5, height);
      float stripeTop = min(head - up * inset, floorY);
      float stripeBottom = max(head - up * inset, floorY);
      float lit = lookFill(lookBox(p, vec2(left + width * 0.14, stripeTop), vec2(left + width * 0.3, stripeBottom), 0.0));
      picture = lookOver(picture, vec4(vec3(1.0), 1.0) * 0.22 * opacity * lit);
      float dark = lookFill(lookBox(p, vec2(left + width * 0.72, stripeTop), vec2(left + width * 0.92, stripeBottom), 0.0));
      picture = lookOver(picture, vec4(0.0, 0.0, 0.0, 0.22 * opacity * dark));
    }
    float capY = head - up * min(3.0, height / 3.0);
    float capTop = min(head, capY);
    float cap = lookFill(lookBox(p, vec2(left + width * 0.1, capTop), vec2(left + width * 0.9, capTop + 2.5), 1.2));
    picture = lookOver(picture, lookPaint(lookLightInk(t, 0.45 + treble * 0.4), (0.75 + treble * 0.25) * opacity * cap));

    // The reflection, hanging from the floor in its tower's own glass.
    float shown = height * uLook[7].x;
    float mTop = up < 0.0 ? floorY + 1.0 : floorY - 1.0 - shown;
    float mirror = lookShape(lookBox(p, vec2(left, mTop), vec2(left + width, mTop + shown), 0.0));
    float fall = lookAlong(p.y, floorY, floorY - up * reach * uLook[7].x);
    float mirrorAlpha = fall < 0.5 ? mix(0.34, 0.1, fall / 0.5) : mix(0.1, 0.0, (fall - 0.5) / 0.5);
    picture = lookOver(picture, lookPaint(lookInk(tower.z), mirrorAlpha * opacity * mirror));
  }

  // The floating cap, over everything, lit.
  float held = tower.y * reach;
  if (height >= 2.0 && lookAccents() && held - height > 3.0) {
    float heldY = floorY + up * held;
    float floating = lookFill(lookBox(p, vec2(left + width * 0.06, heldY - 1.5), vec2(left + width * 0.94, heldY + 1.5), 1.5));
    picture = lookOver(picture, lookPaint(lookLightInk(t, 0.5), 0.95 * floating));
  }

  // The floor's edge: a hairline of polish.
  if (p.x >= uLook[1].x && p.x <= uLook[1].y) {
    float line = lookFill(abs(p.y - floorY) - 0.5);
    picture = lookOver(picture, vec4(vec3(1.0), 1.0) * 0.16 * line);
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = lookStand(copy);
    if (stand.w >= 0.5) {
      picture = towersCopy(p, stand, copy == 0 ? uLook[10] : uLook[11], picture);
    }
  }
  return picture;
}
`;

const HOT: readonly [number, number, number] = [1, 1, 1];

const step = (
  reading: ISceneReading,
  state: IGlassTowersState,
  input: IEngineLookInput,
): boolean => {
  const { plot, music, look, bands, colours } = reading;
  const row = layPieces(reading, state.row, MIN_PITCH);
  const falling = holdPeaks(
    state.peaks,
    row.levels,
    row.count,
    reading.deltaMs,
  );
  const data = sizeLookData(input, row.count, 1);
  const first = bands[0] ? towerStand(bands[0]) : undefined;
  for (let piece = 0; piece < row.count; piece += 1) {
    const level = row.levels[piece];
    const left = row.lefts[piece];
    data[piece * 4] = level;
    data[piece * 4 + 1] = state.peaks.held[piece];
    data[piece * 4 + 2] = towerMirrorInk(look.ink, level, left, plot);
    // Sparks off the first copy's tallest towers, on the beat, as the 2D
    // look throws them.
    const height = first ? level * first.reach : 0;
    if (first && height >= 2) {
      throwTowerSparks(
        state,
        music.onBeat,
        level,
        left,
        row.body,
        first.floor + first.up * height,
        first.up,
      );
    }
  }
  const width = plot.right - plot.left;
  setLookVector(input, 6, row.pitch, row.body, row.count, music.treble);
  setLookVector(input, 7, MIRROR, (plot.left + plot.right) / 2, 0, 0);
  setLookStands(input, bands, towerStand);
  [0, 1].forEach((copy) => {
    const band = bands[copy];
    if (band) {
      const pool = towerPool(band, width, music, reading.glow);
      setLookVector(
        input,
        10 + copy,
        pool.across,
        pool.deep,
        pool.middle,
        pool.halfway,
      );
    } else {
      setLookVector(input, 10 + copy, 1, 1, 0, 0);
    }
  });
  input.bloom = 0;

  // The sparks: every glow first, then every white-hot core over them.
  const placed: number[] = [];
  const alive = moveTowerSparks(state, reading.deltaMs, bands, (x, y, life) => {
    placed.push(x, y, life);
  });
  const span = towerSparkSpan(plot);
  const alpha = towerSparkAlpha(reading.glow);
  for (let at = 0; at < placed.length; at += 3) {
    const [x, y, life] = [placed[at], placed[at + 1], placed[at + 2]];
    const ink = lightRamp(colours, figureInkAt(look.ink, span, x, y), 0.2);
    pushSprite(input, x, y, sparkGlowRadius(life), alpha, ink);
  }
  for (let at = 0; at < placed.length; at += 3) {
    pushSprite(input, placed[at], placed[at + 1], SPARK_CORE, 0.85, HOT);
  }
  return alive > 0 || (falling && look.accents);
};

const glassTowersLook: IEngineLook<IGlassTowersState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.towers,
  step,
};

export default glassTowersLook;
