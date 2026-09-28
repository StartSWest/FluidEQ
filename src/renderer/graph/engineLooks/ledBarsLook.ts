/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  MIN_PITCH,
  ledBarsBloom,
  panelSegments,
  type ILedBarsState,
} from '../sceneViews/ledBars';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * LED BARS on the GPU: the 2D look's analyser panel — every segment's dim
 * print, the lit columns in their colours, the hot top segment, the held
 * one, the glass highlights and the bloom (`sceneViews/ledBars.ts`) —
 * painted per pixel from the same panel. Each pixel is in one segment of one
 * column, so each is one rectangle, where the 2D panel was a path of every
 * lit segment on the screen.
 *
 *   uLook[6] the row: pitch, column width, how many
 *   uLook[7] a segment's height, the pitch between rows
 *   uLook[10], uLook[11] each copy's board (`panelSegments`): its floor,
 *            which way it grows, how many rows, present
 *   texel i  column i's level and its held peak
 */

const GLSL = `
// The top of the segment 'step' rows up a board (ledBars.ts, segmentAt).
float segmentTop(vec4 board, float step) {
  float cell = uLook[7].x;
  float rowPitch = uLook[7].y;
  return board.y < 0.0
    ? board.x - (step + 1.0) * rowPitch + (rowPitch - cell)
    : board.x + step * rowPitch;
}

vec4 ledBarsBoard(vec2 p, vec4 board, bool ghostOnly, vec4 picture) {
  float pitch = uLook[6].x;
  float body = uLook[6].y;
  int count = int(uLook[6].z + 0.5);
  float cell = uLook[7].x;
  float rowPitch = uLook[7].y;
  int column = int(floor((p.x - uLook[1].x) / pitch));
  if (column < 0 || column >= count) {
    return picture;
  }
  float left = uLook[1].x + float(column) * pitch + (pitch - body) * 0.5;
  float rows = board.z;
  float along = board.y < 0.0 ? (board.x - p.y) / rowPitch : (p.y - board.x) / rowPitch;
  float step = floor(along);
  vec4 bar = lookData(column);
  float lit = floor(bar.x * rows + 0.5);
  float headY = board.x + board.y * rows * rowPitch;
  float t = lookFigureT(p, board.x, headY);

  if (lookBloomPass()) {
    // What throws light: each lit column from its floor, and its held segment.
    if (lit > 0.0) {
      float top = segmentTop(board, lit - 1.0);
      float lo = min(top, board.x);
      float hi = max(top, board.x) + (board.y < 0.0 ? 0.0 : cell);
      float light = lookFill(lookBox(p, vec2(left, lo), vec2(left + body, hi), 0.0));
      picture = lookOver(picture, lookPaint(lookInk(t), light));
    }
    float heldStep = floor(bar.y * rows + 0.5) - 1.0;
    if (lookAccents() && heldStep >= lit && heldStep < rows) {
      float y = segmentTop(board, heldStep);
      float held = lookFill(lookBox(p, vec2(left, y), vec2(left + body, y + cell), 0.0));
      picture = lookOver(picture, lookPaint(lookInk(t), held));
    }
    return picture;
  }
  if (step < 0.0 || step >= rows) {
    return picture;
  }
  float y = segmentTop(board, step);
  float d = lookBox(p, vec2(left, y), vec2(left + body, y + cell), 0.0);
  int mode = lookInkMode();
  if (ghostOnly) {
    // The unlit print of every segment in its own colour.
    float rowT = rows > 1.0 ? step / (rows - 1.0) : 1.0;
    float tint = mode == 1
      ? (p.x - uLook[1].x) / max(1.0, uLook[1].y - uLook[1].x)
      : (mode == 2 ? rowT : (mode == 3 ? 0.0 : 0.5));
    float alpha = lookFilled() || mode == 1 ? 0.09 : 0.16;
    return lookOver(picture, lookPaint(lookInk(tint), alpha * lookShape(d)));
  }
  float opacity = lookOpacity();
  float heldStep = floor(bar.y * rows + 0.5) - 1.0;
  bool isHeld = lookAccents() && heldStep >= lit && heldStep < rows && step == heldStep;
  if (step >= lit && !isHeld) {
    return picture;
  }
  vec3 ink;
  if (isHeld) {
    ink = lookLightInk(t, 0.55);
  } else if (step == lit - 1.0) {
    ink = lookLightInk(t, 0.2);
  } else if (mode == 2) {
    ink = lookInk(rows > 1.0 ? step / (rows - 1.0) : 1.0);
  } else if (mode == 3) {
    ink = lookInk(lookHeatT(bar.x));
  } else {
    ink = lookInk(t);
  }
  picture = lookOver(picture, lookPaint(ink, opacity * lookShape(d)));
  if (lookFilled() && !isHeld) {
    float shineY = board.y < 0.0 ? y + 0.5 : y + cell - 1.5;
    float shine = lookFill(lookBox(p, vec2(left + 1.0, shineY),
      vec2(left + 1.0 + max(0.5, body - 2.0), shineY + max(0.6, cell * 0.14)), 0.0));
    picture = lookOver(picture, vec4(vec3(1.0), 1.0) * 0.28 * opacity * shine);
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  if (!lookBloomPass()) {
    for (int copy = 0; copy < 2; copy++) {
      vec4 board = copy == 0 ? uLook[10] : uLook[11];
      if (board.w >= 0.5) {
        picture = ledBarsBoard(p, board, true, picture);
      }
    }
  }
  for (int copy = 0; copy < 2; copy++) {
    vec4 board = copy == 0 ? uLook[10] : uLook[11];
    if (board.w >= 0.5) {
      picture = ledBarsBoard(p, board, false, picture);
    }
  }
  return lookBloomPass() ? picture : lookBloomed(picture, uv);
}
`;

const step = (
  reading: ISceneReading,
  state: ILedBarsState,
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
  const panel = panelSegments(bands, row);
  setLookVector(input, 6, row.pitch, row.body, row.count, 0);
  setLookVector(input, 7, panel.cell, panel.rowPitch, 0, 0);
  [0, 1].forEach((copy) => {
    const board = panel.boards[copy];
    if (board) {
      setLookVector(input, 10 + copy, board.floor, board.up, board.rows, 1);
    } else {
      setLookVector(input, 10 + copy, 0, 0, 0, 0);
    }
  });
  input.bloom = ledBarsBloom(music.pulse, reading.glow, look.opacity);
  return falling && look.accents;
};

const ledBarsLook: IEngineLook<ILedBarsState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.ledBars,
  step,
};

export default ledBarsLook;
