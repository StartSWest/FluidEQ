/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  BAR_MARK_ALPHA,
  BAR_TICKS,
  BAR_TICK_ALPHA,
  BAR_TRACK_INK,
  DIAL_ARM_DASH,
  DIAL_ARM_INK,
  DIAL_RINGS,
  DIAL_RING_INK,
  DIAL_UPRIGHT_INK,
  DIAL_WELL,
  FAINT_INK,
  SCALE_BRACKET_INK,
  SCALE_MARKS,
  SCALE_TRACK_INK,
  SCALE_TROUBLE_INK,
  TRACE_PASSES,
  WIDTH_FILL,
  layoutPanel,
  tracePoints,
  type IPanel,
} from '../analysis/loudnessPanel';
import { advanceLoudness } from '../analysis/loudnessView';
import { levelOfDb } from '../analysis/stereoReading';
import { cssInkGlsl } from './analysisGlsl';
import type { IEngineAnalysisLook } from './analysisLookTypes';
import {
  LINE_FLOATS,
  MAX_LINE_POINTS,
  type IEngineLookInput,
} from './engineLookInput';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * STEREO & LOUDNESS on the GPU: the goniometer's well, rings, arms and
 * cloud, the correlation scale with its bracket and needle, the two level
 * bars and the width bar (`analysis/loudnessPanel.ts`), laid out by that
 * file's own `layoutPanel` and advanced by `advanceLoudness`; the letters
 * and numbers stay on the page (`paintLoudnessWords`). The cloud is drawn
 * as free lines (`IEngineLookLines`), a mirrored copy's already reflected.
 *
 *   uLook[7]  the needle, where it has been lately (from, to), the width
 *   uLook[8]  the two levels, and their peak marks
 *   texel (0..3, copy)  that copy's panel: the dial's middle and radius, the
 *             scale's box, the bars' left, width and height, the three
 *             rows, and 1 where the panel fits
 */

const f = (value: number) => value.toFixed(6);

/** The dial's well, from its middle to its rim, as a GLSL function. */
const wellGlsl = (): string => {
  const inks = DIAL_WELL.map(([at, ink]) => [at, cssInkGlsl(ink)] as const);
  const between = inks.slice(1).map(([at, ink], index) => {
    const [fromAt, fromInk] = inks[index];
    return `  if (u <= ${f(at)}) {
    float t = clamp((u - ${f(fromAt)}) / ${f(Math.max(1e-6, at - fromAt))}, 0.0, 1.0);
    vec4 a = ${fromInk};
    vec4 b = ${ink};
    return vec4(mix(a.rgb, b.rgb, t), mix(a.a, b.a, t));
  }`;
  });
  return `vec4 loudnessWell(float u) {
${between.join('\n')}
  return ${inks[inks.length - 1][1]};
}`;
};

const TICKS = BAR_TICKS.map((db) => f(levelOfDb(db)));

