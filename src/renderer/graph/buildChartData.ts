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

import { MutableRefObject } from 'react';
import {
  AutoEqFormat,
  IFilter,
  IFiltersMap,
  IState,
  MAX_GAIN,
  MIN_GAIN,
  TApoLayer,
} from 'common/constants';
import {
  GRAPH_END,
  GRAPH_START,
  IChartCurveData,
  IChartLineDataPointsById,
} from './ChartController';
import {
  getFilterLineData,
  getCombinedLineData,
  getGraphicEqLineData,
} from './utils';
import { ColorEnum, SecondaryColorEnum } from '../styles/color';
import { getBandColor } from '../utils/bandColors';
import { useTranslation } from '../utils/I18nContext';
import { getVoicingFilters, getVoicingGraphicEq } from '../../common/voicing';
import { getDriverFilters, getDriverGraphicEq } from '../../common/driver';
import {
  getHeadphoneFilters,
  getHeadphoneGraphicEq,
} from '../../common/headphone';
import { getSmartEqFilters, getSmartEqGraphicEq } from '../../common/smartEq';
import { hasCustomFxCurve } from '../../common/customFx';
import { getAutoPreAmpGain } from '../../common/response';

/** Supporting curves sit behind the one in focus rather than competing with it. */
export const SUPPORTING_CURVE_OPACITY = 0.5;

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
export interface IBuildChartDataParams extends Pick<
  IState,
  | 'convolution'
  | 'customFx'
  | 'driver'
  | 'eqFormat'
  | 'filters'
  | 'graphicEq'
  | 'headphone'
  | 'isAutoPreAmpOn'
  | 'isSmartHeadroomOn'
  | 'preAmp'
  | 'smartEq'
  | 'voicing'
> {
  /**
   * Not from `IState`, where it is optional.
   *
   * The context always supplies a list, and every use here is a membership
   * test. Taking the optional form would mean guarding each one against an
   * absence that cannot happen.
   */
  bypassed: TApoLayer[];
  hasConvolution: boolean;
  isEqQuiet: boolean;
  t: ReturnType<typeof useTranslation>['t'];
  /**
   * Last render's bands and the lines drawn for them, kept across renders.
   *
   * A band's line is expensive and most renders change one band, so the rest
   * are reused rather than recomputed. That makes this a cache with a lifetime,
   * which is why it arrives as refs the component owns instead of living here:
   * module state would be one cache shared by every chart on screen, and two
   * charts showing different tunings would answer each other's questions.
   */
  prevFilters: MutableRefObject<IFiltersMap>;
  prevFilterLines: MutableRefObject<IChartLineDataPointsById>;
}

/**
 * Cheaper than redrawing a band's line to find out it did not move.
 *
 * A missing band on either side counts as unequal rather than throwing: the
 * previous render's map is a cache, and a band that has just been added is
 * absent from it by definition.
 */
const isFilterEqual = (f1: IFilter, f2: IFilter) => {
  if (!f1 || !f2) {
    return false;
  }

  return (
    f1.frequency === f2.frequency &&
    f1.gain === f2.gain &&
    f1.quality === f2.quality &&
    f1.type === f2.type
  );
};

