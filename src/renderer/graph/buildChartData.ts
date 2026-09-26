/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { shapeEqFilters, smoothEqCurve } from 'common/eqShape';
import {
  convolutionResponse,
  eqModeGainScale,
  getStudioEqFilters,
  getStudioEqGraphic,
} from 'common/eqMode';
import {
  AutoEqFormat,
  IFilter,
  isBandEnabled,
  IState,
  TApoLayer,
} from 'common/constants';
import type {
  IChartCurveData,
  IChartLineDataPointsById,
} from './ChartController';
import {
  getCombinedLineData,
  getDesignedFilterLineData,
  getGraphicEqLineData,
} from './utils';
import type { useTranslation } from '../utils/I18nContext';
import { getVoicingFilters, getVoicingGraphicEq } from '../../common/voicing';
import { getDriverFilters, getDriverGraphicEq } from '../../common/driver';
import {
  getHeadphoneFilters,
  getHeadphoneGraphicEq,
} from '../../common/headphone';
import { getSmartEqFilters, getSmartEqGraphicEq } from '../../common/smartEq';
import { hasCustomFxCurve } from '../../common/customFx';
import { hasEqCut } from '../../common/eqCuts';
import { getToneFilters, hasTone } from '../../common/tone';
import type { TMatchedDesign } from './useMatchedDesign';
import withEqCuts from './eqCutLine';
import { createLayerLines, layerLines } from './layerLines';
import { drawBandLines, IBandLineCache } from './bandLines';
import chartCurves, { eqGradientStops } from './chartCurves';

export { SUPPORTING_CURVE_OPACITY } from './chartCurves';

export interface IGraphData {
  chartData: IChartCurveData[];
  autoPreAmpValue: number;
}

/**
 * Everything the curves are derived from, and nothing else.
 *
 * The layers are taken from `IState` by name rather than restated, so one that
 * changes shape cannot leave this describing the old one. The rest are listed
 * below because they are not state: two the component derives, the translator
 * the layer names are read through, and the two render-spanning caches.
 */
export interface IBuildChartDataParams
  extends
    Pick<
      IState,
      | 'convolution'
      | 'customFx'
      | 'driver'
      | 'eqFormat'
      | 'filters'
      | 'graphicEq'
      | 'headphone'
      | 'isAutoPreAmpOn'
      | 'isEqDoubleOn'
      | 'eqMode'
      | 'curveEqMode'
      | 'eqBandQ'
      | 'curveBandQ'
      | 'curveSmoothing'
      | 'eqCuts'
      | 'preAmp'
      | 'smartEq'
      | 'tone'
      | 'voicing'
    >,
    IBandLineCache {
  /**
   * Not from `IState`, where it is optional.
   *
   * The context always supplies a list, and every use here is a membership
   * test. Taking the optional form would mean guarding each one against an
   * absence that cannot happen.
   */
  bypassed: TApoLayer[];
  hasConvolution: boolean;
  /**
   * Whether a preamp is in the chain at all, which is what draws the output
   * curve when nothing else would. Separate from `preAmp` because under the
   * FluidEQ Engine's automatic preamp that is passed as zero: the live gain
   * moves at display rate, and the chart applies it to the output curve
   * itself rather than rebuilding every curve for each value.
   */
  hasPreAmp: boolean;
  isEqQuiet: boolean;
  /**
   * Per group, whether the engine playing builds the group's layers
   * analog-matched, so they are drawn with the analog shape they play: the
   * FluidEQ Engine does, unless the group's Treble choice is Classic;
   * Equalizer APO plays every band from the cookbook.
   */
  matchedDesign: TMatchedDesign;
  /**
   * The rate the output runs at, which is the rate either engine builds every
   * band at: the lower it is, the more the cookbook narrows a treble band.
   * Undefined until the output list has answered.
   */
  sampleRate?: number;
  /**
   * Rainbow mode's palette, which shades the EQ curve's halo while the mode
   * is on (`rainbowPalette.ts`). The one in use when not given.
   */
  rainbow?: readonly string[];
  t: ReturnType<typeof useTranslation>['t'];
}

/** A curve's points, or nothing where none of its lines are drawn. */
const curveOf = (lines: IChartLineDataPointsById) =>
  Object.keys(lines).length > 0 ? getCombinedLineData(0, lines) : undefined;

/**
 * Every curve the graph draws, built in one pass.
 *
 * Almost all of it a function of the tuning and nothing else. The exception
 * is the band-line cache, which is why it is a parameter: everything else
 * here can be read off the arguments, and saying so in the signature is the
 * point of keeping it out of the component.
 *
 * One pass rather than a builder per curve, because the layers are not
 * independent: the final chain is their sum, and a builder each would mean
 * walking the whole set again to add them up.
 */
