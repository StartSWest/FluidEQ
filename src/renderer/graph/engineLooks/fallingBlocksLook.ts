/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  FLASH_MS,
  MIN_PITCH,
  blockBevel,
  blocksStand,
  build,
  crumbShrink,
  eachFalling,
  type IFallingBlocksState,
} from '../sceneViews/fallingBlocks';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * FALLING BLOCKS on the GPU: the 2D look's stacks of bevelled blocks, the
 * blocks on their way down, the crumbling ones, the landing flashes and the
 * held frames (`sceneViews/fallingBlocks.ts`), painted per pixel from the
 * stacks the 2D look's own function builds.
 *
 *   uLook[6] the columns: pitch, block size, how many, how many rows
 *   uLook[7] a block's bevel
 *   uLook[10], uLook[11] each copy (`blocksStand`): its floor, which way it
 *            grows, present
 *   texel (i, 0)          column i's stack, its level, its held row (or -1),
 *                         1 while its top block flashes from landing
 *   texel (i, 1 + n)      the column's nth falling block: how far up, the
 *                         row it lands in, 1 when there is one
 *   texel (i, 1 + F + n)  its nth crumbling block: its row, how far it has
 *                         shrunk from each side, 1 when there is one
 */

/** Falling and crumbling blocks one column carries at once, at most. */
const FALLING_SLOTS = 16;
const CRUMB_SLOTS = 4;

const GLSL = `
const int FALLING = ${FALLING_SLOTS};
const int CRUMBS = ${CRUMB_SLOTS};

float blockTop(float rowUp, float floorY, float up, float pitch, float inset) {
  return up < 0.0 ? floorY - (rowUp + 1.0) * pitch + inset : floorY + rowUp * pitch + inset;
}

float inRect(vec2 p, vec2 lo, vec2 size) {
  return lookFill(lookBox(p, lo, lo + size, 0.0));
}

vec3 blockInk(float rows, float level, float group, float t) {
  int mode = lookInkMode();
  if (mode == 2) {
    return lookInk(rows > 1.0 ? group / (rows - 1.0) : 1.0);
  }
  return mode == 3 ? lookInk(lookHeatT(level)) : lookInk(t);
}

// One block with its bevels, over the picture.
vec4 paintBlock(vec2 p, vec2 at, float cell, vec3 ink, vec4 picture) {
  float opacity = lookOpacity();
  float d = lookBox(p, at, at + vec2(cell), 0.0);
  picture = lookOver(picture, lookPaint(ink, opacity * lookShape(d)));
  if (lookFilled()) {
    float bevel = uLook[7].x;
    float lit = max(inRect(p, at, vec2(cell, bevel)), inRect(p, at + vec2(0.0, bevel), vec2(bevel, cell - bevel)));
    float shade = max(inRect(p, at + vec2(bevel, cell - bevel), vec2(cell - bevel, bevel)),
      inRect(p, at + vec2(cell - bevel, bevel), vec2(bevel, cell - bevel * 2.0)));
    picture = lookOver(picture, vec4(vec3(1.0), 1.0) * 0.3 * opacity * lit);
    picture = lookOver(picture, vec4(0.0, 0.0, 0.0, 0.3 * opacity * shade));
  }
  return picture;
}

vec4 blocksCopy(vec2 p, vec4 stand, vec4 picture) {
  float floorY = stand.x;
  float up = stand.y;
  float pitch = uLook[6].x;
  float cell = uLook[6].y;
  int count = int(uLook[6].z + 0.5);
  float rows = uLook[6].w;
  float inset = (pitch - cell) * 0.5;
  int column = int(floor((p.x - uLook[1].x) / pitch));
  if (column < 0 || column >= count) {
    return picture;
  }
  float x = uLook[1].x + float(column) * pitch + inset;
  vec4 head = lookData(column);
  float stack = head.x;
  float level = head.y;
  float t = lookFigureT(p, floorY, floorY + up * rows * pitch);
  float along = (up < 0.0 ? floorY - p.y : p.y - floorY) / pitch;
  float rowUp = floor(along);
  if (rowUp >= 0.0 && rowUp < stack) {
    float y = blockTop(rowUp, floorY, up, pitch, inset);
    picture = paintBlock(p, vec2(x, y), cell, blockInk(rows, level, min(rows - 1.0, rowUp), t), picture);
  }
  for (int n = 0; n < FALLING; n++) {
    vec4 falling = texelFetch(uLookData, ivec2(column, 1 + n), 0);
    if (falling.z < 0.5) {
      break;
    }
    float y = blockTop(falling.x, floorY, up, pitch, inset);
    if (p.y >= y - 2.0 && p.y <= y + cell + 2.0) {
      picture = paintBlock(p, vec2(x, y), cell, blockInk(rows, level, falling.y, t), picture);
    }
  }
  for (int n = 0; n < CRUMBS; n++) {
    vec4 crumb = texelFetch(uLookData, ivec2(column, 1 + FALLING + n), 0);
    if (crumb.z < 0.5) {
      break;
    }
    float shrink = crumb.y;
    float y = blockTop(crumb.x, floorY, up, pitch, inset);
    float bit = inRect(p, vec2(x + shrink, y + shrink), vec2(cell - shrink * 2.0));
    picture = lookOver(picture, lookPaint(lookLightInk(t, 0.3), lookOpacity() * 0.6 * bit));
  }
  if (head.w > 0.5 && stack > 0.0) {
    float y = blockTop(stack - 1.0, floorY, up, pitch, inset);
    picture = lookOver(picture, vec4(vec3(1.0), 1.0) * 0.5 * inRect(p, vec2(x, y), vec2(cell)));
  }
  if (head.z >= 0.0) {
    float y = blockTop(head.z, floorY, up, pitch, inset) + 0.5;
    float frame = lookStroke(lookBox(p, vec2(x + 0.5, y), vec2(x + cell - 0.5, y + cell - 1.0), 0.0), 1.0);
    picture = lookOver(picture, lookPaint(lookLightInk(t, 0.5), 0.8 * frame));
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = copy == 0 ? uLook[10] : uLook[11];
    if (stand.z >= 0.5) {
      picture = blocksCopy(p, stand, picture);
    }
  }
  return picture;
}
`;

