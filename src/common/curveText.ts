/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { TImportEars } from './bandEars';
import {
  NO_GAIN_FILTER_TYPES,
  isBandEnabled,
  isBandOnChannel,
  type IFilter,
  type IFiltersMap,
  type IGraphicEqPoint,
} from './constants';

/**
 * Bands as the ParametricEQ text My curves keeps (`myCurves.ts`): what "My EQ
 * now" and "From OPRA" save, written so that reading it back
 * (`readCurveText`) gives the same bands.
 */

/** Two decimals, no trailing zeros: `3.5`, not `3.50`. */
const round = (value: number) => Math.round(value * 100) / 100;

const filterLine = (filter: IFilter, index: number): string => {
  const head = `Filter ${index + 1}: ON ${filter.type} Fc ${round(filter.frequency)} Hz`;
  const quality = `Q ${round(filter.quality)}`;
  return NO_GAIN_FILTER_TYPES.includes(filter.type)
    ? `${head} ${quality}`
    : `${head} Gain ${round(filter.gain)} dB ${quality}`;
};

/**
 * A curve's text: its preamp, then its bands low to high, or its GraphicEQ
 * points when it was published as points — those are the curve, and the
 * bands beside them only the editor's projection of it.
 *
 * Bands switched off are left out: they are not heard, and a curve is what is
 * heard.
 */
export const curveTextOf = ({
  preAmp,
  filters,
  graphicEq,
}: {
  preAmp: number;
  filters: IFiltersMap;
  graphicEq?: readonly IGraphicEqPoint[];
}): string => {
  const lines = [`Preamp: ${round(preAmp)} dB`];
  if (graphicEq && graphicEq.length > 0) {
    lines.push(
      `GraphicEQ: ${graphicEq
        .map((point) => `${round(point.frequency)} ${round(point.gain)}`)
        .join('; ')}`,
    );
  } else {
    Object.values(filters)
      .filter(isBandEnabled)
      .sort((a, b) => a.frequency - b.frequency)
      .forEach((filter, index) => lines.push(filterLine(filter, index)));
  }
  return lines.join('\n');
};

/** A bell or shelf at 0 dB: there, and heard as nothing. */
const isFlat = (filter: IFilter) =>
  filter.gain === 0 && !NO_GAIN_FILTER_TYPES.includes(filter.type);

/**
 * Your EQ as one curve for `ears`: the bands heard there, the flat ones of a
 * fixed layout left out — fifteen lines where eight say anything is a curve
 * nobody can read. A curve keeps one set of bands, so "both ears" holds the
 * bands on both and leaves out any band kept to one ear — counted, so the
 * person is told and can save each ear as a curve of its own, which then
 * plays back exactly.
 */
export const eqCurveText = (
  preAmp: number,
  filters: IFiltersMap,
  ears: TImportEars,
): { text: string; leftOut: number; bands: number } => {
  const heard = Object.values(filters).filter(
    (filter) =>
      !isFlat(filter) &&
      (ears === 'both'
        ? filter.channel === undefined
        : isBandOnChannel(filter, ears)),
  );
  const kept: IFiltersMap = Object.fromEntries(
    heard.map((filter) => [filter.id, filter]),
  );
  return {
    text: curveTextOf({ preAmp, filters: kept }),
    leftOut:
      ears === 'both'
        ? Object.values(filters).filter(
            (filter) => filter.channel !== undefined && !isFlat(filter),
          ).length
        : 0,
    bands: heard.filter(isBandEnabled).length,
  };
};
