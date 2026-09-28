/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  DITHER_BELOW,
  MIN_PITCH,
  pixelBloom,
  pixelStand,
  pixelTopWhiten,
  type IPixelBarsState,
} from '../sceneViews/pixelBars';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * PIXEL BARS on the GPU: the 2D look's eight-bit columns — square pixels on
 * the screen's own pixel grid, the white-hot top, the dithered foot, the held
 * pixel and the ground row (`sceneViews/pixelBars.ts`) — painted per pixel
 * from the same layout, and snapped to the pixels the engine draws, so the
 * edges stay hard at any size the engine draws at.
 *
 *   uLook[6] the row: pitch, pixel width, how many, the top pixel's heat
 *   uLook[10], uLook[11] each copy (`pixelStand`): its floor, which way it
 *            grows, the ground strip, how many rows
 *   texel i  column i's level and its held peak
 */

const GLSL = `
const float DITHER_BELOW = ${DITHER_BELOW};

// A value on the grid of pixels the engine draws.
float snapPixel(float value) {
  float px = lookPixel();
  return floor(value / px + 0.5) * px;
}

// Inside a square, hard-edged, the way the originals were; outlines keep
// the line width.
float pixelCell(vec2 p, vec2 lo, vec2 hi) {
  if (!lookFilled()) {
    return lookStroke(lookBox(p, lo, hi, 0.0), lookLineWidth());
  }
  return p.x >= lo.x && p.x < hi.x && p.y >= lo.y && p.y < hi.y ? 1.0 : 0.0;
}

vec4 pixelCopy(vec2 p, vec4 stand, vec4 picture) {
  float floorY = stand.x;
  float up = stand.y;
  float base = stand.z;
  float rows = stand.w;
  float pitch = uLook[6].x;
  int count = int(uLook[6].z + 0.5);
  float px = lookPixel();
  float cell = max(px, snapPixel(uLook[6].y));
  float opacity = lookOpacity();
  int column = int(floor((p.x - uLook[1].x) / pitch));
  if (column < 0 || column >= count) {
    return picture;
  }
  float x = snapPixel(uLook[1].x + float(column) * pitch + (pitch - uLook[6].y) * 0.5);
  vec4 bar = lookData(column);
  float steps = floor(bar.x * rows + 0.5);
  float headY = floorY + up * rows * pitch;
  float t = lookFigureT(p, floorY, headY);

  if (lookBloomPass()) {
    if (steps > 0.0) {
      float topY = snapPixel(up < 0.0 ? floorY - base - steps * pitch : floorY + base + (steps - 1.0) * pitch);
      float lo = min(topY, floorY);
      float hi = lo + abs(floorY - topY) + cell;
      float light = lookFill(lookBox(p, vec2(x, lo), vec2(x + cell, hi), 0.0));
      picture = lookOver(picture, lookPaint(lookInk(t), light));
    }
    return picture;
  }

  // The ground row, dim.
  float groundY = snapPixel(up < 0.0 ? floorY - cell * 0.22 : floorY);
  float ground = pixelCell(p, vec2(x, groundY), vec2(x + cell, groundY + max(px, cell * 0.22)));
  picture = lookOver(picture, lookPaint(lookInk(0.15), opacity * 0.4 * ground));

  float along = up < 0.0 ? (floorY - base - p.y) / pitch : (p.y - floorY - base) / pitch;
  float step = up < 0.0 ? floor(along) : floor(along);
  float heldStep = floor(bar.y * rows + 0.5) - 1.0;
  bool isHeld = lookAccents() && heldStep >= steps && heldStep >= 0.0 && step == heldStep;
  if (step < 0.0 || (step >= steps && !isHeld)) {
    return picture;
  }
  float y = snapPixel(up < 0.0 ? floorY - base - (step + 1.0) * pitch : floorY + base + step * pitch);
  float square = pixelCell(p, vec2(x, y), vec2(x + cell, y + cell));
  vec3 ink;
  float alpha = opacity;
  int mode = lookInkMode();
  if (isHeld) {
    ink = lookLightInk(t, 0.6);
  } else if (step == steps - 1.0) {
    ink = lookLightInk(t, uLook[6].w);
  } else {
    if (mode == 2) {
      ink = lookInk(rows > 1.0 ? step / (rows - 1.0) : 1.0);
    } else if (mode == 3) {
      ink = lookInk(lookHeatT(bar.x));
    } else {
      ink = lookInk(t);
    }
    bool isLow = step < steps * DITHER_BELOW;
    bool isOdd = mod(float(column) + step, 2.0) > 0.5;
    if (isLow && isOdd) {
      alpha = opacity * 0.45;
    }
  }
  return lookOver(picture, lookPaint(ink, alpha * square));
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = copy == 0 ? uLook[10] : uLook[11];
    if (stand.w >= 0.5) {
      picture = pixelCopy(p, stand, picture);
    }
  }
  return lookBloomPass() ? picture : lookBloomed(picture, uv);
}
`;

const step = (
  reading: ISceneReading,
  state: IPixelBarsState,
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
    pixelTopWhiten(music.pulse),
  );
  [0, 1].forEach((copy) => {
    const band = bands[copy];
    if (band) {
      const { floor, up, base, rows } = pixelStand(band, row.pitch);
      setLookVector(input, 10 + copy, floor, up, base, rows);
    } else {
      setLookVector(input, 10 + copy, 0, 0, 0, 0);
    }
  });
  input.bloom = pixelBloom(music.pulse, reading.glow, look.opacity);
  return falling && look.accents;
};

const pixelBarsLook: IEngineLook<IPixelBarsState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.pixelBars,
  step,
};

export default pixelBarsLook;
