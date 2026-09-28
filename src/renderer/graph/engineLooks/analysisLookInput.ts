/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ResolvedGraphPalette } from 'common/graphStyles';
import { parseCssColour } from '../../utils/oklab';
import { rampAt } from '../lookColours';
import { placeLevel, type IAnalysisReading } from '../analysis/analysisFrame';
import type { IEngineLookInput } from './engineLookInput';
import { setLookBands, setLookVector, writeInks } from './lookInput';

/**
 * Filling the vectors every measuring view shares (`analysisGlsl.ts`) from
 * the frame's readings, one per copy of the drawing, and both ramps.
 */

const PALETTE: Record<ResolvedGraphPalette, number> = {
  signal: 0,
  rainbow: 1,
  level: 2,
  heat: 3,
};

/** The edge's colour as 0..1 channels; the look's hot end if unreadable. */
const edgeRgb = (reading: IAnalysisReading): readonly number[] => {
  const parsed = parseCssColour(reading.edge.colour);
  if (parsed) {
    return parsed.rgb;
  }
  return rampAt(reading.colours, 1).map((channel) => channel / 255);
};

/** Nothing to draw this frame: no curve has any points. */
export const blankAnalysisLook = (input: IEngineLookInput): void => {
  input.vectors[6 * 4 + 3] = 0;
};

/**
 * One row of curves (`analysisGlsl.ts`): each point's x, and up to three
 * readings that share those points placed in the copy's band, where the 2D
 * view's own `placeLevel` puts them. A fourth number per point, where the
 * view has one, goes in the place of a third curve.
 */
export const writeCurves = (
  data: Float32Array,
  row: number,
  reading: IAnalysisReading,
  curves: readonly (Float64Array | undefined)[],
  fourth?: (index: number) => number,
): void => {
  const { xs, band } = reading;
  const size = xs.length;
  for (let index = 0; index < size; index += 1) {
    const at = (row * size + index) * 4;
    data[at] = xs[index];
    for (let curve = 0; curve < 3; curve += 1) {
      const levels = curves[curve];
      data[at + 1 + curve] = levels ? placeLevel(band, levels[index]) : 0;
    }
    if (fourth) {
      data[at + 3] = fourth(index);
    }
  }
};

export const readAnalysisLookInput = (
  input: IEngineLookInput,
  readings: readonly IAnalysisReading[],
  window: { width: number; height: number },
): void => {
  const [first] = readings;
  const { plot, tuning, edge } = first;
  // A frame's sprites and bloom are its own: each view sets what it draws.
  input.spriteCount = 0;
  input.spritesUnder = 0;
  input.bloom = 0;
  setLookVector(input, 0, window.width, window.height, 0, 0);
  setLookVector(input, 1, plot.left, plot.right, plot.top, plot.bottom);
  setLookBands(
    input,
    readings.map((reading) => reading.band),
  );
  setLookVector(
    input,
    4,
    PALETTE[first.palette],
    tuning.filled ? 1 : 0,
    tuning.fillOpacity,
    edge.width,
  );
  setLookVector(
    input,
    5,
    first.glow,
    edge.isEuphoria ? 1 : 0,
    first.band.opacity,
    readings[1]?.band.opacity ?? 0,
  );
  const [red, green, blue] = edgeRgb(first);
  setLookVector(input, 6, red, green, blue, first.levels.length);
  input.inkCount = writeInks(input.inks, first.colours);
  input.mateInkCount = writeInks(input.mateInks, first.mate);
};
