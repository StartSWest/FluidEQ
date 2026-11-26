/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { MutableRefObject } from 'react';
import { IFilter, IFiltersMap, isBandEnabled } from 'common/constants';
import { shapeEqFilters, type TBandQ } from 'common/eqShape';
import type { IChartLineDataPointsById } from './ChartController';
import { getDesignedFilterLineData } from './utils';

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
    f1.type === f2.type &&
    isBandEnabled(f1) === isBandEnabled(f2)
  );
};

/**
 * Which design and rate each chart's cached band lines were drawn with, keyed
 * by that chart's own cache so two charts never answer for each other.
 */
const drawnDesign = new WeakMap<MutableRefObject<IFiltersMap>, string>();

export interface IBandLineCache {
  /**
   * Last render's bands and the lines drawn for them, kept across renders.
   *
   * A band's line is expensive and most renders change one band, so the rest
   * are reused rather than recomputed. That makes this a cache with a
   * lifetime, which is why it arrives as refs the component owns: module
   * state would be one cache shared by every chart on screen, and two charts
   * showing different tunings would answer each other's questions.
   */
  prevFilters: MutableRefObject<IFiltersMap>;
  prevFilterLines: MutableRefObject<IChartLineDataPointsById>;
}

/**
 * Each band's own line, as the engine playing builds it — at the width Your
 * EQ's Band Q gives it, matched or on the cookbook, at the output's rate —
 * redrawing only the bands that moved.
 *
 * The width is the one the writer puts in the file (`shapeEqFilters` with
 * `getMainBandQ`, `apoRender.ts`). The line used to be drawn at the band's
 * stored Q while the output curve and the engine widened it, so changing
 * Band Q moved the output curve and left this one where it was (Ivan,
 * 2026-11-26). Band Q changes a bell's width and never its peak, so the line
 * still passes through every handle; the group's strength (Studio, Double)
 * scales the gain and stays the output curve's alone.
 *
 * A band switched off gets no line at all, not a flat one. The EQ curve is
 * the sum over this map, so leaving the band out is what makes the drawing
 * agree with what the engine was told — the same reasoning as a bypassed
 * layer, one band down. Its handle stays on the graph, drawn muted, because
 * it is still a band you can pick up and switch back on.
 */
export const drawBandLines = (
  filters: IFiltersMap,
  shape: TBandQ,
  matched: boolean,
  sampleRate: number | undefined,
  { prevFilters, prevFilterLines }: IBandLineCache,
): IChartLineDataPointsById => {
  const lines: IChartLineDataPointsById = {};
  // The cached lines were drawn for one width rule and one engine's design
  // at one rate: changing Band Q, engines or outputs redraws every band
  // rather than reusing a line of another shape.
  const design = `${shape}:${matched ? 'matched' : 'cookbook'}@${sampleRate ?? '-'}`;
  const redrawAll = drawnDesign.get(prevFilters) !== design;
  drawnDesign.set(prevFilters, design);

  Object.values(filters).forEach((filter) => {
    if (!isBandEnabled(filter)) {
      return;
    }
    lines[filter.id] =
      !redrawAll &&
      filter.id in prevFilters.current &&
      isFilterEqual(filter, prevFilters.current[filter.id])
        ? prevFilterLines.current[filter.id]
        : getDesignedFilterLineData(
            shapeEqFilters([filter], shape)[0],
            matched,
            sampleRate,
          );
  });

  prevFilterLines.current = lines;
  prevFilters.current = filters;
  return lines;
};
