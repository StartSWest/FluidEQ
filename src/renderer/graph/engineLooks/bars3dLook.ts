/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  MIN_PITCH,
  bars3dBloom,
  bars3dShift,
  bars3dSlab,
  bars3dStand,
  type IBars3dState,
} from '../sceneViews/bars3d';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * 3D BARS on the GPU: the 2D look's blocks — front, lit top, shaded side,
 * the shadow each throws on the floor — the sheen, the floating slabs and
 * the bloom (`sceneViews/bars3d.ts`), painted per pixel from the same
 * layout. A block reaches into the next one's gap by its depth, so a pixel
 * weighs its own block and the one to its left, face by face in the 2D
 * look's order: shadows, sides, tops, fronts.
 *
 *   uLook[6] the row: pitch, block width, how many, how far it moves left
 *   uLook[7] the depth: across, up, a slab's thickness
 *   uLook[8], uLook[9] where each copy stands (`bars3dStand`)
 *   texel i  block i's level and its held peak
 */

const GLSL = `
struct Block {
  float left;
  float height;
  float held;
  float level;
};

Block blockAt(int k, float reach) {
  vec4 bar = lookData(k);
  float left = uLook[1].x + float(k) * uLook[6].x + (uLook[6].x - uLook[6].y) * 0.5 - uLook[6].w;
  return Block(left, max(2.0, bar.x * reach), bar.y * reach, bar.x);
}

float blockFront(vec2 p, float left, float w, float floorY, float head) {
  return lookBox(p, vec2(left, min(floorY, head)), vec2(left + w, max(floorY, head)), 0.0);
}

float blockTop(vec2 p, float left, float w, float head, float up) {
  vec2 back = vec2(uLook[7].x, up * uLook[7].y);
  return lookQuad(p, vec2(left, head), vec2(left, head) + back, vec2(left + w, head) + back, vec2(left + w, head));
}

float blockSide(vec2 p, float left, float w, float floorY, float head, float up) {
  vec2 back = vec2(uLook[7].x, up * uLook[7].y);
  vec2 foot = vec2(left + w, floorY);
  vec2 crown = vec2(left + w, head);
  return lookQuad(p, foot, foot + back, crown + back, crown);
}

vec4 bars3dCopy(vec2 p, vec4 stand, vec4 picture) {
  float floorY = stand.x;
  float up = stand.y;
  float reach = stand.z;
  float headY = floorY + up * reach;
  float pitch = uLook[6].x;
  float w = uLook[6].y;
  int count = int(uLook[6].z + 0.5);
  float dx = uLook[7].x;
  float dy = uLook[7].y;
  float opacity = lookOpacity();
  float t = lookFigureT(p, floorY, headY);
  int here = int(floor((p.x - uLook[1].x + uLook[6].w) / pitch));
  bool filled = lookFilled();

  if (lookBloomPass()) {
    for (int k = here - 1; k <= here; k++) {
      if (k < 0 || k >= count) {
        continue;
      }
      Block b = blockAt(k, reach);
      float front = lookFill(blockFront(p, b.left, w, floorY, floorY + up * b.height));
      picture = lookOver(picture, lookPaint(lookInk(t), front));
    }
    return picture;
  }

  // Shadows on the floor, thrown back and to the right.
  if (filled) {
    for (int k = here - 1; k <= here; k++) {
      if (k < 0 || k >= count) {
        continue;
      }
      Block b = blockAt(k, reach);
      float fall = min(b.height * 0.35, dy * 3.0);
      float shadow = lookFill(lookQuad(p,
        vec2(b.left + w, floorY),
        vec2(b.left + w + dx + fall * 0.6, floorY + up * dy * 0.6),
        vec2(b.left + dx * 0.6 + fall * 0.6, floorY + up * dy * 0.6),
        vec2(b.left, floorY)));
      picture = lookOver(picture, vec4(0.0, 0.0, 0.0, 0.35 * opacity * shadow));
    }
  }
  // Sides, darkened; then the lit tops; then the fronts over both.
  for (int k = here - 1; k <= here; k++) {
    if (k < 0 || k >= count) {
      continue;
    }
    Block b = blockAt(k, reach);
    float head = floorY + up * b.height;
    vec3 paint = lookInkMode() == 3 ? lookInk(lookHeatT(b.level)) : lookInk(t);
    float side = blockSide(p, b.left, w, floorY, head, up);
    picture = lookOver(picture, lookPaint(paint, opacity * lookShape(side)));
    if (filled) {
      picture = lookOver(picture, vec4(0.0, 0.0, 0.0, 0.42 * opacity * lookFill(side)));
    }
  }
  for (int k = here - 1; k <= here; k++) {
    if (k < 0 || k >= count) {
      continue;
    }
    Block b = blockAt(k, reach);
    float head = floorY + up * b.height;
    vec3 lit = lookInkMode() == 3 ? lookLightInk(lookHeatT(b.level), 0.45) : lookLightInk(t, 0.45);
    picture = lookOver(picture, lookPaint(lit, opacity * lookShape(blockTop(p, b.left, w, head, up))));
  }
  for (int k = here - 1; k <= here; k++) {
    if (k < 0 || k >= count) {
      continue;
    }
    Block b = blockAt(k, reach);
    float head = floorY + up * b.height;
    vec3 paint = lookInkMode() == 3 ? lookInk(lookHeatT(b.level)) : lookInk(t);
    float front = blockFront(p, b.left, w, floorY, head);
    picture = lookOver(picture, lookPaint(paint, opacity * lookShape(front)));
    if (filled) {
      // A little light down the fronts, where the view catches them.
      float across = (p.x - uLook[1].x) / max(1.0, uLook[1].y - uLook[1].x);
      float sheen = mix(0.06, 0.02, clamp(across, 0.0, 1.0));
      picture = lookOver(picture, vec4(vec3(1.0), 1.0) * sheen * opacity * lookFill(front));
    }
  }
  // The floating slabs, lit.
  for (int k = here - 1; k <= here; k++) {
    if (k < 0 || k >= count || !lookAccents()) {
      continue;
    }
    Block b = blockAt(k, reach);
    float slab = uLook[7].z;
    if (b.held - b.height <= 4.0) {
      continue;
    }
    float slabFloor = floorY + up * (b.held - slab);
    float slabHead = slabFloor + up * slab;
    picture = lookOver(picture, lookPaint(lookLightInk(t, 0.3), 0.9 * lookShape(blockSide(p, b.left, w, slabFloor, slabHead, up))));
    picture = lookOver(picture, lookPaint(lookLightInk(t, 0.7), 0.95 * lookShape(blockTop(p, b.left, w, slabHead, up))));
    picture = lookOver(picture, lookPaint(lookLightInk(t, 0.5), 0.95 * lookShape(blockFront(p, b.left, w, slabFloor, slabHead))));
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = lookStand(copy);
    if (stand.w >= 0.5) {
      picture = bars3dCopy(p, stand, picture);
    }
  }
  return lookBloomPass() ? picture : lookBloomed(picture, uv);
}
`;

const step = (
  reading: ISceneReading,
  state: IBars3dState,
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
  const stands = [0, 1].map((copy) =>
    bands[copy] ? bars3dStand(bands[copy], row.body) : undefined,
  );
  const depth = stands[0] ?? { dx: 0, dy: 0 };
  setLookVector(
    input,
    6,
    row.pitch,
    row.body,
    row.count,
    bars3dShift(row, depth.dx),
  );
  setLookVector(input, 7, depth.dx, depth.dy, bars3dSlab(row.body), 0);
  stands.forEach((stand, copy) => {
    if (stand) {
      setLookVector(input, 8 + copy, stand.floor, stand.up, stand.reach, 1);
    } else {
      setLookVector(input, 8 + copy, 0, 0, 0, 0);
    }
  });
  input.bloom = bars3dBloom(music.pulse, reading.glow, look.opacity);
  return falling && look.accents;
};

const bars3dLook: IEngineLook<IBars3dState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.bars3d,
  step,
};

export default bars3dLook;
