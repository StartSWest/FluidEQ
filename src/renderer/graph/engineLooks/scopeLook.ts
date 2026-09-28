/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  SCOPE_BEAM,
  SCOPE_EDGE_DASH,
  SCOPE_EDGE_INK,
  SCOPE_HINT_ALPHA,
  SCOPE_HINT_RAMP,
  SCOPE_HINT_WIDTH,
  SCOPE_RULE_INK,
  scopeHint,
  scopeTraces,
} from '../analysis/scopeView';
import { cssInkGlsl } from './analysisGlsl';
import type { IEngineAnalysisLook } from './analysisLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * The OSCILLOSCOPE on the GPU: the rule silence sits on, the two dashed
 * rows full scale reaches, and each channel's beam in its three passes
 * (`analysis/scopeView.ts`), from the triggered samples that file finds.
 * Before any samples are measured, the two rows the spectrum's level
 * reaches.
 *
 *   uLook[7]  how many traces, and the hint's reach from the middle —
 *             below zero where there is no hint to draw
 *   uLook[8]  each trace's presence, and 1 where it wears the other
 *             channel's colours
 *   uLook[9]  the beam's three widths, glow to core
 *   uLook[10] their alphas
 *   uLook[11] each trace's pixels between two drawn points, and how many
 *             points it draws
 *   texel (j, t)  trace t's drawn points 4j to 4j + 3, as samples
 */

const f = (value: number) => value.toFixed(6);

const GLSL = `
const vec4 SCOPE_RULE = ${cssInkGlsl(SCOPE_RULE_INK)};
const vec4 SCOPE_EDGE = ${cssInkGlsl(SCOPE_EDGE_INK)};

float scopeSample(int trace, int k) {
  vec4 four = texelFetch(uLookData, ivec2(k / 4, trace), 0);
  int within = k - (k / 4) * 4;
  return within == 0 ? four.x : (within == 1 ? four.y : (within == 2 ? four.z : four.w));
}

// A trace's spacing between drawn points, and how many it draws.
vec2 scopeSpacing(int trace) {
  return trace == 0 ? uLook[11].xy : uLook[11].zw;
}

vec2 scopePoint(vec4 band, int trace, int k) {
  float middle = (band.x + band.y) * 0.5;
  float reach = (band.y - band.x) * 0.5;
  return vec2(uLook[1].x + float(k) * scopeSpacing(trace).x, middle - clamp(scopeSample(trace, k), -1.0, 1.0) * reach);
}

// How far p is from a trace's line through its drawn points.
float scopeDistance(vec2 p, vec4 band, int trace, float reach) {
  vec2 spacing = scopeSpacing(trace);
  int points = int(spacing.y + 0.5);
  if (points < 2) {
    return 1e5;
  }
  float pitch = max(1e-3, spacing.x);
  int at = int(floor((p.x - uLook[1].x) / pitch));
  int span = min(64, int(ceil(reach / pitch)) + 1);
  float best = 1e5;
  int first = clamp(at - span, 0, max(0, points - 2));
  int last = clamp(at + span, 0, max(0, points - 2));
  vec2 a = scopePoint(band, trace, first);
  for (int k = first; k <= last; k++) {
    vec2 b = scopePoint(band, trace, k + 1);
    best = min(best, anToSegment(p, a, b));
    a = b;
  }
  return best;
}

// A rule across the plot at row y, dashed on and off along it.
float scopeRule(vec2 p, float y, float on, float off) {
  float along = p.x - uLook[1].x;
  float dashed = off > 0.0 ? step(mod(along, on + off), on) : 1.0;
  float inside = step(uLook[1].x, p.x) * step(p.x, uLook[1].y);
  return lookStroke(p.y - y, 1.0) * dashed * inside;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  int traces = int(uLook[7].x + 0.5);
  for (int copy = 0; copy < 2; copy++) {
    vec4 band = lookBand(copy);
    if (band.w < 0.5) {
      continue;
    }
    float presence = anOpacity(copy);
    float middle = (band.x + band.y) * 0.5;
    picture = lookOver(picture, lookPaint(SCOPE_RULE.rgb, SCOPE_RULE.a * presence * scopeRule(p, middle, 1.0, 0.0)));
    float edges = max(scopeRule(p, band.x, ${f(SCOPE_EDGE_DASH[0])}, ${f(SCOPE_EDGE_DASH[1])}), scopeRule(p, band.y, ${f(SCOPE_EDGE_DASH[0])}, ${f(SCOPE_EDGE_DASH[1])}));
    picture = lookOver(picture, lookPaint(SCOPE_EDGE.rgb, SCOPE_EDGE.a * presence * edges));
    if (traces == 0) {
      float hint = uLook[7].y;
      if (hint < 0.0) {
        continue;
      }
      float rows = max(
        lookStroke(p.y - (middle - hint), ${f(SCOPE_HINT_WIDTH)}),
        lookStroke(p.y - (middle + hint), ${f(SCOPE_HINT_WIDTH)})
      ) * step(uLook[1].x, p.x) * step(p.x, uLook[1].y);
      picture = lookOver(picture, lookPaint(anRamp(false, ${f(SCOPE_HINT_RAMP)}), presence * ${f(SCOPE_HINT_ALPHA)} * rows));
      continue;
    }
    for (int trace = 0; trace < 2; trace++) {
      if (trace >= traces) {
        break;
      }
      float strength = trace == 0 ? uLook[8].x : uLook[8].y;
      bool mate = (trace == 0 ? uLook[8].z : uLook[8].w) > 0.5;
      float d = scopeDistance(p, band, trace, uLook[9].x * 0.5 + lookPixel());
      vec3 ink = anBeamInk(p, band, mate);
      for (int pass = 0; pass < 3; pass++) {
        float width = pass == 0 ? uLook[9].x : (pass == 1 ? uLook[9].y : uLook[9].z);
        float alpha = pass == 0 ? uLook[10].x : (pass == 1 ? uLook[10].y : uLook[10].z);
        picture = lookOver(picture, lookPaint(ink, presence * strength * alpha * lookStroke(d, width)));
      }
    }
  }
  return picture;
}
`;

