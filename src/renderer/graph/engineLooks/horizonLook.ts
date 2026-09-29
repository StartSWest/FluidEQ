/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  MIN_PITCH,
  MIRROR,
  REST_HEIGHT,
  horizonBloom,
  horizonLine,
  horizonStand,
  type IHorizonState,
} from '../sceneViews/horizon';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { setLookStands, setLookVector, sizeLookData } from './lookInput';

/**
 * HORIZON on the GPU: the bars running through the colours foot to head,
 * their reflection in the water, the lit tops, the held lines and the
 * horizon's line and haze (`sceneViews/horizon.ts`), painted per pixel from
 * the same layout. No sun behind the row: the top of the plot cut its glow
 * flat (Ivan, 2026-09-28).
 *
 *   uLook[6] the row: pitch, bar width, how many, a bar at rest's height
 *   uLook[7] the horizon line's light, its haze's, a reflection's length
 *   uLook[8], uLook[9] where each copy stands (`horizonStand`)
 *   texel i  bar i's level and its held peak
 */

const GLSL = `
vec4 horizonCopy(vec2 p, int copy, vec4 stand, vec4 picture) {
  float floorY = stand.x;
  float up = stand.y;
  float reach = stand.z;
  float headY = floorY + up * reach;
  float pitch = uLook[6].x;
  float body = uLook[6].y;
  int count = int(uLook[6].z + 0.5);
  float opacity = lookOpacity();
  float t = lookFigureT(p, floorY, headY);
  bool bloom = lookBloomPass();

  int k = int(floor((p.x - uLook[1].x) / pitch));
  if (k >= 0 && k < count) {
    vec4 bar = lookData(k);
    float left = uLook[1].x + float(k) * pitch + (pitch - body) * 0.5;
    float height = max(uLook[6].w, bar.x * reach);
    float top = up < 0.0 ? floorY - height : floorY;
    float d = lookBox(p, vec2(left, top), vec2(left + body, top + height), 0.0);
    if (bloom) {
      picture = lookOver(picture, lookPaint(lookInk(t), lookFill(d)));
    } else {
      // The reflection, running away from the line and fading to the dark.
      float nearY = floorY - up * 2.0;
      float farY = nearY - up * height * uLook[7].z;
      float reflect = lookFill(lookBox(p, vec2(left, min(nearY, farY)), vec2(left + body, max(nearY, farY)), 0.0));
      float along = lookAlong(p.y, nearY, farY);
      picture = lookOver(picture, lookPaint(lookInk(along), 0.36 * opacity * (1.0 - along) * reflect));
      int mode = lookInkMode();
      vec3 ink = mode == 2
        ? lookInk(lookAlong(p.y, floorY, floorY + up * height))
        : (mode == 3 ? lookInk(lookHeatT(bar.x)) : lookInk(t));
      picture = lookOver(picture, lookPaint(ink, opacity * lookShape(d)));
      if (lookFilled()) {
        float tipTop = up < 0.0 ? floorY - height : floorY + height - 1.5;
        float tip = lookFill(lookBox(p, vec2(left, tipTop), vec2(left + body, tipTop + min(1.5, height)), 0.0));
        picture = lookOver(picture, vec4(vec3(1.0), 1.0) * 0.45 * opacity * tip);
      }
      float heldHeight = bar.y * reach;
      if (lookAccents() && heldHeight - height > 3.0) {
        float heldY = floorY + up * (heldHeight + 3.0);
        float held = lookFill(lookBox(p, vec2(left, heldY - 0.75), vec2(left + body, heldY + 0.75), 0.0));
        picture = lookOver(picture, lookPaint(lookLightInk(1.0, 0.5), 0.9 * held));
      }
    }
  }

  // The horizon: its haze and its line of light across the plot.
  if (p.x >= uLook[1].x && p.x <= uLook[1].y) {
    if (bloom) {
      float line = lookFill(abs(p.y - floorY) - 1.5);
      return lookOver(picture, lookPaint(lookLightInk(0.0, 0.4), uLook[7].x * line));
    }
    float hazeT = clamp(abs(p.y - floorY) / 6.0, 0.0, 1.0);
    picture = lookOver(picture, lookPaint(lookInk(0.0), uLook[7].y * (1.0 - hazeT)));
    float line = lookFill(abs(p.y - floorY) - 0.75);
    picture = lookOver(picture, lookPaint(lookLightInk(0.0, 0.55), uLook[7].x * line));
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = lookStand(copy);
    if (stand.w >= 0.5) {
      picture = horizonCopy(p, copy, stand, picture);
    }
  }
  return lookBloomPass() ? picture : lookBloomed(picture, uv);
}
`;

const step = (
  reading: ISceneReading,
  state: IHorizonState,
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
    data[piece * 4] = row.levels[piece];
    data[piece * 4 + 1] = state.peaks.held[piece];
  }
  const lights = horizonLine(music.pulse);
  setLookVector(input, 6, row.pitch, row.body, row.count, REST_HEIGHT);
  setLookVector(input, 7, lights.line, lights.haze, MIRROR, 0);
  setLookStands(input, bands, horizonStand);
  input.bloom = horizonBloom(music.pulse, reading.glow, look.opacity);
  // The line flashes and the bars move while there is music to follow.
  return reading.playing || (falling && look.accents);
};

const horizonLook: IEngineLook<IHorizonState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.horizon,
  step,
};

export default horizonLook;
