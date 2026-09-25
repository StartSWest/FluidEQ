/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ComponentProps,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { ScaleLinear } from 'd3';
import Curve from './Curve';
import {
  IChartCurveData,
  IChartLiveOffset,
  offsetGainScale,
} from './ChartController';
import { AnimationOptionsEnum } from './Line';

interface ILiveOutputCurveProps {
  data: IChartCurveData;
  xScale: ComponentProps<typeof Curve>['xScale'];
  yScale: ScaleLinear<number, number>;
  offset: IChartLiveOffset;
}

/**
 * The output curve under the FluidEQ Engine's automatic preamp, which moves
 * it by the live gain, read and watched outside the chart.
 *
 * It used to be a group translated by the offset, written straight to the
 * element: exact while the EQ's axis was linear, and it had to stay out of
 * the chart's render, where every ramp step rebuilt every curve and started a
 * transition for each (57 renders in five seconds of music, 25 ms apiece).
 * The axis now compresses what lies past ±20 dB (`eqGainScale`), where a
 * translation is wrong by however far the curve reaches in, so the curve is
 * drawn again at each step instead — this component alone, one path, the
 * chart untouched. A step that only moves the preamp lands at once; a new
 * curve still glides in as every other curve does.
 */
const LiveOutputCurve = ({
  data,
  xScale,
  yScale,
  offset,
}: ILiveOutputCurveProps) => {
  const offsetDb = useSyncExternalStore(offset.subscribe, offset.read);
  const shifted = useMemo(
    () => offsetGainScale(yScale, offsetDb),
    [yScale, offsetDb],
  );
  // The curve last put on screen, set once a render is committed: a render
  // that brings another one is a new curve, one that does not is the preamp.
  const committed = useRef<IChartCurveData | undefined>(undefined);
  const isNewCurve = committed.current !== data;
  useEffect(() => {
    committed.current = data;
  }, [data]);
  return (
    <Curve
      data={data}
      xScale={xScale}
      yScale={shifted}
      animation={
        isNewCurve ? AnimationOptionsEnum.LEFT : AnimationOptionsEnum.NONE
      }
    />
  );
};

export default LiveOutputCurve;