const step = (
  reading: ISceneReading,
  state: IFallingBlocksState,
  input: IEngineLookInput,
): boolean => {
  const { bands, look } = reading;
  const row = layPieces(reading, state.row, MIN_PITCH);
  const falling = holdPeaks(
    state.peaks,
    row.levels,
    row.count,
    reading.deltaMs,
  );
  const building = build(reading, state);
  const { rows } = state;
  const data = sizeLookData(input, row.count, 1 + FALLING_SLOTS + CRUMB_SLOTS);
  data.fill(0);
  const at = (column: number, slot: number) => (slot * row.count + column) * 4;
  for (let column = 0; column < row.count; column += 1) {
    const stack = state.stacks[column];
    const heldRow = Math.round(state.peaks.held[column] * rows) - 1;
    data[at(column, 0)] = stack;
    data[at(column, 0) + 1] = row.levels[column];
    data[at(column, 0) + 2] =
      look.accents && heldRow >= stack && heldRow < rows ? heldRow : -1;
    data[at(column, 0) + 3] =
      stack > 0 && state.sinceLanding[column] < FLASH_MS ? 1 : 0;
  }
  const slots = new Int32Array(row.count);
  eachFalling(state, (column, rowUp, landsOn) => {
    if (column < row.count && slots[column] < FALLING_SLOTS) {
      const index = at(column, 1 + slots[column]);
      data[index] = rowUp;
      data[index + 1] = landsOn;
      data[index + 2] = 1;
      slots[column] += 1;
    }
  });
  slots.fill(0);
  state.crumbling.forEach((block) => {
    if (block.column < row.count && slots[block.column] < CRUMB_SLOTS) {
      const index = at(block.column, 1 + FALLING_SLOTS + slots[block.column]);
      data[index] = block.row;
      data[index + 1] = crumbShrink(block.age, row.body);
      data[index + 2] = 1;
      slots[block.column] += 1;
    }
  });
  setLookVector(input, 6, row.pitch, row.body, row.count, rows);
  setLookVector(input, 7, blockBevel(row.body), 0, 0, 0);
  [0, 1].forEach((copy) => {
    const band = bands[copy];
    if (band) {
      const { floor, up } = blocksStand(band);
      setLookVector(input, 10 + copy, floor, up, 1, 0);
    } else {
      setLookVector(input, 10 + copy, 0, 0, 0, 0);
    }
  });
  input.bloom = 0;
  return building || (falling && look.accents);
};

const fallingBlocksLook: IEngineLook<IFallingBlocksState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.fallingBlocks,
  step,
};

export default fallingBlocksLook;
