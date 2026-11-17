/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useChartIdOf } from './chartIds';

/** The fade's height where the plot has room for all of it (the mockup's). */
export const FOOT_FADE_HEIGHT = 56;

/**
 * Smootherstep's alpha at each tenth of the way down: eased at both ends, so
 * no band of it can be picked out where it starts or where it lands. Two
 * stops, a straight ramp, left a visible line at the top.
 */
const STOPS = [0, 0.02, 0.07, 0.16, 0.28, 0.43, 0.58, 0.72, 0.84, 0.93, 1];

/**
 * THE GRAPH SINKS INTO THE PAGE UNDER IT (Ivan, 2026-11-17, "T2 + mínima":
 * "just put a smooth transition, but soft, and it has to work with the flat
 * design"). Over the last 56px of the EQ page's graph everything drawn —
 * its own face, a standard look's bars, wave or spectrum, a Plus scene, the
 * curves' fills — eases into the colour of the card it meets, so there is no
 * edge where the graph stops and the tab row starts. Flat colour only: no
 * shadow, no glow, no blur.
 *
 * One layer, in the chart's own drawing order: over the picture (the trace's
 * canvas and a scene are behind the svg, the curves are drawn before it) and
 * under everything read or grabbed — the genre pins, the band labels and
 * handles, the scales and the frequency names, which stay crisp on it.
 *
 * It lands on the card exactly: the page's card is `$surface-section`, a
 * translucent face, laid over the window's floor, so the fade is the floor
 * and then that face over it, both on the same curve (`.chart-foot-fade` in
 * `_graphThemeChart.scss`) — the recipe a solid dialog is drawn with.
 *
 * Only under −20 dB: it covers the plot's compressed foot, where the bands
 * never go, and is shortened to it on a short graph rather than reach the
 * scale (`top`).
 */
const ChartFootFade = ({
  width,
  foot,
  top,
}: {
  width: number;
  /** The graph's foot, in the svg's pixels. */
  foot: number;
  /** The highest it may start: the −20 dB line. */
  top: number;
}) => {
  const idOf = useChartIdOf();
  const height = Math.min(FOOT_FADE_HEIGHT, foot - top);
  if (height <= 0 || width <= 0) {
    return null;
  }
  const layers = ['floor', 'card'] as const;
  return (
    <g className="chart-foot-fade" aria-hidden="true" pointerEvents="none">
      <defs>
        {layers.map((layer) => (
          <linearGradient
            key={layer}
            id={idOf(`chart-foot-fade-${layer}`)}
            className={`chart-foot-fade__${layer}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            {STOPS.map((alpha, step) => (
              <stop
                // The stops never change; their place is their identity.
                // eslint-disable-next-line react/no-array-index-key
                key={step}
                offset={`${(step * 100) / (STOPS.length - 1)}%`}
                stopColor="currentColor"
                stopOpacity={alpha}
              />
            ))}
          </linearGradient>
        ))}
      </defs>
      {layers.map((layer) => (
        <rect
          key={layer}
          x={0}
          y={foot - height}
          width={width}
          height={height}
          fill={`url(#${idOf(`chart-foot-fade-${layer}`)})`}
        />
      ))}
    </g>
  );
};

export default ChartFootFade;
