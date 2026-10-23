/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app } from 'electron';

/**
 * FluidEQ's icon in the Dock and the app switcher of a development build.
 *
 * A Mac draws an app from the bundle it runs from, and in development that
 * is Electron's own `Electron.app`, so the Dock showed Electron's atom. A
 * release is already right: electron-builder puts `icon.icns` in FluidEQ's own
 * bundle, and this does nothing there.
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
  app.dock.setIcon(iconPath);
};

export default showOwnIconInDevDock;
