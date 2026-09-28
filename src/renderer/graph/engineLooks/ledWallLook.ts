/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  MIN_PITCH,
  isLampSparking,
  ledBloom,
  ledBoard,
  ledRadius,
  type ILedWallState,
} from '../sceneViews/ledWall';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * LED WALL on the GPU: the 2D look's board of round lamps
 * (`sceneViews/ledWall.ts`) — the unlit glass, the lit columns in their
 * colours, the held peak lamp, every lamp's lens, the bloom and the treble's
 * sparks — painted per pixel from the same layout. Each pixel has one lamp
 * of its own, so each is one circle, where the 2D board was a path of
 * thousands of arcs.
 *
 *   uLook[6] the board: pitch, lamp radius, columns
 *   uLook[10], uLook[11] each copy's board (`ledBoard`): its foot row,
 *            which way it grows, how many rows, present
 *   texel i  column i's level, its held peak, whether its top lamp sparks
 */

const GLSL = `
// One board: the copy of the figure's lamps. Its foot row, which way it
// grows, how many rows it holds.
struct LedBoard {
  float foot;
  float up;
  float rows;
  float head;
};

vec4 ledBoardOf(int copy) {
  return copy == 0 ? uLook[10] : uLook[11];
}

LedBoard ledBoard(vec4 board, float pitch) {
  return LedBoard(board.x, board.y, board.z, board.x + board.y * (board.z - 1.0) * pitch);
}

// One lamp's lens, over a lamp already lit: a rim darkening to its edge, a
// hot centre, and a glint up and to the left (ledWall.ts, printLens).
vec4 ledLens(vec2 q, float radius) {
  float d = length(q);
  float inside = lookFill(d - radius);
  float rimT = clamp((d - radius * 0.62) / (radius * 0.38), 0.0, 1.0);
  vec4 lens = vec4(0.0, 0.0, 0.0, 0.38 * rimT * inside);
  float coreT = clamp(d / (radius * 0.72), 0.0, 1.0);
  float core = coreT < 0.4
    ? mix(0.62, 0.2, coreT / 0.4)
    : mix(0.2, 0.0, (coreT - 0.4) / 0.6);
  lens = lookOver(lens, vec4(vec3(core), core) * inside);
  vec2 g = q - vec2(-0.34, -0.36) * radius;
  float gd = length(g);
  float glint = 0.75 * clamp(1.0 - gd / (radius * 0.3), 0.0, 1.0) * lookFill(gd - radius * 0.3);
  return lookOver(lens, vec4(vec3(glint), glint));
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  float pitch = uLook[6].x;
  float radius = uLook[6].y;
  int count = int(uLook[6].z + 0.5);
  float left0 = uLook[1].x;
  int column = int(floor((p.x - left0) / pitch));
  bool bloom = lookBloomPass();
  vec4 picture = vec4(0.0);
  if (column < 0 || column >= count) {
    return picture;
  }
  float x = left0 + (float(column) + 0.5) * pitch;
  vec4 lamp = lookData(column);
  float opacity = lookOpacity();
  vec3 glassInk = lookInk(0.1);

  // The unlit board, every copy's, under everything.
  if (!bloom) {
    for (int copy = 0; copy < 2; copy++) {
      vec4 band = ledBoardOf(copy);
      if (band.w < 0.5) {
        continue;
      }
      LedBoard board = ledBoard(band, pitch);
      float row = floor((p.y - board.foot) / (board.up * pitch) + 0.5);
      if (row < 0.0 || row >= board.rows) {
        continue;
      }
      vec2 q = p - vec2(x, board.foot + board.up * row * pitch);
      float d = length(q) - radius;
      if (lookFilled()) {
        picture = lookOver(picture, lookPaint(glassInk, 0.075 * lookFill(d)));
        vec4 lens = ledLens(q, radius) * 0.07;
        picture = lookOver(picture, lens);
      } else {
        picture = lookOver(picture, lookPaint(glassInk, 0.12 * lookStroke(d, lookLineWidth())));
      }
    }
  }

  for (int copy = 0; copy < 2; copy++) {
    vec4 band = ledBoardOf(copy);
    if (band.w < 0.5) {
      continue;
    }
    LedBoard board = ledBoard(band, pitch);
    float lit = floor(lamp.x * board.rows + 0.5);
    float along = (p.y - board.foot) / (board.up * pitch);
    float row = floor(along + 0.5);
    if (bloom) {
      // What throws light: each lit column whole, as a block.
      if (lit > 0.0 && along >= -0.5 && along <= lit - 0.5) {
        vec3 ink = lookInk(lookFigureT(p, board.foot, board.head));
        picture = lookOver(picture, vec4(ink, 1.0));
      }
      continue;
    }
    if (row < 0.0 || row >= board.rows) {
      continue;
    }
    vec2 centre = vec2(x, board.foot + board.up * row * pitch);
    vec2 q = p - centre;
    float d = length(q) - radius;
    float shape = lookShape(d);
    float peakRow = floor(lamp.y * board.rows + 0.5) - 1.0;
    bool isLit = row < lit;
    bool isPeak = lookAccents() && peakRow >= lit && peakRow >= 0.0 && row == peakRow;
    if (!isLit && !isPeak) {
      continue;
    }
    vec3 ink;
    float rampT = board.rows > 1.0 ? row / (board.rows - 1.0) : 1.0;
    if (isPeak) {
      ink = lookLightInk(lookFigureT(centre, board.foot, board.head), 0.3);
    } else if (lookInkMode() == 2) {
      ink = lookInk(rampT);
    } else if (lookInkMode() == 3) {
      ink = lookInk(lookHeatT(lamp.x));
    } else {
      ink = lookInk(lookFigureT(p, board.foot, board.head));
    }
    picture = lookOver(picture, lookPaint(ink, opacity * shape));
    if (lookFilled()) {
      picture = lookOver(picture, ledLens(q, radius) * opacity);
    }
  }
  if (bloom) {
    return picture;
  }
  picture = lookBloomed(picture, uv);

  // The treble's sparks, over the light: a lit column's top lamp, white.
  if (lamp.z > 0.5) {
    for (int copy = 0; copy < 2; copy++) {
      vec4 band = ledBoardOf(copy);
      if (band.w < 0.5) {
        continue;
      }
      LedBoard board = ledBoard(band, pitch);
      float lit = floor(lamp.x * board.rows + 0.5);
      if (lit < 1.0) {
        continue;
      }
      vec2 top = vec2(x, board.foot + board.up * (lit - 1.0) * pitch);
      float spark = lookFill(length(p - top) - radius * 1.05);
      picture = lookOver(picture, vec4(vec3(0.9), 0.9) * spark);
    }
  }
  return picture;
}
`;

