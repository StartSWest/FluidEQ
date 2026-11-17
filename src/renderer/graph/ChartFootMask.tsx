/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useChartIdOf } from './chartIds';
import { FOOT_FADE_OPACITY } from './footFade';

/** Reaches past the svg on every side: the curves' halos run past its edges. */
const REACH = 100000;

/**
 * The chart's drawing faded out at the graph's foot (`footFade.ts`): the grid,
 * the coverage columns and the curves with their fills are drawn through this
 * mask; the pins, the band labels and handles, the scales and the frequency
 * names are drawn after it, outside it, and stay whole. Luminance: white
 * keeps, black takes away.
 */
const ChartFootMask = ({
  foot,
  height,
}: {
  /** The graph's foot, in the svg's pixels. */
  foot: number;
  /** How far over the foot the fade begins (`footFadeHeight`). */
  height: number;
}) => {
  const idOf = useChartIdOf();
  const last = FOOT_FADE_OPACITY.length - 1;
  return (
    <mask
      id={idOf('chart-foot-mask')}
      maskUnits="userSpaceOnUse"
      x={-REACH}
      y={-REACH}
      width={REACH * 2}
      height={REACH + foot}
    >
      <linearGradient
        id={idOf('chart-foot-mask-curve')}
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        {FOOT_FADE_OPACITY.map((opacity, step) => (
          <stop
            // The stops never change; their place is their identity.
            // eslint-disable-next-line react/no-array-index-key
            key={step}
            offset={`${(step * 100) / last}%`}
            stopColor="#fff"
            stopOpacity={opacity}
          />
        ))}
      </linearGradient>
      <rect
        x={-REACH}
        y={-REACH}
        width={REACH * 2}
        height={REACH + foot - height}
        fill="#fff"
      />
      <rect
        x={-REACH}
        y={foot - height}
        width={REACH * 2}
        height={height}
        fill={`url(#${idOf('chart-foot-mask-curve')})`}
      />
    </mask>
  );
};

export default ChartFootMask;
