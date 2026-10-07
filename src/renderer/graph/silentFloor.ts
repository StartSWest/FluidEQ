/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { MIN_GAIN } from 'common/constants';
import type { IChartPointData } from './ChartController';
import { GRAPH_SILENT_POINTS } from './liveGraphBand';

/** Silence laid out on `axis`'s frequencies, every point on the floor. */
export const silenceOn = (
  axis: readonly IChartPointData[],
): readonly IChartPointData[] =>
  Object.freeze(axis.map(({ x }) => Object.freeze({ x, y: MIN_GAIN })));

/** Whether two sets of points stand at the same frequencies, point by point. */
const isSameAxis = (
  one: readonly IChartPointData[],
  other: readonly IChartPointData[],
): boolean => {
  if (one.length !== other.length) {
    return false;
  }
  for (let index = 0; index < one.length; index += 1) {
    if (one[index].x !== other[index].x) {
      return false;
    }
  }
  return true;
};

/**
 * The floor the live trace falls to when the music stops, on the frequencies
 * it was last measured at.
 *
 * Silence is no points at all (`liveCapturePump.ts`), so the trace is handed a
 * floor of its own to fall to, and takes each point's frequency from what it
 * is handed (`traceEasing.ts`). That floor was the graphs' fixed one, 10 Hz to
 * 25 kHz, while the measurement runs from 10 Hz to the output's Nyquist — 24
 * kHz at 48 kHz, 22.05 at 44.1 — so every level still falling was redrawn a
 * little higher up the axis than it was heard: stopping the music moved the
 * whole graph to the right, a 10 kHz peak 4.5 px on a 1,100 px graph at 48 kHz
 * and 15 px at 44.1 (Ivan, 2026-10-06: "it needs to be always in the right
 * position matching the real freq").
 *
 * The graphs' own axis only until anything has been measured, when there is
 * nothing falling to misplace.
 */
export const useSilentFloor = (
  live: readonly IChartPointData[],
): readonly IChartPointData[] => {
  const [floor, setFloor] =
    useState<readonly IChartPointData[]>(GRAPH_SILENT_POINTS);
  // Kept from one render to the next, which only state can do across the
  // silence that empties `live`: set during render, React's own pattern for
  // state that follows a prop, so the frame that changes the axis is never
  // drawn against the old one.
  if (live.length > 0 && !isSameAxis(floor, live)) {
    setFloor(silenceOn(live));
  }
  return floor;
};
