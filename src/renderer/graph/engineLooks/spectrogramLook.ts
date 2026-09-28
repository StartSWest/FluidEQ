/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { halveBand } from '../analysis/analysisFrame';
import {
  ROW_FADE_IN,
  advanceStrip,
  spectrogramStrips,
  stripSize,
} from '../analysis/spectrogramView';
import type { IEngineAnalysisLook } from './analysisLookTypes';
import { setLookVector, sizeLookData } from './lookInput';

/**
 * The SPECTROGRAM on the GPU: the last few seconds of the song as a picture,
 * newest along each strip's foot (`analysis/spectrogramView.ts`). The ring
 * of rows is kept by the engine (`IEngineLookHistory`, `uLookHistory`), one
 * reading per point, and coloured per pixel as the page prints its rows:
 * the reading between two points taken along the line between them, its
 * colour by the look's Colour by, its alpha by how loud it is.
 *
 *   uLook[7]  how many strips, texels a history row, rows a strip keeps
 *   uLook[8]  strip 0's newest row and its height; strip 1's
 *   uLook[9], uLook[10]   the first copy's strips: top, bottom, flipped,
 *                          present
 *   uLook[11], uLook[12]  the second copy's
 *   texel (i, 0)  point i's column
 *   history texel (j, s * rows + r)  strip s's row r, points 4j to 4j + 3
 */

const GLSL = `
uniform sampler2D uLookHistory;

float spectrogramLevel(int strip, int row, int point) {
  int rows = int(uLook[7].z + 0.5);
  vec4 four = texelFetch(uLookHistory, ivec2(point / 4, strip * rows + row), 0);
  int within = point - (point / 4) * 4;
  return within == 0 ? four.x : (within == 1 ? four.y : (within == 2 ? four.z : four.w));
}

vec4 spectrogramStrip(vec4 picture, vec2 p, int copy, int strip, vec4 band, int seg) {
  if (band.w < 0.5 || p.y < band.x || p.y >= band.y || p.x < uLook[1].x || p.x > uLook[1].y) {
    return picture;
  }
  vec2 ring = strip == 0 ? uLook[8].xy : uLook[8].zw;
  float height = max(1.0, ring.y);
  // A mirrored copy is the same picture reflected about its band.
  float y = band.z > 0.5 ? band.x + band.y - p.y : p.y;
  float row = floor((y - band.x) / ((band.y - band.x) / height));
  int at = int(mod(ring.x + 1.0 + row, height));
  vec4 a = anPoint(seg, 0);
  vec4 b = anPoint(seg + 1, 0);
  float toward = b.x > a.x ? clamp((p.x - a.x) / (b.x - a.x), 0.0, 1.0) : 0.0;
  float shown = clamp(mix(spectrogramLevel(strip, at, seg), spectrogramLevel(strip, at, seg + 1), toward), 0.0, 1.0);
  int palette = anPalette();
  float stop = palette == 1 ? anAcross(p.x) : (palette == 0 ? 0.0 : shown);
  float alpha = clamp(shown * ${ROW_FADE_IN.toFixed(1)}, 0.0, 1.0) * anOpacity(copy) * anFillOpacity();
  return lookOver(picture, lookPaint(anRamp(strip == 1, stop), alpha));
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  if (anPoints() < 2) {
    return picture;
  }
  int seg = anSegment(p.x);
  int strips = int(uLook[7].x + 0.5);
  for (int copy = 0; copy < 2; copy++) {
    vec4 first = copy == 0 ? uLook[9] : uLook[11];
    vec4 second = copy == 0 ? uLook[10] : uLook[12];
    picture = spectrogramStrip(picture, p, copy, 0, first, seg);
    if (strips > 1) {
      picture = spectrogramStrip(picture, p, copy, 1, second, seg);
    }
  }
  return picture;
}
`;

const spectrogramLook: IEngineAnalysisLook = {
  glsl: GLSL,
  step: (readings, state, input) => {
    const [first] = readings;
    const { xs } = first;
    const size = xs.length;
    const strips = spectrogramStrips(first, state);
    const across = Math.ceil(size / 4);
    const floats = strips.length * across * 4;
    const kept = input.history?.latest;
    const latest =
      kept && kept.length === floats ? kept : new Float32Array(floats);
    let rows = 1;
    strips.forEach(({ strip, band, levels }, index) => {
      const { width, height } = stripSize(first, band);
      strip.printed += advanceStrip(strip, width, height, first.deltaMs);
      rows = Math.max(rows, height);
      latest.set(levels, index * across * 4);
    });
    input.history = {
      key: strips.map(({ strip }) => strip.generation).join('|'),
      width: across,
      rows,
      strips: strips.length,
      printed: strips.map(({ strip }) => strip.printed),
      latest,
    };
    const data = sizeLookData(input, size, 1);
    for (let index = 0; index < size; index += 1) {
      data[index * 4] = xs[index];
    }
    setLookVector(input, 7, strips.length, across, rows, 0);
    setLookVector(
      input,
      8,
      strips[0].strip.printed % strips[0].strip.height,
      strips[0].strip.height,
      strips[1] ? strips[1].strip.printed % strips[1].strip.height : 0,
      strips[1]?.strip.height ?? 0,
    );
    readings.forEach((reading, copy) => {
      const bands = first.split ? halveBand(reading.band) : [reading.band];
      [0, 1].forEach((index) => {
        const band = bands[index];
        setLookVector(
          input,
          9 + copy * 2 + index,
          band?.top ?? 0,
          band?.bottom ?? 0,
          band?.flipped ? 1 : 0,
          band ? 1 : 0,
        );
      });
    });
    // The picture keeps scrolling while there is sound, and holds still once
    // the capture stops — which is what the pause and the silence both are.
    return first.playing;
  },
};

export default spectrogramLook;
