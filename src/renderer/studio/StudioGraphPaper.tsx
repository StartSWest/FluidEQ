/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import Axis from '../graph/Axis';
import { frequencyTickFormat, gainTickFormat } from '../graph/ChartController';
import GridLine from '../graph/GridLine';
import {
  FREQUENCY_MAJOR_TICKS,
  FREQUENCY_MINOR_TICKS,
  GAIN_AXIS_TICKS,
  GAIN_GRID_TICKS,
  levelTickFormat,
  MINOR_RULE_INK,
  UNITY_RULE_INK,
  UNITY_TICKS,
} from '../graph/graphPaper';
import type { IStudioPaper } from './studioPaper';

/**
 * The graph's rules and scales over the stage, drawn by the graph's own line
 * and axis components in the order and inks the chart draws them.
 *
 * Nothing animates: the chart eases its grid when a curve rescales it, and a
 * stage being resized or sent full screen would otherwise trail its own
 * lines. It takes no pointer, so the stage underneath still takes the double
 * click.
 */
export default function StudioGraphPaper({ paper }: { paper: IStudioPaper }) {
  const { margins, padding, width, height, frequency, gain, level } = paper;
  const plotWidth = Math.max(width - padding.left - padding.right, 0);
  return (
    <svg
      className="studio-paper"
      width={width}
      height={height}
      style={{ left: margins.left, top: margins.top }}
      overflow="visible"
      aria-hidden="true"
      focusable="false"
    >
      <GridLine
        type="vertical"
        scale={frequency}
        tickValues={FREQUENCY_MAJOR_TICKS}
        size={height - padding.bottom}
        transform={`translate(0, ${height - padding.bottom})`}
        disableAnimation
      />
      <GridLine
        type="vertical"
        scale={frequency}
        tickValues={FREQUENCY_MINOR_TICKS}
        size={height - padding.bottom - 20}
        transform={`translate(0, ${height - padding.bottom - 10})`}
        color={MINOR_RULE_INK}
        disableAnimation
      />
      <GridLine
        type="horizontal"
        scale={gain}
        tickValues={GAIN_GRID_TICKS}
        size={plotWidth}
        transform={`translate(${padding.left}, 0)`}
        disableAnimation
      />
      <GridLine
        type="horizontal"
        scale={gain}
        tickValues={UNITY_TICKS}
        size={plotWidth}
        color={UNITY_RULE_INK}
        transform={`translate(${padding.left}, 0)`}
        disableAnimation
      />
      <Axis
        type="left"
        scale={gain}
        transform={`translate(${padding.left}, 0)`}
        tickValues={GAIN_AXIS_TICKS}
        tickFormat={gainTickFormat}
        disableAnimation
      />
      <Axis
        type="right"
        scale={level}
        transform={`translate(${padding.left + plotWidth}, 0)`}
        tickValues={paper.levelTicks}
        tickFormat={levelTickFormat}
        disableAnimation
      />
      <Axis
        type="bottom"
        scale={frequency}
        transform={`translate(0, ${height - padding.bottom})`}
        tickValues={paper.frequencyLabels}
        tickFormat={frequencyTickFormat}
        disableAnimation
      />
    </svg>
  );
}
