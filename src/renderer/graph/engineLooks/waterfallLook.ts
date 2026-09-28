/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseCssColour } from '../../utils/oklab';
import { floorInk } from '../../utils/windowInk';
import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  FRONT_FADE,
  WATERFALL_DEPTH,
  WIRE_ALPHA,
  WIRE_WIDTH,
  advanceWaterfall,
  frontGlowAlpha,
  skinAlpha,
  skinInk,
  waterfallPoints,
  waterfallSlice,
  waterfallStacks,
  wireIndices,
} from '../analysis/waterfallView';
import type { IEngineAnalysisLook } from './analysisLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * The WATERFALL on the GPU: each stack's slices back to front — the
 * wireframe's stretch to the slice behind, the skin that hides it, the lit
 * ridge, and under the front ridge its glow (`analysis/waterfallView.ts`).
 *
 * Painted front to back here instead, each layer under what is already in
 * front of it: a pixel is done once what covers it is solid, which on the
 * lower half of the plot is the front skin alone, and a pixel below a
 * slice's foot is below every slice behind it too — so a pixel reads a few
 * slices of the thirty-two, where the page's canvas filled and stroked every
 * one of them across the whole plot.
 *
 * Where each slice stands comes from the page's own `waterfallSlice`, read
 * for a band one pixel deep and scaled by each band here.
 *
 *   uLook[7]  points a slice, stacks, wireframe lines, the front glow's
 *             alpha
 *   uLook[8]  the window's floor colour, the skin's alpha
 *   uLook[9], uLook[10]   the first copy's stacks' bands
 *   uLook[11], uLook[12]  the second copy's
 *   uLook[13] 1 where stack 0 wears the other colours, the same for 1, a
 *             wire's alpha and width
 *   uLook[14] the front ridge's width
 *   uLook[15] the front glow's fade: its alpha and darkening at the crest,
 *             and at the foot
 *   texel (i, stack * DEPTH + age)  point i of the slice that old, .x
 *   texel (age * 3 + n, PARAM_ROW)  where that slice stands: n 0 how far
 *             its foot has receded, how tall a full reading is, how narrow,
 *             how faded; n 1 how much is left of it, its ramp position, each
 *             stack's tallest reading; n 2 its skin's alpha and darkening
 */

const DEPTH = WATERFALL_DEPTH;
const PARAM_ROW = DEPTH * 2;

/** A band one pixel deep, standing on its foot: the slice's proportions. */
const UNIT_BAND: IAnalysisBand = {
  top: 0,
  bottom: 1,
  flipped: false,
  opacity: 1,
};

