/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  COMPARE_BEFORE,
  COMPARE_BEHIND,
  COMPARE_RIBBON,
  FLAT_ENOUGH,
  compareMoving,
  readCompare,
  type ICompareCurves,
} from '../analysis/compareView';
import { spectrumEnergy } from '../analysis/spectrumPaint';
import { rampStopsGlsl } from './analysisGlsl';
import { blankAnalysisLook, writeCurves } from './analysisLookInput';
import type { IEngineAnalysisLook } from './analysisLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * BEFORE & AFTER on the GPU: the band between the two curves, the faint
 * before-figure and the reading over it (`analysis/compareView.ts`), from the
 * before-curves that file works out.
 *
 *   uLook[7]  1 on a split, how present the channel behind is, 1 where the
 *             front pair has a band between them, the same for the behind
 *   uLook[8]  the front pair's heat: after, before
 *   uLook[9]  the behind pair's
 *   uLook[10] the before-figure: its fill's share, edge alpha, edge width
 *   texel (i, copy * 2)      x, the front after-curve's row, its before's
 *   texel (i, copy * 2 + 1)  the same for the pair behind
 */

const GLSL = `
${rampStopsGlsl('compareRibbon', COMPARE_RIBBON)}

// One channel's pair: mate paints the after-figure and the band in the
// other channel's colours, beforeMate the before-figure.
vec4 compareChannel(vec4 picture, vec2 p, int copy, int row, int seg, bool mate, bool beforeMate, vec2 heat, bool ribbon, float strength) {
  vec4 band = lookBand(copy);
  float presence = anOpacity(copy) * strength;
  float reach = max(anEdgeWidth(), uLook[10].z) * 0.5 + lookPixel();
  vec3 d = anDistances(p, row, seg, reach);
  vec3 at = anCurvesAt(p.x, row, seg);
  if (ribbon) {
    vec4 ink = compareRibbon(anUp(band, p.y), mate);
    float cover = anRibbonCover(p, at.x, at.y, d.x, d.y);
    picture = lookOver(picture, lookPaint(ink.rgb, ink.a * presence * cover));
  }
  // Before: a body of its own, faint, so the shape of the source is
  // readable under the correction, and its edge.
  if (lookFilled()) {
    picture = anBody(picture, p, band, beforeMate, heat.y, anFillOpacity() * uLook[10].x, anBodyCover(p, band, at.y, d.y));
  }
  picture = lookOver(picture, lookPaint(anEdgeInk(p, band, beforeMate, heat.y), uLook[10].y * lookStroke(d.y, uLook[10].z)));
  // After: the reading itself, with the look's full edge.
  if (lookFilled()) {
    picture = anBody(picture, p, band, mate, heat.x, anFillOpacity(), anBodyCover(p, band, at.x, d.x));
  }
  return lookOver(picture, lookPaint(anEdgeInk(p, band, mate, heat.x), presence * lookStroke(d.x, anEdgeWidth())));
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
      picture = compareChannel(picture, p, copy, copy * 2 + 1, seg, true, true, uLook[9].xy, uLook[7].w > 0.5, uLook[7].y);
      picture = compareChannel(picture, p, copy, copy * 2, seg, false, false, uLook[8].xy, uLook[7].z > 0.5, 1.0);
    } else {
      picture = compareChannel(picture, p, copy, copy * 2, seg, false, true, uLook[8].xy, uLook[7].z > 0.5, 1.0);
    }
  }
  return picture;
}
`;

const heatOf = (curves: ICompareCurves | undefined): [number, number] =>
  curves
    ? [spectrumEnergy(curves.after), spectrumEnergy(curves.before)]
    : [0, 0];

const compareLook: IEngineAnalysisLook = {
  glsl: GLSL,
  step: (readings, state, input) => {
    const [first] = readings;
    const curves = readCompare(first, state);
    if (!curves) {
      blankAnalysisLook(input);
      return false;
    }
    const { front, behind } = curves;
    const data = sizeLookData(input, first.levels.length, 4);
    readings.forEach((reading, copy) => {
      writeCurves(data, copy * 2, reading, [front.after, front.before]);
      if (behind) {
        writeCurves(data, copy * 2 + 1, reading, [behind.after, behind.before]);
      }
    });
    setLookVector(
      input,
      7,
      behind ? 1 : 0,
      COMPARE_BEHIND,
      front.widest > FLAT_ENOUGH ? 1 : 0,
      behind && behind.widest > FLAT_ENOUGH ? 1 : 0,
    );
    setLookVector(input, 8, ...heatOf(front), 0, 0);
    setLookVector(input, 9, ...heatOf(behind), 0, 0);
    setLookVector(
      input,
      10,
      COMPARE_BEFORE.fill,
      COMPARE_BEFORE.edge,
      Math.max(1, first.edge.width - COMPARE_BEFORE.thinner),
      0,
    );
    return compareMoving(curves);
  },
};

export default compareLook;
