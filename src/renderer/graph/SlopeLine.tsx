/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type * as d3 from 'd3';
import { type AnimationEvent, useEffect, useRef, useState } from 'react';
import { TILT_PIVOT_HZ } from 'common/graphAnalysis';
import { useTranslation } from '../utils/I18nContext';
import { useGraphAnalyserSlope } from '../utils/graphScaleSettings';
import isOwnAnimationEnd from '../utils/ownAnimationEnd';
import { useChartIdOf } from './chartIds';
import { playSlopeLine, useSlopeLine } from './slopeLineStore';

/** The keyframes it plays: shown, held, faded (`_graphThemeChart.scss`). */
const SHOW = 'chart-slope-line-show';
/** The way out once the legend's row lets it go. */
const LEAVE = 'chart-slope-line-leave';

/**
 * THE ANALYSER'S SLOPE, DRAWN FOR A MOMENT (Ivan, 2026-11-17: "when
 * switching the analyser slope ... show the line for a few seconds and fade";
 * "perhaps we can show the line too when the legend opens"). The straight
 * line the spectrum is tipped by, through the pivot (1 kHz, the EQ's 0 dB
 * line), rising so many decibels an octave on the analyser's own scale and
 * named at its end; Off draws it flat, so a change reads either way.
 *
 * It plays on every change of the slope however it was made — a press in
 * the View menu, its keys, a reset — because it watches the setting itself,
 * and on the legend's say (`slopeLineStore.ts`). Its timing is its
 * animation's; it is taken away on that animation's own end, so a new play
 * mid-fade starts it over. Drawn under the pins and the band handles, and it
 * moves no scale.
 */
const SlopeLine = ({
  xScale,
  levelScale,
  pivotY,
  left,
  right,
}: {
  xScale: d3.AxisScale<d3.NumberValue>;
  /** The analyser's level scale, in the svg's pixels. */
  levelScale: d3.ScaleLinear<number, number>;
  /** Where the pivot stands: the EQ's 0 dB line. */
  pivotY: number;
  left: number;
  right: number;
}) => {
  const { t } = useTranslation();
  const idOf = useChartIdOf();
  const slope = useGraphAnalyserSlope();
  const { play, isHeld } = useSlopeLine();

  // A change of the slope plays it; the first value read is not a change.
  const shownSlope = useRef(slope);
  useEffect(() => {
    if (shownSlope.current !== slope) {
      shownSlope.current = slope;
      playSlopeLine();
    }
  }, [slope]);

  // What is on screen: a play under way (its number), held, leaving, or
  // nothing.
  const [shown, setShown] = useState<number | 'held' | 'leaving'>();
  const lastPlay = useRef(play);
  useEffect(() => {
    if (lastPlay.current !== play) {
      lastPlay.current = play;
      setShown(play);
    }
  }, [play]);
  useEffect(() => {
    if (isHeld) {
      setShown('held');
      return;
    }
    setShown((now) => (now === 'held' ? 'leaving' : now));
  }, [isHeld]);

  if (shown === undefined) {
    return null;
  }
  const pxPerDb =
    Math.abs(Number(levelScale(0)) - Number(levelScale(-10))) / 10;
  const yAt = (x: number) => {
    const hz = Number(
      (xScale as unknown as { invert: (pixel: number) => number }).invert(x),
    );
    return pivotY - slope * Math.log2(hz / TILT_PIVOT_HZ) * pxPerDb;
  };
  const label =
    slope === 0
      ? t('look.off')
      : t('graph.analyserSlopeValue', { value: String(slope) });
  const labelX = right - 8;
  const animation = typeof shown === 'number' ? SHOW : LEAVE;
  return (
    <g
      // A new play mounts a new group, which starts its animation over.
      key={String(shown)}
      className={`chart-slope-line${shown === 'held' ? ' is-held' : ''}${
        shown === 'leaving' ? ' is-leaving' : ''
      }`}
      aria-hidden="true"
      pointerEvents="none"
      onAnimationEnd={(event: AnimationEvent<SVGGElement>) => {
        if (isOwnAnimationEnd(event, animation)) {
          setShown(undefined);
        }
      }}
    >
      {/* Inside the plot, as the curves are: a steep slope runs off its
          top and its foot. */}
      <line
        x1={left}
        y1={yAt(left)}
        x2={right}
        y2={yAt(right)}
        clipPath={`url(#${idOf('chart-clip-path')})`}
      />
      <circle cx={Number(xScale(TILT_PIVOT_HZ))} cy={pivotY} r={3} />
      <text x={labelX} y={Math.max(14, yAt(labelX) - 8)} textAnchor="end">
        {label}
      </text>
    </g>
  );
};

export default SlopeLine;
