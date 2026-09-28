/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  DRAWN_ECHOES,
  SAMPLES,
  echoWidth,
  readSpectrumWave,
  waveGlow,
  waveStand,
  waveWeight,
  type ISpectrumWaveState,
} from '../sceneViews/spectrumWave';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { setLookStands, setLookVector, sizeLookData } from './lookInput';

/**
 * SPECTRUM WAVE on the GPU: the 2D look's line of light — its glow, the line
 * and its white-hot core — the fill fading to the floor, the two echoes in
 * its wake and the held line (`sceneViews/spectrumWave.ts`), painted per
 * pixel from the line the 2D look's own function reads.
 *
 *   uLook[6] samples, the line's weight, its glow's light and width
 *   uLook[7] an echo's width, the two drawn echoes' light
 *   uLook[8], uLook[9] where each copy stands (`waveStand`)
 *   texel (i, 0)  sample i of the line and of its held line, 0..1
 *   texel (i, 1), (i, 2)  the drawn echoes at sample i, and 1 when there
 */

const GLSL = `
// A line through the samples of row 'row', at p.x: its height and slope.
vec2 waveAt(float x, int row, int channel) {
  float width = max(1.0, uLook[1].y - uLook[1].x);
  float samples = uLook[6].x;
  float at = clamp((x - uLook[1].x) / width, 0.0, 1.0) * samples;
  int i = int(min(floor(at), samples - 1.0));
  vec4 a = texelFetch(uLookData, ivec2(i, row), 0);
  vec4 b = texelFetch(uLookData, ivec2(i + 1, row), 0);
  float va = channel == 0 ? a.x : a.y;
  float vb = channel == 0 ? b.x : b.y;
  return vec2(mix(va, vb, at - float(i)), (vb - va) / (width / samples));
}

float waveDistance(vec2 p, vec4 stand, int row, int channel) {
  // Past either end, the distance to the end itself: the line's round cap.
  if (p.x < uLook[1].x || p.x > uLook[1].y) {
    float x = clamp(p.x, uLook[1].x, uLook[1].y);
    float end = stand.x + stand.y * waveAt(x, row, channel).x * stand.z;
    return length(p - vec2(x, end));
  }
  vec2 v = waveAt(p.x, row, channel);
  float y = stand.x + stand.y * v.x * stand.z;
  float slope = stand.y * v.y * stand.z;
  return abs(p.y - y) / sqrt(1.0 + slope * slope);
}

vec4 waveCopy(vec2 p, vec4 stand, vec4 picture) {
  float floorY = stand.x;
  float up = stand.y;
  float reach = stand.z;
  float headY = floorY + up * reach;
  float t = lookFigureT(p, floorY, headY);
  bool inside = p.x >= uLook[1].x && p.x <= uLook[1].y;
  float lineY = floorY + up * waveAt(p.x, 0, 0).x * reach;

  if (lookFilled() && inside) {
    // The fill, from the line to the floor, fading to nothing at the floor.
    float fill = clamp(min((p.y - lineY) * -up, (floorY - p.y) * -up) / lookPixel() + 0.5, 0.0, 1.0);
    picture = lookOver(picture, lookPaint(lookInk(t), lookOpacity() * 0.74 * fill));
    float along = lookAlong(p.y, headY, floorY);
    float erase = along < 0.45 ? mix(0.0, 0.35, along / 0.45) : mix(0.35, 0.95, (along - 0.45) / 0.55);
    picture *= 1.0 - erase * fill;
  }
  // The wake, then the line: its glow, itself, its core.
  for (int e = 1; e <= 2; e++) {
    if (texelFetch(uLookData, ivec2(0, e), 0).y < 0.5) {
      continue;
    }
    float d = waveDistance(p, stand, e, 0);
    float alpha = e == 1 ? uLook[7].y : uLook[7].z;
    picture = lookOver(picture, lookPaint(lookLightInk(t, 0.1), alpha * lookStroke(d, uLook[7].x)));
  }
  float d = waveDistance(p, stand, 0, 0);
  float weight = uLook[6].y;
  picture = lookOver(picture, lookPaint(lookInk(t), uLook[6].z * lookStroke(d, weight * uLook[6].w)));
  picture = lookOver(picture, lookPaint(lookLightInk(t, 0.1), lookStroke(d, weight)));
  picture = lookOver(picture, lookPaint(lookLightInk(t, 0.75), 0.85 * lookStroke(d, max(0.6, weight * 0.35))));
  if (lookAccents()) {
    // The held line, dashed three on, five off.
    float dash = mod(p.x - uLook[1].x, 8.0) < 3.0 ? 1.0 : 0.0;
    float held = waveDistance(p, stand, 0, 1);
    picture = lookOver(picture, lookPaint(lookLightInk(t, 0.5), 0.7 * dash * lookStroke(held, 1.2)));
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = lookStand(copy);
    if (stand.w >= 0.5) {
      picture = waveCopy(p, stand, picture);
    }
  }
  return picture;
}
`;

const step = (
  reading: ISceneReading,
  state: ISpectrumWaveState,
  input: IEngineLookInput,
): boolean => {
  const { bands, look, music } = reading;
  const moving = readSpectrumWave(reading, state);
  const across = SAMPLES + 1;
  const data = sizeLookData(input, across, 1 + DRAWN_ECHOES.length);
  data.fill(0);
  for (let sample = 0; sample < across; sample += 1) {
    data[sample * 4] = state.line[sample];
    data[sample * 4 + 1] = state.peaks.held[sample];
  }
  DRAWN_ECHOES.forEach(([age], index) => {
    const echo = state.echoes[age];
    if (!echo) {
      return;
    }
    const row = (1 + index) * across * 4;
    for (let sample = 0; sample < across; sample += 1) {
      data[row + sample * 4] = echo[sample];
      data[row + sample * 4 + 1] = 1;
    }
  });
  const light = waveGlow(music.pulse, reading.glow);
  setLookVector(
    input,
    6,
    SAMPLES,
    waveWeight(look.lineWidth, music.pulse),
    light.alpha,
    light.widen,
  );
  setLookVector(
    input,
    7,
    echoWidth(look.lineWidth),
    DRAWN_ECHOES[0][1],
    DRAWN_ECHOES[1][1],
    0,
  );
  setLookStands(input, bands, waveStand);
  input.bloom = 0;
  return moving;
};

const spectrumWaveLook: IEngineLook<ISpectrumWaveState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.spectrumWave,
  step,
};

export default spectrumWaveLook;
