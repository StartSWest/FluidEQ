/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo, useRef } from 'react';
import type { IFiltersMap } from 'common/constants';
import { buildChartData } from '../graph/buildChartData';
import {
  IChartLineDataPointsById,
  IChartPointData,
  OUTPUT_CURVE_ID,
} from '../graph/ChartController';
import { useEnginePreampAudible } from '../utils/enginePreamp';
import useMatchedDesign from '../graph/useMatchedDesign';
import useOutputRate from '../utils/useOutputRate';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';

/** The EQ curve's id among the graph's curves. */
const EQ_CURVE_ID = 'EQ Response';
/** The measured correction's id among them. */
const SMART_CURVE_ID = 'Smart EQ';

export interface IPlayerCurves {
  /** What is heard: the bands and every layer, where there are layers. */
  total: IChartPointData[] | undefined;
  /** The bands alone. */
  bands: IChartPointData[] | undefined;
  /**
   * What Smart EQ is doing to the song, alone. Nobody chose this curve's
   * shape, so it is the one layer that cannot be read off a control — and
   * on a screen whose whole point is to show what the song is getting, a
   * correction that cannot be seen is a correction that cannot be argued
   * with (Ivan, 2026-09-22). Absent when there is no correction.
   */
  smart: IChartPointData[] | undefined;
}

/**
 * The player's screen draws the same curves the graph does, built by the
 * graph's own builder from the same state, so the small screen and the big
 * graph cannot tell two stories about one EQ. Only the three it shows are
 * kept: what is heard, the bands, and the Smart EQ correction.
 *
 * `isAutomatic` is whether the preamp on screen is the engine's own rather
 * than the stored one — under the FluidEQ Engine with Auto normalize on. Then
 * the stored number is not what is being applied and the live one is, so the
 * curve is built with no preamp in it at all and the screen slides it by the
 * live figure at DRAW time (`eqCurvePaint.ts`). Built with the live number
 * instead, every one of its steps would rebuild every curve: the engine ramps
 * it at display rate on loud passages, which is exactly the stutter the graph
 * moves its own output curve by hand to avoid (`enginePreamp.ts`). What is
 * kept here is only whether there is a curve to slide — a fact that flips a
 * few times a session.
 */
const usePlayerCurves = (isAutomatic: boolean): IPlayerCurves => {
  const { t } = useTranslation();
  const {
    bypassed,
    convolution,
    customFx,
    driver,
    eqFormat,
    filters,
    graphicEq,
    headphone,
    isAutoPreAmpOn,
    isEqDoubleOn,
    eqMode,
    curveEqMode,
    eqBandQ,
    curveBandQ,
    curveSmoothing,
    preAmp,
    smartEq,
    voicing,
  } = useFluidEqContext();
  const isAutomaticAudible = useEnginePreampAudible();
  const matchedDesign = useMatchedDesign();
  const outputRate = useOutputRate();
  const prevFilters = useRef<IFiltersMap>({});
  const prevFilterLines = useRef<IChartLineDataPointsById>({});
  // What goes into the curve, and whether there is one to draw at all.
  const builtPreAmp = isAutomatic ? 0 : preAmp;
  const hasPreAmp = isAutomatic ? isAutomaticAudible : Math.abs(preAmp) > 0.01;

  return useMemo(() => {
    const { chartData } = buildChartData({
      bypassed,
      convolution,
      customFx,
      driver,
      eqFormat,
      filters,
      graphicEq,
      hasConvolution: Boolean(convolution) && !bypassed.includes('convolution'),
      headphone,
      isAutoPreAmpOn,
      isEqDoubleOn,
      eqMode,
      curveEqMode,
      eqBandQ,
      curveBandQ,
      curveSmoothing,
      isEqQuiet: false,
      hasPreAmp,
      matchedDesign,
      preAmp: builtPreAmp,
      prevFilterLines,
      prevFilters,
      sampleRate: outputRate,
      smartEq,
      t,
      voicing,
    });
    const bands = chartData.find((curve) => curve.id === EQ_CURVE_ID)?.line
      .points;
    const total =
      chartData.find((curve) => curve.id === OUTPUT_CURVE_ID)?.line.points ??
      bands;
    const smart = chartData.find((curve) => curve.id === SMART_CURVE_ID)?.line
      .points;
    return { total, bands, smart };
  }, [
    builtPreAmp,
    matchedDesign,
    outputRate,
    bypassed,
    convolution,
    customFx,
    driver,
    eqFormat,
    filters,
    graphicEq,
    hasPreAmp,
    headphone,
    isAutoPreAmpOn,
    isEqDoubleOn,
    eqMode,
    curveEqMode,
    eqBandQ,
    curveBandQ,
    curveSmoothing,
    smartEq,
    t,
    voicing,
  ]);
};

export default usePlayerCurves;
