/* FluidEQ — GPL-3.0-or-later */

import type { BrowserWindow } from 'electron';
import { revealMainWindow } from './tray';

/** A Dock click opens the existing window even when Close only hid it. */
export default function createAppActivation({
  getMainWindow,
  createMainWindow,
}: {
  getMainWindow: () => BrowserWindow | null;
  createMainWindow: () => Promise<void>;
}) {
  let opening: Promise<void> | undefined;
  return async () => {
    const window = getMainWindow();
    if (!opening && window && !window.isDestroyed()) {
      // The Mac close button keeps the window alive for background audio.
      // Checking only for null left a Dock click with nothing to do.
      revealMainWindow(getMainWindow);
      return;
    }
    opening ??= createMainWindow().finally(() => {
      opening = undefined;
    });
    await opening;
    revealMainWindow(getMainWindow);
  };
}
