/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  SAMPLES,
  SPARK_RADIUS,
  STRAND_COUNT,
  shapeSilk,
  silkStand,
  strandGlow,
  strandLoudness,
  strandWeight,
  traceStrand,
  type ISilkWavesState,
} from '../sceneViews/silkWaves';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import { pushSprite, setLookVector, sizeLookData } from './lookInput';

/**
 * SILK WAVES on the GPU: the 2D look's five strands of light, their sheer
 * ribbons, glows and bright edges, all added as light where they cross
 * (`sceneViews/silkWaves.ts`) — traced by the 2D look's own function and
 * painted per pixel from the traced points; the crest sparks as sprites.
 *
 *   uLook[6] .. uLook[10] strand s: its loudness, its line's weight
 *   uLook[11] the glow's light (with Opacity) and how much wider it is, and
 *             how many samples a strand has
 *   uLook[12], uLook[13] each copy's middle line and widest swing, present
 *   texel (i, copy * STRANDS + s) strand s of that copy at sample i: its
 *             crest and its echo, y in CSS pixels
 */

const GLSL = `
const int STRANDS = ${STRAND_COUNT};

vec3 silkInk(vec2 p, vec4 copy, float loudness, float whiten) {
  int mode = lookInkMode();
  if (mode == 0) {
    return lookLightInk(0.5, whiten);
  }
  if (mode == 3) {
    return lookLightInk(loudness, whiten);
  }
  if (mode == 1) {
    return lookLightInk((p.x - uLook[1].x) / max(1.0, uLook[1].y - uLook[1].x), whiten);
  }
  return lookLightInk(abs(p.y - copy.x) / max(1.0, copy.y), whiten);
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  float width = uLook[1].y - uLook[1].x;
  float along = (p.x - uLook[1].x) / max(1.0, width);
  if (along < 0.0 || along > 1.0) {
    return vec4(0.0);
  }
  float samples = uLook[11].z;
  float at = along * samples;
  int i = int(min(floor(at), samples - 1.0));
  float frac = at - float(i);
  float step = width / samples;
  float opacity = lookOpacity();
  vec4 light = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    vec4 stand = copy == 0 ? uLook[12] : uLook[13];
    if (stand.z < 0.5) {
      continue;
    }
    for (int s = 0; s < STRANDS; s++) {
      int row = copy * STRANDS + s;
      vec4 a = texelFetch(uLookData, ivec2(i, row), 0);
      vec4 b = texelFetch(uLookData, ivec2(i + 1, row), 0);
      float crest = mix(a.x, b.x, frac);
      float echo = mix(a.y, b.y, frac);
      float slope = (b.x - a.x) / step;
      float d = abs(p.y - crest) / sqrt(1.0 + slope * slope);
      vec4 strand = uLook[6 + s];
      float loudness = strand.x;
      float weight = strand.y;
      if (lookFilled()) {
        float lo = min(crest, echo);
        float hi = max(crest, echo);
        float ribbon = clamp(min(p.y - lo, hi - p.y) / lookPixel() + 0.5, 0.0, 1.0);
        light += lookPaint(silkInk(p, stand, loudness, 0.0), opacity * 0.24 * ribbon);
      }
      float glow = lookStroke(d, weight * uLook[11].y);
      light += lookPaint(silkInk(p, stand, loudness, 0.0), uLook[11].x * glow);
      float edge = lookStroke(d, weight);
      light += lookPaint(silkInk(p, stand, loudness, 0.25), 0.9 * edge);
    }
  }
  return min(light, vec4(1.0));
}
`;

const SPARK: readonly [number, number, number] = [1, 1, 1];

const step = (
  reading: ISceneReading,
  state: ISilkWavesState,
  input: IEngineLookInput,
): boolean => {
  const { music, look, bands } = reading;
  shapeSilk(reading, state);
  const across = SAMPLES + 1;
  const data = sizeLookData(input, across, 2 * STRAND_COUNT);
  data.fill(0);
  const { traced } = state;
  for (let strand = 0; strand < STRAND_COUNT; strand += 1) {
    const loudness = strandLoudness(strand, music);
    setLookVector(
      input,
      6 + strand,
      loudness,
      strandWeight(look.lineWidth, loudness),
      0,
      0,
    );
  }
  [0, 1].forEach((copy) => {
    const band = bands[copy];
    if (!band) {
      setLookVector(input, 12 + copy, 0, 1, 0, 0);
      return;
    }
    const { middle, swing } = silkStand(band);
    setLookVector(input, 12 + copy, middle, swing, 1, 0);
    for (let strand = 0; strand < STRAND_COUNT; strand += 1) {
      traceStrand(reading, band, state, strand, traced, (x, y) =>
        pushSprite(input, x, y, SPARK_RADIUS, 0.85, SPARK),
      );
      const row = (copy * STRAND_COUNT + strand) * across * 4;
      for (let sample = 0; sample < across; sample += 1) {
        data[row + sample * 4] = traced.crest[sample];
        data[row + sample * 4 + 1] = traced.echo[sample];
      }
    }
  });
  const light = strandGlow(reading.glow);
  setLookVector(input, 11, light.alpha * look.opacity, light.widen, SAMPLES, 0);
  input.bloom = 0;
  // The strands roll on the music's clock, which the listener keeps awake.
  return false;
};

const silkWavesLook: IEngineLook<ISilkWavesState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.silkWaves,
  step,
};

export default silkWavesLook;
