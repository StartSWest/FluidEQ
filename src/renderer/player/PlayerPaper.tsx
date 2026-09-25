/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import type { ScaleLinear, ScaleLogarithmic } from 'd3';
import Axis from '../graph/Axis';
import { frequencyTickFormat } from '../graph/ChartController';
import GridLine from '../graph/GridLine';
import {
  FREQUENCY_MAJOR_TICKS,
  FREQUENCY_MINOR_TICKS,
  MINOR_RULE_INK,
  frequencyLabelTicksFor,
  liveLevelTicksFor,
} from '../graph/graphPaper';
import { graphLevelTickFormat } from '../graph/liveGraphBand';
import type { IPlayerPaper } from './paperRules';

interface IPlayerPaperProps {
  width: number;
  height: number;
  paper: IPlayerPaper;
  frequency: ScaleLogarithmic<number, number>;
  /** The analyser's scale, moved to where the watched wave is drawn. */
  level: ScaleLinear<number, number>;
}

/**
 * The main graph's grid under a measuring view in the player: the same rules,
 * the same labels and the same ink, drawn by the same components, so a reading
 * in the player is read against exactly what it is read against in the app.
 *
 * Unanimated, unlike the main graph's: the deck changes size whenever its
 * divider is dragged, and a scale easing into place behind a drag reads as
 * the paper lagging the picture.
 */
const PlayerPaper = ({
  width,
  height,
  paper,
  frequency,
  level,
}: IPlayerPaperProps) => {
  const { left, top, right, bottom } = paper.padding;
  const plotRight = width - right;
  const plotBottom = height - bottom;
  const frequencyLabels = useMemo(
    () => frequencyLabelTicksFor(frequency),
    [frequency],
  );
  const levelTicks = useMemo(() => liveLevelTicksFor(level), [level]);

  return (
    <svg
      className="player-vis__paper"
      width={width}
      height={height}
      aria-hidden
    >
      {paper.frequency && (
        <>
          <GridLine
            type="vertical"
            scale={frequency}
            tickValues={FREQUENCY_MAJOR_TICKS}
            size={plotBottom - top}
            transform={`translate(0, ${plotBottom})`}
            disableAnimation
          />
          {/* Inset top and bottom as the main graph's are: the decades run
              the full height, what lies between them stops short. */}
          <GridLine
            type="vertical"
            scale={frequency}
            tickValues={FREQUENCY_MINOR_TICKS}
            size={Math.max(0, plotBottom - top - 20)}
            transform={`translate(0, ${plotBottom - 10})`}
            color={MINOR_RULE_INK}
            disableAnimation
          />
          <Axis
            type="bottom"
            scale={frequency}
            transform={`translate(0, ${plotBottom})`}
            tickValues={frequencyLabels}
            tickFormat={frequencyTickFormat}
            disableAnimation
          />
        </>
      )}
      {paper.level && (
        <>
          <GridLine
            type="horizontal"
            scale={level}
            tickValues={levelTicks}
            size={plotRight - left}
            transform={`translate(${left}, 0)`}
            disableAnimation
          />
          <Axis
            type="right"
            scale={level}
            transform={`translate(${plotRight}, 0)`}
            tickValues={levelTicks}
            tickFormat={graphLevelTickFormat}
            disableAnimation
          />
        </>
      )}
    </svg>
  );
};

export default PlayerPaper;
