/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import { openWallpaperDialog } from '../wallpaper/wallpaperDialogs';
import { useWallpaperState } from '../wallpaper/wallpaperStore';

interface IGraphWallpaperToggleProps {
  /** The Plus scene on the graph, which is what would go on the desktop. */
  lookId: string;
}

/**
 * The desktop background, on the graph beside the scene it would show.
 *
 * Icon only, like the tint and lighting switches in the same row, which is the
 * first thing to run out of width. Lit while this scene is the background of
 * at least one monitor. Either way it opens the dialog that asks which
 * monitors, rather than setting anything itself: a press that quietly
 * replaced every monitor's background would be the wrong default on a
 * machine with three. Shown only where the desktop can take a visualizer.
 */
export default function GraphWallpaperToggle({
  lookId,
}: IGraphWallpaperToggleProps) {
  const { t } = useTranslation();
  const { supported, displays, screens } = useWallpaperState();
  if (!supported || displays.length === 0) {
    return null;
  }
  const onDesktop = screens.some(
    (screen) => screen.lookId === lookId && screen.phase !== 'error',
  );
  const label = t(onDesktop ? 'wallpaper.status.running' : 'wallpaper.action');
  return (
    <button
      type="button"
      className="graph-look-step graph-look-step--toggle graph-wallpaper"
      aria-pressed={onDesktop}
      aria-label={label}
      title={label}
      onClick={() => openWallpaperDialog(lookId)}
    >
      <svg viewBox="0 0 16 16" aria-hidden>
        <rect x="1.5" y="2.5" width="13" height="9" rx="1.2" />
        <path d="M5.5 14h5M8 11.5V14" />
      </svg>
    </button>
  );
}
