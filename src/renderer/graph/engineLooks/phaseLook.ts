/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  PHASE_BAND_FILL,
  PHASE_BAND_RAMP,
  PHASE_LINE_WIDTH,
  PHASE_PIP_RADIUS,
  PHASE_RULES,
  PHASE_RULE_INK,
  PHASE_STEPS,
  PHASE_TROUBLE_INK,
  PHASE_ZERO_INK,
  advancePhase,
  phaseRow,
  phaseSteps,
} from '../analysis/phaseView';
import { cssInkGlsl } from './analysisGlsl';
import type { IEngineAnalysisLook } from './analysisLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * PHASE HISTORY on the GPU: the tinted half that cancels, the rules across
 * the strip, the width hanging off the correlation line, the line and the
 * pip at now (`analysis/phaseView.ts`), from the history that file writes.
 *
 *   uLook[6].w the strip's steps, in place of a spectrum's points
 *   uLook[7]  each copy's zero row, and the line's width
 *   uLook[8]  the first copy's rules, −1 to +1 without zero
 *   uLook[9]  the second copy's
 *   texel (i, copy)  step i: x, the correlation line's row, the width
 *                    band's far edge
 */

const f = (value: number) => value.toFixed(6);

const GLSL = `
const vec4 PHASE_TROUBLE = ${cssInkGlsl(PHASE_TROUBLE_INK)};
const vec4 PHASE_RULE = ${cssInkGlsl(PHASE_RULE_INK)};
const vec4 PHASE_ZERO = ${cssInkGlsl(PHASE_ZERO_INK)};

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  if (anPoints() < 2) {
    return picture;
  }
  int seg = anSegment(p.x);
  float across = step(uLook[1].x, p.x) * step(p.x, uLook[1].y);
  for (int copy = 0; copy < 2; copy++) {
    vec4 band = lookBand(copy);
    if (band.w < 0.5) {
      continue;
    }
    float presence = anOpacity(copy);
    float zero = copy == 0 ? uLook[7].x : uLook[7].y;
    float foot = anFoot(band);
    // The half that means trouble, marked out.
    float trouble = lookFill(lookBox(p, vec2(uLook[1].x, min(zero, foot)), vec2(uLook[1].y, max(zero, foot)), 0.0));
    picture = lookOver(picture, lookPaint(PHASE_TROUBLE.rgb, PHASE_TROUBLE.a * presence * trouble));
    vec4 rules = copy == 0 ? uLook[8] : uLook[9];
    float ruled = max(
      max(lookStroke(p.y - rules.x, 1.0), lookStroke(p.y - rules.y, 1.0)),
      max(max(lookStroke(p.y - rules.z, 1.0), lookStroke(p.y - rules.w, 1.0)), lookStroke(p.y - zero, 1.0))
    ) * across;
    picture = lookOver(picture, lookPaint(PHASE_RULE.rgb, PHASE_RULE.a * presence * ruled));
    picture = lookOver(picture, lookPaint(PHASE_ZERO.rgb, PHASE_ZERO.a * presence * lookStroke(p.y - zero, 1.0) * across));
    // The width, hanging off the line, and the line.
    vec3 d = anDistances(p, copy, seg, uLook[7].z * 0.5 + lookPixel());
    vec3 at = anCurvesAt(p.x, copy, seg);
    float widthBand = anRibbonCover(p, at.x, at.y, d.x, d.y);
    picture = lookOver(picture, lookPaint(anRamp(false, ${f(PHASE_BAND_RAMP)}), presence * anFillOpacity() * ${f(PHASE_BAND_FILL)} * widthBand));
    picture = lookOver(picture, lookPaint(anBeamInk(p, band, false), presence * lookStroke(d.x, uLook[7].z)));
    // Now, at the right-hand edge.
    float now = anPoint(anPoints() - 1, copy).y;
    float pip = lookFill(length(p - vec2(uLook[1].y - 1.0, now)) - ${f(PHASE_PIP_RADIUS)});
    picture = lookOver(picture, lookPaint(vec3(1.0), presence * pip));
  }
  return picture;
}
`;

const phaseLook: IEngineAnalysisLook = {
  glsl: GLSL,
  step: (readings, state, input) => {
    const [first] = readings;
    const moving = advancePhase(first, state);
    const data = sizeLookData(input, PHASE_STEPS, 2);
    const zeros = [0, 0];
    readings.forEach((reading, copy) => {
      const { xs, ys, edges } = phaseSteps(reading, state);
      for (let index = 0; index < PHASE_STEPS; index += 1) {
        const at = (copy * PHASE_STEPS + index) * 4;
        data[at] = xs[index];
        data[at + 1] = ys[index];
        data[at + 2] = edges[index];
        data[at + 3] = 0;
      }
      zeros[copy] = phaseRow(reading, 0);
      const rules = PHASE_RULES.filter((value) => value !== 0).map((value) =>
        phaseRow(reading, value),
      );
      setLookVector(input, 8 + copy, rules[0], rules[1], rules[2], rules[3]);
    });
    input.vectors[6 * 4 + 3] = PHASE_STEPS;
    setLookVector(
      input,
      7,
      zeros[0],
      zeros[1],
      Math.max(PHASE_LINE_WIDTH, first.edge.width),
      0,
    );
    return moving;
  },
};

export default phaseLook;
