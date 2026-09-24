/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  filterSmoothingCorrection,
  shapeEqFilters,
  smoothEqCurve,
} from 'common/eqShape';
import {
  getBandQ,
  getCurveEqMode,
  getEqMode,
  getStudioEqFilters,
  getStudioEqGraphic,
} from 'common/eqMode';
import type {
  IFilter,
  IGraphicEqPoint,
  IState,
  TApoFeature,
} from 'common/constants';
import { layerGainLimit } from '../../common/correctionRange';
import { layerGroupOf } from '../../common/filterDesign';
import type { IChartLineDataPointsById } from './ChartController';
import {
  getCombinedLineData,
  getDesignedFilterLineData,
  getGraphicEqLineData,
} from './utils';
import type { TMatchedDesign } from './useMatchedDesign';

/** What the EQ mode menu sets, which is how every layer is drawn. */
export type TEqModeSettings = Pick<
  IState,
  | 'eqMode'
  | 'curveEqMode'
  | 'isEqDoubleOn'
  | 'eqBandQ'
  | 'curveBandQ'
  | 'curveSmoothing'
>;

/**
 * Each layer's lines as its group of the EQ mode menu plays it, which is how
 * the writer builds it (`apoRender.ts`, `layerGroupOf`): Your EQ's row, with
 * no smoothing, for the Tone, a preset, the driver and Smart EQ; the
 * Corrections row, smoothing included, for the headphone correction and the
 * custom file, which names no layer. Drawn by one row for all of them, a
 * preset would show the Corrections row's Studio while it played Your EQ's
 * Normal.
 *
 * Each within the range the writer gives it: a correction's for the headphone
 * layer, a slider's for the rest (`correctionRange.ts`). And analog-matched
 * only where the engine playing builds that group so; the custom file names
 * no layer, so its bands stay on the cookbook in the engine and here.
 */
export const createLayerLines = (
  settings: TEqModeSettings,
  matchedDesign: TMatchedDesign,
  sampleRate: number | undefined,
) => {
  const strength = getEqMode(settings);
  const curveStrength = getCurveEqMode(settings);
  const mainShape = getBandQ(settings, 'eq');
  const curveShape = getBandQ(settings, 'curves');
  const settingsFor = (feature?: TApoFeature) =>
    feature !== undefined && layerGroupOf(feature) === 'eq'
      ? { mode: strength, shape: mainShape, smoothing: 'off' as const }
      : {
          mode: curveStrength,
          shape: curveShape,
          smoothing: settings.curveSmoothing,
        };
  const matchedFor = (feature?: TApoFeature) =>
    feature !== undefined && matchedDesign[layerGroupOf(feature)];

  const filterLine = (filter: IFilter, feature?: TApoFeature) => {
    const { mode, shape, smoothing } = settingsFor(feature);
    const effective =
      mode === 'studio'
        ? getStudioEqFilters([filter], shape, layerGainLimit(feature))[0]
        : shapeEqFilters([filter], shape)[0];
    const original = getDesignedFilterLineData(
      effective,
      matchedFor(feature),
      sampleRate,
    );
    const correction = filterSmoothingCorrection([effective], smoothing);
    const points = correction.length
      ? getCombinedLineData(0, {
          original,
          correction: getGraphicEqLineData(correction),
        })
      : original;
    return mode === 'double'
      ? getCombinedLineData(0, { first: points, second: points })
      : points;
  };

  const graphicLine = (curve: IGraphicEqPoint[], feature?: TApoFeature) => {
    const { mode, smoothing } = settingsFor(feature);
    const smoothed = smoothEqCurve(curve, smoothing);
    const points = getGraphicEqLineData(
      mode === 'studio'
        ? getStudioEqGraphic(smoothed, layerGainLimit(feature))
        : smoothed,
    );
    return mode === 'double'
      ? getCombinedLineData(0, { first: points, second: points })
      : points;
  };

  return {
    strength,
    curveStrength,
    mainShape,
    curveShape,
    matchedFor,
    filterLine,
    graphicLine,
  };
};

export type TLayerLines = ReturnType<typeof createLayerLines>;

interface ILayerSource {
  feature: TApoFeature;
  isBypassed: boolean;
  /** Its published curve, when it has one: then it is drawn instead. */
  graphic: IGraphicEqPoint[];
  filters: Array<Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>>;
  /** The keys its lines go under in a sum of every layer's. */
  graphicId: string;
  filterPrefix: string;
}

/**
 * One layer's own lines, run through the same biquad code as the bands so a
 * sum with them is an honest one: its published curve where it has one, as
 * the writer prefers it, its filters where it has not.
 *
 * Nothing for a layer that is switched off. Bypass keeps the layer in state
 * so the chip can put it back, and a graph drawing a curve for something no
 * longer in the config disagrees with what is heard — which a graph must
 * never do, and which is what keeps the A/B switch honest.
 */
export const layerLines = (
  lines: TLayerLines,
  source: ILayerSource,
): IChartLineDataPointsById => {
  const drawn: IChartLineDataPointsById = {};
  if (source.isBypassed) {
    return drawn;
  }
  if (source.graphic.length) {
    drawn[source.graphicId] = lines.graphicLine(source.graphic, source.feature);
    return drawn;
  }
  source.filters.forEach((filter, index) => {
    const id = `${source.filterPrefix}-${index}`;
    drawn[id] = lines.filterLine(
      {
        id,
        frequency: filter.frequency,
        gain: filter.gain,
        quality: filter.quality,
        type: filter.type,
      },
      source.feature,
    );
  });
  return drawn;
};
