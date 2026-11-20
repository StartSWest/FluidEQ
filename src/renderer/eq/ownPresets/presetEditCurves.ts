/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TGraphCurve } from '../../utils/graphViewSettings';
import {
  VOICING_CURVE_ID,
  type IChartCurveData,
} from '../../graph/ChartController';
import { RIGHT_EAR_CURVE_ID } from '../../graph/chartCurves';
import { ColorEnum } from '../../styles/color';
import shownCurves from '../../graph/shownCurves';

const EQ_CURVE_IDS = ['EQ Response', RIGHT_EAR_CURVE_ID];

/**
 * How present Your EQ's line is while a preset's curve is edited over it:
 * there to read the preset against, and plainly not the line being moved.
 */
const YOUR_EQ_WHILE_EDITING = 0.32;

/**
 * The graph's lines while one of the listener's presets is open: the
 * preset's curve at full strength in its violet, the line its handles stand
 * on, and Your EQ's drawn back and thin, without its spectrum shading, as
 * the context it is. Everything else as it was.
 */
export const presetEditCurves = (
  curves: readonly IChartCurveData[],
): IChartCurveData[] =>
  curves.map((curve) => {
    if (curve.id === VOICING_CURVE_ID) {
      return {
        ...curve,
        line: {
          ...curve.line,
          color: ColorEnum.PRESET_EDIT,
          strokeWidth: 3,
          opacity: 1,
        },
      };
    }
    if (EQ_CURVE_IDS.includes(curve.id)) {
      return {
        ...curve,
        line: {
          color: curve.line.color,
          points: curve.line.points,
          ...(curve.line.dashed ? { dashed: true } : {}),
          strokeWidth: 1.5,
          opacity: YOUR_EQ_WHILE_EDITING,
        },
      };
    }
    return curve;
  });

/**
 * The lines the graph draws: those the legend has not switched off, and while
 * a preset is open, its own line whatever the legend says — it is the one
 * being shaped — and the rest restyled round it.
 */
export const shownCurvesFor = (
  isEditingPreset: boolean,
  curves: readonly IChartCurveData[],
  hidden: readonly TGraphCurve[],
): IChartCurveData[] =>
  isEditingPreset
    ? presetEditCurves(
        shownCurves(
          curves,
          hidden.filter((curve) => curve !== 'voicing'),
        ),
      )
    : shownCurves(curves, hidden);
