/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { figureInkAt, type ISceneReading } from '../sceneViews/sceneFrame';
import {
  MIN_PITCH,
  emberGlowAlpha,
  moveEmbers,
  placeEmbers,
  sparkBloom,
  standOf,
  tipAlpha,
  tipWhiten,
  type ISparkBarsState,
} from '../sceneViews/sparkBars';
import { holdPeaks, layPieces } from '../sceneViews/scenePieces';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import {
  lightRamp,
  pushRectSprite,
  pushSprite,
  setLookStands,
  setLookVector,
  sizeLookData,
} from './lookInput';

/**
 * SPARK BARS on the GPU: the 2D look's slim bars dark at their feet, their
 * burning tips, the held marks and the bloom (`sceneViews/sparkBars.ts`),
 * painted per pixel from the same layout; the embers thrown and moved by
 * the 2D look's own functions and drawn as sprites.
 *
 *   uLook[6] the row: pitch, bar width, how many
 *   uLook[7] a tip's light and heat
 *   uLook[8], uLook[9] where each copy stands (`standOf`)
 *   texel i  bar i's level and its held peak
 */

const GLSL = `
vec4 sparkCopy(vec2 p, vec4 stand, vec4 picture) {
  float floorY = stand.x;
  float up = stand.y;
  float reach = stand.z;
  float headY = floorY + up * reach;
  float pitch = uLook[6].x;
  float body = uLook[6].y;
  int count = int(uLook[6].z + 0.5);
  float opacity = lookOpacity();
  float t = lookFigureT(p, floorY, headY);
  int here = int(floor((p.x - uLook[1].x) / pitch));
  for (int k = here - 1; k <= here + 1; k++) {
    if (k < 0 || k >= count) {
      continue;
    }
    vec4 bar = lookData(k);
    float left = uLook[1].x + float(k) * pitch + (pitch - body) * 0.5;
    float height = max(2.0, bar.x * reach);
    float top = up < 0.0 ? floorY - height : floorY;
    float tipHeight = min(4.0, height);
    float tipTop = up < 0.0 ? top : floorY + height - tipHeight;
    float tip = lookFill(lookBox(p, vec2(left - 0.5, tipTop), vec2(left + body + 0.5, tipTop + tipHeight), 0.0));
    if (lookBloomPass()) {
      picture = lookOver(picture, lookPaint(lookLightInk(t, 0.3), tip));
      continue;
    }
    float d = lookBox(p, vec2(left, top), vec2(left + body, top + height), 0.0);
    vec3 ink = lookInkMode() == 3 ? lookInk(lookHeatT(bar.x)) : lookInk(t);
    picture = lookOver(picture, lookPaint(ink, opacity * lookShape(d)));
    if (lookFilled()) {
      // Dark at the foot: the fire is at the top.
      float along = lookAlong(p.y, floorY, headY);
      float dark = along < 0.6 ? mix(0.55, 0.0, along / 0.6) : 0.0;
      picture = lookOver(picture, vec4(0.0, 0.0, 0.0, dark * opacity * lookFill(d)));
    }
    picture = lookOver(picture, lookPaint(lookLightInk(t, uLook[7].y), uLook[7].x * tip));
    float heldHeight = bar.y * reach;
    if (lookAccents() && heldHeight - height > 3.0) {
      float heldY = floorY + up * heldHeight;
      float held = lookFill(lookBox(p, vec2(left, heldY - 1.0), vec2(left + body, heldY + 1.0), 0.0));
      picture = lookOver(picture, lookPaint(lookLightInk(t, 0.7), 0.95 * held));
    }
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = lookStand(copy);
    if (stand.w >= 0.5) {
      picture = sparkCopy(p, stand, picture);
    }
  }
  return lookBloomPass() ? picture : lookBloomed(picture, uv);
}
`;

const step = (
  reading: ISceneReading,
  state: ISparkBarsState,
  input: IEngineLookInput,
): boolean => {
  const { bands, look, music, plot, colours } = reading;
  const row = layPieces(reading, state.row, MIN_PITCH);
  const falling = holdPeaks(
    state.peaks,
    row.levels,
    row.count,
    reading.deltaMs,
  );
  moveEmbers(reading, state);
  const data = sizeLookData(input, row.count, 1);
  for (let piece = 0; piece < row.count; piece += 1) {
    data[piece * 4] = row.levels[piece];
    data[piece * 4 + 1] = state.peaks.held[piece];
  }
  setLookVector(input, 6, row.pitch, row.body, row.count, 0);
  setLookVector(input, 7, tipAlpha(music.treble), tipWhiten(music.pulse), 0, 0);
  setLookStands(input, bands, standOf);
  // The embers in every copy's place: each copy's glows, then its cores.
  const glow = emberGlowAlpha(reading.glow);
  bands.forEach((band) => {
    const { floor, up, reach } = standOf(band);
    const span = {
      left: plot.left,
      right: plot.right,
      floor,
      head: floor + up * reach,
    };
    const placed: number[] = [];
    placeEmbers(state, floor, up, (x, y, size) => placed.push(x, y, size));
    for (let at = 0; at < placed.length; at += 3) {
      const t = figureInkAt(look.ink, span, placed[at], placed[at + 1]);
      pushSprite(
        input,
        placed[at],
        placed[at + 1],
        placed[at + 2] * 2.2,
        glow,
        lightRamp(colours, t, 0.2),
      );
    }
    for (let at = 0; at < placed.length; at += 3) {
      const t = figureInkAt(look.ink, span, placed[at], placed[at + 1]);
      pushRectSprite(
        input,
        placed[at],
        placed[at + 1],
        placed[at + 2],
        placed[at + 2],
        0.95,
        lightRamp(colours, t, 0.75),
      );
    }
  });
  input.bloom = sparkBloom(music.pulse, reading.glow, look.opacity);
  return state.embers.length > 0 || (falling && look.accents);
};

const sparkBarsLook: IEngineLook<ISparkBarsState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.sparkBars,
  step,
};

export default sparkBarsLook;
