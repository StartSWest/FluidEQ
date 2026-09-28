/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisFrame, IAnalysisState } from './analysisFrame';
import {
  advanceBars,
  barsMoving,
  paintBarRows,
  type IBarView,
} from './barRows';
import { readFractionalBands } from './octaveBands';

/**
 * The real-time analyser: one bar per fractional-octave band, with a cap.
 *
 * The bands are equal slices of the plot's LOG axis, which is what makes them
 * fractional octaves — thirty-four of them across the plot's eleven and a
 * third octaves is the standard third-octave set, and Pieces walks it from
 * whole octaves up to twelfth-octave without another control.
 *
 * Each band's reading is the POWER mean of the points inside it, never the
 * loudest of them (`octaveBands.ts`). A band is a share of the energy, and
 * taking its peak would report a narrow tone as if it filled the whole band —
 * which on a display people set room curves by is a lie with consequences.
 *
 * The cap is the part that makes it an RTA rather than a bar chart: it jumps
 * to every peak, hangs, and then falls at a steady rate, so the eye can read
 * a passage's shape from one glance a second after it happened.
 */
export const RTA_BARS: IBarView = {
  count: (pieces) => Math.max(4, Math.min(160, pieces)),
  read: (levels, _axis, bands) => readFractionalBands(levels, bands),
  hangMs: 1100,
  /** Plot depths per second: about six decibels, the rate an RTA cap falls. */
  fall: 0.075,
  minGap: 0,
  minWidth: 1,
  pairInset: 0.5,
  capHeight: 2.5,
  capLift: 3,
  capAlpha: 0.78,
  shortest: 0.5,
  radius: () => 0,
};

const drawRtaView = (frame: IAnalysisFrame, state: IAnalysisState): boolean => {
  const bars = advanceBars(frame, state, RTA_BARS);
  paintBarRows(frame, bars, RTA_BARS);
  return barsMoving(bars);
};

export default drawRtaView;