const GLSL = `
uniform sampler2D uLookLines;

const float RING_ALPHA = ${f(DIAL_RING_INK.alpha)};
const vec4 ARM = ${cssInkGlsl(DIAL_ARM_INK)};
const vec4 UPRIGHT = ${cssInkGlsl(DIAL_UPRIGHT_INK)};
const vec4 TRACK = ${cssInkGlsl(SCALE_TRACK_INK)};
const vec4 TROUBLE = ${cssInkGlsl(SCALE_TROUBLE_INK)};
const vec4 BRACKET = ${cssInkGlsl(SCALE_BRACKET_INK)};
const vec4 FAINT = ${cssInkGlsl(FAINT_INK)};
const vec4 BAR_TRACK = ${cssInkGlsl(BAR_TRACK_INK.ink)};

${wellGlsl()}

float loudnessTicks(float x, float left, float width) {
  float ticks[${TICKS.length}] = float[${TICKS.length}](${TICKS.join(', ')});
  float best = 1e5;
  for (int i = 0; i < ${TICKS.length}; i++) {
    best = min(best, abs(x - (left + width * ticks[i])));
  }
  return best;
}

// A short vertical mark from y0 to y1 at distance dx across.
float loudnessMark(vec2 q, float dx, float y0, float y1) {
  float inside = clamp(0.5 + (q.y - y0) / lookPixel(), 0.0, 1.0) * clamp(0.5 + (y1 - q.y) / lookPixel(), 0.0, 1.0);
  return lookStroke(dx, 1.0) * inside;
}

// A dashed line from a to b, dashed from a.
float loudnessDashed(vec2 q, vec2 a, vec2 b, float on, float off) {
  vec2 along = b - a;
  float span = length(along);
  float t = clamp(dot(q - a, along) / max(1e-6, span * span), 0.0, 1.0);
  float d = length(q - (a + along * t));
  return lookStroke(d, 1.0) * step(mod(t * span, on + off), on);
}

vec4 loudnessCopy(vec4 picture, vec2 p, vec2 uv, int copy) {
  vec4 t0 = texelFetch(uLookData, ivec2(0, copy), 0);
  vec4 t1 = texelFetch(uLookData, ivec2(1, copy), 0);
  vec4 t2 = texelFetch(uLookData, ivec2(2, copy), 0);
  vec4 t3 = texelFetch(uLookData, ivec2(3, copy), 0);
  if (t3.y < 0.5) {
    return picture;
  }
  vec4 band = lookBand(copy);
  float presence = anOpacity(copy);
  // The panel is laid out once, downward, and a mirrored copy is it reflected.
  vec2 q = vec2(p.x, band.z > 0.5 ? band.x + band.y - p.y : p.y);
  vec2 dial = t0.xy;
  float radius = t0.z;
  vec2 fromMiddle = q - dial;
  float fromCentre = length(fromMiddle);

  // The well, the rings, the arms and the upright.
  vec4 well = loudnessWell(fromCentre / max(1e-3, radius));
  picture = lookOver(picture, lookPaint(well.rgb, well.a * presence * lookFill(fromCentre - radius)));
  float rings = 0.0;
  ${DIAL_RINGS.map((share) => `rings = max(rings, lookStroke(fromCentre - radius * ${f(share)}, 1.0));`).join('\n  ')}
  picture = lookOver(picture, lookPaint(anRamp(false, ${f(DIAL_RING_INK.ramp)}), RING_ALPHA * presence * rings));
  float reach = radius * ${f(Math.SQRT1_2)};
  float arms = max(
    loudnessDashed(q, dial + vec2(-reach, reach), dial + vec2(reach, -reach), ${f(DIAL_ARM_DASH[0])}, ${f(DIAL_ARM_DASH[1])}),
    loudnessDashed(q, dial + vec2(reach, reach), dial + vec2(-reach, -reach), ${f(DIAL_ARM_DASH[0])}, ${f(DIAL_ARM_DASH[1])})
  );
  picture = lookOver(picture, lookPaint(ARM.rgb, ARM.a * presence * arms));
  float upright = loudnessMark(q, q.x - dial.x, dial.y - radius, dial.y + radius);
  picture = lookOver(picture, lookPaint(UPRIGHT.rgb, UPRIGHT.a * presence * upright));

  // The cloud, in its three passes.
  vec3 cover = texture(uLookLines, uv).rgb;
  ${TRACE_PASSES.map(
    ({ ramp, alpha }, pass) =>
      `picture = lookOver(picture, lookPaint(anRamp(false, ${f(ramp)}), ${f(alpha)} * presence * cover[${pass}]));`,
  ).join('\n  ')}

  // The correlation scale: its track, the half that cancels, where the
  // needle has been lately, its marks and the needle.
  float scaleLeft = t0.w;
  float scaleWidth = t1.x;
  float scaleTop = t1.y;
  float scaleHeight = t1.z;
  float rounding = scaleHeight * 0.5;
  float zero = scaleLeft + 0.5 * scaleWidth;
  vec2 scaleLo = vec2(scaleLeft, scaleTop);
  picture = lookOver(picture, lookPaint(TRACK.rgb, TRACK.a * presence * lookFill(lookBox(q, scaleLo, scaleLo + vec2(scaleWidth, scaleHeight), rounding))));
  picture = lookOver(picture, lookPaint(TROUBLE.rgb, TROUBLE.a * presence * lookFill(lookBox(q, scaleLo, vec2(zero, scaleTop + scaleHeight), rounding))));
  float from = scaleLeft + (uLook[7].y + 1.0) * 0.5 * scaleWidth;
  float to = scaleLeft + (uLook[7].z + 1.0) * 0.5 * scaleWidth;
  picture = lookOver(picture, lookPaint(BRACKET.rgb, BRACKET.a * presence * lookFill(lookBox(q, vec2(from, scaleTop), vec2(from + max(1.0, to - from), scaleTop + scaleHeight), 0.0))));
  float marks = 0.0;
  ${SCALE_MARKS.map((value) => `marks = max(marks, loudnessMark(q, q.x - (scaleLeft + ${f((value + 1) / 2)} * scaleWidth), scaleTop + scaleHeight + 1.0, scaleTop + scaleHeight + 4.0));`).join('\n  ')}
  picture = lookOver(picture, lookPaint(FAINT.rgb, FAINT.a * presence * marks));
  float needle = scaleLeft + (uLook[7].x + 1.0) * 0.5 * scaleWidth;
  picture = lookOver(picture, lookPaint(vec3(1.0), presence * lookFill(lookBox(q, vec2(needle - 1.5, scaleTop - 2.0), vec2(needle + 1.5, scaleTop + scaleHeight + 2.0), 1.5))));

  // The two level bars, each with its peak mark and the scale under it.
  float barLeft = t1.w;
  float barWidth = t2.x;
  float barHeight = t2.y;
  for (int row = 0; row < 2; row++) {
    float top = row == 0 ? t2.z : t2.w;
    vec2 lo = vec2(barLeft, top);
    picture = lookOver(picture, lookPaint(BAR_TRACK.rgb, BAR_TRACK.a * ${f(BAR_TRACK_INK.alpha)} * presence * lookFill(lookBox(q, lo, lo + vec2(barWidth, barHeight), barHeight * 0.5))));
    float level = clamp(row == 0 ? uLook[8].x : uLook[8].y, 0.0, 1.0);
    float fill = lookFill(lookBox(q, lo, lo + vec2(max(barHeight, barWidth * level), barHeight), barHeight * 0.5));
    vec3 ink = anRamp(row == 1, clamp((q.x - barLeft) / max(1.0, barWidth), 0.0, 1.0));
    picture = lookOver(picture, lookPaint(ink, anFillOpacity() * presence * fill));
    float mark = row == 0 ? uLook[8].z : uLook[8].w;
    if (mark > 0.004) {
      float at = barLeft + barWidth * clamp(mark, 0.0, 1.0);
      picture = lookOver(picture, lookPaint(vec3(1.0), ${f(BAR_MARK_ALPHA)} * presence * lookFill(lookBox(q, vec2(at - 1.0, top), vec2(at + 1.0, top + barHeight), 0.0))));
    }
    float ticks = loudnessMark(q, loudnessTicks(q.x, barLeft, barWidth), top + barHeight + 1.0, top + barHeight + 3.0);
    picture = lookOver(picture, lookPaint(FAINT.rgb, FAINT.a * ${f(BAR_TICK_ALPHA)} * presence * ticks));
  }

  // The width bar.
  float top = t3.x;
  vec2 lo = vec2(barLeft, top);
  float thin = barHeight * 0.6;
  picture = lookOver(picture, lookPaint(BAR_TRACK.rgb, BAR_TRACK.a * ${f(BAR_TRACK_INK.alpha)} * presence * lookFill(lookBox(q, lo, lo + vec2(barWidth, thin), thin * 0.5))));
  float wide = lookFill(lookBox(q, lo, lo + vec2(max(thin, barWidth * clamp(uLook[7].w, 0.0, 1.0)), thin), thin * 0.5));
  return lookOver(picture, lookPaint(anRamp(false, ${f(WIDTH_FILL.ramp)}), ${f(WIDTH_FILL.alpha)} * presence * wide));
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    if (lookBand(copy).w > 0.5) {
      picture = loudnessCopy(picture, p, uv, copy);
    }
  }
  return picture;
}
`;

