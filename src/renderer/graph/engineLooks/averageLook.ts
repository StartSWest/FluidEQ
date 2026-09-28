/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { placeLevel, type IAnalysisReading } from '../analysis/analysisFrame';
import {
  AVERAGE_BEHIND,
  AVERAGE_BODY,
  AVERAGE_CREST_ALPHA,
  AVERAGE_CREST_DASH,
  AVERAGE_CREST_WIDTH,
  AVERAGE_FAST_ALPHA,
  AVERAGE_FAST_WIDTH,
  AVERAGE_RIBBON,
  AVERAGE_RIBBON_BODY,
  AVERAGE_SLOW_HEAVIER,
  advanceAverage,
  type IAverageReadings,
} from '../analysis/averageView';
import { spectrumEnergy } from '../analysis/spectrumPaint';
import { rampStopsGlsl } from './analysisGlsl';
import { blankAnalysisLook, writeCurves } from './analysisLookInput';
import type { IEngineAnalysisLook } from './analysisLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * PEAK & AVERAGE on the GPU: the quiet body under the slow reading, the
 * ribbon out to the instant with the instant's body printed in it, the slow
 * reading's rule, the instant's hairline and the dashed high-water mark
 * (`analysis/averageView.ts`), from the readings that file advances.
 *
 *   uLook[7]  1 on a split, how present the channel behind is
 *   uLook[8]  the front channel's heat: its instant, its slow reading
 *   uLook[9]  the behind channel's
 *   texel (i, copy * 4 + channel * 2)      x, the instant's row, the slow
 *                                          reading's, the high-water mark's
 *   texel (i, copy * 4 + channel * 2 + 1)  how far along the mark's line
 *                                          point i is, for its dashes
 */

const f = (value: number) => value.toFixed(6);

const GLSL = `
${rampStopsGlsl('averageRibbon', AVERAGE_RIBBON)}

// The high-water mark as it is drawn, dashed: the distance to the nearest
// point of its line, or nowhere when that point falls between two dashes.
float averageDash(vec2 p, int row, int seg, float reach) {
  int last = anPoints() - 1;
  float best = 1e5;
  float along = 0.0;
  int first = seg;
  while (first > 0 && anPoint(first, row).x >= p.x - reach) {
    first -= 1;
  }
  vec4 a = anPoint(first, row);
  float arc = anPoint(first, row + 1).y;
  for (int k = 0; k < 128; k++) {
    int j = first + k;
    if (j >= last) {
      break;
    }
    vec4 b = anPoint(j + 1, row);
    if (a.x > p.x + reach) {
      break;
    }
    vec2 ab = b.xw - a.xw;
    float span = dot(ab, ab);
    float t = span > 0.0 ? clamp(dot(p - a.xw, ab) / span, 0.0, 1.0) : 0.0;
    float d = length(p - (a.xw + ab * t));
    if (d < best) {
      best = d;
      along = arc + t * sqrt(span);
    }
    arc += sqrt(span);
    a = b;
  }
  return mod(along, ${f(AVERAGE_CREST_DASH * 2)}) < ${f(AVERAGE_CREST_DASH)} ? best : 1e5;
}

vec4 averageChannel(vec4 picture, vec2 p, int copy, int row, int seg, bool mate, vec2 heat, float strength) {
  vec4 band = lookBand(copy);
  float presence = anOpacity(copy) * strength;
  float slowWidth = anEdgeWidth() + ${f(AVERAGE_SLOW_HEAVIER)};
  vec3 d = anDistances(p, row, seg, slowWidth * 0.5 + lookPixel());
  vec3 at = anCurvesAt(p.x, row, seg);
  // The body under the slow reading, quiet, so the ribbon reads as space
  // above a floor.
  if (lookFilled()) {
    picture = anBody(picture, p, band, mate, heat.y, anFillOpacity() * ${f(AVERAGE_BODY)}, anBodyCover(p, band, at.y, d.y));
  }
  // The ribbon, out along the instant and back along the slow reading.
  float ribbon = anRibbonCover(p, at.x, at.y, d.x, d.y);
  vec4 ink = averageRibbon(anUp(band, p.y), mate);
  picture = lookOver(picture, lookPaint(ink.rgb, ink.a * presence * ribbon));
  if (lookFilled()) {
    picture = anBody(picture, p, band, mate, heat.x, anFillOpacity() * ${f(AVERAGE_RIBBON_BODY)}, min(ribbon, anBodyCover(p, band, at.x, d.x)));
  }
  // The slow reading's rule, the instant's hairline, the dashed mark.
  picture = lookOver(picture, lookPaint(anEdgeInk(p, band, mate, heat.y), presence * lookStroke(d.y, slowWidth)));
  picture = lookOver(picture, lookPaint(anRamp(mate, 1.0), presence * ${f(AVERAGE_FAST_ALPHA)} * lookStroke(d.x, ${f(AVERAGE_FAST_WIDTH)})));
  float dash = averageDash(p, row, seg, ${f(AVERAGE_CREST_WIDTH)} * 0.5 + lookPixel());
  return lookOver(picture, lookPaint(vec3(1.0), presence * ${f(AVERAGE_CREST_ALPHA)} * lookStroke(dash, ${f(AVERAGE_CREST_WIDTH)})));
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  if (anPoints() < 2) {
    return picture;
  }
  int seg = anSegment(p.x);
  bool split = uLook[7].x > 0.5;
  for (int copy = 0; copy < 2; copy++) {
    if (lookBand(copy).w < 0.5) {
      continue;
    }
    if (split) {
      picture = averageChannel(picture, p, copy, copy * 4 + 2, seg, true, uLook[9].xy, uLook[7].y);
    }
    picture = averageChannel(picture, p, copy, copy * 4, seg, false, uLook[8].xy, 1.0);
  }
  return picture;
}
`;

