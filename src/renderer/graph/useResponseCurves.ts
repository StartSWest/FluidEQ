/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo, useRef } from 'react';
import type { IFiltersMap } from '../../common/constants';
import { useCurrentEngine } from '../utils/audioEngineContext';
import { useEnginePreampAudible } from '../utils/enginePreamp';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useFluidEqSmartEq } from '../utils/fluidEqSmartEq';
import { dspPresetVoicing } from '../../common/dsp/presetVoicing';
import { usePresetEditSession } from '../eq/ownPresets/presetEditSession';
import { draftCurveOf } from '../eq/ownPresets/presetEditBands';
import { useGraphEqQuiet } from '../utils/graphViewSettings';
import { useTranslation } from '../utils/I18nContext';
import { useRainbowStops } from '../utils/rainbowPalette';
import useOutputRate from '../utils/useOutputRate';
import { buildChartData, IGraphData } from './buildChartData';
import type {
  IChartCurveData,
  IChartLineDataPointsById,
} from './ChartController';
import useMatchedDesign from './useMatchedDesign';

export interface IResponseCurves extends IGraphData {
  /**
   * The curves in the audible chain: every one, or none while the engine is
   * off. The builder still works the editor's values out then, but those
   * must reach neither a plot nor its scale and make an inactive tuning look
   * applied; an empty list also gives a graph its ordinary full range.
   */
  appliedChartData: IChartCurveData[];
  /**
   * The FluidEQ Engine's automatic preamp is on: the gain is live and moves
   * at display rate, so the curves are built without it and a chart moves
   * the output curve by it (`liveEnginePreamp`).
   */
  isPreampLive: boolean;
}

/**
 * Every layer's response as the main graph draws it — the bands, the Tone,
 * the preset's curve, the headphone correction, the driver, Smart EQ, the
 * cuts, the impulse and the output they add up to — built from the sound
 * that is on now. The main graph and the Gaming Lab's Curve stage draw the
 * same curves from it (Ivan, 2026-11-02: "same as in graph we do on main
 * just copy that"), so the two can never disagree about a layer.
 */
const useResponseCurves = (): IResponseCurves => {
  const { t } = useTranslation();
  const {
    filters,
    isEngineUsable,
    isAutoPreAmpOn,
    isEqDoubleOn,
    eqMode,
    curveEqMode,
    mainBandQ,
    eqBandQ,
    curveBandQ,
    curveSmoothing,
    eqCuts,
    convolution,
    preAmp: configuredPreAmp,
    eqFormat,
    graphicEq,
    voicing: playingVoicing,
    driver,
    headphone,
    tone,
    bypassed: playingBypassed,
    customFx,
  } = useFluidEqContext();
  const smartEq = useFluidEqSmartEq();
  // A preset being edited is drawn from its draft in the same frame as the
  // handle that moved it, not a round trip later through the window's
  // layers, and drawn whatever its chip said: the first write of the draft
  // switches the layer on (`applyingLayer` in main).
  // Keyed on what the curve is made of, so a hover or a selection over its
  // handles redraws no line.
  const presetEdit = usePresetEditSession();
  const editedId = presetEdit?.presetId;
  const editedBase = presetEdit?.base;
  const editedBands = presetEdit?.bands;
  const editedVoicing = useMemo(
    () =>
      editedId !== undefined && editedBase && editedBands
        ? dspPresetVoicing(editedId, draftCurveOf(editedBase, editedBands))
        : undefined,
    [editedBands, editedBase, editedId],
  );
  const voicing = editedVoicing ?? playingVoicing;
  const bypassed = useMemo(
    () =>
      editedVoicing
        ? playingBypassed.filter((layer) => layer !== 'voicing')
        : playingBypassed,
    [editedVoicing, playingBypassed],
  );
  const currentEngine = useCurrentEngine();
  const matchedDesign = useMatchedDesign();
  const outputRate = useOutputRate('editor');
  const isEqQuiet = useGraphEqQuiet();
  const isPreampLive = currentEngine === 'fluid' && isAutoPreAmpOn;
  // All this hears of the live preamp is whether it is non-zero.
  const isLivePreampAudible = useEnginePreampAudible();
  const preAmp = isPreampLive ? 0 : configuredPreAmp;
  const hasPreAmp = isPreampLive
    ? isLivePreampAudible
    : Math.abs(configuredPreAmp) > 0.01;
  // Switched off, the impulse is not in the config and so is not drawn,
  // which is the rule every other layer follows.
  const hasConvolution =
    Boolean(convolution) && !bypassed.includes('convolution');
  // The builder's own memory of the last bands and their lines, so a band
  // that did not move keeps the line it had.
  const prevFilters = useRef<IFiltersMap>({});
  const prevFilterLines = useRef<IChartLineDataPointsById>({});
  // Rainbow mode's palette: the EQ curve's halo is drawn in it.
  const rainbow = useRainbowStops();

  const { chartData, autoPreAmpValue }: IGraphData = useMemo(
    () =>
      buildChartData({
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
        isEqDoubleOn,
        eqMode,
        curveEqMode,
        mainBandQ,
        eqBandQ,
        curveBandQ,
        curveSmoothing,
        eqCuts,
        isEqQuiet,
        hasPreAmp,
        matchedDesign,
        preAmp,
        prevFilterLines,
        prevFilters,
        rainbow,
        sampleRate: outputRate,
        smartEq,
        t,
        tone,
        voicing,
      }),
    [
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
      isAutoPreAmpOn,
      isEqDoubleOn,
      eqMode,
      curveEqMode,
      mainBandQ,
      eqBandQ,
      curveBandQ,
      curveSmoothing,
      eqCuts,
      matchedDesign,
      outputRate,
      isEqQuiet,
      preAmp,
      smartEq,
      t,
      tone,
      voicing,
      rainbow,
    ],
  );

  const appliedChartData = useMemo(
    () => (isEngineUsable ? chartData : []),
    [chartData, isEngineUsable],
  );

  return { chartData, autoPreAmpValue, appliedChartData, isPreampLive };
};

export default useResponseCurves;
