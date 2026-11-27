/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { STILL_ENOUGH, type IAnalysisReading } from '../analysis/analysisFrame';
import {
  ANALYZER_FIGURES,
  HOLD_LINE_ALPHA,
  LIGHT_WINDOW_FILL_SHARE,
  PIP_ALPHA,
  PIP_RADIUS,
  advanceAnalyzer,
  analyzerHalo,
  figureEdgeWidth,
  isPip,
  type IAnalyzerFigure,
} from '../analysis/analyzerView';
import {
  HOLD_DASH,
  HOLD_DASH_GAP,
  HOLD_LINE_WIDTH,
  holdLengths,
} from '../analysis/holdDashes';
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
 *   texel (i, copy * 2 + 4), (i, copy * 2 + 5)  in .x, how far along each of
 *             those holds' lines the point stands (`holdLengths`)
 */

const PITCH = HOLD_DASH + HOLD_DASH_GAP;

const GLSL = `
// How much of p the hold's dashed line covers (\`holdDashes.ts\`): the
// canvas's own line dash, laid along the line from its first point, each
// dash a stretch of the line with round ends. The nearest stretch of the
// line is found as anDistances finds it, and how far along the line p
// falls is read from the lengths row four rows below the curve's own.
float analyzerHoldDash(vec2 p, int row, int seg) {
  float reach = ${(HOLD_LINE_WIDTH * 0.5).toFixed(3)} + lookPixel();
  int last = anPoints() - 1;
  float best = 1e9;
  float along = 0.0;
  for (int k = -64; k <= 64; k++) {
    int j = seg + k;
    if (j < 0 || j >= last) {
      continue;
    }
    vec4 a = anPoint(j, row);
    vec4 b = anPoint(j + 1, row);
    if (b.x < p.x - reach || a.x > p.x + reach) {
      continue;
    }
    vec2 ab = b.xz - a.xz;
    float span = dot(ab, ab);
    float t = span > 0.0 ? clamp(dot(p - a.xz, ab) / span, 0.0, 1.0) : 0.0;
    float d = length(p - (a.xz + ab * t));
    if (d < best) {
      best = d;
      along = anPoint(j, row + 4).x + t * sqrt(span);
    }
  }
  float phase = mod(along, ${PITCH.toFixed(1)});
  float off = phase <= ${HOLD_DASH.toFixed(1)}
    ? 0.0
    : min(phase - ${HOLD_DASH.toFixed(1)}, ${PITCH.toFixed(1)} - phase);
  return lookStroke(length(vec2(off, best)), ${HOLD_LINE_WIDTH.toFixed(3)});
}

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
  // A light window wears dark ink (\`windowSide.ts\`): its body is a flat wash
  // at a share of the fill and its hold is dashed (LIGHT_WINDOW_FILL_SHARE).
  bool onWhite = dot(uWindowInk, vec3(0.2126, 0.7152, 0.0722)) < 0.5;
  if (lookFilled()) {
    float cover = anBodyCover(p, band, at.x, d.x);
    if (onWhite) {
      float alpha = anFillOpacity() * figure.x * ${LIGHT_WINDOW_FILL_SHARE.toFixed(3)};
      if (cover > 0.0 && alpha > 0.0) {
        picture = lookOver(picture, anFillPaint(p, band, mate, energy, alpha) * cover);
        // The front figure alone carries the texture, as in the 2D view;
        // the channel behind is told apart by its colours.
        picture = mate ? picture : lookTextured(picture, p, cover, alpha);
      }
    } else if (mate) {
      picture = anBody(picture, p, band, mate, energy, anFillOpacity() * figure.x, cover);
    } else {
      picture = anTexturedBody(picture, p, band, mate, energy, anFillOpacity() * figure.x, cover);
    }
  }
  if (figure.y > 0.0) {
    picture = lookOver(picture, lookPaint(anEdgeInk(p, band, mate, energy), figure.y * lookStroke(d.x, figure.z)));
  }
  // The hold's dashed line, and a pip wherever the reading still touches
  // it, in the window's strongest ink as the 2D view draws them
  // (\`readInk\`): white on a dark window, near-black on a light one.
  picture = lookOver(picture, lookPaint(uWindowInk, figure.w * ${HOLD_LINE_ALPHA.toFixed(3)} * analyzerHoldDash(p, row, seg)));
  float pip = 0.0;
  for (int j = seg - 2; j <= seg + 3; j++) {
    vec4 point = anPoint(j, row);
    if (j >= 0 && j < anPoints() && point.w > 0.5) {
      pip = max(pip, lookFill(length(p - point.xz) - ${PIP_RADIUS.toFixed(3)}));
    }
  }
  return lookOver(picture, lookPaint(uWindowInk, figure.w * ${PIP_ALPHA.toFixed(3)} * pip));
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

/** The lengths along a hold's line, kept between frames. */
let lengths = new Float64Array(0);

const analyzerLook: IEngineAnalysisLook = {
  glsl: GLSL,
  step: (readings, state, input) => {
    const [first] = readings;
    const holds = advanceAnalyzer(first, state);
    const { levels, split } = first;
    // The curves drawn: the joined reading, or the left in front of the right.
    const pair = split && holds.behind ? split : undefined;
    const front = pair ? pair[0] : levels;
    const data = sizeLookData(input, levels.length, 8);
    if (lengths.length !== levels.length) {
      lengths = new Float64Array(levels.length);
    }
    // How far along each hold's line its points stand, four rows below the
    // curves', for the dashes (`holdLengths`).
    const writeLengths = (
      row: number,
      reading: IAnalysisReading,
      hold: Float64Array,
    ) => {
      holdLengths(reading, hold, lengths);
      for (let index = 0; index < lengths.length; index += 1) {
        data[((row + 4) * levels.length + index) * 4] = lengths[index];
      }
    };
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
      writeLengths(copy * 2, reading, holds.front);
      if (pair && holds.behind) {
        writeCurves(
          data,
          copy * 2 + 1,
          reading,
          [pair[1], holds.behind],
          pips(holds.behind),
        );
        writeLengths(copy * 2 + 1, reading, holds.behind);
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
