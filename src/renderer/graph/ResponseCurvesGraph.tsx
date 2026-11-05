/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { liveEnginePreamp } from '../utils/enginePreamp';
import { useGraphGridHidden, useHiddenCurves } from '../utils/graphStyle';
import Chart, { ChartDimensions } from './Chart';
import {
  GRID_BOTTOM_MARGIN,
  GRID_SIDE_MARGIN,
  plotTopMargin,
} from './plotMargins';
import shownCurves from './shownCurves';
import useResponseCurves from './useResponseCurves';

interface IResponseCurvesGraphProps {
  className?: string;
  ariaLabel: string;
}

/**
 * Every layer's curve as the main graph draws it — the same curves, colours,
 * scale and grid, the View menu's hidden ones left off — in a box of its
 * own, without the live wave, the band handles or the visualizers. For a
 * page that is about the layers, so they can be seen where they are chosen
 * (the Gaming Lab's Curve stage; Ivan, 2026-11-02: "same as in graph we do
 * on main just copy that").
 *
 * A picture of the sound on now and nothing to operate: it reads no audio,
 * so it costs nothing while the music plays and nothing moves on it but the
 * curves when a layer changes.
 */
const ResponseCurvesGraph = ({
  className,
  ariaLabel,
}: IResponseCurvesGraphProps) => {
  const { appliedChartData, isPreampLive } = useResponseCurves();
  const hiddenCurves = useHiddenCurves();
  const isGridHidden = useGraphGridHidden();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // The box's own size, heard on the frame it changes.
  useLayoutEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const measure = () =>
      setSize((was) =>
        was.width === element.clientWidth && was.height === element.clientHeight
          ? was
          : { width: element.clientWidth, height: element.clientHeight },
      );
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  const data = useMemo(
    () => shownCurves(appliedChartData, hiddenCurves),
    [appliedChartData, hiddenCurves],
  );
  const dimensions: ChartDimensions = {
    ...size,
    margins: {
      top: plotTopMargin(isGridHidden),
      right: isGridHidden ? 0 : GRID_SIDE_MARGIN,
      bottom: isGridHidden ? 0 : GRID_BOTTOM_MARGIN,
      left: isGridHidden ? 0 : GRID_SIDE_MARGIN,
    },
  };
  const isMeasured = size.width > 0 && size.height > 0;

  return (
    <div
      ref={box}
      className={`graph-plot response-curves-graph${
        isMeasured ? ' is-measured' : ''
      }${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Mounted before it has a size, as the main graph's is: the curves
          take their first measured size at once (`scaleRange.ts`) and the
          plot fades in whole, where a chart mounted on its size drew every
          curve on from the left each time the stage opened. */}
      <Chart
        data={data}
        dimensions={dimensions}
        outputOffset={isPreampLive ? liveEnginePreamp : undefined}
        isLiveOutputForeground={false}
      />
    </div>
  );
};

export default ResponseCurvesGraph;
