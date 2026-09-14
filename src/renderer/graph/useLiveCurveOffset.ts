/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useMemo, useState } from 'react';
import type { AxisScale, NumberValue } from 'd3';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import {
  IChartCurveData,
  IChartLiveOffset,
  OUTPUT_CURVE_ID,
} from './ChartController';

/**
 * Where a live offset carries the output curve, as a scale extent.
 *
 * The curve is built without the offset, so its points no longer tell the
 * scale how far down a deep preamp takes it; this does, in whole decibels and
 * outward, and only changes state when that answer changes. Within the
 * graph's own ±20 dB it is always ±20 dB, so the offset moving on every frame
 * of a loud passage costs no render at all.
 */
export const useLiveCurveExtent = (
  scaleData: readonly IChartCurveData[],
  offset: IChartLiveOffset | undefined,
): readonly [number, number] | undefined => {
  const built = useMemo(() => {
    const points =
      scaleData.find((curve) => curve.id === OUTPUT_CURVE_ID)?.line.points ??
      [];
    if (points.length === 0) {
      return undefined;
    }
    let low = Infinity;
    let high = -Infinity;
    points.forEach(({ y }) => {
      low = Math.min(low, y);
      high = Math.max(high, y);
    });
    return [low, high] as const;
  }, [scaleData]);

  const [extent, setExtent] = useState<readonly [number, number]>();

  useLayoutEffect(() => {
    if (!offset || !built) {
      setExtent(undefined);
      return undefined;
    }
    const measure = () => {
      const gain = offset.read();
      const low = Math.min(MIN_GAIN, Math.floor(built[0] + gain));
      const high = Math.max(MAX_GAIN, Math.ceil(built[1] + gain));
      setExtent((previous) =>
        previous?.[0] === low && previous[1] === high ? previous : [low, high],
      );
    };
    measure();
    return offset.subscribe(measure);
  }, [built, offset]);

  return extent;
};

/**
 * The element the output curve is drawn inside, moved by the live offset.
 *
 * Written straight to the element, the way the meters write their levels: a
 * preamp that ramps at display rate is a moving picture, not a change to the
 * tuning, and taking it through React rebuilt every curve and started a new
 * path transition for each value. The offset is a constant in decibels, so
 * the same distance in pixels at every frequency — a translation is exact.
 */
export const useLiveCurveGroup = (
  offset: IChartLiveOffset | undefined,
  gainScale: AxisScale<NumberValue>,
): ((group: SVGGElement | null) => void) => {
  const [group, setGroup] = useState<SVGGElement | null>(null);

  useLayoutEffect(() => {
    if (!offset || !group) {
      return undefined;
    }
    const place = () => {
      const shift = (gainScale(offset.read()) ?? 0) - (gainScale(0) ?? 0);
      group.setAttribute('transform', `translate(0 ${shift})`);
    };
    place();
    return offset.subscribe(place);
  }, [gainScale, group, offset]);

  return setGroup;
};
