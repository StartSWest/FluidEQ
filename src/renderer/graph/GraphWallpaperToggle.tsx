/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import useDesktopScene from '../wallpaper/useDesktopScene';
import DesktopGlyph from '../wallpaper/DesktopGlyph';

interface IGraphWallpaperToggleProps {
  /** The Plus scene on the graph, which is what would go on the desktop. */
  lookId: string;
}

/**
 * The desktop background, on the graph beside the scene it would show.
 *
 * Icon only, like the tint and lighting switches in the same row, which is the
 * first thing to run out of width. Lit while this scene is the background of
 * at least one monitor; either way it opens the dialog that asks which
 * monitors (`useDesktopScene`). The player's visualizer strip carries the same
 * control, in the same place in the same row.
 */
export default function GraphWallpaperToggle({
  lookId,
}: IGraphWallpaperToggleProps) {
  const desktop = useDesktopScene(lookId);
  if (!desktop) {
    return null;
  }
  return (
    <button
      type="button"
      className="graph-look-step graph-look-step--toggle graph-wallpaper"
      aria-pressed={desktop.onDesktop}
      aria-label={desktop.label}
      title={desktop.label}
      onClick={desktop.open}
    >
      <DesktopGlyph />
    </button>
  );
}
