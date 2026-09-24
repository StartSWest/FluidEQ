/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useState } from 'react';
import type { AxisScale, NumberValue } from 'd3';
import { IChartLiveOffset } from './ChartController';

/**
 * The element the output curve is drawn inside, moved by the live offset.
 *
 * Written straight to the element, the way the meters write their levels: a
 * preamp that ramps at display rate is a moving picture, not a change to the
 * tuning, and taking it through React rebuilt every curve and started a new
 * path transition for each value. The offset is a constant in decibels, so
 * the same distance in pixels at every frequency — a translation is exact.
 *
 * The scale does not follow it (`gainScale` holds the EQ's ±20 dB): a preamp
 * deep enough takes the output curve off the bottom of the plot.
 */
const useLiveCurveGroup = (
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

export default useLiveCurveGroup;