/**
 * Every curve the graph draws, built in one pass.
 *
 * Six hundred lines inside a component, almost all of it a function of the
 * tuning and nothing else. The exception is the two caches, which is why they
 * are parameters: everything else here can be read off the arguments, and
 * saying so in the signature is the point of moving it out.
 *
 * One pass rather than a builder per layer, because the layers are not
 * independent: the final chain is their sum, and the automatic preamp is
 * measured from that sum. Computing each in isolation would mean walking the
 * whole set again to add them up.
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
  headphone,
  isAutoPreAmpOn,
  isSmartHeadroomOn,
  isEqQuiet,
  preAmp,
  prevFilterLines,
  prevFilters,
  smartEq,
  t,
  voicing,
}: IBuildChartDataParams): IGraphData => {
  const updatedFilterLines: IChartLineDataPointsById = {};

  // Update filter lines that have changed
  Object.values(filters).forEach((filter) => {
    // New filters have no previous data
    if (!(filter.id in prevFilters.current)) {
      updatedFilterLines[filter.id] = getFilterLineData(filter);
      return;
    }

    // Recompute filter line if it has been adjusted
    if (!isFilterEqual(filter, prevFilters.current[filter.id])) {
      updatedFilterLines[filter.id] = getFilterLineData(filter);
    } else {
      // Otherwise, reuse previous data
      updatedFilterLines[filter.id] = prevFilterLines.current[filter.id];
    }
  });

  // Update past state
  prevFilterLines.current = updatedFilterLines;
  prevFilters.current = filters;

  // The voicing is a real APO layer, so it gets a real curve rather than a
  // note in the UI. Its filters run through the same biquad code as the
  // bands, which is what makes "EQ + voicing" an honest sum rather than an
  // approximation of one.
  const voicingFilterLines: IChartLineDataPointsById = {};
  const voicingGraphic = bypassed.includes('voicing')
    ? []
    : getVoicingGraphicEq(voicing);
  if (voicingGraphic.length) {
    voicingFilterLines['voicing-graphic'] =
      getGraphicEqLineData(voicingGraphic);
  }
  // Nothing is drawn for a layer that is switched off.
  //
  // Bypass keeps the layer in state so the chip can put it back, which means
  // the graph would happily go on drawing a curve for something that is no
  // longer in the config — and a graph that disagrees with what you hear is
  // worse than one that shows less. This is what makes the A/B honest.
  (bypassed.includes('voicing') || voicingGraphic.length
    ? []
    : getVoicingFilters(voicing)
  ).forEach((filter, index) => {
    const id = `voicing-${index}`;
    voicingFilterLines[id] = getFilterLineData({
      id,
      frequency: filter.frequency,
      gain: filter.gain,
      quality: filter.quality,
      type: filter.type,
    });
  });
  const hasVoicing = Object.keys(voicingFilterLines).length > 0;

  // Driver compensation is a third APO layer, so it gets the same treatment:
  // its own curve, from the same biquad code, rather than an invisible
  // correction the user has to take on trust.
  const driverFilterLines: IChartLineDataPointsById = {};
  const driverGraphic = bypassed.includes('driver')
    ? []
    : getDriverGraphicEq(driver);
  if (driverGraphic.length) {
    driverFilterLines['driver-graphic'] = getGraphicEqLineData(driverGraphic);
  }
  (bypassed.includes('driver') || driverGraphic.length
    ? []
    : getDriverFilters(driver)
  ).forEach((filter, index) => {
    const id = `driver-${index}`;
    driverFilterLines[id] = getFilterLineData({
      id,
      frequency: filter.frequency,
      gain: filter.gain,
      quality: filter.quality,
      type: filter.type,
    });
  });
  const hasDriver = Object.keys(driverFilterLines).length > 0;

  // The published headphone correction, which had no curve here at all.
  //
  // It was the one layer the graph did not know about: no line, no chip, and
  // — the part that was wrong rather than merely missing — absent from the
  // total and from the headroom below, so the curve labelled "Final output"
  // was not the output and the preamp reserved nothing for a correction that
  // can easily ask for six decibels. It was reported as "the AutoEQ is being
  // applied as the EQ", which is what a correction with no line of its own
  // looks like from the outside.
  //
  // The filter projection rather than the published points, because a curve
  // here is built from biquads: `getHeadphoneFilters` is what the editor and
  // the band handles already read, so the line on the plot is the line the
  // sliders describe. The writer prefers the points where a profile has them
  // — see `getHeadphoneGraphicEq` — so this is an approximation of the
  // published curve in exactly the way the editor's own bands are.
  const headphoneFilterLines: IChartLineDataPointsById = {};
  const headphoneGraphic = bypassed.includes('headphone')
    ? []
    : getHeadphoneGraphicEq(headphone);
  if (headphoneGraphic.length) {
    headphoneFilterLines['headphone-graphic'] =
      getGraphicEqLineData(headphoneGraphic);
  }
  (bypassed.includes('headphone') || headphoneGraphic.length
    ? []
    : getHeadphoneFilters(headphone)
  ).forEach((filter, index) => {
    const id = `headphone-${index}`;
    headphoneFilterLines[id] = getFilterLineData({
      id,
      frequency: filter.frequency,
      gain: filter.gain,
      quality: filter.quality,
      type: filter.type,
    });
  });
  const hasHeadphone = Object.keys(headphoneFilterLines).length > 0;

  // What the measurement decided, drawn like any other layer. This one has
  // the strongest claim to a curve of its own: nobody chose its shape, so the
  // graph is the only place it can be inspected at all.
  const smartFilterLines: IChartLineDataPointsById = {};
  const smartGraphic = bypassed.includes('smart')
    ? []
    : getSmartEqGraphicEq(smartEq);
  if (smartGraphic.length) {
    smartFilterLines['smart-graphic'] = getGraphicEqLineData(smartGraphic);
  }
  (bypassed.includes('smart') || smartGraphic.length
    ? []
    : getSmartEqFilters(smartEq)
  ).forEach((filter, index) => {
    const id = `smart-eq-${index}`;
    smartFilterLines[id] = getFilterLineData({
      id,
      frequency: filter.frequency,
      gain: filter.gain,
      quality: filter.quality,
      type: filter.type,
    });
  });
  const hasSmartEq = Object.keys(smartFilterLines).length > 0;

  // Nothing drawn for an impulse that is switched off, for the same reason as
  // the other layers: this is what Equalizer APO is applying, and a graph
  // that disagrees with what you hear is worse than one that shows less.
  const convolutionFilterLines: IChartLineDataPointsById = {};
  if (!bypassed.includes('convolution')) {
    if (convolution?.response?.length) {
      convolutionFilterLines['convolution-response'] = getGraphicEqLineData(
        convolution.response,
      );
    } else {
      Object.values(convolution?.filters || {}).forEach((filter) => {
        convolutionFilterLines[filter.id] = getFilterLineData(filter);
      });
    }
  }

  const convolutionCurveData = getCombinedLineData(0, convolutionFilterLines);
  // A switched-off EQ has no curve at all, like every other switched-off
  // layer. It used to be drawn flat, which is not the same claim: flat says
  // "these bands are doing nothing", and what is true is that they are not in
  // the chain. The output curve below is where the difference shows.
  const hasEq = !bypassed.includes('eq');
  const nativeEqGraphic =
    hasEq && eqFormat === AutoEqFormat.GRAPHIC && graphicEq?.length
      ? graphicEq
      : undefined;
  let eqLineData: IChartLineDataPointsById = {};
  if (hasEq) {
    eqLineData = nativeEqGraphic
      ? { 'eq-graphic': getGraphicEqLineData(nativeEqGraphic) }
      : updatedFilterLines;
  }
  // The bands are drawn from zero, and the preamp is left to the output
  // curve.
  //
  // This curve is the thing being edited, and its handles sit at the gains
  // they were given — so folding the preamp into it slid the line off its own
  // handles by however much headroom the chain happened to need, and moved
  // every band on screen whenever a band nowhere near it got louder. Nothing
  // about the tuning changed; only the drawing did, which is the complaint
  // the auto-normalize floor was already fixed for once.
  //
  // The preamp is real and still has to be visible, so the output curve below
  // carries it. That is the honest place for it: it is the level the chain
  // comes out at, not a property of any one band.
  const eqCurveData = getCombinedLineData(0, eqLineData);
  const voicingCurveData = hasVoicing
    ? getCombinedLineData(0, voicingFilterLines)
    : [];
  const driverCurveData = hasDriver
    ? getCombinedLineData(0, driverFilterLines)
    : [];
  const headphoneCurveData = hasHeadphone
    ? getCombinedLineData(0, headphoneFilterLines)
    : [];
  const smartCurveData = hasSmartEq
    ? getCombinedLineData(0, smartFilterLines)
    : [];
  // The custom file is applied after the generated chain. Draw a native
  // GraphicEQ directly; for parametric commands use the same biquad path as
  // every other layer. The parser's GraphicEQ projection is not drawn twice.
  const customFilterLines: IChartLineDataPointsById = {};
  const customGraphicLines: IChartLineDataPointsById = {};
  if (!bypassed.includes('custom') && customFx) {
    if (customFx.graphicEq?.length) {
      const graphic = getGraphicEqLineData(customFx.graphicEq);
      if (graphic.length > 0) {
        customGraphicLines['custom-graphic'] = graphic;
      }
    }
    Object.values(customFx.filters).forEach((filter) => {
      customFilterLines[filter.id] = getFilterLineData(filter);
    });
  }
  const customLines = { ...customFilterLines, ...customGraphicLines };
  const hasCustom =
    Object.keys(customLines).length > 0 ||
    (!bypassed.includes('custom') &&
      customFx !== undefined &&
      Math.abs(customFx.preAmp) > 0.001);
  const customCurveData = hasCustom
    ? getCombinedLineData(customFx?.preAmp ?? 0, customLines)
    : [];
  // What actually reaches the ears once every layer is applied. Worth its own
  // curve because the layers are written separately but heard together, and
  // two gentle corrections in the same region are not obviously gentle once
  // they add up.
  //
  // Drawn whenever a second layer EXISTS, not whenever one is switched on.
  // Gating it on the latter meant bypassing the only extra layer took the
  // output curve off the plot altogether — so the one curve that answers
  // "what does this switch actually do to what I hear" vanished at the exact
  // moment it was asked. It stays, and it moves.
  //
  // Every bypassed layer is already an empty set of lines by this point, EQ
  // included, so this sum is the chain as Equalizer APO has it and nothing
  // more.
  //
  // A non-zero preamp counts as a reason on its own, now that the bands are
  // drawn from zero: with a plain EQ and nothing else, this is the only curve
  // left that shows the headroom being reserved, and a chain quietly sitting
  // 6 dB down with nothing on screen saying so is how a silent output goes
  // unnoticed. At 0 dB it would be the EQ curve traced twice, so it is not
  // drawn.
  const hasExtraLayers = Boolean(
    convolution ||
    Math.abs(preAmp) > 0.01 ||
    getVoicingFilters(voicing).length ||
    getVoicingGraphicEq(voicing).length ||
    getDriverFilters(driver).length ||
    getDriverGraphicEq(driver).length ||
    getHeadphoneFilters(headphone).length ||
    getHeadphoneGraphicEq(headphone).length ||
    getSmartEqFilters(smartEq).length ||
    getSmartEqGraphicEq(smartEq).length ||
    hasCustomFxCurve(customFx),
  );
  const totalCurveData = hasExtraLayers
    ? getCombinedLineData(
        preAmp +
          (bypassed.includes('custom') || !customFx ? 0 : customFx.preAmp),
        {
          ...eqLineData,
          ...convolutionFilterLines,
          ...voicingFilterLines,
          ...driverFilterLines,
          // The line this was named for. Left out, the sum was every layer but
          // one and still called itself the final output — and the layer it
          // omitted is frequently the largest thing in the chain, so the curve
          // somebody reads to answer "what am I actually hearing" was wrong by
          // several decibels wherever the correction was working hardest.
          ...headphoneFilterLines,
          ...smartFilterLines,
          ...customLines,
        },
      )
    : [];
  // Named for what it is rather than for what went into it.
  //
  // It used to spell out its own ingredients — "EQ + voicing + Smart EQ" —
  // which is the longest chip in the legend and still does not say the thing
  // that matters, which is that this line is the one you are listening to.
  const totalCurveName = t('graph.curve.total');
  const sortedFilters = Object.values(filters).sort(
    (a, b) => a.frequency - b.frequency,
  );
  const logSpan = Math.log(GRAPH_END / GRAPH_START);
  const eqGradientStops = [
    { offset: 0, color: getBandColor(0).color },
    ...sortedFilters.map((filter, index) => ({
      offset: Math.log(filter.frequency / GRAPH_START) / logSpan,
      color: getBandColor(
        sortedFilters.length > 1 ? index / (sortedFilters.length - 1) : 0,
      ).color,
    })),
    { offset: 1, color: getBandColor(1).color },
  ];

  // Compute preAmp line data
  // const preAmpLine = getPreAmpLine(preAmp);

  // One rule for how loud a chain is, and it is the writer's.
  //
  // This used to negate the highest point of the drawn curve with no floor at
  // zero, so a chain that only cuts produced a *positive* preamp — sixteen
  // decibels of makeup gain on one real profile — and the graph then drew
  // itself lifted by it, which is why a heavily cut correction appeared to be
  // sitting at unity. Equalizer APO never saw a decibel of it: the writer
  // reserves headroom for boosts and stops at zero, so the file said 0 dB
  // while the picture claimed otherwise and the volume never moved.
  //
  // Worse, it moved for no reason anybody could hear. Switching one band to
  // Low Pass changes where the chain peaks, which changed the makeup, which
  // slid the entire curve up or down — a redraw that looked like a tuning
  // change and was not.
  //
  // So the peak comes from the same strict combined-response function the
  // config writer uses. File-backed convolutions contribute their measured
  // WAV response rather than an assumption about publisher normalization.
  // Floored at MIN_GAIN, because the chain can now ask for more headroom than
  // a preamp is allowed to give.
  //
  // Every layer is capped at 20 dB on its own and there are five of them, so
  // the sum has always been able to exceed the range — but in practice the
  // only layer that stacked on top of the user's own was Smart EQ, and Smart
  // EQ was capped at 6. Taking that cap off, so a continuous mode can actually
  // undo a band somebody dragged to -16, is what made the arithmetic reachable
  // and threw "Invalid gain value - outside of range" out of an effect on
  // mount, which the error boundary turns into a blank workspace.
  //
  // Clamping loses nothing real: a chain needing more than 20 dB of headroom
  // will clip on the loudest peaks whatever this says, and the alternative is
  // not "correct headroom" but "no application".
  // Both directions, and clamped at both ends. The third copy of this
  // arithmetic and the third place the same `Math.max(0, …)` was pinning the
  // preamp to attenuation only — so a chain that merely cut left the volume
  // on the floor, live as well as on disk. Positive when the chain cuts,
  // negative when it boosts; the loudest point lands at unity either way.
  // Native GraphicEQ stages are not represented by the projected editor
  // bands when APO writes the chain. Remove those projections from the
  // biquad list and measure the actual points instead, matching flush.ts.
  const nativeHeadphoneGraphic = bypassed.includes('headphone')
    ? undefined
    : getHeadphoneGraphicEq(headphone);
  const nativeDriverGraphic = bypassed.includes('driver')
    ? undefined
    : getDriverGraphicEq(driver);
  const nativeVoicingGraphic = bypassed.includes('voicing')
    ? undefined
    : getVoicingGraphicEq(voicing);
  const nativeSmartGraphic = bypassed.includes('smart')
    ? undefined
    : getSmartEqGraphicEq(smartEq);
  const nativeCustomGraphic =
    !bypassed.includes('custom') && customFx?.graphicEq?.length
      ? customFx.graphicEq
      : undefined;
  const eqFilters =
    bypassed.includes('eq') || nativeEqGraphic ? [] : Object.values(filters);
  const headphoneFilters =
    bypassed.includes('headphone') || nativeHeadphoneGraphic?.length
      ? []
      : getHeadphoneFilters(headphone);
  const customFilters =
    bypassed.includes('custom') || !customFx
      ? []
      : Object.values(customFx.filters);
  const customPreAmp =
    bypassed.includes('custom') || !customFx ? 0 : customFx.preAmp;
  const convolutionCurve =
    convolution?.fileName &&
    !bypassed.includes('convolution') &&
    convolution.response?.length
      ? convolution.response
      : undefined;
  const fallbackConvolutionCurve =
    convolution?.fileName &&
    !convolutionCurve &&
    !bypassed.includes('convolution') &&
    Number.isFinite(convolution.peakGainDb)
      ? [
          { frequency: 10, gain: convolution.peakGainDb as number },
          { frequency: 20000, gain: convolution.peakGainDb as number },
        ]
      : undefined;
  const calculatedAutoPreAmpValue = Math.min(
    MAX_GAIN,
    Math.max(
      MIN_GAIN,
      getAutoPreAmpGain({
        filters: [
          ...(convolution &&
          !convolution.fileName &&
          !bypassed.includes('convolution')
            ? Object.values(convolution.filters || {})
            : []),
          ...eqFilters,
          ...(bypassed.includes('driver') || nativeDriverGraphic?.length
            ? []
            : getDriverFilters(driver)),
          ...headphoneFilters,
          ...(bypassed.includes('voicing') || nativeVoicingGraphic?.length
            ? []
            : getVoicingFilters(voicing)),
          ...(bypassed.includes('smart') || nativeSmartGraphic?.length
            ? []
            : getSmartEqFilters(smartEq)),
          ...customFilters,
        ],
        curves: [
          nativeEqGraphic,
          nativeDriverGraphic,
          nativeHeadphoneGraphic,
          nativeVoicingGraphic,
          nativeSmartGraphic,
          nativeCustomGraphic,
          convolutionCurve,
          fallbackConvolutionCurve,
        ],
        constantGain: customPreAmp,
      }),
    ),
  );
  return {
    chartData: [
      ...(hasConvolution && convolution
        ? [
            {
              id: 'Headphone Convolution',
              name: `Convolution · ${convolution.name}`,
              line: {
                color: ColorEnum.COMPLEMENTARY,
                strokeWidth: 2,
                opacity: SUPPORTING_CURVE_OPACITY,
                points: convolutionCurveData,
              },
            } as IChartCurveData,
          ]
        : []),
      // The voicing layer on its own, so its shape is readable next to the
      // bands rather than hidden inside their sum.
      ...(hasVoicing
        ? [
            {
              id: 'Voicing',
              name: t('graph.curve.voicing'),
              line: {
                color: ColorEnum.TRIADIC1,
                strokeWidth: 2,
                opacity: SUPPORTING_CURVE_OPACITY,
                points: voicingCurveData,
              },
            } as IChartCurveData,
          ]
        : []),
      // Driver compensation gets the same treatment as the voicing: its own
      // curve, so a correction applied on your behalf is visible rather than
      // taken on trust.
      ...(hasDriver
        ? [
            {
              id: 'Driver',
              name: t('graph.curve.driver'),
              line: {
                color: ColorEnum.DRIVER,
                strokeWidth: 2,
                opacity: SUPPORTING_CURVE_OPACITY,
                points: driverCurveData,
              },
            } as IChartCurveData,
          ]
        : []),
      // Beside the driver, and drawn like it: a correction applied on your
      // behalf, visible rather than taken on trust. It was the only one of the
      // four without a line, and frequently the largest of them — so the only
      // way to see its shape was to switch it off and watch the total move.
      ...(hasHeadphone
        ? [
            {
              id: 'Headphone Correction',
              name: t('graph.curve.headphone'),
              line: {
                color: ColorEnum.HEADPHONE,
                strokeWidth: 2,
                opacity: SUPPORTING_CURVE_OPACITY,
                points: headphoneCurveData,
              },
            } as IChartCurveData,
          ]
        : []),
      // Nobody chose this curve's shape, so it is the one layer that cannot
      // be inspected anywhere else. Drawn separately from the total for the
      // same reason as the other two: a correction you can see is a
      // correction you can argue with.
      ...(hasSmartEq
        ? [
            {
              id: 'Smart EQ',
              name: t('graph.curve.smart'),
              line: {
                color: ColorEnum.SMART,
                strokeWidth: 2,
                opacity: SUPPORTING_CURVE_OPACITY,
                points: smartCurveData,
              },
            } as IChartCurveData,
          ]
        : []),
      ...(hasCustom
        ? [
            {
              id: 'Custom FX',
              name: `${t('graph.curve.custom')} · ${customFx?.fileName ?? ''}`,
              line: {
                color: ColorEnum.CUSTOM,
                strokeWidth: 2,
                opacity: SUPPORTING_CURVE_OPACITY,
                points: customCurveData,
              },
            } as IChartCurveData,
          ]
        : []),
      ...(hasExtraLayers
        ? [
            {
              id: 'Total Response',
              name: totalCurveName,
              line: {
                color: ColorEnum.TOTAL,
                strokeWidth: 2,
                opacity: SUPPORTING_CURVE_OPACITY,
                points: totalCurveData,
              },
            } as IChartCurveData,
          ]
        : []),
      // Quietly in the reading state, at full weight everywhere else.
      //
      // The line itself was never what made the layer curves hard to read —
      // its furniture was: three pixels of stroke with a glow under it, a
      // spectrum gradient, and two dozen handles sitting on top of the very
      // curves somebody is trying to see. Taking the whole curve away removed
      // the thing everything else is read against, which answers a different
      // question from the one being asked. So the furniture goes and the line
      // stays, thin and plain.
      ...(hasEq
        ? [
            {
              id: 'EQ Response',
              name: t('graph.curve.eq'),
              line: isEqQuiet
                ? {
                    color: SecondaryColorEnum.DEFAULT,
                    strokeWidth: 1.5,
                    opacity: SUPPORTING_CURVE_OPACITY,
                    points: eqCurveData,
                  }
                : {
                    color: SecondaryColorEnum.DEFAULT,
                    strokeWidth: 3,
                    points: eqCurveData,
                    gradientId: 'chart-eq-spectrum-gradient',
                    gradientStops: eqGradientStops,
                    glow: true,
                  },
            } as IChartCurveData,
          ]
        : []),
    ],
    // Rounding to two decimals. When disabled, expose the current manual
    // preamp so the graph and APO remain in sync without auto-adjusting it.
    /*
     * Smart's number is not derivable here, and must not be guessed at.
     *
     * The value above is the worst case, computed from the chain alone. Smart's
     * depends on a measurement that lives in the main process, so the only
     * honest thing the graph can show is the value that came back from the
     * writer — which is what `preAmp` already holds.
     *
     * This is a correctness fix and not a display one. `FrequencyResponseChart`
     * mirrors this straight into `setPreAmp`, so returning the worst case while
     * Smart was on would have the renderer overwrite the measured preamp with
     * an unmeasured one on every re-render, and the mode would appear to do
     * nothing at all. Returning `preAmp` makes that mirror a no-op, which is
     * exactly what it should be when somebody else owns the number.
     */
    autoPreAmpValue:
      isAutoPreAmpOn && !isSmartHeadroomOn ? calculatedAutoPreAmpValue : preAmp,
  };
};
