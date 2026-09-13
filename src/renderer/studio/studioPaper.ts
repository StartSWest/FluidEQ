/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useSyncExternalStore } from 'react';
import type { ScaleLinear, ScaleLogarithmic } from 'd3';
import type { IScenePack } from 'common/scenePacks';
import {
  frequencyScale,
  gainScale,
  type IMarginLike,
} from '../graph/ChartController';
import {
  frequencyLabelTicksFor,
  getAxisPadding,
  liveLevelScaleFor,
  liveLevelTicksFor,
  sceneSpectrumRectFor,
} from '../graph/graphPaper';
import {
  GRID_BOTTOM_MARGIN,
  GRID_SIDE_MARGIN,
  ONE_ROW_CONTROLS_HEIGHT,
  plotTopMargin,
} from '../graph/plotMargins';
import { createFlagSetting } from '../utils/graphStorage';
import type { IStudioWave } from './studioWave';

/**
 * The graph's grid, laid over a scene on the Studio's stage.
 *
 * Not a picture of a grid: the graph's own gutters, scales and tick lists
 * (`graphPaper.ts`) worked out for the stage's size, and the band the scene
 * is handed moved into those gutters exactly as the graph moves it when its
 * grid is shown. So a line on the stage is where that line is on the graph,
 * and a peak's height against the level scale reads the same on both.
 *
 * The graph keeps headroom above the plot for its controls strip, measured
 * from the strip. The stage has no strip, so it keeps the headroom a strip of
 * one row gives the graph.
 */

export interface IStudioPaper {
  /** Where the ruled drawing starts inside the stage, as on the graph card. */
  margins: IMarginLike;
  /** The gutters the scales' labels live in, inside that drawing. */
  padding: IMarginLike;
  width: number;
  height: number;
  frequency: ScaleLogarithmic<number, number>;
  gain: ScaleLinear<number, number>;
  level: ScaleLinear<number, number>;
  levelTicks: number[];
  /** The decades named along the bottom: those that fit side by side. */
  frequencyLabels: number[];
  /** The band the scene is handed, `[left, right, bottom, top]`. */
  spectrumRect: readonly [number, number, number, number];
}

export const studioPaper = (
  width: number,
  height: number,
  pack: Pick<IScenePack, 'spectrumRange'>,
  wave: IStudioWave,
): IStudioPaper => {
  const margins: IMarginLike = {
    top: plotTopMargin(false, ONE_ROW_CONTROLS_HEIGHT),
    right: GRID_SIDE_MARGIN,
    bottom: GRID_BOTTOM_MARGIN,
    left: GRID_SIDE_MARGIN,
  };
  const padding = getAxisPadding(false);
  const drawnWidth = Math.max(width - margins.left - margins.right, 0);
  const drawnHeight = Math.max(height - margins.top - margins.bottom, 0);
  const frequency = frequencyScale(drawnWidth, padding.left, padding.right);
  const gain = gainScale(drawnHeight, padding.top, padding.bottom);
  const level = liveLevelScaleFor({
    gain,
    spectrumRange: pack.spectrumRange,
    liveCurve: { heightScale: wave.height, verticalPosition: wave.position },
    height,
    marginTop: margins.top,
  });
  return {
    margins,
    padding,
    width: drawnWidth,
    height: drawnHeight,
    frequency,
    gain,
    level,
    levelTicks: liveLevelTicksFor(level),
    frequencyLabels: frequencyLabelTicksFor(frequency),
    spectrumRect: sceneSpectrumRectFor({
      frequency,
      level,
      margins,
      width,
      height,
    }),
  };
};

/**
 * Whether the stage shows the graph's grid. Off at first, as the Studio has
 * always shown a scene; remembered, because somebody measuring a wave wants
 * the ruler still there on the next project.
 */
const gridSetting = createFlagSetting('fluideq.studioGrid', false);

export const setStudioGridShown = (next: boolean) => gridSetting.set(next);
export const useStudioGridShown = () =>
  useSyncExternalStore(gridSetting.subscribe, gridSetting.get, () => false);
