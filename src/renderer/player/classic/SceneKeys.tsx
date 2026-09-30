/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import GraphWallpaperToggle from '../../graph/GraphWallpaperToggle';
import LightingToggle from '../../graph/LightingToggle';
import SceneTintMenu from '../../graph/SceneTintMenu';

/**
 * The scene's three switches, in the top right corner of the equalizer's
 * screen while a Plus visualizer plays behind its curve: what it does to the
 * window, the desk lights, and the desktop background (Ivan, 2026-09-24: "in
 * single row also show ambient icon and keyboard lighting icon in same order
 * always"). The same three the graph's strip and the two-column player's
 * visualizer carry, in the same order, each the graph's own control and each
 * hiding itself where it can do nothing; here they wear the "Also applied"
 * key's face, so the line reads as one strip with a control at each end
 * (`_miniPlayerEqScreen.scss`).
 *
 * What the scene does to the window opens its menu, as it does on the graph
 * and on the visualizer's bar, and is drawn here as its glyph alone (Ivan,
 * 2026-09-28: "instead of toggling, let's open the menu if the user clicks
 * the ambient icon"): a key walking the four modes kept three of them out of
 * sight, and the Backdrop went by unseen behind it.
 */
const SceneKeys = ({ lookId }: { lookId: string }) => (
  <span className="player-eq-screen__keys">
    <SceneTintMenu />
    <LightingToggle />
    <GraphWallpaperToggle lookId={lookId} />
  </span>
);

export default SceneKeys;