const GLSL = `
const int DEPTH = ${DEPTH};
const int PARAM_ROW = ${PARAM_ROW};

vec4 wfParam(int age, int which) {
  return texelFetch(uLookData, ivec2(age * 3 + which, PARAM_ROW), 0);
}

float wfLevel(int stack, int age, int index) {
  return texelFetch(uLookData, ivec2(index, stack * DEPTH + age), 0).x;
}

// A layer painted before what is already there, so behind it.
vec4 wfUnder(vec4 front, vec4 layer) {
  return front + layer * (1.0 - front.a);
}

// Point k of the slice that old, in the stack's band.
vec2 wfPoint(vec4 band, int stack, int age, vec4 at, int k) {
  float left = uLook[1].x;
  float width = uLook[1].y - left;
  float middle = left + width * 0.5;
  int points = int(uLook[7].x + 0.5);
  float across = points == 1 ? 0.5 : float(k) / float(points - 1);
  float depth = band.y - band.x;
  float level = clamp(wfLevel(stack, age, k), 0.0, 1.0);
  return vec2(
    middle + (left + across * width - middle) * at.z,
    anFoot(band) + anRise(band) * depth * (at.x + level * at.y)
  );
}

vec4 wfStack(vec2 p, vec4 band, int stack, bool mate, float presence) {
  int points = int(uLook[7].x + 0.5);
  float lines = uLook[7].z;
  float depth = band.y - band.x;
  float rise = anRise(band);
  float foot = anFoot(band);
  float height = (p.y - foot) * rise;
  float left = uLook[1].x;
  float width = uLook[1].y - left;
  float middle = left + width * 0.5;
  float margin = max(uLook[14].x, 1.0) * 0.5 + lookPixel();
  bool rainbow = anPalette() == 1;
  vec3 floorInk = uLook[8].rgb;
  vec4 acc = vec4(0.0);
  for (int age = 0; age < DEPTH; age++) {
    vec4 at = wfParam(age, 0);
    vec4 more = wfParam(age, 1);
    float baseH = at.x * depth;
    // Below this slice's foot is below every slice behind it too.
    if (height < baseH - margin) {
      break;
    }
    float crestH = baseH + (stack == 0 ? more.z : more.w) * at.y * depth;
    float behindCrestH = crestH;
    vec4 behind = at;
    if (age < DEPTH - 1) {
      behind = wfParam(age + 1, 0);
      vec4 behindMore = wfParam(age + 1, 1);
      behindCrestH = behind.x * depth + (stack == 0 ? behindMore.z : behindMore.w) * behind.y * depth;
    }
    if (height > max(crestH, behindCrestH) + margin) {
      continue;
    }
    float xl = middle + (left - middle) * at.z;
    float xr = middle + (left + width - middle) * at.z;
    float dx = (xr - xl) / float(max(1, points - 1));
    float f = (p.x - xl) / max(1e-3, dx);
    int k = clamp(int(floor(f)), 0, max(0, points - 2));
    float stroke = age == 0 ? uLook[14].x : 1.0;
    int span = min(8, int(ceil((stroke * 0.5 + lookPixel()) / max(1e-3, dx))) + 1);
    float d = 1e5;
    for (int j = k - span; j <= k + span; j++) {
      if (j < 0 || j > points - 2) {
        continue;
      }
      d = min(d, anToSegment(p, wfPoint(band, stack, age, at, j), wfPoint(band, stack, age, at, j + 1)));
    }
    vec2 from = wfPoint(band, stack, age, at, k);
    vec2 to = wfPoint(band, stack, age, at, k + 1);
    float ridgeY = mix(from.y, to.y, clamp((p.x - from.x) / max(1e-3, to.x - from.x), 0.0, 1.0));
    float baseY = foot + rise * baseH;
    // The skin: between the ridge and the slice's foot, across its width.
    float px = lookPixel();
    bool inside = (p.y - ridgeY) * rise <= 0.0;
    float skin = min(
      min(clamp(0.5 + (inside ? d : -d) / px, 0.0, 1.0), clamp(0.5 + (p.y - baseY) * rise / px, 0.0, 1.0)),
      clamp(0.5 + (p.x - xl) / px, 0.0, 1.0) * clamp(0.5 + (xr - p.x) / px, 0.0, 1.0)
    );
    vec3 ink = rainbow ? anRamp(mate, anAcross(p.x)) : anRamp(mate, more.y);
    float inkAlpha = rainbow ? 1.0 : 0.9;
    // The ridge, lit.
    vec3 ridgeInk = age == 0 && anEuphoria() ? anEdgeColour() : ink;
    float ridgeAlpha = age == 0 && anEuphoria() ? 1.0 : inkAlpha;
    acc = wfUnder(acc, lookPaint(ridgeInk, presence * at.w * ridgeAlpha * lookStroke(d, stroke)));
    if (age == 0 && crestH > baseH) {
      // The skin under the front ridge, lit in its colour and darkening to
      // its foot: the fade over the glow, so behind it here.
      float crestY = foot + rise * crestH;
      float u = lookAlong(p.y, crestY, baseY);
      vec4 fade = uLook[15];
      acc = wfUnder(acc, lookPaint(floorInk * (1.0 - mix(fade.y, fade.w, u)), mix(fade.x, fade.z, u) * presence * skin));
      acc = wfUnder(acc, lookPaint(ink, inkAlpha * presence * uLook[7].w * skin));
    }
    // The skin that hides every slice behind this one.
    vec4 skinned = wfParam(age, 2);
    acc = wfUnder(acc, lookPaint(floorInk * (1.0 - skinned.y), skinned.x * presence * uLook[8].w * more.x * skin));
    // The wireframe's stretch from the slice behind to this one.
    if (age < DEPTH - 1 && lines > 0.0) {
      float line = clamp(f / float(max(1, points - 1)), 0.0, 1.0) * lines;
      float wire = 1e5;
      for (int l = int(floor(line)) - 1; l <= int(floor(line)) + 2; l++) {
        if (l < 0 || float(l) > lines) {
          continue;
        }
        int index = int(floor(float(l) * float(points - 1) / lines + 0.5));
        wire = min(wire, anToSegment(p, wfPoint(band, stack, age + 1, behind, index), wfPoint(band, stack, age, at, index)));
      }
      acc = wfUnder(acc, lookPaint(ink, presence * at.w * uLook[13].z * inkAlpha * lookStroke(wire, uLook[13].w)));
    }
    if (acc.a > 0.996) {
      break;
    }
  }
  return acc;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  int stacks = int(uLook[7].y + 0.5);
  for (int copy = 0; copy < 2; copy++) {
    for (int stack = 0; stack < 2; stack++) {
      if (stack >= stacks) {
        break;
      }
      vec4 band = uLook[9 + copy * 2 + stack];
      if (band.w < 0.5) {
        continue;
      }
      bool mate = (stack == 0 ? uLook[13].x : uLook[13].y) > 0.5;
      picture = lookOver(picture, wfStack(p, band, stack, mate, anOpacity(copy)));
    }
  }
  return picture;
}
`;