export const buildChartData = ({
  bypassed,
  convolution,
  customFx,
  driver,
  eqFormat,
  filters,
  graphicEq,
  hasConvolution,
  hasPreAmp,
  headphone,
  isEqQuiet,
  isEqDoubleOn,
  eqMode,
  curveEqMode,
  eqBandQ,
  curveBandQ,
  curveSmoothing,
  eqCuts,
  matchedDesign,
  preAmp,
  prevFilterLines,
  prevFilters,
  rainbow,
  sampleRate,
  smartEq,
  t,
  tone,
  voicing,
}: IBuildChartDataParams): IGraphData => {
  const lines = createLayerLines(
    { eqMode, curveEqMode, isEqDoubleOn, eqBandQ, curveBandQ, curveSmoothing },
    matchedDesign,
    sampleRate,
  );
  const { strength, curveStrength, mainShape, curveShape } = lines;
  const eqMatched = lines.matchedFor('eq');
  const bandLines = drawBandLines(filters, eqMatched, sampleRate, {
    prevFilters,
    prevFilterLines,
  });

  // Each layer a real layer of the chain, so each gets a real curve rather
  // than a note in the UI, and through the same biquad code as the bands,
  // which is what makes the total an honest sum rather than an approximation
  // of one.
  const voicingLines = layerLines(lines, {
    feature: 'voicing',
    isBypassed: bypassed.includes('voicing'),
    graphic: getVoicingGraphicEq(voicing),
    filters: getVoicingFilters(voicing),
    graphicId: 'voicing-graphic',
    filterPrefix: 'voicing',
  });
  const driverLines = layerLines(lines, {
    feature: 'driver',
    isBypassed: bypassed.includes('driver'),
    graphic: getDriverGraphicEq(driver),
    filters: getDriverFilters(driver),
    graphicId: 'driver-graphic',
    filterPrefix: 'driver',
  });
  // The published headphone correction, which had no curve here at all: no
  // line, no chip, and absent from the total, so the curve labelled "Final
  // output" was not the output. It was reported as "the AutoEQ is being
  // applied as the EQ", which is what a correction with no line of its own
  // looks like from the outside.
  const headphoneLines = layerLines(lines, {
    feature: 'headphone',
    isBypassed: bypassed.includes('headphone'),
    graphic: getHeadphoneGraphicEq(headphone),
    filters: getHeadphoneFilters(headphone),
    graphicId: 'headphone-graphic',
    filterPrefix: 'headphone',
  });
  const smartLines = layerLines(lines, {
    feature: 'smart',
    isBypassed: bypassed.includes('smart'),
    graphic: getSmartEqGraphicEq(smartEq),
    filters: getSmartEqFilters(smartEq),
    graphicId: 'smart-graphic',
    filterPrefix: 'smart-eq',
  });
  // The Tone panel's Bass, Mid and Treble: a layer of their own, drawn beside
  // the bands rather than inside them (`tone.ts`), so a turn of Bass reads as
  // the shelf it is and not only as a change in the total.
  const toneLines = layerLines(lines, {
    feature: 'tone',
    isBypassed: bypassed.includes('tone'),
    graphic: [],
    filters: getToneFilters(tone),
    graphicId: 'tone-graphic',
    filterPrefix: 'tone',
  });

  const convolutionLines: IChartLineDataPointsById = {};
  if (!bypassed.includes('convolution')) {
    const response = smoothEqCurve(
      convolutionResponse(convolution, curveShape),
      curveSmoothing,
    );
    if (response.length) {
      convolutionLines['convolution-response'] = getGraphicEqLineData(
        response.map((point) => ({
          ...point,
          gain: point.gain * eqModeGainScale(curveStrength),
        })),
      );
    }
  }

  // A switched-off EQ has no curve at all, like every other switched-off
  // layer. It used to be drawn flat, which is not the same claim: flat says
  // "these bands are doing nothing", and what is true is that they are not in
  // the chain. The output curve below is where the difference shows.
  const hasEq = !bypassed.includes('eq');
  const nativeEqGraphic =
    hasEq && eqFormat === AutoEqFormat.GRAPHIC && graphicEq?.length
      ? graphicEq
      : undefined;
  let eqLines: IChartLineDataPointsById = {};
  if (hasEq) {
    eqLines = nativeEqGraphic
      ? { 'eq-graphic': getGraphicEqLineData(nativeEqGraphic) }
      : bandLines;
  }
  // The bands are drawn from zero, and the preamp is left to the output
  // curve: this curve is the thing being edited, its handles sit at the gains
  // they were given, and folding the preamp in slid the line off its own
  // handles whenever a band nowhere near them got louder.
  //
  // The cuts go to the output curve too, and only there. They were drawn on
  // this line while the Tone was fitted into the bands; the Tone is a curve
  // of its own now, this line shows the bands alone, and the cuts are the
  // Tone panel's (Ivan, 2026-09-23: "the cut applies only to final output
  // since the cyan eq line now doesn't get affected by tone so cuts
  // neither").
  // What the output curve sums for the EQ: the bands as the EQ mode plays
  // them, where the EQ curve above shows them as tuned.
  const enabledBands = Object.values(filters).filter(isBandEnabled);
  const drawBands = (bands: IFilter[]): IChartLineDataPointsById =>
    Object.fromEntries(
      bands.map((filter) => [
        filter.id,
        getDesignedFilterLineData(filter, eqMatched, sampleRate),
      ]),
    );
  let appliedEqLines = eqLines;
  if (hasEq && strength === 'studio') {
    appliedEqLines = nativeEqGraphic
      ? {
          'eq-studio-graphic': getGraphicEqLineData(
            getStudioEqGraphic(nativeEqGraphic),
          ),
        }
      : drawBands(getStudioEqFilters(enabledBands, mainShape));
  } else if (hasEq) {
    const shaped = nativeEqGraphic
      ? eqLines
      : drawBands(shapeEqFilters(enabledBands, mainShape));
    appliedEqLines =
      strength === 'double'
        ? { ...shaped, 'eq-second-pass': getCombinedLineData(0, shaped) }
        : shaped;
  }

  // The custom file is applied after the generated chain. Draw a native
  // GraphicEQ directly; for parametric commands use the same biquad path as
  // every other layer. The parser's GraphicEQ projection is not drawn twice.
  const customLines: IChartLineDataPointsById = {};
  const customOn = !bypassed.includes('custom') && customFx !== undefined;
  if (customOn) {
    Object.values(customFx.filters).forEach((filter) => {
      customLines[filter.id] = lines.filterLine(filter);
    });
    if (customFx.graphicEq?.length) {
      const graphic = lines.graphicLine(customFx.graphicEq);
      if (graphic.length > 0) {
        customLines['custom-graphic'] = graphic;
      }
    }
  }
  const customPreAmp = customOn ? customFx.preAmp : 0;
  const hasCustom =
    Object.keys(customLines).length > 0 || Math.abs(customPreAmp) > 0.001;

  // What actually reaches the ears once every layer is applied: the layers
  // are written separately but heard together, and two gentle corrections in
  // the same region are not obviously gentle once they add up.
  //
  // Drawn whenever a second layer EXISTS, not whenever one is switched on, so
  // bypassing the only extra layer moves this curve rather than taking the
  // one curve that answers "what does this switch do" off the plot. Every
  // bypassed layer is an empty set of lines by now, EQ included, so the sum
  // is the chain as the engine has it and nothing more. A preamp counts on
  // its own: with a plain EQ this is the only curve showing the headroom
  // reserved, and at 0 dB it would be the EQ curve traced twice.
  const hasExtraLayers = Boolean(
    ((strength !== 'normal' || mainShape !== 'off') && hasEq) ||
    convolution ||
    hasPreAmp ||
    getVoicingFilters(voicing).length ||
    getVoicingGraphicEq(voicing).length ||
    getDriverFilters(driver).length ||
    getDriverGraphicEq(driver).length ||
    getHeadphoneFilters(headphone).length ||
    getHeadphoneGraphicEq(headphone).length ||
    getSmartEqFilters(smartEq).length ||
    getSmartEqGraphicEq(smartEq).length ||
    hasTone(tone) ||
    hasCustomFxCurve(customFx) ||
    // The one curve that carries the cuts.
    hasEqCut(eqCuts),
  );
  const layersCurve = hasExtraLayers
    ? getCombinedLineData(preAmp + customPreAmp, {
        ...appliedEqLines,
        ...toneLines,
        ...convolutionLines,
        ...voicingLines,
        ...driverLines,
        ...headphoneLines,
        ...smartLines,
        ...customLines,
      })
    : [];

  return {
    chartData: chartCurves({
      t,
      convolution:
        hasConvolution && convolution
          ? {
              name: convolution.name,
              points: getCombinedLineData(0, convolutionLines),
            }
          : undefined,
      voicing: curveOf(voicingLines),
      driver: curveOf(driverLines),
      headphone: curveOf(headphoneLines),
      smart: curveOf(smartLines),
      custom: hasCustom
        ? {
            fileName: customFx?.fileName ?? '',
            points: getCombinedLineData(customPreAmp, customLines),
          }
        : undefined,
      tone: curveOf(toneLines),
      total: hasExtraLayers
        ? {
            points: withEqCuts(layersCurve, eqCuts, sampleRate),
            isEmphasised: strength !== 'normal' || curveStrength !== 'normal',
          }
        : undefined,
      eq: hasEq
        ? {
            points: getCombinedLineData(0, eqLines),
            isQuiet: isEqQuiet,
            gradientStops: eqGradientStops(filters, rainbow),
          }
        : undefined,
    }),
    /*
     * THE GRAPH NO LONGER DERIVES THIS. IT REPORTS IT.
     *
     * Auto normalize reserves what the music needs, and half of that answer
     * is a measurement the main process holds. Recomputing the chain-only
     * worst case here would produce a different, always-wrong number — and
     * because `FrequencyResponseChart` mirrors this straight into
     * `setPreAmp`, it would overwrite the real one on every re-render: the
     * config carried -4.36 dB while the sidebar sat at -20.00 dB. So `preAmp`
     * — whatever the writer last derived, automatic or manual — is what the
     * slider and the final curve both show.
     */
    autoPreAmpValue: preAmp,
  };
};
