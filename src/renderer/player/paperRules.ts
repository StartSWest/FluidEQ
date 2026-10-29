/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { GraphStyle } from 'common/graphStyles';
import {
  frequencyAxisSuitsLook,
  isAnalysisStyle,
  levelAxisSuitsLook,
} from 'common/graphAnalysis';

export interface IPlayerPaper {
  /** The frequency rules, down the drawing. */
  frequency: boolean;
  /** The analyser's decibel rules, across it. */
  level: boolean;
}

/**
 * The ruled paper under a measuring view in the amp's top panel: the main
 * graph's own rules, faint, and nothing else — no numbers and no gutter round
 * the drawing, which runs to the panel's edges (Ivan, 2026-10-25: "the real
 * graph lines but subtle and no paddings", "no numbers"). The song is read
 * over the picture; the picture is not an instrument to read figures off.
 *
 * The main graph's rules about the grid still hold: shown while the graph's
 * grid switch is on, and each set of rules only where it names what is drawn
 * (`frequencyAxisSuitsLook`, `levelAxisSuitsLook`). Only on the measuring
 * views: a scene is a picture, and the panel gives it the whole surface.
 */
// Module constants, so a panel that re-renders keeps the same object.
const BARE: IPlayerPaper = { frequency: false, level: false };
const FREQUENCY_ONLY: IPlayerPaper = { frequency: true, level: false };
const LEVEL_ONLY: IPlayerPaper = { frequency: false, level: true };
const BOTH: IPlayerPaper = { frequency: true, level: true };

export const playerPaperFor = (
  style: GraphStyle,
  {
    isTrace,
    isGridHidden,
  }: {
    /** The live trace draws the look here, rather than a Plus scene. */
    isTrace: boolean;
    isGridHidden: boolean;
  },
): IPlayerPaper => {
  if (!isTrace || isGridHidden || !isAnalysisStyle(style)) {
    return BARE;
  }
  const frequency = frequencyAxisSuitsLook(style);
  const level = levelAxisSuitsLook(style);
  if (frequency && level) {
    return BOTH;
  }
  if (frequency) {
    return FREQUENCY_ONLY;
  }
  return level ? LEVEL_ONLY : BARE;
};
