/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  MIN_PITCH,
  MIRROR,
  neonBloom,
  neonFilament,
  neonStand,
  neonTubeWidth,
  type INeonBarsState,
} from '../sceneViews/neonBars';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import { setLookStands, setLookVector, sizeLookData } from './lookInput';
import type { IEngineLook } from './engineLookTypes';

/**
 * NEON BARS on the GPU: the 2D look's tubes, reflection, filaments, caps,
 * floor line and bloom (`sceneViews/neonBars.ts`), painted per pixel from
 * the same layout.
 *
 *   uLook[6] the row: pitch, tube width, how many, filament width
 *   uLook[7] the reflection's length against its bar
 *   uLook[8], uLook[9] where each copy stands (`neonStand`)
 *   texel i  bar i's level and its held peak, 0..1 of its reach
 */

const GLSL = `
// One copy of the figure: where its floor stands, which way is up, how far
// a bar may reach.
struct NeonCopy {
  float floorY;
  float up;
  float reach;
  float headY;
};

NeonCopy neonCopy(vec4 stand) {
  return NeonCopy(stand.x, stand.y, stand.z, stand.x + stand.y * stand.z);
}

// A tube standing on base and growing by h in the direction dir.
float neonTube(vec2 p, float left, float width, float base, float dir, float h) {
  if (h < 1.0) {
    return 1e4;
  }
  float top = dir < 0.0 ? base - h : base;
  return lookBox(p, vec2(left, top), vec2(left + width, top + h), min(width, h) * 0.5);
}

vec4 neonPaintCopy(vec2 p, vec4 stand, vec4 picture) {
  NeonCopy copy = neonCopy(stand);
  float left0 = uLook[1].x;
  float pitch = uLook[6].x;
  float width = uLook[6].y;
  int count = int(uLook[6].z + 0.5);
  float filament = uLook[6].w;
  float opacity = lookOpacity();
  float wholeT = lookFigureT(p, copy.floorY, copy.headY);
  vec3 whole = lookInk(wholeT);
  int here = int(floor((p.x - left0) / pitch));

  // The reflection, under everything, then swallowed by the floor's gloss.
  float mirror = 0.0;
  for (int k = here - 1; k <= here + 1; k++) {
    if (k < 0 || k >= count) {
      continue;
    }
    float left = left0 + float(k) * pitch + (pitch - width) * 0.5;
    float height = max(width * 0.6, lookData(k).x * copy.reach);
    float d = neonTube(p, left, width, copy.floorY - copy.up * 2.0, -copy.up, height * uLook[7].x);
    mirror = max(mirror, lookShape(d));
  }
  picture = lookOver(picture, lookPaint(whole, opacity * 0.32 * mirror));
  float mirrorEnd = copy.floorY - copy.up * copy.reach * uLook[7].x;
  float lowY = min(copy.floorY, mirrorEnd);
  float highY = max(copy.floorY, mirrorEnd);
  if (p.x >= uLook[1].x && p.x <= uLook[1].y && p.y >= lowY && p.y <= highY) {
    float along = abs(mirrorEnd - copy.floorY) < 1e-3
      ? 0.0
      : (p.y - copy.floorY) / (mirrorEnd - copy.floorY);
    picture *= 1.0 - mix(0.1, 1.0, clamp(along, 0.0, 1.0));
  }

  // The tubes, the dark at their feet, the filaments; then the caps.
  for (int k = here - 1; k <= here + 1; k++) {
    if (k < 0 || k >= count) {
      continue;
    }
    vec4 bar = lookData(k);
    float left = left0 + float(k) * pitch + (pitch - width) * 0.5;
    float height = max(width * 0.6, bar.x * copy.reach);
    float tube = lookShape(neonTube(p, left, width, copy.floorY, copy.up, height));
    vec3 paint = lookInkMode() == 3 ? lookInk(lookHeatT(bar.x)) : whole;
    picture = lookOver(picture, lookPaint(paint, opacity * tube));
    if (lookFilled()) {
      float up = copy.headY - copy.floorY;
      float footT = abs(up) < 1e-3 ? 0.0 : clamp((p.y - copy.floorY) / up, 0.0, 1.0);
      float dark = footT < 0.5 ? mix(0.55, 0.1, footT / 0.5) : mix(0.1, 0.0, (footT - 0.5) / 0.5);
      float solid = lookFill(neonTube(p, left, width, copy.floorY, copy.up, height));
      picture = lookOver(picture, vec4(0.0, 0.0, 0.0, dark * opacity * solid));
      if (height > width) {
        float end = width * 0.5;
        float fx = left + (width - filament) * 0.5;
        float fy = copy.up < 0.0 ? copy.floorY - height + end : copy.floorY + end * 0.6;
        float fh = max(1.0, height - end * 1.6);
        float fil = lookFill(lookBox(p, vec2(fx, fy), vec2(fx + filament, fy + fh), filament * 0.5));
        picture = lookOver(picture, lookPaint(lookLightInk(wholeT, 0.7), 0.85 * opacity * fil));
      }
    }
    float held = bar.y * copy.reach;
    if (lookAccents() && held - height > 3.0) {
      float capY = copy.floorY + copy.up * (held + 3.0);
      float cap = lookFill(lookBox(p, vec2(left, capY - 1.5), vec2(left + width, capY + 1.5), min(1.5, width * 0.5)));
      picture = lookOver(picture, lookPaint(lookLightInk(wholeT, 0.55), 0.95 * cap));
    }
  }

  // The floor line, flashing on the beat.
  if (p.x >= uLook[1].x && p.x <= uLook[1].y) {
    float line = lookFill(abs(p.y - copy.floorY) - 0.5);
    picture = lookOver(picture, lookPaint(lookLightInk(wholeT, 0.4), (0.2 + lookPulse() * 0.5) * line));
  }
  return picture;
}

// What throws light: every tube and every cap, whole, in the figure's ink.
vec4 neonLitCopy(vec2 p, vec4 stand, vec4 lit) {
  NeonCopy copy = neonCopy(stand);
  float left0 = uLook[1].x;
  float pitch = uLook[6].x;
  float width = uLook[6].y;
  int count = int(uLook[6].z + 0.5);
  vec3 whole = lookInk(lookFigureT(p, copy.floorY, copy.headY));
  int here = int(floor((p.x - left0) / pitch));
  for (int k = here - 1; k <= here + 1; k++) {
    if (k < 0 || k >= count) {
      continue;
    }
    vec4 bar = lookData(k);
    float left = left0 + float(k) * pitch + (pitch - width) * 0.5;
    float height = max(width * 0.6, bar.x * copy.reach);
    float shape = lookFill(neonTube(p, left, width, copy.floorY, copy.up, height));
    float held = bar.y * copy.reach;
    if (lookAccents() && held - height > 3.0) {
      float capY = copy.floorY + copy.up * (held + 3.0);
      shape = max(shape, lookFill(lookBox(p, vec2(left, capY - 1.5), vec2(left + width, capY + 1.5), min(1.5, width * 0.5))));
    }
    lit = lookOver(lit, lookPaint(whole, shape));
  }
  return lit;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = lookStand(copy);
    if (stand.w < 0.5) {
      continue;
    }
    picture = lookBloomPass() ? neonLitCopy(p, stand, picture) : neonPaintCopy(p, stand, picture);
  }
  return lookBloomPass() ? picture : lookBloomed(picture, uv);
}
`;

const step = (
  reading: ISceneReading,
  state: INeonBarsState,
  input: IEngineLookInput,
): boolean => {
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
  const width = neonTubeWidth(row.body);
  setLookVector(input, 6, row.pitch, width, row.count, neonFilament(width));
  setLookVector(input, 7, MIRROR, 0, 0, 0);
  setLookStands(input, reading.bands, neonStand);
  input.bloom = neonBloom(
    reading.music.pulse,
    reading.glow,
    reading.look.opacity,
  );
  return falling && reading.look.accents;
};

const neonBarsLook: IEngineLook<INeonBarsState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.neonBars,
  step,
};

export default neonBarsLook;
