/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { GraphStyle } from 'common/graphStyles';
import { PANEL_MIN_DEPTH, PANEL_MIN_WIDTH } from '../analysis/loudnessPanel';

export interface IDrawnSize {
  width: number;
  height: number;
  /** How much larger than the plate it is drawn; shrunk back by as much. */
  scale: number;
}

/**
 * The size a look is drawn at for a plate of `box`: the plate's own, unless
 * the look cannot draw itself that small. Stereo & loudness draws nothing
 * in a box under its panel's floor (`loudnessPanel.ts`) - a blank tile, at
 * rest and live - so it is drawn at that floor and shrunk to the plate. The
 * picker's live tile and the shipped stills' generator (`scripts/look-stills`)
 * both ask here, so a still is the drawing the tile makes.
 */
export const drawnSizeOf = (
  style: GraphStyle,
  box: { width: number; height: number },
): IDrawnSize => {
  if (style !== 'loudness' || box.width === 0 || box.height === 0) {
    return { ...box, scale: 1 };
  }
  const scale = Math.max(
    1,
    PANEL_MIN_WIDTH / box.width,
    PANEL_MIN_DEPTH / box.height,
  );
  return {
    width: Math.ceil(box.width * scale),
    height: Math.ceil(box.height * scale),
    scale,
  };
};
