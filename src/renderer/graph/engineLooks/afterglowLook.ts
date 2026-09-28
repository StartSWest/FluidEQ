/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  EDGE,
  GHOSTS,
  MIN_PITCH,
  afterglowBloom,
  afterglowStand,
  ghostHaze,
  isTrailing,
  leaveGhost,
  type IAfterglowState,
} from '../sceneViews/afterglow';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { setLookStands, setLookVector, sizeLookData } from './lookInput';

/**
 * AFTERGLOW on the GPU: the 2D look's bars and the trail of ghosts they
 * leave (`sceneViews/afterglow.ts`), the burning tops, the held peaks and the
 * bloom, painted per pixel from the same layout and the same trail, kept by
 * the same functions. The trail was fourteen paths filled one over another
 * across the whole row every frame, which is what made this the costliest
 * look to rasterise.
 *
 *   uLook[6] the row: pitch, bar width, how many, how many ghosts
 *   uLook[7] a ghost's haze before its age and Opacity (`ghostHaze`), and
 *            its edge's height
 *   uLook[8], uLook[9] where each copy stands (`afterglowStand`)
 *   texel (i, 0)   bar i's level and its held peak
 *   texel (i, age) the ghost that old: its level, 1 when it is one
 */

const GLSL = `
const int GHOSTS = ${GHOSTS};

vec4 afterglowCopy(vec2 p, vec4 stand, vec4 picture) {
  float floorY = stand.x;
  float up = stand.y;
  float reach = stand.z;
  float headY = floorY + up * reach;
  float pitch = uLook[6].x;
  float body = uLook[6].y;
  int count = int(uLook[6].z + 0.5);
  int ghosts = int(uLook[6].w + 0.5);
  int piece = int(floor((p.x - uLook[1].x) / pitch));
  if (piece < 0 || piece >= count) {
    return picture;
  }
  float left = uLook[1].x + float(piece) * pitch + (pitch - body) * 0.5;
  float right = left + body;
  float t = lookFigureT(p, floorY, headY);
  float opacity = lookOpacity();
  vec4 bar = lookData(piece);

  float height = max(1.5, bar.x * reach);
  float edge = min(3.0, height);
  float topY = up < 0.0 ? floorY - height : floorY + height - edge;
  float tops = lookFill(lookBox(p, vec2(left, topY), vec2(right, topY + edge), 0.0));
  if (lookBloomPass()) {
    return lookOver(picture, lookPaint(lookLightInk(t, 0.2), tops));
  }

  // The trail, added as light, oldest first: each ghost a haze from the floor
  // to where the bar stood, with the edge it burned at.
  vec4 trail = vec4(0.0);
  for (int age = GHOSTS - 1; age >= 1; age--) {
    if (age >= ghosts) {
      continue;
    }
    vec4 ghost = texelFetch(uLookData, ivec2(piece, age), 0);
    if (ghost.y < 0.5 || ghost.x <= bar.x + 0.01) {
      continue;
    }
    float fade = pow(1.0 - float(age) / float(GHOSTS), 1.6);
    float gh = max(1.5, ghost.x * reach);
    float gTop = up < 0.0 ? floorY - gh : floorY;
    float haze = lookShape(lookBox(p, vec2(left, gTop), vec2(right, gTop + gh), 0.0));
    trail += lookPaint(lookLightInk(t, 0.15), uLook[7].x * fade * opacity * haze);
    float ge = ghost.x * reach;
    float eTop = up < 0.0 ? floorY - ge : floorY + ge - uLook[7].y;
    float edgeCover = lookFill(lookBox(p, vec2(left, eTop), vec2(right, eTop + uLook[7].y), 0.0));
    trail += lookPaint(lookLightInk(t, 0.35), 0.6 * fade * opacity * edgeCover);
  }
  picture = min(picture + trail, vec4(1.0));

  // The bars, their burning tops, the held line.
  float barTop = up < 0.0 ? floorY - height : floorY;
  float shape = lookShape(lookBox(p, vec2(left, barTop), vec2(right, barTop + height), 0.0));
  vec3 ink = lookInkMode() == 3 ? lookInk(lookHeatT(bar.x)) : lookInk(t);
  picture = lookOver(picture, lookPaint(ink, opacity * shape));
  picture = lookOver(picture, lookPaint(lookLightInk(t, 0.55 + lookPulse() * 0.3), 0.95 * tops));
  float heldHeight = bar.y * reach;
  if (lookAccents() && heldHeight - height > 3.0) {
    float heldY = floorY + up * heldHeight;
    float line = lookFill(lookBox(p, vec2(left, heldY - 0.75), vec2(right, heldY + 0.75), 0.0));
    picture = lookOver(picture, lookPaint(lookLightInk(t, 0.5), 0.8 * line));
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = lookStand(copy);
    if (stand.w >= 0.5) {
      picture = afterglowCopy(p, stand, picture);
    }
  }
  return lookBloomPass() ? picture : lookBloomed(picture, uv);
}
`;

const step = (
  reading: ISceneReading,
  state: IAfterglowState,
  input: IEngineLookInput,
): boolean => {
  const row = layPieces(reading, state.row, MIN_PITCH);
  const falling = holdPeaks(
    state.peaks,
    row.levels,
    row.count,
    reading.deltaMs,
  );
  leaveGhost(state, row.levels, row.count, reading.deltaMs);
  const data = sizeLookData(input, row.count, GHOSTS);
  data.fill(0);
  for (let piece = 0; piece < row.count; piece += 1) {
    data[piece * 4] = row.levels[piece];
    data[piece * 4 + 1] = state.peaks.held[piece];
  }
  state.ghosts.forEach((ghost, age) => {
    if (age === 0 || ghost.length !== row.count) {
      return;
    }
    const at = age * row.count * 4;
    for (let piece = 0; piece < row.count; piece += 1) {
      data[at + piece * 4] = ghost[piece];
      data[at + piece * 4 + 1] = 1;
    }
  });
  const { pulse } = reading.music;
  setLookVector(input, 6, row.pitch, row.body, row.count, state.ghosts.length);
  setLookVector(input, 7, ghostHaze(pulse, reading.glow), EDGE, 0, 0);
  setLookStands(input, reading.bands, afterglowStand);
  input.bloom = afterglowBloom(pulse, reading.glow, reading.look.opacity);
  return (
    isTrailing(state, row.levels, row.count) ||
    (falling && reading.look.accents)
  );
};

const afterglowLook: IEngineLook<IAfterglowState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.afterglow,
  step,
};

export default afterglowLook;
