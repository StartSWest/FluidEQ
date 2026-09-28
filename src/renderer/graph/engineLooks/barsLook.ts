/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisReading } from '../analysis/analysisFrame';
import {
  BARS_BEHIND,
  advanceBars,
  barsMoving,
  placeBar,
  type IBarView,
} from '../analysis/barRows';
import { ENERGY_BARS } from '../analysis/energyView';
import { NOTE_BARS, NOTE_RULE_ALPHA, noteMarks } from '../analysis/notesView';
import { RTA_BARS } from '../analysis/rtaView';
import { spectrumEnergy } from '../analysis/spectrumPaint';
import type { IEngineAnalysisLook } from './analysisLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * The bar views on the GPU — the third-octave analyser, the note spectrum
 * and the energy bands — each bar, its outline where the look is not filled,
 * and its cap (`analysis/barRows.ts`), from the rows that file lays out and
 * advances; the note spectrum's rule up from every C under them.
 *
 *   uLook[7]  how many bands, how wide a band's span, 1 on a split, the
 *             loudest cap (the heat palette's)
 *   uLook[8]  a cap's height, its alpha, how present the row behind is, how
 *             many rules
 *   uLook[9]  the front row's corner radius, the behind row's, a rule's alpha
 *   uLook[10] the front row's heat, the behind row's
 *   texel (2i, copy * 2 + r)      bar i of a row: left, right, its body's
 *                                 top and bottom — r 0 the front, 1 behind
 *   texel (2i + 1, copy * 2 + r)  its cap's top, and 1 where it has one
 *   texel (j, 4)                  rule j's column
 */

const RULES_ROW = 4;

const GLSL = `
// One row of bars and caps, in its copy's band.
vec4 barsRow(vec4 picture, vec2 p, int copy, int row, bool mate, float strength, float radius, float heat) {
  vec4 band = lookBand(copy);
  float presence = anOpacity(copy) * strength;
  int count = int(uLook[7].x + 0.5);
  int k = int(floor((p.x - uLook[1].x) / max(1e-3, uLook[7].y)));
  float body = 0.0;
  float cap = 0.0;
  for (int j = k - 2; j <= k + 2; j++) {
    if (j < 0 || j >= count) {
      continue;
    }
    vec4 bar = texelFetch(uLookData, ivec2(j * 2, row), 0);
    vec4 mark = texelFetch(uLookData, ivec2(j * 2 + 1, row), 0);
    if (bar.w > bar.z) {
      float d = lookBox(p, bar.xz, bar.yw, radius);
      body = max(body, lookFilled() ? lookFill(d) : lookStroke(d, anEdgeWidth()));
    }
    if (mark.y > 0.5) {
      cap = max(cap, lookFill(lookBox(p, vec2(bar.x, mark.x), vec2(bar.y, mark.x + uLook[8].x), 0.0)));
    }
  }
  if (lookFilled()) {
    picture = lookOver(picture, anPiecePaint(p, band, mate, uLook[7].w, anFillOpacity()) * presence * body);
  } else {
    picture = lookOver(picture, lookPaint(anEdgeInk(p, band, mate, heat), presence * body));
  }
  // The caps in white, because nothing else on the plot is.
  return lookOver(picture, lookPaint(vec3(1.0), presence * uLook[8].y * cap));
}

// A faint rule up the copy from each C, under the bars.
vec4 barsRules(vec4 picture, vec2 p, int copy) {
  int count = int(uLook[8].w + 0.5);
  if (count == 0) {
    return picture;
  }
  vec4 band = lookBand(copy);
  float px = lookPixel();
  float inside = clamp(0.5 + (p.y - band.x) / px, 0.0, 1.0) * clamp(0.5 + (band.y - p.y) / px, 0.0, 1.0);
  float rule = 0.0;
  for (int j = 0; j < 32; j++) {
    if (j >= count) {
      break;
    }
    float x = texelFetch(uLookData, ivec2(j, ${RULES_ROW}), 0).x;
    rule = max(rule, lookStroke(p.x - x, 1.0));
  }
  return lookOver(picture, lookPaint(vec3(1.0), anOpacity(copy) * uLook[9].z * rule * inside));
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  bool split = uLook[7].z > 0.5;
  for (int copy = 0; copy < 2; copy++) {
    if (lookBand(copy).w < 0.5) {
      continue;
    }
    picture = barsRules(picture, p, copy);
    if (split) {
      picture = barsRow(picture, p, copy, copy * 2 + 1, true, uLook[8].z, uLook[9].y, uLook[10].y);
    }
    picture = barsRow(picture, p, copy, copy * 2, false, 1.0, uLook[9].x, uLook[10].x);
  }
  return picture;
}
`;

/**
 * One of the three as the engine draws it: the view's own layout, and the
 * rules it stands on where it has any.
 */
const createBarsLook = (
  view: IBarView,
  rulesOf?: (reading: IAnalysisReading) => readonly number[],
): IEngineAnalysisLook => ({
  glsl: GLSL,
  step: (readings, state, input) => {
    const [first] = readings;
    const bars = advanceBars(first, state, view);
    const count = bars.rows[0].bands.length;
    const rules = rulesOf ? rulesOf(first) : [];
    const across = Math.max(count * 2, rules.length, 1);
    const data = sizeLookData(input, across, RULES_ROW + 1);
    data.fill(0);
    readings.forEach((reading, copy) => {
      bars.rows.forEach((row) => {
        const base = (copy * 2 + (row.mate ? 1 : 0)) * across;
        for (let index = 0; index < count; index += 1) {
          const { left, width } = row.columnAt(index);
          const { head, foot, capTop } = placeBar(
            reading.band,
            view,
            row.bands[index],
            row.hold[index],
          );
          const at = (base + index * 2) * 4;
          data.set(
            [
              left,
              left + width,
              Math.min(head, foot),
              Math.max(head, foot),
              capTop ?? 0,
              capTop === undefined ? 0 : 1,
              0,
              0,
            ],
            at,
          );
        }
      });
    });
    rules.forEach((x, index) => {
      data[(RULES_ROW * across + index) * 4] = x;
    });
    const [front, behind] = [...bars.rows].reverse();
    const { plot } = first;
    setLookVector(
      input,
      7,
      count,
      (plot.right - plot.left) / count,
      behind ? 1 : 0,
      bars.loudest,
    );
    setLookVector(
      input,
      8,
      view.capHeight,
      view.capAlpha,
      BARS_BEHIND,
      Math.min(32, rules.length),
    );
    setLookVector(
      input,
      9,
      view.radius(front.columnAt(0).width),
      behind ? view.radius(behind.columnAt(0).width) : 0,
      NOTE_RULE_ALPHA,
      0,
    );
    setLookVector(
      input,
      10,
      spectrumEnergy(front.bands),
      behind ? spectrumEnergy(behind.bands) : 0,
      0,
      0,
    );
    return barsMoving(bars);
  },
});

export const rtaLook = createBarsLook(RTA_BARS);

export const notesLook = createBarsLook(NOTE_BARS, (reading) =>
  noteMarks(reading).map(({ x }) => x),
);

export const energyLook = createBarsLook(ENERGY_BARS);
