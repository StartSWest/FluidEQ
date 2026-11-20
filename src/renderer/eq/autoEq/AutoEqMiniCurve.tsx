/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import { isBandEnabled } from 'common/constants';
import { getResponseGainAtFrequencies } from 'common/response';
import type { ISongSound } from 'common/songSound';

/**
 * Your EQ's curve the size of a word, for Auto EQ: a song's saved sound in the
 * panel's list of what it holds, and each saved EQ beside its name. 20 Hz to
 * 20 kHz on a log scale, ±12 dB filling the height and anything past it
 * standing at the edge, over a dashed zero.
 */
const CURVE_POINTS = 48;
const FREQUENCIES = Array.from(
  { length: CURVE_POINTS },
  (_, index) => 20 * 1000 ** (index / (CURVE_POINTS - 1)),
);
const CURVE_RANGE_DB = 12;

const curvePath = (
  filters: ISongSound['filters'],
  width: number,
  height: number,
): string => {
  const gains = getResponseGainAtFrequencies(
    { filters: Object.values(filters).filter(isBandEnabled) },
    FREQUENCIES,
  );
  return gains
    .map((gain, index) => {
      const x = (index / (CURVE_POINTS - 1)) * width;
      const clamped = Math.max(-CURVE_RANGE_DB, Math.min(CURVE_RANGE_DB, gain));
      const y = height / 2 - (clamped / CURVE_RANGE_DB) * (height / 2 - 1);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
};

const AutoEqMiniCurve = ({
  filters,
  width,
  height,
  className,
}: {
  filters: ISongSound['filters'];
  width: number;
  height: number;
  className: string;
}) => {
  const path = useMemo(
    () => curvePath(filters, width, height),
    [filters, width, height],
  );
  return (
    <svg
      className={`eq-auto-curve ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <path className="eq-auto-curve__zero" d={`M0 ${height / 2} H${width}`} />
      <path className="eq-auto-curve__line" d={path} />
    </svg>
  );
};

export default AutoEqMiniCurve;
