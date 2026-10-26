/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import type { ScaleLinear, ScaleLogarithmic } from 'd3';
import GridLine from '../graph/GridLine';
import {
  FREQUENCY_MAJOR_TICKS,
  FREQUENCY_MINOR_TICKS,
  MINOR_RULE_INK,
  liveLevelTicksFor,
} from '../graph/graphPaper';
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
 * The main graph's rules under a measuring view in the amp's top panel: the
 * same rules in the same ink, drawn by the same component, and faint
 * (`_miniPlayerHero.scss`) — the rules without their numbers (`paperRules`).
 *
 * Unanimated, unlike the main graph's: a scale easing into place behind a
 * change of size reads as the paper lagging the picture.
 */
const PlayerPaper = ({
  width,
  height,
  paper,
  frequency,
  level,
}: IPlayerPaperProps) => {
  // Every level rule but the one along the panel's top edge, which read as a
  // line ruled across the panel under the keys (Ivan, 2026-10-25: "don't
  // show a top line on the graph").
  const levelTicks = useMemo(
    () => liveLevelTicksFor(level).filter((tick) => level(tick) > 1),
    [level],
  );

  return (
    <svg
      className="player-hero__paper"
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
            size={height}
            transform={`translate(0, ${height})`}
            disableAnimation
          />
          {/* The decades run the whole height, fading out at the top
              (`_miniPlayerHero.scss`); what lies between them stops short at
              the foot, as on the main graph. */}
          <GridLine
            type="vertical"
            scale={frequency}
            tickValues={FREQUENCY_MINOR_TICKS}
            size={Math.max(0, height - 10)}
            transform={`translate(0, ${height - 10})`}
            color={MINOR_RULE_INK}
            disableAnimation
          />
        </>
      )}
      {paper.level && (
        <GridLine
          type="horizontal"
          scale={level}
          tickValues={levelTicks}
          size={width}
          transform="translate(0, 0)"
          disableAnimation
        />
      )}
    </svg>
  );
};

export default PlayerPaper;
