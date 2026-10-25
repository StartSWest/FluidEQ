/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app, nativeImage } from 'electron';
import log from 'electron-log';

/**
 * FluidEQ's icon in the Dock and the app switcher of a development build.
 *
 * A Mac draws an app from the bundle it runs from, and in development that
 * is Electron's own `Electron.app`, so the Dock showed Electron's atom. A
 * release reads the same Mac artwork from its app-icon.icns bundle resource;
 * both leave the transparent surround that keeps its size in line with the
 * other Dock icons. This does nothing to a packaged app's runtime icon.
 *
 * Windows' answer, stamping the icon into the development binary
 * (`name-dev-electron.ts`), is not one here. The bundle is signed and its
 * resources are sealed by that signature, and macOS ties the permission to
 * capture the system's sound to the signature that asked for it. So the icon
 * is said at runtime, which reaches the Dock and the switcher from the moment
 * this runs; the bounce at launch, before it, is still Electron's.
 *
 * Asked of the Dock itself rather than of the platform's name: a platform
 * with no Dock has `app.dock` undefined and nothing to set.
 */
const showOwnIconInDevDock = (iconPath: string): void => {
  if (app.isPackaged || app.dock === undefined) {
    return;
  }
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    log.warn('The development Dock icon could not be read', iconPath);
    return;
  }
  app.dock.setIcon(icon);
};

export default showOwnIconInDevDock;