/** The cloud's points for every copy, each copy's reflected and apart. */
const writeLines = (
  input: IEngineLookInput,
  copies: readonly { panel: IPanel; flip?: number }[],
  scope: readonly [Float32Array, Float32Array] | undefined,
  level: number,
): void => {
  const floats = MAX_LINE_POINTS * LINE_FLOATS;
  const points =
    input.lines && input.lines.points.length === floats
      ? input.lines.points
      : new Float32Array(floats);
  let count = 0;
  copies.forEach(({ panel, flip }) => {
    let first = true;
    tracePoints(panel, scope, level, (x, y) => {
      if (count >= MAX_LINE_POINTS) {
        return;
      }
      const at = count * LINE_FLOATS;
      points[at] = x;
      points[at + 1] = flip === undefined ? y : flip - y;
      points[at + 2] = first ? 1 : 0;
      points[at + 3] = 0;
      first = false;
      count += 1;
    });
  });
  const [glow, body, core] = TRACE_PASSES;
  input.lines = {
    points,
    count,
    widths: [glow.width, body.width, core.width],
  };
};

const loudnessLook: IEngineAnalysisLook = {
  glsl: GLSL,
  step: (readings, state, input) => {
    const [first] = readings;
    // A box too small to hold a legible instrument draws nothing and
    // advances nothing, as on the page.
    if (!layoutPanel(first)) {
      sizeLookData(input, 4, 2).fill(0);
      input.lines = undefined;
      return false;
    }
    const moving = advanceLoudness(first, state);
    const data = sizeLookData(input, 4, 2);
    data.fill(0);
    const drawn: { panel: IPanel; flip?: number }[] = [];
    readings.forEach((reading, copy) => {
      const panel = layoutPanel(reading);
      if (!panel) {
        return;
      }
      const { band } = reading;
      drawn.push({
        panel,
        flip: band.flipped ? band.top + band.bottom : undefined,
      });
      data.set(
        [
          panel.dialX,
          panel.dialY,
          panel.radius,
          panel.scaleLeft,
          panel.scaleWidth,
          panel.scaleTop,
          panel.scaleHeight,
          panel.barLeft,
          panel.barWidth,
          panel.barHeight,
          panel.rows[0],
          panel.rows[1],
          panel.rows[2],
          1,
          0,
          0,
        ],
        copy * 16,
      );
    });
    writeLines(input, drawn, first.scope, state.meters[0]);
    setLookVector(
      input,
      7,
      state.correlation,
      state.meterPeaks[0],
      state.meterPeaks[1],
      state.loudness,
    );
    setLookVector(
      input,
      8,
      state.meters[0],
      state.meters[1],
      state.crest[0],
      state.crest[1],
    );
    return moving;
  },
};

export default loudnessLook;