const scopeLook: IEngineAnalysisLook = {
  glsl: GLSL,
  step: (readings, state, input) => {
    const [first] = readings;
    const { plot, edge } = first;
    const traces = scopeTraces(first, state);
    const [glow, body, core] = SCOPE_BEAM;
    setLookVector(
      input,
      9,
      glow.width(edge.width),
      body.width(edge.width),
      core.width(edge.width),
      0,
    );
    setLookVector(input, 10, glow.alpha, body.alpha, core.alpha, 0);
    if (!traces) {
      const { loudest, reach } = scopeHint(first);
      sizeLookData(input, 1, 1);
      setLookVector(input, 7, 0, reach, 0, 0);
      setLookVector(input, 8, 0, 0, 0, 0);
      return loudest > 0.002;
    }
    // Each trace starts at its own crossing, so each has its own count of
    // samples and its own spacing between the points it draws.
    const points = traces.map((trace) => Math.ceil(trace.count / trace.step));
    const spacing = traces.map(
      (trace) =>
        ((plot.right - plot.left) * trace.step) / Math.max(1, trace.count - 1),
    );
    const across = Math.max(1, Math.ceil(Math.max(...points) / 4));
    const data = sizeLookData(input, across, traces.length);
    data.fill(0);
    traces.forEach((trace, row) => {
      for (let point = 0; point < points[row]; point += 1) {
        data[row * across * 4 + point] =
          trace.samples[trace.start + point * trace.step];
      }
    });
    setLookVector(input, 7, traces.length, -1, 0, 0);
    setLookVector(
      input,
      11,
      spacing[0],
      points[0],
      spacing[1] ?? 0,
      points[1] ?? 0,
    );
    setLookVector(
      input,
      8,
      traces[0].strength,
      traces[1]?.strength ?? 0,
      traces[0].mate ? 1 : 0,
      traces[1]?.mate ? 1 : 0,
    );
    // The samples move whenever there is sound, so the loop runs while the
    // capture does; it settles with the capture, like every other view.
    return first.playing;
  },
};

export default scopeLook;
