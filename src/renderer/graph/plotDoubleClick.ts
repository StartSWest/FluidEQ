/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TGraphView } from '../utils/graphViewSettings';

/**
 * Where a double-click on the plot takes the graph.
 *
 * From the pane, a double-click fills the screen; from full screen it comes
 * back to the pane: one gesture in and the same one out. The Ctrl+double-click
 * into the Expanded view went with that view (Ivan, 2026-11-16).
 */
const viewAfterPlotDoubleClick = (current: TGraphView): TGraphView =>
  current === 'normal' ? 'fullscreen' : 'normal';

export default viewAfterPlotDoubleClick;
