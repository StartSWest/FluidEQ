/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SIDE_FIGURE, midSideMoving } from '../analysis/midSideView';
import { spectrumEnergy } from '../analysis/spectrumPaint';
import { writeCurves } from './analysisLookInput';
import type { IEngineAnalysisLook } from './analysisLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * MID & SIDE on the GPU: the side behind in the other channel's colours,
 * the mid in front with the look's edge (`analysis/midSideView.ts`); before
 * the pair has been measured, the shared reading alone.
 *
 *   uLook[7]  1 once the pair is measured, the mid's heat, the side's
 *   uLook[8]  the side: its fill's share, edge alpha, edge width
 *   texel (i, copy)  x, the mid's row (or the shared reading's), the side's
 */

const GLSL = `
vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  if (anPoints() < 2) {
    return picture;
  }
  int seg = anSegment(p.x);
  bool pair = uLook[7].x > 0.5;
  for (int copy = 0; copy < 2; copy++) {
    vec4 band = lookBand(copy);
    if (band.w < 0.5) {
      continue;
    }
    vec3 d = anDistances(p, copy, seg, anEdgeWidth() * 0.5 + lookPixel());
    vec3 at = anCurvesAt(p.x, copy, seg);
    if (pair) {
      // The side behind, in its own colours: the mid is the record and the
      // side is what has been done to it.
      if (lookFilled()) {
        picture = anBody(picture, p, band, true, uLook[7].z, anFillOpacity() * uLook[8].x, anBodyCover(p, band, at.y, d.y));
      }
      picture = lookOver(picture, lookPaint(anEdgeInk(p, band, true, uLook[7].z), uLook[8].y * lookStroke(d.y, uLook[8].z)));
    }
    if (lookFilled()) {
      picture = anBody(picture, p, band, false, uLook[7].y, anFillOpacity(), anBodyCover(p, band, at.x, d.x));
    }
    // The mid's edge is stroked at whatever its body left the canvas's alpha
    // at: whole where it was filled, the copy's presence where it was not.
    float edge = pair && !lookFilled() ? anOpacity(copy) : 1.0;
    picture = lookOver(picture, lookPaint(anEdgeInk(p, band, false, uLook[7].y), edge * lookStroke(d.x, anEdgeWidth())));
  }
  return picture;
}
`;

const midSideLook: IEngineAnalysisLook = {
  glsl: GLSL,
  step: (readings, state, input) => {
    const [first] = readings;
    const { split, levels } = first;
    const data = sizeLookData(input, levels.length, 2);
    readings.forEach((reading, copy) => {
      writeCurves(data, copy, reading, split ? [split[0], split[1]] : [levels]);
    });
    setLookVector(
      input,
      7,
      split ? 1 : 0,
      spectrumEnergy(split ? split[0] : levels),
      split ? spectrumEnergy(split[1]) : 0,
      0,
    );
    setLookVector(
      input,
      8,
      SIDE_FIGURE.fill,
      SIDE_FIGURE.edge,
      Math.max(1, first.edge.width - SIDE_FIGURE.thinner),
      0,
    );
    return split ? midSideMoving(first) : state.seeded;
  },
};

export default midSideLook;