/** One channel's rows: its three readings, then how far along its mark. */
const writeChannel = (
  data: Float32Array,
  row: number,
  reading: IAnalysisReading,
  readings: IAverageReadings,
): void => {
  const { fast, slow, crest } = readings;
  writeCurves(data, row, reading, [fast, slow, crest]);
  const { xs, band } = reading;
  const size = xs.length;
  let along = 0;
  let lastY = placeLevel(band, crest[0]);
  for (let index = 0; index < size; index += 1) {
    const y = placeLevel(band, crest[index]);
    if (index > 0) {
      along += Math.hypot(xs[index] - xs[index - 1], y - lastY);
    }
    lastY = y;
    const at = ((row + 1) * size + index) * 4;
    data[at] = xs[index];
    data[at + 1] = along;
    data[at + 2] = 0;
    data[at + 3] = 0;
  }
};

const heatOf = (readings: IAverageReadings | undefined): [number, number] =>
  readings
    ? [spectrumEnergy(readings.fast), spectrumEnergy(readings.slow)]
    : [0, 0];

const averageLook: IEngineAnalysisLook = {
  glsl: GLSL,
  step: (readings, state, input) => {
    const [first] = readings;
    const advanced = advanceAverage(first, state);
    if (!advanced) {
      blankAnalysisLook(input);
      return false;
    }
    const { front, behind } = advanced;
    const data = sizeLookData(input, first.levels.length, 8);
    readings.forEach((reading, copy) => {
      writeChannel(data, copy * 4, reading, front);
      if (behind) {
        writeChannel(data, copy * 4 + 2, reading, behind);
      }
    });
    setLookVector(input, 7, behind ? 1 : 0, AVERAGE_BEHIND, 0, 0);
    setLookVector(input, 8, ...heatOf(front), 0, 0);
    setLookVector(input, 9, ...heatOf(behind), 0, 0);
    return advanced.moving;
  },
};

export default averageLook;
