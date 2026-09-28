/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { STILL_ENOUGH, type IAnalysisReading } from '../analysis/analysisFrame';
import {
  ANALYZER_FIGURES,
  HOLD_LINE_ALPHA,
  HOLD_LINE_WIDTH,
  PIP_ALPHA,
  PIP_RADIUS,
  advanceAnalyzer,
  analyzerHalo,
  figureEdgeWidth,
  isPip,
  type IAnalyzerFigure,
} from '../analysis/analyzerView';
import { spectrumEnergy } from '../analysis/spectrumPaint';
import type { IEngineAnalysisLook } from './analysisLookTypes';
import type { IEngineLookInput } from './engineLookInput';
import { writeCurves } from './analysisLookInput';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * The ANALYZER on the GPU: each figure's body faded to its foot, its edge,
 * its peak hold and the pips where the reading still touches it
 * (`analysis/analyzerView.ts`), from the holds that file advances.
 *
 *   uLook[7]  the front curve's heat, the behind curve's, the joined
 *             figure's halo, 1 on a split
 *   uLook[10] the front figure: its fill's share, edge alpha, edge width,
 *             hold alpha (`ANALYZER_FIGURES`)
 *   uLook[11] the behind figure's
 *   texel (i, copy * 2)      x, the front curve's row, its hold's, 1 at a pip
 *   texel (i, copy * 2 + 1)  the same for the curve behind it
 */

const GLSL = `
vec4 analyzerFigure(vec4 picture, vec2 p, vec4 band, int row, int seg, bool mate, float energy, float halo, vec4 figure) {
  float haloWidth = halo > 0.0 ? anEdgeWidth() + 10.0 * halo : 0.0;
  float reach = max(max(figure.z, haloWidth), ${HOLD_LINE_WIDTH.toFixed(3)}) * 0.5 + lookPixel();
  vec3 d = anDistances(p, row, seg, reach);
  vec3 at = anCurvesAt(p.x, row, seg);
  if (halo > 0.0) {
    // The halo (paintHalo): the edge stroked wide and soft behind it.
    vec3 glow = anEdgeColour();
    picture = lookOver(picture, lookPaint(glow, 0.16 * halo * lookStroke(d.x, haloWidth)));
    picture = lookOver(picture, lookPaint(glow, 0.26 * halo * lookStroke(d.x, anEdgeWidth() + 4.0 * halo)));
  }
  if (lookFilled()) {
    picture = anBody(picture, p, band, mate, energy, anFillOpacity() * figure.x, anBodyCover(p, band, at.x, d.x));
  }
  if (figure.y > 0.0) {
    picture = lookOver(picture, lookPaint(anEdgeInk(p, band, mate, energy), figure.y * lookStroke(d.x, figure.z)));
  }
  // The hold, and a pip wherever the reading still touches it: white on
  // every palette, because nothing else on the plot is.
  picture = lookOver(picture, lookPaint(vec3(1.0), figure.w * ${HOLD_LINE_ALPHA.toFixed(3)} * lookStroke(d.y, ${HOLD_LINE_WIDTH.toFixed(3)})));
  float pip = 0.0;
  for (int j = seg - 2; j <= seg + 3; j++) {
    vec4 point = anPoint(j, row);
    if (j >= 0 && j < anPoints() && point.w > 0.5) {
      pip = max(pip, lookFill(length(p - point.xz) - ${PIP_RADIUS.toFixed(3)}));
    }
  }
  return lookOver(picture, lookPaint(vec3(1.0), figure.w * ${PIP_ALPHA.toFixed(3)} * pip));
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  if (anPoints() < 2) {
    return picture;
  }
  int seg = anSegment(p.x);
  bool split = uLook[7].w > 0.5;
  for (int copy = 0; copy < 2; copy++) {
    vec4 band = lookBand(copy);
    if (band.w < 0.5) {
      continue;
    }
    if (split) {
      picture = analyzerFigure(picture, p, band, copy * 2 + 1, seg, true, uLook[7].y, 0.0, uLook[11]);
    }
    picture = analyzerFigure(picture, p, band, copy * 2, seg, false, uLook[7].x, uLook[7].z, uLook[10]);
  }
  return picture;
}
`;

const setFigure = (
  input: IEngineLookInput,
  index: number,
  reading: IAnalysisReading,
  figure: IAnalyzerFigure,
) =>
  setLookVector(
    input,
    index,
    figure.fill,
    figure.edge,
    figureEdgeWidth(reading, figure),
    figure.hold,
  );

const analyzerLook: IEngineAnalysisLook = {
  glsl: GLSL,
  step: (readings, state, input) => {
    const [first] = readings;
    const holds = advanceAnalyzer(first, state);
    const { levels, split } = first;
    // The curves drawn: the joined reading, or the left in front of the right.
    const pair = split && holds.behind ? split : undefined;
    const front = pair ? pair[0] : levels;
    const data = sizeLookData(input, levels.length, 4);
    const pips = (hold: Float64Array) => (index: number) =>
      isPip(hold[index], levels[index]) ? 1 : 0;
    readings.forEach((reading, copy) => {
      writeCurves(
        data,
        copy * 2,
        reading,
        [front, holds.front],
        pips(holds.front),
      );
      if (pair && holds.behind) {
        writeCurves(
          data,
          copy * 2 + 1,
          reading,
          [pair[1], holds.behind],
          pips(holds.behind),
        );
      }
    });
    setLookVector(
      input,
      7,
      spectrumEnergy(front),
      pair ? spectrumEnergy(pair[1]) : 0,
      pair ? 0 : analyzerHalo(first, levels),
      pair ? 1 : 0,
    );
    setFigure(
      input,
      10,
      first,
      pair ? ANALYZER_FIGURES.front : ANALYZER_FIGURES.joined,
    );
    setFigure(input, 11, first, ANALYZER_FIGURES.behind);
    return holds.highest > STILL_ENOUGH;
  },
};

export default analyzerLook;
