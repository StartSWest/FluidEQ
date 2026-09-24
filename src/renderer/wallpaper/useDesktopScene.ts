/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import { openWallpaperDialog } from './wallpaperDialogs';
import { useWallpaperState } from './wallpaperStore';

export interface IDesktopScene {
  /** This scene is the background of a monitor that has not failed. */
  onDesktop: boolean;
  /** What the control is called, which says which of the two it is. */
  label: string;
  /** The dialog that asks which monitors. */
  open: () => void;
}

/**
 * The desktop background for a scene on screen, for every control that
 * offers it — the graph's strip, the player's.
 *
 * Nothing where the desktop cannot take a visualizer, or before a scene is
 * drawn. A press opens the dialog that asks which monitors rather than
 * setting anything itself: quietly replacing every monitor's background is
 * the wrong default on a machine with three.
 */
const useDesktopScene = (
  lookId: string | undefined,
): IDesktopScene | undefined => {
  const { t } = useTranslation();
  const { supported, displays, screens } = useWallpaperState();
  if (lookId === undefined || !supported || displays.length === 0) {
    return undefined;
  }
  const onDesktop = screens.some(
    (screen) => screen.lookId === lookId && screen.phase !== 'error',
  );
  return {
    onDesktop,
    label: t(onDesktop ? 'wallpaper.status.running' : 'wallpaper.action'),
    open: () => openWallpaperDialog(lookId),
  };
};

export default useDesktopScene;
