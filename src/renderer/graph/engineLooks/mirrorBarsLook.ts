/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  MIN_PITCH,
  mirrorBloom,
  mirrorBreath,
  mirrorCapAlpha,
  mirrorLineAlpha,
  mirrorStand,
  type IMirrorBarsState,
} from '../sceneViews/mirrorBars';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * MIRROR BARS on the GPU: the 2D look's pills standing out both ways from a
 * middle line, their gloss, the line, the held caps and the bloom
 * (`sceneViews/mirrorBars.ts`), painted per pixel from the same layout.
 *
 *   uLook[6] the row: pitch, bar width, how many, how much it breathes
 *   uLook[7] the middle line's light, the caps' light
 *   uLook[10], uLook[11] each copy (`mirrorStand`): its middle, how far a
 *            bar reaches, present
 *   texel i  bar i's level and its held peak
 */

const GLSL = `
vec4 mirrorCopy(vec2 p, vec4 stand, vec4 picture) {
  float middle = stand.x;
  float reach = stand.y;
  float pitch = uLook[6].x;
  float body = uLook[6].y;
  int count = int(uLook[6].z + 0.5);
  float breath = uLook[6].w;
  float radius = body * 0.5;
  float opacity = lookOpacity();
  float t = lookMirroredT(p, middle, reach);
  int here = int(floor((p.x - uLook[1].x) / pitch));

  for (int k = here - 1; k <= here + 1; k++) {
    if (k < 0 || k >= count) {
      continue;
    }
    vec4 bar = lookData(k);
    float left = uLook[1].x + float(k) * pitch + (pitch - body) * 0.5;
    float extent = max(radius, bar.x * reach * breath);
    float d = lookBox(p, vec2(left, middle - extent), vec2(left + body, middle + extent), min(radius, extent));
    if (lookBloomPass()) {
      picture = lookOver(picture, lookPaint(lookInk(t), lookFill(d)));
      continue;
    }
    vec3 ink = lookInkMode() == 3 ? lookInk(lookHeatT(bar.x)) : lookInk(t);
    picture = lookOver(picture, lookPaint(ink, opacity * lookShape(d)));
    if (lookFilled()) {
      // The gloss across the middle, where a rounded surface catches light.
      float along = lookAlong(p.y, middle - reach * 0.7, middle + reach * 0.7);
      float gloss = along < 0.5 ? mix(0.0, 0.24, along / 0.5) : mix(0.24, 0.0, (along - 0.5) / 0.5);
      picture = lookOver(picture, vec4(vec3(1.0), 1.0) * gloss * opacity * lookFill(d));
    }
  }
  if (lookBloomPass()) {
    return picture;
  }

  // The middle line the row stands on.
  if (p.x >= uLook[1].x && p.x <= uLook[1].y) {
    float line = lookFill(abs(p.y - middle) - 0.5);
    picture = lookOver(picture, lookPaint(lookLightInk(t, 0.5), uLook[7].x * line));
  }
  // The caps held above and below each bar.
  if (here >= 0 && here < count && lookAccents()) {
    vec4 bar = lookData(here);
    float left = uLook[1].x + float(here) * pitch + (pitch - body) * 0.5;
    float extent = max(radius, bar.x * reach * breath);
    float held = bar.y * reach * breath;
    if (held - extent > 3.0) {
      float capAbove = lookFill(lookBox(p, vec2(left, middle - held - 3.0), vec2(left + body, middle - held - 0.5), 1.2));
      float capBelow = lookFill(lookBox(p, vec2(left, middle + held + 0.5), vec2(left + body, middle + held + 3.0), 1.2));
      picture = lookOver(picture, lookPaint(lookLightInk(t, 0.55), uLook[7].y * max(capAbove, capBelow)));
    }
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = copy == 0 ? uLook[10] : uLook[11];
    if (stand.z >= 0.5) {
      picture = mirrorCopy(p, stand, picture);
    }
  }
  return lookBloomPass() ? picture : lookBloomed(picture, uv);
}
`;

const step = (
  reading: ISceneReading,
  state: IMirrorBarsState,
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
  setLookVector(
    input,
    6,
    row.pitch,
    row.body,
    row.count,
    mirrorBreath(music.pulse),
  );
  setLookVector(
    input,
    7,
    mirrorLineAlpha(music.pulse),
    mirrorCapAlpha(music.treble),
    0,
    0,
  );
  [0, 1].forEach((copy) => {
    const band = bands[copy];
    if (band) {
      const { middle, reach } = mirrorStand(band);
      setLookVector(input, 10 + copy, middle, reach, 1, 0);
    } else {
      setLookVector(input, 10 + copy, 0, 1, 0, 0);
    }
  });
  input.bloom = mirrorBloom(music, reading.glow, look.opacity);
  return falling && look.accents;
};

const mirrorBarsLook: IEngineLook<IMirrorBarsState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.mirrorBars,
  step,
};

export default mirrorBarsLook;