const step = (
  reading: ISceneReading,
  state: ILedWallState,
  input: IEngineLookInput,
): boolean => {
  const row = layPieces(reading, state.row, MIN_PITCH);
  const falling = holdPeaks(
    state.peaks,
    row.levels,
    row.count,
    reading.deltaMs,
  );
  state.frame = (state.frame + 1) % 100000;
  const { treble } = reading.music;
  [0, 1].forEach((copy) => {
    const band = reading.bands[copy];
    if (band) {
      const board = ledBoard(band, row.pitch);
      setLookVector(input, 10 + copy, board.foot, board.up, board.rows, 1);
    } else {
      setLookVector(input, 10 + copy, 0, 0, 0, 0);
    }
  });
  const data = sizeLookData(input, row.count, 1);
  for (let column = 0; column < row.count; column += 1) {
    data[column * 4] = row.levels[column];
    data[column * 4 + 1] = state.peaks.held[column];
    // The 2D board's own draw: a few top lamps flash on the treble.
    data[column * 4 + 2] = isLampSparking(treble, column, state.frame) ? 1 : 0;
  }
  setLookVector(input, 6, row.pitch, ledRadius(row.body), row.count, 0);
  input.bloom = ledBloom(
    reading.music.pulse,
    reading.glow,
    reading.look.opacity,
  );
  return falling && reading.look.accents;
};

const ledWallLook: IEngineLook<ILedWallState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.ledWall,
  step,
};

export default ledWallLook;
