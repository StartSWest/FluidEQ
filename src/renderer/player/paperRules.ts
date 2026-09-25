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
import type { IMarginLike } from '../graph/ChartController';

/**
 * The ruled paper under a measuring view in the player's own visualizer deck
 * (Ivan, 2026-09-24: "we need to show the grid on standard viz on mini player
 * in that 2 row mode").
 *
 * The main graph's grid, with the main graph's rules about it: shown while
 * the graph's grid switch is on, and each scale only where it names what is
 * drawn (`frequencyAxisSuitsLook`, `levelAxisSuitsLook`). Only on the
 * measuring views: a scene is a picture, and the deck gives it the whole
 * surface as before. In full screen too (Ivan, 2026-09-24: "the grid also in
 * fullscreen for those meter ones"): a measuring view on the whole screen is
 * still an instrument, and its numbers are what it is there to be read by.
 */
export interface IPlayerPaper {
  /** Frequencies along the bottom, with their rules. */
  frequency: boolean;
  /** The analyser's decibels down the right, with their rules. */
  level: boolean;
  /** The gutters the labels stand in, around the drawing. */
  padding: IMarginLike;
}

/**
 * Room for the labels, in CSS pixels.
 *
 * The bottom gutter is the main graph's own (`graphPaper.ts`): "10k Hz"
 * under the plot. The right is the main graph's 48 for "-80 dB" and 8 more:
 * the main graph's card keeps its own padding around the plot, and the
 * player's picture runs to the deck's edge, so at 48 the numbers ended
 * against it (Ivan, 2026-09-24: "bit right padding for the numbers of the
 * grid"). The left is half a frequency label, so "10 Hz" is not cut in half
 * at the edge. The top clears the player's strip of controls, which stands
 * 8px down and 26px tall across the whole top of the deck: the level scale's
 * top number sat under Auto.
 */
const FREQUENCY_BOTTOM = 30;
const FREQUENCY_SIDE = 20;
const LEVEL_RIGHT = 56;
const UNDER_STRIP = 44;

// Module constants, so a deck that re-renders keeps the same padding object
// and the scales built from it are not rebuilt every frame.
const BARE: IPlayerPaper = {
  frequency: false,
  level: false,
  padding: { left: 0, top: 0, right: 0, bottom: 0 },
};
const FREQUENCY_ONLY: IPlayerPaper = {
  frequency: true,
  level: false,
  padding: {
    left: FREQUENCY_SIDE,
    top: 0,
    right: FREQUENCY_SIDE,
    bottom: FREQUENCY_BOTTOM,
  },
};
const LEVEL_ONLY: IPlayerPaper = {
  frequency: false,
  level: true,
  padding: { left: 0, top: UNDER_STRIP, right: LEVEL_RIGHT, bottom: 0 },
};
const BOTH: IPlayerPaper = {
  frequency: true,
  level: true,
  padding: {
    left: FREQUENCY_SIDE,
    top: UNDER_STRIP,
    right: LEVEL_RIGHT,
    bottom: FREQUENCY_BOTTOM,
  },
};

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
