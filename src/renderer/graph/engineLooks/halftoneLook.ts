/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  MIN_PITCH,
  halftoneDot,
  halftoneHeldLine,
  halftoneStand,
  moveRipples,
  rippleSwell,
  type IHalftoneState,
} from '../sceneViews/halftone';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * HALFTONE on the GPU: the 2D look's dot screen and its held dots
 * (`sceneViews/halftone.ts`), every dot sized by the 2D look's own function
 * and printed per pixel.
 *
 *   uLook[6] the screen: pitch, column width, how many
 *   uLook[10], uLook[11] each copy (`halftoneStand`): its floor, which way
 *            it grows, how many rows, the data row its dots start on
 *   texel (i, 0)             column i's level, and its held row in each copy
 *   texel (i, start + line)  the dot's radius on that row
 */

const GLSL = `
vec4 halftoneCopy(vec2 p, vec4 screen, int copy, vec4 picture) {
  float floorY = screen.x;
  float up = screen.y;
  float rows = screen.z;
  int start = int(screen.w + 0.5);
  float pitch = uLook[6].x;
  float largest = uLook[6].y * 0.5;
  int count = int(uLook[6].z + 0.5);
  float opacity = lookOpacity();
  float headY = floorY + up * rows * pitch;
  float t = lookFigureT(p, floorY, headY);
  int column = int(floor((p.x - uLook[1].x) / pitch));
  float along = (p.y - floorY) / (up * pitch);
  int line = int(floor(along));
  float lineWidth = max(0.6, lookLineWidth() * 0.5);
  for (int k = column - 1; k <= column + 1; k++) {
    if (k < 0 || k >= count) {
      continue;
    }
    float cx = uLook[1].x + (float(k) + 0.5) * pitch;
    float level = lookData(k).x;
    for (int l = line - 1; l <= line + 1; l++) {
      if (l < 0 || float(l) >= rows) {
        continue;
      }
      float radius = texelFetch(uLookData, ivec2(k, start + l), 0).x;
      if (radius < 0.4) {
        continue;
      }
      float d = length(p - vec2(cx, floorY + up * (float(l) + 0.5) * pitch)) - radius;
      float cover = lookFilled() ? lookFill(d) : lookStroke(d, lineWidth);
      int mode = lookInkMode();
      vec3 ink = mode == 2
        ? lookInk(rows > 1.0 ? float(l) / (rows - 1.0) : 1.0)
        : (mode == 3 ? lookInk(lookHeatT(level)) : lookInk(t));
      picture = lookOver(picture, lookPaint(ink, opacity * cover));
    }
  }
  if (column >= 0 && column < count) {
    float heldLine = copy == 0 ? lookData(column).z : lookData(column).w;
    if (heldLine >= 0.0) {
      float cx = uLook[1].x + (float(column) + 0.5) * pitch;
      float d = length(p - vec2(cx, floorY + up * (heldLine + 0.5) * pitch)) - largest * 0.7;
      picture = lookOver(picture, lookPaint(lookLightInk(t, 0.6), opacity * lookFill(d)));
    }
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 screen = copy == 0 ? uLook[10] : uLook[11];
    if (screen.z >= 1.0) {
      picture = halftoneCopy(p, screen, copy, picture);
    }
  }
  return picture;
}
`;

const step = (
  reading: ISceneReading,
  state: IHalftoneState,
  input: IEngineLookInput,
): boolean => {
  const { bands, look, music, plot } = reading;
  const row = layPieces(reading, state.row, MIN_PITCH);
  const falling = holdPeaks(
    state.peaks,
    row.levels,
    row.count,
    reading.deltaMs,
  );
  moveRipples(state, music.onBeat, reading.deltaMs);
  const screens = [0, 1].map((copy) =>
    bands[copy] ? halftoneStand(bands[copy], row.pitch) : undefined,
  );
  const rows = screens.map((screen) => screen?.rows ?? 0);
  const data = sizeLookData(input, row.count, 1 + rows[0] + rows[1]);
  data.fill(0);
  const width = plot.right - plot.left;
  const largest = row.body / 2;
  for (let column = 0; column < row.count; column += 1) {
    const level = row.levels[column];
    const held = state.peaks.held[column];
    const x = row.lefts[column] + row.body / 2;
    const swell = rippleSwell(state.ripples, (x - plot.left) / width);
    data[column * 4] = level;
    data[column * 4 + 1] = held;
    let start = 1;
    screens.forEach((screen, copy) => {
      data[column * 4 + 2 + copy] = screen
        ? halftoneHeldLine(look.accents, held, level, screen.rows)
        : -1;
      for (let line = 0; line < rows[copy]; line += 1) {
        data[((start + line) * row.count + column) * 4] = halftoneDot(
          largest,
          level,
          line,
          rows[copy],
          swell,
        );
      }
      start += rows[copy];
    });
  }
  setLookVector(input, 6, row.pitch, row.body, row.count, 0);
  screens.forEach((screen, copy) => {
    if (screen) {
      setLookVector(
        input,
        10 + copy,
        screen.floor,
        screen.up,
        screen.rows,
        copy === 0 ? 1 : 1 + rows[0],
      );
    } else {
      setLookVector(input, 10 + copy, 0, 0, 0, 0);
    }
  });
  input.bloom = 0;
  return state.ripples.length > 0 || (falling && look.accents);
};

const halftoneLook: IEngineLook<IHalftoneState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.halftone,
  step,
};

export default halftoneLook;
