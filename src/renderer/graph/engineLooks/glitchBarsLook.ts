/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  GHOST_LEFT,
  GHOST_RIGHT,
  MIN_PITCH,
  ghostLight,
  glitchSplit,
  glitchStand,
  tearSignal,
  type IGlitchBarsState,
} from '../sceneViews/glitchBars';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { setLookStands, setLookVector, sizeLookData } from './lookInput';

/**
 * GLITCH BARS on the GPU: the 2D look's bars through a broken signal — the
 * cyan and magenta ghosts either side, the true bars, the scanlines, the
 * held caps, and the strips each beat tears sideways (`sceneViews/
 * glitchBars.ts`) — painted per pixel from the same layout and the same
 * tears. A torn strip is the whole picture again, pushed sideways: here, the
 * picture read at a shifted x.
 *
 *   uLook[6] the row: pitch, bar width, how many, how many tears
 *   uLook[7] how far the ghosts split, how bright they burn
 *   uLook[8], uLook[9] where each copy stands (`glitchStand`)
 *   uLook[10], uLook[11] the ghosts' colours
 *   texel (i, 0)  bar i's level and its held peak
 *   texel (k, 1)  tear k: where its strip starts and how deep it is, as
 *                 shares of the band, and how far it is pushed
 */

const MAX_TEARS = 32;

const GLSL = `
float glitchBar(vec2 p, int k, vec4 stand, out float cap) {
  vec4 bar = lookData(k);
  float left = uLook[1].x + float(k) * uLook[6].x + (uLook[6].x - uLook[6].y) * 0.5;
  float height = max(2.0, bar.x * stand.z);
  float top = stand.y < 0.0 ? stand.x - height : stand.x;
  float held = bar.y * stand.z;
  cap = 1e4;
  if (lookAccents() && held - height > 3.0) {
    float capY = stand.x + stand.y * held;
    cap = lookBox(p, vec2(left, capY - 1.5), vec2(left + uLook[6].y, capY + 1.5), 0.0);
  }
  return lookBox(p, vec2(left, top), vec2(left + uLook[6].y, top + height), 0.0);
}

// The whole picture of a copy at p: ghosts, bars, caps, scanlines.
vec4 glitchPicture(vec2 p, vec4 stand, vec4 picture) {
  float pitch = uLook[6].x;
  int count = int(uLook[6].z + 0.5);
  float split = uLook[7].x;
  float opacity = lookOpacity();
  float headY = stand.x + stand.y * stand.z;
  float t = lookFigureT(p, stand.x, headY);

  // The ghosts, added as light either side.
  vec4 light = vec4(0.0);
  for (int side = 0; side < 2; side++) {
    vec2 q = p + vec2(side == 0 ? split : -split, 0.0);
    int here = int(floor((q.x - uLook[1].x) / pitch));
    float shape = 0.0;
    for (int k = here - 1; k <= here + 1; k++) {
      if (k < 0 || k >= count) {
        continue;
      }
      float cap;
      float d = glitchBar(q, k, stand, cap);
      shape = max(shape, max(lookShape(d), lookFill(cap)));
    }
    vec3 colour = side == 0 ? uLook[10].rgb : uLook[11].rgb;
    light += lookPaint(colour, opacity * uLook[7].y * shape);
  }
  picture = min(picture + light, vec4(1.0));

  int here = int(floor((p.x - uLook[1].x) / pitch));
  for (int k = here - 1; k <= here + 1; k++) {
    if (k < 0 || k >= count) {
      continue;
    }
    float cap;
    float d = glitchBar(p, k, stand, cap);
    float level = lookData(k).x;
    vec3 ink = lookInkMode() == 3 ? lookInk(lookHeatT(level)) : lookInk(t);
    picture = lookOver(picture, lookPaint(ink, opacity * lookShape(d)));
    picture = lookOver(picture, lookPaint(lookLightInk(t, 0.55), opacity * lookFill(cap)));
    if (lookFilled() && fract(p.y / 3.0) >= 2.0 / 3.0) {
      // A dark scanline every three pixels across the bars.
      picture = lookOver(picture, vec4(0.0, 0.0, 0.0, 0.42 * opacity * lookFill(d)));
    }
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  int tears = int(uLook[6].w + 0.5);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = lookStand(copy);
    if (stand.w < 0.5) {
      continue;
    }
    vec4 band = lookBand(copy);
    float depth = band.y - band.x;
    // The last tear over this row of pixels pushes it; none leaves it be.
    float shift = 0.0;
    for (int k = 0; k < ${MAX_TEARS}; k++) {
      if (k >= tears) {
        break;
      }
      vec4 tear = texelFetch(uLookData, ivec2(k, 1), 0);
      float top = band.x + tear.x * depth;
      if (p.y >= top && p.y < top + tear.y * depth
          && p.x >= uLook[1].x - 40.0 && p.x <= uLook[1].y + 40.0) {
        shift = tear.z;
      }
    }
    picture = glitchPicture(p - vec2(shift, 0.0), stand, picture);
  }
  return picture;
}
`;

const step = (
  reading: ISceneReading,
  state: IGlitchBarsState,
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
  tearSignal(state, music, reading.deltaMs);
  const tears = state.tears.slice(-MAX_TEARS);
  const data = sizeLookData(input, Math.max(row.count, MAX_TEARS), 2);
  data.fill(0);
  for (let piece = 0; piece < row.count; piece += 1) {
    data[piece * 4] = row.levels[piece];
    data[piece * 4 + 1] = state.peaks.held[piece];
  }
  const tearRow = input.width * 4;
  tears.forEach((tear, index) => {
    data[tearRow + index * 4] = tear.from;
    data[tearRow + index * 4 + 1] = tear.depth;
    data[tearRow + index * 4 + 2] = tear.shift;
  });
  setLookVector(input, 6, row.pitch, row.body, row.count, tears.length);
  setLookVector(input, 7, glitchSplit(music), ghostLight(reading.glow), 0, 0);
  setLookStands(input, bands, glitchStand);
  setLookVector(
    input,
    10,
    GHOST_LEFT[0] / 255,
    GHOST_LEFT[1] / 255,
    GHOST_LEFT[2] / 255,
    1,
  );
  setLookVector(
    input,
    11,
    GHOST_RIGHT[0] / 255,
    GHOST_RIGHT[1] / 255,
    GHOST_RIGHT[2] / 255,
    1,
  );
  input.bloom = 0;
  return state.tears.length > 0 || (falling && look.accents);
};

const glitchBarsLook: IEngineLook<IGlitchBarsState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.glitchBars,
  step,
};

export default glitchBarsLook;
