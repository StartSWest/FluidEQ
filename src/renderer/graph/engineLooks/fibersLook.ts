/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  MIN_PITCH,
  SWAY,
  fibersBloom,
  fibersStand,
  fibreSway,
  fibreTip,
  fibreWidth,
  type IFibersState,
} from '../sceneViews/fibers';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { setLookStands, setLookVector, sizeLookData } from './lookInput';

/**
 * FIBER OPTICS on the GPU: the 2D look's brush of glass fibres, dark at the
 * floor and lit toward their tips, the tips and their halos, the held points
 * and the bloom (`sceneViews/fibers.ts`), painted per pixel from the same
 * layout; each fibre is the 2D look's curve, from its foot up to its swaying
 * tip, read at the pixel's height.
 *
 *   uLook[6] the brush: pitch, fibre width, how many, a tip's radius
 *   uLook[7] a fibre's line, how far a tip may sway
 *   uLook[8], uLook[9] where each copy stands (`fibersStand`)
 *   texel i  fibre i's level, its held peak, how far its tip sways
 */

const GLSL = `
// Fibre k's tip, and how far p is from its line: the 2D look's curve from
// the foot, straight up at first and bending to the tip.
vec2 fibreTip(int k, float floorY, float up, float reach, out float height, out float x) {
  vec4 fibre = lookData(k);
  x = uLook[1].x + (float(k) + 0.5) * uLook[6].x;
  height = max(2.0, fibre.x * reach);
  return vec2(x + fibre.z, floorY + up * height);
}

float fibreDistance(vec2 p, float x, vec2 tip, float floorY, float up, float height) {
  float v = (p.y - floorY) / (up * height);
  if (v <= 0.0) {
    return length(p - vec2(x, floorY));
  }
  if (v >= 1.0) {
    return length(p - tip);
  }
  // y = floor + up * h * (1.2 t - 0.2 t^2) along the curve, x = x + t^2 sway.
  float t = (1.2 - sqrt(max(0.0, 1.44 - 0.8 * v))) / 0.4;
  return abs(p.x - (x + t * t * (tip.x - x)));
}

vec4 fibersCopy(vec2 p, vec4 stand, vec4 picture) {
  float floorY = stand.x;
  float up = stand.y;
  float reach = stand.z;
  float headY = floorY + up * reach;
  float pitch = uLook[6].x;
  int count = int(uLook[6].z + 0.5);
  float tipRadius = uLook[6].w;
  float opacity = lookOpacity();
  float t = lookFigureT(p, floorY, headY);
  int here = int(floor((p.x - uLook[1].x) / pitch));
  int spread = 2 + int(ceil(tipRadius * 2.2 / pitch));

  if (lookBloomPass()) {
    float halo = 0.0;
    for (int n = -8; n <= 8; n++) {
      int k = here + n;
      if (n < -spread || n > spread || k < 0 || k >= count) {
        continue;
      }
      float height;
      float x;
      vec2 tip = fibreTip(k, floorY, up, reach, height, x);
      halo = max(halo, lookFill(length(p - tip) - tipRadius * 2.2));
    }
    return lookOver(picture, lookPaint(lookLightInk(t, 0.3), halo));
  }

  if (lookFilled()) {
    for (int n = -2; n <= 2; n++) {
      int k = here + n;
      if (k < 0 || k >= count) {
        continue;
      }
      float height;
      float x;
      vec2 tip = fibreTip(k, floorY, up, reach, height, x);
      float d = fibreDistance(p, x, tip, floorY, up, height);
      vec3 ink = lookInkMode() == 3 ? lookInk(lookHeatT(lookData(k).x)) : lookInk(t);
      picture = lookOver(picture, lookPaint(ink, opacity * lookStroke(d, uLook[7].x)));
    }
    // Dark near the floor, the light gathering toward the tips.
    float sway = uLook[7].y;
    if (p.x >= uLook[1].x - sway && p.x <= uLook[1].y + sway && p.y >= min(floorY, headY) && p.y <= max(floorY, headY)) {
      float along = lookAlong(p.y, floorY, headY);
      float erase = along < 0.55 ? mix(0.7, 0.15, along / 0.55) : mix(0.15, 0.0, (along - 0.55) / 0.45);
      picture *= 1.0 - erase;
    }
  }

  // The halos, added as light; then the tips; then the held points.
  float halo = 0.0;
  float tips = 0.0;
  float held = 0.0;
  for (int n = -8; n <= 8; n++) {
    int k = here + n;
    if (n < -spread || n > spread || k < 0 || k >= count) {
      continue;
    }
    float height;
    float x;
    vec2 tip = fibreTip(k, floorY, up, reach, height, x);
    float d = length(p - tip);
    halo = max(halo, lookFill(d - tipRadius * 2.2));
    tips = max(tips, lookFilled() ? lookFill(d - tipRadius) : lookStroke(d - tipRadius, lookLineWidth() * 0.6));
    float heldHeight = lookData(k).y * reach;
    if (lookAccents() && heldHeight - height > 4.0) {
      held = max(held, lookFill(length(p - vec2(x, floorY + up * heldHeight)) - tipRadius * 0.7));
    }
  }
  picture = min(picture + lookPaint(lookLightInk(t, 0.2), 0.12 * opacity * halo), vec4(1.0));
  picture = lookOver(picture, lookPaint(lookLightInk(t, lookFilled() ? 0.55 : 0.4), opacity * tips));
  return lookOver(picture, lookPaint(lookLightInk(t, 0.4), 0.5 * held));
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = lookStand(copy);
    if (stand.w >= 0.5) {
      picture = fibersCopy(p, stand, picture);
    }
  }
  return lookBloomPass() ? picture : lookBloomed(picture, uv);
}
`;

const step = (
  reading: ISceneReading,
  state: IFibersState,
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
  const data = sizeLookData(input, row.count, 1);
  for (let piece = 0; piece < row.count; piece += 1) {
    const level = row.levels[piece];
    data[piece * 4] = level;
    data[piece * 4 + 1] = state.peaks.held[piece];
    data[piece * 4 + 2] = fibreSway(piece, level, music);
  }
  setLookVector(
    input,
    6,
    row.pitch,
    row.body,
    row.count,
    fibreTip(row.body, music.pulse),
  );
  setLookVector(input, 7, fibreWidth(row.body), SWAY, 0, 0);
  setLookStands(input, bands, fibersStand);
  input.bloom = fibersBloom(music.pulse, reading.glow, look.opacity);
  return falling && look.accents;
};

const fibersLook: IEngineLook<IFibersState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.fibers,
  step,
};

export default fibersLook;
