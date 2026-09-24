/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TGraphView } from '../utils/graphViewSettings';

/**
 * Where a double-click on the plot takes the graph.
 *
 * From the pane, a double-click fills the screen and Ctrl+double-click (⌘ on
 * a Mac) fills the window, the two larger views Ctrl+F and Ctrl+S reach. From
 * either of those, a double-click comes back to the pane: one gesture in and
 * the same one out, whichever way in was taken. It used to toggle full screen
 * alone, so a double-click on the expanded graph went on up to full screen
 * rather than back (Ivan, 2026-09-23: "from expanded if I do double click it
 * needs to go back to normal graph view", "if graph normal and double click
 * with control pressed it goes to expanded mode").
 */
const viewAfterPlotDoubleClick = (
  current: TGraphView,
  withModifier: boolean,
): TGraphView => {
  if (current !== 'normal') {
    return 'normal';
  }
  return withModifier ? 'expanded' : 'fullscreen';
};

export default viewAfterPlotDoubleClick;
