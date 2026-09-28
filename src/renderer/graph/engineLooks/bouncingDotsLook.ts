/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  MIN_PITCH,
  dotsBloom,
  dotsStand,
  fly,
  heldWhiten,
  squashOf,
  stemWidth,
  type IBouncingDotsState,
} from '../sceneViews/bouncingDots';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { setLookStands, setLookVector, sizeLookData } from './lookInput';

/**
 * BOUNCING DOTS on the GPU: the 2D look's balls on their stems, squashed
 * where they land, their shine, the held marks and the bloom
 * (`sceneViews/bouncingDots.ts`), painted per pixel; the balls thrown and
 * caught by the 2D look's own physics.
 *
 *   uLook[6] the row: pitch, ball width, how many, a stem's width
 *   uLook[7] the held mark's heat
 *   uLook[8], uLook[9] where each copy stands (`dotsStand`)
 *   texel i  ball i's height, its band's level, its held peak, how round
 */

const GLSL = `
// Ball k of a copy: its centre and its half-width and half-height.
vec4 dotBall(int k, vec4 stand, float radius, out float x) {
  vec4 ball = lookData(k);
  x = uLook[1].x + float(k) * uLook[6].x + (uLook[6].x - uLook[6].y) * 0.5 + radius;
  float y = stand.x + stand.y * max(0.0, ball.x) * stand.z;
  float tall = radius * ball.w;
  float wide = radius * (2.0 - ball.w);
  return vec4(x, y - stand.y * (radius - tall), wide, tall);
}

float ellipseDistance(vec2 p, vec4 e) {
  vec2 q = (p - e.xy) / e.zw;
  float k = length(q);
  return (k - 1.0) * min(e.z, e.w);
}

vec4 dotsCopy(vec2 p, vec4 stand, vec4 picture) {
  float floorY = stand.x;
  float up = stand.y;
  float reach = stand.z;
  float headY = floorY + up * reach;
  float pitch = uLook[6].x;
  int count = int(uLook[6].z + 0.5);
  float radius = uLook[6].y * 0.5;
  float opacity = lookOpacity();
  float t = lookFigureT(p, floorY, headY);
  int here = int(floor((p.x - uLook[1].x) / pitch));

  if (lookBloomPass()) {
    for (int k = here - 1; k <= here + 1; k++) {
      if (k < 0 || k >= count) {
        continue;
      }
      float x;
      vec4 e = dotBall(k, stand, radius, x);
      picture = lookOver(picture, lookPaint(lookInk(t), lookFill(ellipseDistance(p, e))));
    }
    return picture;
  }

  // The stems, faint, from the floor to each band's level.
  for (int k = here - 1; k <= here + 1; k++) {
    if (k < 0 || k >= count) {
      continue;
    }
    vec4 ball = lookData(k);
    float x = uLook[1].x + float(k) * pitch + (pitch - uLook[6].y) * 0.5 + radius;
    float levelY = floorY + up * ball.y * reach;
    float along = clamp((p.y - floorY) / (levelY - floorY + 1e-4), 0.0, 1.0);
    float d = length(p - vec2(x, mix(floorY, levelY, along)));
    picture = lookOver(picture, lookPaint(lookInk(t), 0.22 * opacity * lookStroke(d, uLook[6].w)));
  }
  // The balls, and their shine.
  for (int k = here - 1; k <= here + 1; k++) {
    if (k < 0 || k >= count) {
      continue;
    }
    vec4 ball = lookData(k);
    float x;
    vec4 e = dotBall(k, stand, radius, x);
    float d = ellipseDistance(p, e);
    vec3 ink = lookInkMode() == 3 ? lookInk(lookHeatT(ball.y)) : lookInk(t);
    picture = lookOver(picture, lookPaint(ink, opacity * lookShape(d)));
    if (lookFilled()) {
      vec2 shineAt = vec2(e.x - e.z * 0.3, e.y - e.w * 0.32);
      float shine = lookFill(length(p - shineAt) - e.w * 0.28);
      picture = lookOver(picture, vec4(vec3(1.0), 1.0) * 0.55 * opacity * shine);
    }
  }
  // The held marks.
  if (here >= 0 && here < count && lookAccents()) {
    vec4 ball = lookData(here);
    float x = uLook[1].x + float(here) * pitch + (pitch - uLook[6].y) * 0.5 + radius;
    float height = max(0.0, ball.x) * reach;
    float heldHeight = ball.z * reach;
    if (heldHeight - height > radius * 2.0) {
      float heldY = floorY + up * heldHeight;
      float held = lookFill(lookBox(p, vec2(x - radius, heldY - 0.75), vec2(x + radius, heldY + 0.75), 0.0));
      picture = lookOver(picture, lookPaint(lookLightInk(t, uLook[7].x), 0.85 * held));
    }
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = lookStand(copy);
    if (stand.w >= 0.5) {
      picture = dotsCopy(p, stand, picture);
    }
  }
  return lookBloomPass() ? picture : lookBloomed(picture, uv);
}
`;

const step = (
  reading: ISceneReading,
  state: IBouncingDotsState,
  input: IEngineLookInput,
): boolean => {
  const { bands, look, music } = reading;
  const row = layPieces(reading, state.row, MIN_PITCH);
  const falling = holdPeaks(
    state.peaks,
    row.levels,
    row.count,
    reading.deltaMs,
  );
  const flying = fly(reading, state);
  const data = sizeLookData(input, row.count, 1);
  for (let piece = 0; piece < row.count; piece += 1) {
    data[piece * 4] = state.height[piece];
    data[piece * 4 + 1] = row.levels[piece];
    data[piece * 4 + 2] = state.peaks.held[piece];
    data[piece * 4 + 3] = squashOf(state.landed[piece]);
  }
  setLookVector(
    input,
    6,
    row.pitch,
    row.body,
    row.count,
    stemWidth(row.body / 2),
  );
  setLookVector(input, 7, heldWhiten(music.treble), 0, 0, 0);
  setLookStands(input, bands, (band) => dotsStand(band, row.body));
  input.bloom = dotsBloom(music.pulse, reading.glow, look.opacity);
  return flying || (falling && look.accents);
};

const bouncingDotsLook: IEngineLook<IBouncingDotsState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.bouncingDots,
  step,
};

export default bouncingDotsLook;