/** The window's floor, as the skin and the glow's fade are painted in it. */
const floorRgb = (): readonly number[] =>
  parseCssColour(floorInk(1, 0))?.rgb ?? [0, 0, 0];

const waterfallLook: IEngineAnalysisLook = {
  glsl: GLSL,
  step: (readings, state, input) => {
    const [first] = readings;
    const { roll, moving } = advanceWaterfall(first, state);
    const points = waterfallPoints(first);
    const stacks = waterfallStacks(first, state);
    const across = Math.max(points, DEPTH * 3);
    const data = sizeLookData(input, across, PARAM_ROW + 1);
    stacks.forEach(({ slices }, stack) => {
      for (let age = 0; age < DEPTH; age += 1) {
        const slice = slices[(state.sliceHead - age + DEPTH * 2) % DEPTH];
        const row = (stack * DEPTH + age) * across;
        for (let index = 0; index < points; index += 1) {
          data[(row + index) * 4] = slice[index];
        }
      }
    });
    for (let age = 0; age < DEPTH; age += 1) {
      const slice = waterfallSlice(UNIT_BAND, age, roll);
      const crests = stacks.map(({ slices }) => {
        const values = slices[(state.sliceHead - age + DEPTH * 2) % DEPTH];
        let tallest = 0;
        for (let index = 0; index < points; index += 1) {
          tallest = Math.max(tallest, Math.min(1, values[index]));
        }
        return tallest;
      });
      const [skin, darker] = skinInk(slice.into);
      data.set(
        [
          1 - slice.baseline,
          slice.reach,
          slice.shrink,
          slice.faded,
          slice.leaving,
          slice.ramp,
          crests[0] ?? 0,
          crests[1] ?? 0,
          skin,
          darker,
          0,
          0,
        ],
        (PARAM_ROW * across + age * 3) * 4,
      );
    }
    const { tuning, edge } = first;
    setLookVector(
      input,
      7,
      points,
      stacks.length,
      wireIndices(points).length - 1,
      frontGlowAlpha(tuning.fillOpacity),
    );
    const [red, green, blue] = floorRgb();
    setLookVector(input, 8, red, green, blue, skinAlpha(tuning.fillOpacity));
    readings.forEach((reading, copy) => {
      const copyStacks = waterfallStacks(reading, state);
      [0, 1].forEach((stack) => {
        const band = copyStacks[stack]?.band;
        setLookVector(
          input,
          9 + copy * 2 + stack,
          band?.top ?? 0,
          band?.bottom ?? 0,
          band?.flipped ? 1 : 0,
          band ? 1 : 0,
        );
      });
    });
    setLookVector(
      input,
      13,
      stacks[0]?.mate ? 1 : 0,
      stacks[1]?.mate ? 1 : 0,
      WIRE_ALPHA,
      WIRE_WIDTH,
    );
    setLookVector(input, 14, Math.max(1.4, edge.width), 0, 0, 0);
    const [[crestAlpha, crestDarker], [footAlpha, footDarker]] = FRONT_FADE;
    setLookVector(input, 15, crestAlpha, crestDarker, footAlpha, footDarker);
    return moving;
  },
};

export default waterfallLook;
