/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { LIGHT_WINDOW_FILL_SHARE } from '../analysis/analyzerView';
import {
  COMPARE_BANDS,
  COMPARE_BEFORE,
  COMPARE_BEHIND,
  FLAT_ENOUGH,
  compareMoving,
  readCompare,
  type ICompareCurves,
} from '../analysis/compareView';
import { spectrumEnergy } from '../analysis/spectrumPaint';
import { blankAnalysisLook, writeCurves } from './analysisLookInput';
import type { IEngineAnalysisLook } from './analysisLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * BEFORE & AFTER on the GPU: the reading's body, the band where the EQ lifts
 * it and the band where it cuts, the source's line and the reading's edge
 * (`analysis/compareView.ts`), from the before-curves that file works out.
 *
 *   uLook[7]  1 on a split, how present the channel behind is, 1 where the
 *             front pair has a band between them, the same for the behind
 *   uLook[8]  the front pair's heat: after, before
 *   uLook[9]  the behind pair's
 *   uLook[10] the before-line's alpha and width
 *   texel (i, copy * 2)      x, the front after-curve's row, its before's
 *   texel (i, copy * 2 + 1)  the same for the pair behind
 */

const GLSL = `
// One channel's pair: mate paints the after-figure and its lift in the
// other channel's colours, beforeMate the cut and the before-line.
vec4 compareChannel(vec4 picture, vec2 p, int copy, int row, int seg, bool mate, bool beforeMate, vec2 heat, bool parted, float strength) {
  vec4 band = lookBand(copy);
  float presence = anOpacity(copy) * strength;
  float reach = max(anEdgeWidth(), uLook[10].y) * 0.5 + lookPixel();
  vec3 d = anDistances(p, row, seg, reach);
  vec3 at = anCurvesAt(p.x, row, seg);
  // A light window wears dark ink (\`windowSide.ts\`): the after-body is a
  // flat wash there, as the Analyzer's is, and the bands are lighter.
  bool onWhite = dot(uWindowInk, vec3(0.2126, 0.7152, 0.0722)) < 0.5;
  // After: the reading's body, as the Analyzer paints its own, textured.
  if (lookFilled()) {
    float cover = anBodyCover(p, band, at.x, d.x);
    if (onWhite) {
      float alpha = anFillOpacity() * ${LIGHT_WINDOW_FILL_SHARE.toFixed(3)};
      if (cover > 0.0 && alpha > 0.0) {
        picture = lookOver(picture, anFillPaint(p, band, mate, heat.x, alpha) * cover);
        picture = lookTextured(picture, p, cover, alpha);
      }
    } else {
      picture = anTexturedBody(picture, p, band, mate, heat.x, anFillOpacity(), cover);
    }
  }
  if (parted) {
    // The band between the two curves: a lift where the after-curve stands
    // further up the copy than the before-curve, in the reading's colours;
    // a cut where it stands lower, in the source's.
    float between = anRibbonCover(p, at.x, at.y, d.x, d.y);
    bool lifted = (at.x - at.y) * anRise(band) > 0.0;
    float share = lifted
      ? (onWhite ? ${COMPARE_BANDS.light.lift.toFixed(3)} : ${COMPARE_BANDS.dark.lift.toFixed(3)})
      : (onWhite ? ${COMPARE_BANDS.light.cut.toFixed(3)} : ${COMPARE_BANDS.dark.cut.toFixed(3)});
    vec3 ink = lifted
      ? anEdgeInk(p, band, mate, heat.x)
      : anEdgeInk(p, band, beforeMate, heat.y);
    picture = lookOver(picture, lookPaint(ink, share * presence * between));
    // Before: the source's own line, over both bands.
    picture = lookOver(picture, lookPaint(anEdgeInk(p, band, beforeMate, heat.y), uLook[10].x * lookStroke(d.y, uLook[10].y)));
  }
  // After: the reading's edge, at the look's own width, over everything.
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
      COMPARE_BEFORE.edge,
      Math.max(1, first.edge.width - COMPARE_BEFORE.thinner),
      0,
      0,
    );
    return compareMoving(curves);
  },
};

export default compareLook;
