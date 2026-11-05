/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TGraphCurve } from '../utils/graphViewSettings';
import type { IChartCurveData } from './ChartController';
import { RIGHT_EAR_CURVE_ID } from './chartCurves';

/**
 * Which stored curve each of the chart's curves is, so the legend and the store
 * can name the same line without either having to use the other's words.
 */
const CURVE_BY_CHART_ID: Record<string, TGraphCurve> = {
  'Headphone Convolution': 'convolution',
  'EQ Response': 'eq',
  // The two ears are one layer, shown and hidden together.
  [RIGHT_EAR_CURVE_ID]: 'eq',
  Voicing: 'voicing',
  Driver: 'driver',
  // Spelled out rather than left as `Headphone`, which would sit one line under
  // the impulse response's `Headphone Convolution` and read as its abbreviation.
  // They are different layers with different colours and either can hide the
  // other's chip if the two ids are confused.
  'Headphone Correction': 'headphone',
  'Smart EQ': 'smart',
  'Custom FX': 'custom',
  Tone: 'tone',
  'Total Response': 'total',
};

/**
 * The curves the View menu has not switched off. Dropped rather than drawn
 * transparent: a path at zero alpha is still rebuilt every time a band moves.
 * Every chart that draws the layers asks this, so a curve hidden on the main
 * graph is hidden wherever the layers are drawn.
 */
const shownCurves = (
  curves: readonly IChartCurveData[],
  hidden: readonly TGraphCurve[],
): IChartCurveData[] =>
  curves.filter((curve) => !hidden.includes(CURVE_BY_CHART_ID[curve.id]));

export default shownCurves;
