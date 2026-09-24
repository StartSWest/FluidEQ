/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import useDesktopScene from '../wallpaper/useDesktopScene';
import DesktopGlyph from '../wallpaper/DesktopGlyph';

/**
 * The desktop background, in the top right corner of the equalizer's screen
 * while a Plus visualizer plays behind its curve (Ivan, 2026-09-24): the one
 * surface a one-column player shows the scene on, so the scene's desktop
 * control is on it too, at the other end of the line from "Also applied" and
 * cut from the same key. Lit while the scene is on a monitor. The graph's
 * strip and the two-column player's visualizer carry the same control
 * (`GraphWallpaperToggle`).
 */
const DesktopKey = ({ lookId }: { lookId: string }) => {
  const desktop = useDesktopScene(lookId);
  if (!desktop) {
    return null;
  }
  return (
    <button
      type="button"
      className="player-eq-screen__desktop"
      aria-pressed={desktop.onDesktop}
      aria-label={desktop.label}
      title={desktop.label}
      onClick={desktop.open}
    >
      <DesktopGlyph />
    </button>
  );
};

export default DesktopKey;
