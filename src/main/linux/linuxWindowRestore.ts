/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { screen, type BrowserWindow } from 'electron';

/**
 * GNOME emits `unmaximize` before applying the app's normal size. Setting
 * the player's bounds in that event was overwritten by the pending restore,
 * and its wide app size was then saved as the player's. Wait for its resize,
 * while the caller still holds its switch in progress. The compositor may
 * clamp the normal size, so it need not equal Electron's remembered bounds.
 */
const unmaximizeLinuxWindow = (win: BrowserWindow): Promise<void> => {
  if (win.isDestroyed() || !win.isMaximized()) {
    return Promise.resolve();
  }
  const normal = win.getNormalBounds();
  const area = screen.getDisplayMatching(win.getBounds()).workArea;
  const width = Math.min(normal.width, area.width);
  const height = Math.min(normal.height, area.height);
  return new Promise((resolve) => {
    const finish = () => {
      win.removeListener('unmaximize', restored);
      win.removeListener('resize', resized);
      win.removeListener('closed', finish);
      resolve();
    };
    const restored = () => {
      if (win.isDestroyed()) {
        finish();
        return;
      }
      const bounds = win.getBounds();
      if (
        !win.isMaximized() &&
        bounds.width === width &&
        bounds.height === height
      ) {
        finish();
      }
    };
    const resized = () => {
      if (win.isDestroyed() || !win.isMaximized()) {
        finish();
      }
    };
    win.on('unmaximize', restored);
    win.on('resize', resized);
    win.once('closed', finish);
    win.unmaximize();
    restored();
  });
};

export default unmaximizeLinuxWindow;
